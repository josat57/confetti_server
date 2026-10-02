import mongoose from "mongoose";

const pushTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: ["ios", "android", "web"],
      required: true,
    },
    // "fcm" = Firebase registration token; "webpush" = browser Push API subscription
    kind: {
      type: String,
      enum: ["fcm", "webpush"],
      default: "fcm",
    },
    // Web Push subscription ({ endpoint, keys: { p256dh, auth } }) when kind = "webpush"
    subscription: {
      type: mongoose.Schema.Types.Mixed,
    },
    deviceId: {
      type: String,
    },
    deviceName: {
      type: String,
    },
    appVersion: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
pushTokenSchema.index({ user: 1, isActive: 1 });
pushTokenSchema.index({ token: 1 });

const PushToken = mongoose.model("PushToken", pushTokenSchema);

export default PushToken;
