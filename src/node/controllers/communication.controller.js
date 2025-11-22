import Message from "../models/message.model.js";
import { AppError } from "../utils/AppError.js";

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

    const message = await Message.create({
      sender: req.user._id,
      recipient,
      subject,
      content,
      type: type || "direct",
      event,
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

    // Check access
    if (
      message.sender.toString() !== req.user._id.toString() &&
      message.recipient.toString() !== req.user._id.toString()
    ) {
      return next(new AppError("Access denied", 403));
    }

    // Mark as read if recipient is viewing
    if (
      message.recipient.toString() === req.user._id.toString() &&
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

    res.status(200).json({
      status: "success",
      message: "Message deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
