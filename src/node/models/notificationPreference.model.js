import mongoose from "mongoose";

const notificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    email: {
      enabled: { type: Boolean, default: true },
      categories: {
        system: { type: Boolean, default: true },
        event: { type: Boolean, default: true },
        booking: { type: Boolean, default: true },
        payment: { type: Boolean, default: true },
        message: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        security: { type: Boolean, default: true },
      },
    },
    push: {
      enabled: { type: Boolean, default: true },
      categories: {
        system: { type: Boolean, default: true },
        event: { type: Boolean, default: true },
        booking: { type: Boolean, default: true },
        payment: { type: Boolean, default: true },
        message: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        security: { type: Boolean, default: true },
      },
    },
    sms: {
      enabled: { type: Boolean, default: false },
      categories: {
        system: { type: Boolean, default: false },
        event: { type: Boolean, default: true },
        booking: { type: Boolean, default: true },
        payment: { type: Boolean, default: true },
        message: { type: Boolean, default: false },
        reminder: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        security: { type: Boolean, default: true },
      },
    },
    inApp: {
      enabled: { type: Boolean, default: true },
      categories: {
        system: { type: Boolean, default: true },
        event: { type: Boolean, default: true },
        booking: { type: Boolean, default: true },
        payment: { type: Boolean, default: true },
        message: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true },
        marketing: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
      },
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: "22:00" },
      endTime: { type: String, default: "08:00" },
      timezone: { type: String, default: "UTC" },
    },
    frequency: {
      type: String,
      enum: ["realtime", "hourly", "daily", "weekly"],
      default: "realtime",
    },
  },
  {
    timestamps: true,
  }
);

const NotificationPreference = mongoose.model(
  "NotificationPreference",
  notificationPreferenceSchema
);

export default NotificationPreference;
