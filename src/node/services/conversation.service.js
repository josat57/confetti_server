import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

export const MAX_MESSAGE_LENGTH = 5000;
const PREVIEW_LENGTH = 200;
const USER_FIELDS = "firstName lastName username role status profilePicture";

const ROLE_MAP = { vendor: "vendor", "event-planner": "planner", user: "user", admin: "system" };
const DASHBOARD_BY_ROLE = {
  vendor: "/vendor/dashboard/messages",
  "event-planner": "/planner/dashboard/messages",
  user: "/user/dashboard/messages",
};

const isId = (v) => typeof v === "string" ? mongoose.isValidObjectId(v) : v instanceof mongoose.Types.ObjectId;
const idOf = (v) => (v?._id || v)?.toString();

export const cleanContent = (content) => {
  if (typeof content !== "string" || !content.trim()) {
    throw new AppError("Message content is required", 400);
  }
  const text = content.trim();
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new AppError(`Messages can be at most ${MAX_MESSAGE_LENGTH} characters`, 400);
  }
  return text;
};

/**
 * Resolve a participant id to a User. Accepts a User id, or a Vendor id
 * (the vendor directory and bookings expose Vendor ids), which maps to the vendor's owner.
 */
export const resolveParticipant = async (participantId) => {
  if (!isId(participantId)) throw new AppError("Invalid participant", 400);

  let user = await User.findById(participantId).select(USER_FIELDS).lean();
  if (!user) {
    const vendor = await Vendor.findById(participantId).select("owner").lean();
    if (vendor?.owner) user = await User.findById(vendor.owner).select(USER_FIELDS).lean();
  }
  if (!user || ["suspended", "deleted"].includes(user.status)) {
    throw new AppError("This person can't receive messages", 404);
  }
  return user;
};

