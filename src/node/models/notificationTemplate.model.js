import mongoose from "mongoose";

const notificationTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["email", "push", "sms", "in_app"],
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
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    variables: [
      {
        name: String,
        description: String,
        example: String,
        required: Boolean,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    actionUrl: {
      type: String,
    },
    actionText: {
      type: String,
    },
    expiresIn: {
      type: Number,
      description: "Expiration time in seconds",
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationTemplateSchema.index({ key: 1 });
notificationTemplateSchema.index({ type: 1, category: 1 });
notificationTemplateSchema.index({ isActive: 1 });

const NotificationTemplate = mongoose.model(
  "NotificationTemplate",
  notificationTemplateSchema
);

export default NotificationTemplate;
