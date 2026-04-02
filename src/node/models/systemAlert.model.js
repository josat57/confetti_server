import mongoose from "mongoose";

const systemAlertSchema = new mongoose.Schema(
  {
    alertType: {
      type: String,
      enum: [
        "performance",
        "error",
        "security",
        "resource",
        "availability",
        "custom",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical", "emergency"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
    },
    metric: {
      type: String,
    },
    threshold: {
      value: Number,
      operator: String,
    },
    currentValue: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "resolved", "ignored"],
      default: "active",
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    acknowledgedAt: {
      type: Date,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    resolution: {
      type: String,
    },
    notificationsSent: [
      {
        channel: String,
        recipient: String,
        sentAt: Date,
        status: String,
      },
    ],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    occurrenceCount: {
      type: Number,
      default: 1,
    },
    lastOccurrence: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
systemAlertSchema.index({ alertType: 1, severity: 1, status: 1 });
systemAlertSchema.index({ status: 1, createdAt: -1 });
systemAlertSchema.index({ source: 1, status: 1 });

const SystemAlert = mongoose.model("SystemAlert", systemAlertSchema);

export default SystemAlert;