/** Find the conversation between two users, creating it if needed (safe under concurrent calls). */
export const findOrCreateConversation = async (userA, userB, extra = {}) => {
  const key = Conversation.keyFor(userA, userB);
  let conversation = await Conversation.findOne({ key });
  if (conversation) return conversation;

  try {
    conversation = await Conversation.create({
      participants: [userA, userB],
      key,
      createdBy: userA,
      lastMessageAt: new Date(),
      ...extra,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    conversation = await Conversation.findOne({ key }); // created by a parallel request
  }

  // Attach earlier messages between the two that predate conversations
  await Message.updateMany(
    {
      conversation: { $exists: false },
      $or: [
        { sender: userA, recipient: userB },
        { sender: userB, recipient: userA },
      ],
    },
    { $set: { conversation: conversation._id } }
  );
  await refreshLastMessage(conversation);
  return conversation;
};

/** Recompute lastMessage from the newest message (after a backfill or a delete). */
export const refreshLastMessage = async (conversation) => {
  const latest = await Message.findOne({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .select("content sender createdAt")
    .lean();
  conversation.lastMessage = latest
    ? { content: latest.content.slice(0, PREVIEW_LENGTH), sender: latest.sender, createdAt: latest.createdAt }
    : undefined;
  conversation.lastMessageAt = latest?.createdAt || conversation.createdAt || new Date();
  await conversation.save();
  return conversation;
};

/**
 * Give threads to messages sent before conversations existed. Cheap when there is nothing to do
 * (one indexed lookup), so it runs before listing conversations or counting unread messages.
 */
export const backfillConversations = async (userId) => {
  const me = new mongoose.Types.ObjectId(userId.toString());
  const orphan = {
    conversation: { $exists: false },
    $or: [{ sender: me }, { recipient: me }],
    $expr: { $ne: ["$sender", "$recipient"] },
  };
  if (!(await Message.exists(orphan))) return;

  const pairs = await Message.aggregate([
    { $match: orphan },
    { $group: { _id: { s: "$sender", r: "$recipient" } } },
    { $limit: 500 },
  ]);
  const others = new Set(
    pairs.map(({ _id }) => (_id.s.toString() === userId.toString() ? _id.r : _id.s).toString())
  );
  for (const other of others) {
    await findOrCreateConversation(me, new mongoose.Types.ObjectId(other));
  }
};

/** Add a message to a conversation, update its preview and notify the recipient. */
export const postMessage = async ({ conversation, sender, content, subject, type, event, attachments }) => {
  const senderId = idOf(sender);
  const recipientId = conversation.participants.map(idOf).find((p) => p !== senderId);
  if (!recipientId) throw new AppError("Access denied", 403);

  // Only notify when this starts a new batch of unread messages, so a burst sends one notification
  const recipientHadUnread = await Message.exists({
    conversation: conversation._id,
    recipient: recipientId,
    status: { $ne: "read" },
  });

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    recipient: recipientId,
    content,
    subject,
    type: type || (conversation.relatedBooking ? "vendor" : "direct"),
    event: event || conversation.relatedEvent,
    attachments,
  });

  conversation.lastMessage = {
    content: content.slice(0, PREVIEW_LENGTH),
    sender: senderId,
    createdAt: message.createdAt,
  };
  conversation.lastMessageAt = message.createdAt;
  if (conversation.status !== "active") conversation.status = "active";
  await conversation.save();

  if (!recipientHadUnread) {
    notifyRecipient({ conversation, senderId, recipientId, content }).catch((error) =>
      logger.warn("Message notification failed", { error: error.message, conversation: conversation._id })
    );
  }
  return message;
};

const notifyRecipient = async ({ conversation, senderId, recipientId, content }) => {
  const [sender, recipient] = await Promise.all([
    User.findById(senderId).select(USER_FIELDS).lean(),
    User.findById(recipientId).select("role").lean(),
  ]);
  if (!recipient) return;
  const names = await displayNames([sender].filter(Boolean));
  const senderName = names.get(senderId) || "Someone";
  const base = DASHBOARD_BY_ROLE[recipient.role] || DASHBOARD_BY_ROLE.user;

  await Notification.createNotification({
    recipient: recipientId,
    type: "info",
    kind: "new_message",
    category: "message",
    title: `New message from ${senderName}`,
    message: content.length > 140 ? `${content.slice(0, 137)}…` : content,
    actionUrl: `${base}?c=${conversation._id}`,
    actionText: "Reply",
    data: { conversationId: conversation._id.toString(), senderId },
    relatedEntity: { type: "conversation", id: conversation._id },
  });
};

/** Display names for users: a vendor's business name, otherwise the person's name. */
const displayNames = async (users) => {
  const names = new Map();
  const vendorOwners = users.filter((u) => u.role === "vendor").map((u) => u._id);
  const vendors = vendorOwners.length
    ? await Vendor.find({ owner: { $in: vendorOwners } }).select("owner businessName name logo").lean()
    : [];
  const byOwner = new Map(vendors.map((v) => [v.owner.toString(), v]));

  for (const u of users) {
    const vendor = byOwner.get(u._id.toString());
    const personal = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
    names.set(u._id.toString(), vendor?.businessName || vendor?.name || personal || u.username || "User");
    if (vendor?.logo) names.set(`${u._id}:avatar`, vendor.logo);
  }
  return names;
};

/** Unread counts per conversation for one user. */
const unreadByConversation = async (userId, conversationIds) => {
  if (!conversationIds.length) return new Map();
  const rows = await Message.aggregate([
    {
      $match: {
        recipient: new mongoose.Types.ObjectId(userId.toString()),
        status: { $ne: "read" },
        conversation: { $in: conversationIds },
      },
    },
    { $group: { _id: "$conversation", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.count]));
};

/** Shape conversations the way the frontend's messaging service expects. */
export const formatConversations = async (conversations, userId) => {
  if (!conversations.length) return [];
  const userIds = [...new Set(conversations.flatMap((c) => c.participants.map(idOf)))];
  const users = await User.find({ _id: { $in: userIds } }).select(USER_FIELDS).lean();
  const usersById = new Map(users.map((u) => [u._id.toString(), u]));
  const names = await displayNames(users);
  const unread = await unreadByConversation(userId, conversations.map((c) => c._id));

  return conversations.map((c) => {
    const participants = c.participants.map(idOf).map((id) => {
      const u = usersById.get(id);
      return {
        userId: id,
        name: names.get(id) || "Deleted user",
        role: ROLE_MAP[u?.role] || "user",
        avatar: names.get(`${id}:avatar`) || u?.profilePicture || undefined,
      };
    });
    const lastSender = idOf(c.lastMessage?.sender);
    return {
      _id: c._id.toString(),
      participants,
      subject: c.subject,
      lastMessage: c.lastMessage?.content
        ? {
            content: c.lastMessage.content,
            senderName: lastSender === userId.toString() ? "You" : names.get(lastSender) || "",
            createdAt: c.lastMessage.createdAt,
          }
        : undefined,
      unreadCount: unread.get(c._id.toString()) || 0,
      status: c.status,
      relatedBooking: idOf(c.relatedBooking),
      relatedEvent: idOf(c.relatedEvent),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  });
};

/** Shape messages the way the frontend's messaging service expects. */
export const formatMessages = async (messages, conversation) => {
  const ids = conversation.participants.map(idOf);
  const users = await User.find({ _id: { $in: ids } }).select(USER_FIELDS).lean();
  const roles = new Map(users.map((u) => [u._id.toString(), ROLE_MAP[u.role] || "user"]));
  const names = await displayNames(users);

  return messages.map((m) => {
    const senderId = idOf(m.sender);
    return {
      _id: m._id.toString(),
      conversationId: conversation._id.toString(),
      senderId,
      senderRole: roles.get(senderId) || "user",
      senderName: names.get(senderId) || "Deleted user",
      content: m.content,
      // Messages are text-only for now; the stored attachment records have no public URL
      attachments: [],
      read: m.status === "read",
      readAt: m.readAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    };
  });
};

/** Load a conversation the user takes part in, or fail with 404 (no hint that it exists). */
export const getParticipantConversation = async (conversationId, userId) => {
  if (!isId(conversationId)) throw new AppError("Conversation not found", 404);
  const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
  if (!conversation) throw new AppError("Conversation not found", 404);
  return conversation;
};

export const markConversationRead = (conversationId, userId) =>
  Message.updateMany(
    { conversation: conversationId, recipient: userId, status: { $ne: "read" } },
    { $set: { status: "read", readAt: new Date() } }
  );

export const totalUnread = (userId) =>
  Message.countDocuments({
    recipient: userId,
    status: { $ne: "read" },
    conversation: { $exists: true },
  });
