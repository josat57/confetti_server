import mongoose from "mongoose";

const webhookLogSchema = new mongoose.Schema(
  {
    webhook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Webhook",
      required: true,
    },
    event: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    response: {
      status: Number,
      body: mongoose.Schema.Types.Mixed,
      headers: mongoose.Schema.Types.Mixed,
    },
    success: {
      type: Boolean,
      required: true,
    },
    error: {
      type: String,
    },
    duration: {
      type: Number, // milliseconds
    },
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
webhookLogSchema.index({ webhook: 1, createdAt: -1 });
webhookLogSchema.index({ event: 1 });
webhookLogSchema.index({ success: 1 });
webhookLogSchema.index({ createdAt: -1 });

// TTL index - automatically delete logs older than 30 days
webhookLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

const WebhookLog = mongoose.model("WebhookLog", webhookLogSchema);

export default WebhookLog;
