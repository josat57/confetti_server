import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import { AppError } from "../utils/AppError.js";
import {
  backfillConversations,
  cleanContent,
  findOrCreateConversation,
  formatConversations,
  formatMessages,
  getParticipantConversation,
  markConversationRead,
  postMessage,
  refreshLastMessage,
  resolveParticipant,
  totalUnread,
} from "../services/conversation.service.js";

/**
 * List messages for planner
 * GET /api/v1/planner/messages
 */
export const listMessages = async (req, res, next) => {
  try {
    const { status, type, event, page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    const query = {
      $or: [{ sender: userId }, { recipient: userId }],
    };

    if (status) query.status = status;
    if (type) query.type = type;
    if (event) query.event = event;

    const messages = await Message.find(query)
      .populate("sender", "firstName lastName email")
      .populate("recipient", "firstName lastName email")
      .populate("event", "name type")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();

    const total = await Message.countDocuments(query);
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      status: { $ne: "read" },
    });

    res.status(200).json({
      status: "success",
      data: {
        messages,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send message
 * POST /api/v1/planner/messages
 */
export const sendMessage = async (req, res, next) => {
  try {
    const { recipient, subject, content, type, event } = req.body;

    if (!recipient || !content) {
      return next(new AppError("Recipient and content are required", 400));
    }

    const text = cleanContent(content);
    const other = await resolveParticipant(recipient);
    if (other._id.toString() === req.user._id.toString()) {
      return next(new AppError("You can't message yourself", 400));
    }

    // Planner messages go into the same thread as the inbox, so both views stay in sync
    const conversation = await findOrCreateConversation(req.user._id, other._id, {
      subject: typeof subject === "string" ? subject.slice(0, 200) : undefined,
    });
    const message = await postMessage({
      conversation,
      sender: req.user._id,
      content: text,
      subject,
      type: type || "direct",
      event: mongoose.isValidObjectId(event) ? event : undefined,
    });

    await message.populate([
      { path: "sender", select: "firstName lastName email" },
      { path: "recipient", select: "firstName lastName email" },
      { path: "event", select: "name type" },
    ]);

    res.status(201).json({
      status: "success",
      data: { message },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get message details
 * GET /api/v1/messages/:id
 */
export const getMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate("sender", "firstName lastName email")
      .populate("recipient", "firstName lastName email")
      .populate("event", "name type")
      .populate("parentMessage");

    if (!message) {
      return next(new AppError("Message not found", 404));
    }

    // Check access (sender/recipient are populated here, so compare their ids)
    const me = req.user._id.toString();
    const senderId = (message.sender?._id || message.sender)?.toString();
    const recipientId = (message.recipient?._id || message.recipient)?.toString();
    if (senderId !== me && recipientId !== me) {
      return next(new AppError("Access denied", 403));
    }

    // Mark as read if recipient is viewing
    if (
      recipientId === me &&
      message.status !== "read"
    ) {
      await message.markAsRead();
    }

    res.status(200).json({
      status: "success",
      data: { message },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark message as read
 * PATCH /api/v1/messages/:id/read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return next(new AppError("Message not found", 404));
    }

    // Only recipient can mark as read
    if (message.recipient.toString() !== req.user._id.toString()) {
      return next(new AppError("Access denied", 403));
    }

    await message.markAsRead();

    res.status(200).json({
      status: "success",
      data: { message },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get conversation between two users
 * GET /api/v1/planner/conversations/:userId
 */
export const getConversation = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId },
      ],
    })
      .populate("sender", "firstName lastName email")
      .populate("recipient", "firstName lastName email")
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      status: "success",
      data: { messages },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete message
 * DELETE /api/v1/messages/:id
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return next(new AppError("Message not found", 404));
    }

    // Only sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
      return next(new AppError("Access denied", 403));
    }

    await message.deleteOne();

    if (message.conversation) {
      const conversation = await Conversation.findById(message.conversation);
      if (conversation) await refreshLastMessage(conversation);
    }

    res.status(200).json({
      status: "success",
      message: "Message deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Conversations (inbox for clients, planners and vendors)
// ---------------------------------------------------------------------------

/**
 * List my conversations, newest first
 * GET /api/v1/messages/conversations
 */
export const listConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await backfillConversations(userId);

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 200);
    const query = { participants: userId };
    if (["active", "archived", "closed"].includes(req.query.status)) query.status = req.query.status;

    const conversations = await Conversation.find(query).sort({ lastMessageAt: -1 }).limit(limit).lean();

    res.status(200).json({
      status: "success",
      data: { conversations: await formatConversations(conversations, userId) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start (or reopen) a conversation with a user or a vendor
 * POST /api/v1/messages/conversations
 * body: { participantId (User or Vendor id), subject?, initialMessage?, relatedBooking?, relatedEvent? }
 */
export const createConversation = async (req, res, next) => {
  try {
    const { participantId, subject, initialMessage, relatedBooking, relatedEvent } = req.body;
    if (!participantId) return next(new AppError("participantId is required", 400));

    const text = initialMessage ? cleanContent(initialMessage) : null;
    const other = await resolveParticipant(participantId);
    if (other._id.toString() === req.user._id.toString()) {
      return next(new AppError("You can't message yourself", 400));
    }

    const context = {};
    if (typeof subject === "string" && subject.trim()) context.subject = subject.trim().slice(0, 200);
    if (mongoose.isValidObjectId(relatedBooking)) context.relatedBooking = relatedBooking;
    if (mongoose.isValidObjectId(relatedEvent)) context.relatedEvent = relatedEvent;

    const conversation = await findOrCreateConversation(req.user._id, other._id, context);
    // An existing thread takes the latest context (e.g. a newer booking)
    if (Object.keys(context).length && !conversation.isNew) {
      conversation.set(context);
      await conversation.save();
    }
    if (text) await postMessage({ conversation, sender: req.user._id, content: text });

    const [formatted] = await formatConversations([conversation.toObject()], req.user._id);
    res.status(201).json({ status: "success", data: { conversation: formatted } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get one conversation
 * GET /api/v1/messages/conversations/:id
 */
export const getConversationById = async (req, res, next) => {
  try {
    const conversation = await getParticipantConversation(req.params.id, req.user._id);
    const [formatted] = await formatConversations([conversation.toObject()], req.user._id);
    res.status(200).json({ status: "success", data: { conversation: formatted } });
  } catch (error) {
    next(error);
  }
};

/**
 * Messages in a conversation, oldest first. Page 1 is the newest `limit` messages.
 * GET /api/v1/messages/conversations/:id/messages?page=&limit=
 */
export const getConversationMessages = async (req, res, next) => {
  try {
    const conversation = await getParticipantConversation(req.params.id, req.user._id);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversation._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversation: conversation._id }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        messages: await formatMessages(messages.reverse(), conversation),
        total,
        page,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message in a conversation
 * POST /api/v1/messages/conversations/:id/messages  body: { content }
 */
export const sendConversationMessage = async (req, res, next) => {
  try {
    const conversation = await getParticipantConversation(req.params.id, req.user._id);
    if (conversation.status === "closed") {
      return next(new AppError("This conversation is closed", 400));
    }
    const text = cleanContent(req.body?.content);

    const message = await postMessage({ conversation, sender: req.user._id, content: text });
    const [formatted] = await formatMessages([message.toObject()], conversation);
    res.status(201).json({ status: "success", data: { message: formatted } });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark every message I received in a conversation as read
 * PATCH /api/v1/messages/conversations/:id/read
 */
export const markConversationAsRead = async (req, res, next) => {
  try {
    const conversation = await getParticipantConversation(req.params.id, req.user._id);
    const result = await markConversationRead(conversation._id, req.user._id);
    res.status(200).json({ status: "success", data: { updated: result.modifiedCount || 0 } });
  } catch (error) {
    next(error);
  }
};

/**
 * Total unread messages across my conversations
 * GET /api/v1/messages/unread-count
 */
export const getUnreadMessageCount = async (req, res, next) => {
  try {
    await backfillConversations(req.user._id);
    const count = await totalUnread(req.user._id);
    res.status(200).json({ status: "success", data: { count } });
  } catch (error) {
    next(error);
  }
};
