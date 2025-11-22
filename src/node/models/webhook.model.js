import mongoose from "mongoose";
import crypto from "crypto";

const webhookSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    secret: {
      type: String,
      required: true,
    },
    events: [
      {
        type: String,
        enum: [
          "event.created",
          "event.updated",
          "event.deleted",
          "client.created",
          "client.updated",
          "client.deleted",
          "task.created",
          "task.updated",
          "task.completed",
          "task.deleted",
          "guest.created",
          "guest.updated",
          "guest.rsvp",
          "guest.deleted",
          "booking.created",
          "booking.confirmed",
          "booking.cancelled",
          "payment.received",
          "payment.failed",
        ],
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    lastTriggered: {
      type: Date,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    lastError: {
      message: String,
      timestamp: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
webhookSchema.index({ user: 1 });
webhookSchema.index({ active: 1 });
webhookSchema.index({ events: 1 });

// Generate secret before saving
webhookSchema.pre("save", function (next) {
  if (this.isNew && !this.secret) {
    this.secret = crypto.randomBytes(32).toString("hex");
  }
  next();
});

// Methods
webhookSchema.methods.recordSuccess = function () {
  this.successCount += 1;
  this.lastTriggered = new Date();
  return this.save();
};

webhookSchema.methods.recordFailure = function (error) {
  this.failureCount += 1;
  this.lastError = {
    message: error.message || "Unknown error",
    timestamp: new Date(),
  };
  this.lastTriggered = new Date();

  // Deactivate webhook after 10 consecutive failures
  if (this.failureCount >= 10) {
    this.active = false;
  }

  return this.save();
};

webhookSchema.methods.generateSignature = function (payload) {
  return crypto
    .createHmac("sha256", this.secret)
    .update(JSON.stringify(payload))
    .digest("hex");
};

const Webhook = mongoose.model("Webhook", webhookSchema);

export default Webhook;
