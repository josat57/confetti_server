import mongoose from "mongoose";
import crypto from "crypto";

export const ADMIN_WEBHOOK_EVENTS = [
  "user.registered",
  "user.deleted",
  "user.suspended",
  "vendor.registered",
  "vendor.verified",
  "vendor.suspended",
  "event.created",
  "event.published",
  "event.cancelled",
  "payment.completed",
  "payment.failed",
  "payment.refunded",
  "subscription.created",
  "subscription.cancelled",
  "subscription.renewed",
  "admin.login",
  "admin.created",
  "admin.deleted",
  "backup.completed",
  "backup.failed",
  "system.alert",
];

const adminWebhookSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    secret: { type: String, required: true, select: false },
    events: [{ type: String, enum: ADMIN_WEBHOOK_EVENTS }],
    isActive: { type: Boolean, default: true },
    lastTriggered: Date,
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    lastError: {
      message: String,
      timestamp: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

adminWebhookSchema.index({ isActive: 1, events: 1 });

adminWebhookSchema.pre("save", function (next) {
  if (this.isNew && !this.secret) {
    this.secret = crypto.randomBytes(32).toString("hex");
  }
  next();
});

adminWebhookSchema.methods.generateSignature = function (payload) {
  return crypto
    .createHmac("sha256", this.secret)
    .update(JSON.stringify(payload))
    .digest("hex");
};

adminWebhookSchema.methods.recordSuccess = function () {
  this.successCount += 1;
  this.lastTriggered = new Date();
  return this.save({ validateBeforeSave: false });
};

adminWebhookSchema.methods.recordFailure = function (error) {
  this.failureCount += 1;
  this.lastError = {
    message: error.message || "Unknown error",
    timestamp: new Date(),
  };
  this.lastTriggered = new Date();
  if (this.failureCount >= 10) this.isActive = false;
  return this.save({ validateBeforeSave: false });
};

const AdminWebhook = mongoose.model("AdminWebhook", adminWebhookSchema);
export default AdminWebhook;
