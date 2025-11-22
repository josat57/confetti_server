import mongoose from "mongoose";

const notificationPreferencesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    channels: {
      inApp: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: true,
      },
    },
    notificationTypes: {
      vendorResponse: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      clientApproval: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      taskDeadline: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      paymentDue: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
      newMessage: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      teamInvitation: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      eventUpdate: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false },
      },
      budgetAlert: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      guestRsvp: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false },
      },
      system: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false },
      },
    },
    quietHours: {
      enabled: {
        type: Boolean,
        default: false,
      },
      startTime: {
        type: String,
        default: "22:00",
      },
      endTime: {
        type: String,
        default: "08:00",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
    },
    frequency: {
      type: String,
      enum: ["instant", "hourly", "daily", "weekly"],
      default: "instant",
    },
  },
  {
    timestamps: true,
  }
);

// Methods
notificationPreferencesSchema.methods.isQuietHours = function () {
  if (!this.quietHours.enabled) return false;

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  const start = this.quietHours.startTime;
  const end = this.quietHours.endTime;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (start > end) {
    return currentTime >= start || currentTime <= end;
  }

  return currentTime >= start && currentTime <= end;
};

notificationPreferencesSchema.methods.shouldSendNotification = function (
  type,
  channel
) {
  // Check if channel is globally enabled
  if (!this.channels[channel]) return false;

  // Check if quiet hours are active (only for SMS and push)
  if ((channel === "sms" || channel === "push") && this.isQuietHours()) {
    return false;
  }

  // Convert type to camelCase for lookup
  const typeKey = type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/ /g, "");
  const typeKeyLower = typeKey.charAt(0).toLowerCase() + typeKey.slice(1);

  // Check if notification type is enabled for this channel
  if (this.notificationTypes[typeKeyLower]) {
    return this.notificationTypes[typeKeyLower][channel] !== false;
  }

  return true;
};

// Static methods
notificationPreferencesSchema.statics.getOrCreate = async function (userId) {
  let preferences = await this.findOne({ user: userId });

  if (!preferences) {
    preferences = await this.create({ user: userId });
  }

  return preferences;
};

const NotificationPreferences = mongoose.model(
  "NotificationPreferences",
  notificationPreferencesSchema
);

export default NotificationPreferences;
