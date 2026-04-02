import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "email",
        "push",
        "sms",
        "in_app",
        "in-app",
        "info",
        "warning",
        "success",
        "error",
        "announcement",
      ],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "system",
        "event",
        "booking",
        "payment",
        "message",
        "reminder",
        "marketing",
        "security",
      ],
      default: "system",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "read"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    channel: {
      type: String,
      enum: ["email", "push", "sms", "in_app", "in-app", "all"],
    },
    channels: {
      type: [String],
      enum: ["email", "push", "sms", "in_app", "in-app", "all"],
      default: ["in-app"],
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    readAt: {
      type: Date,
    },
    failedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    metadata: {
      emailId: String,
      pushToken: String,
      smsId: String,
      provider: String,
    },
    actionUrl: {
      type: String,
    },
    actionText: {
      type: String,
    },
    expiresAt: {
      type: Date,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
