import mongoose from "mongoose";

/**
 * A message thread between two users (client/planner ↔ vendor, planner ↔ planner …).
 * There is one conversation per pair of users; `key` (the two ids, sorted) keeps it unique.
 * Unread counts aren't stored: they're counted from Message.status, so the planner
 * message endpoints that mark single messages read stay consistent with threads.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "A conversation has exactly two participants",
      },
      index: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ["active", "archived", "closed"],
      default: "active",
    },
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorBooking",
    },
    relatedEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    lastMessage: {
      content: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: Date,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.statics.keyFor = function (a, b) {
  return [a.toString(), b.toString()].sort().join(":");
};

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
