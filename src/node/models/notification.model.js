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
    // Domain-specific kind (e.g. "new_message", "payment_due"); `type` holds the severity
    kind: {
      type: String,
      index: true,
    },
    relatedEntity: {
      type: { type: String },
      id: mongoose.Schema.Types.ObjectId,
    },
    // Set when external delivery (email/sms/push) is pending for the dispatcher
    queuedForDelivery: {
      type: Boolean,
      default: false,
    },
    deliveryAttempts: {
      type: Number,
      default: 0,
    },
    nextAttemptAt: {
      type: Date,
      default: null,
    },
    deliveryResults: [
      {
        _id: false,
        channel: String,
        status: { type: String, enum: ["sent", "delivered", "failed", "skipped"] },
        error: String,
        at: Date,
      },
    ],
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

notificationSchema.index({ queuedForDelivery: 1, status: 1, scheduledFor: 1 });

// ─── Input normalisation ─────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = notificationSchema.path("type").enumValues;
const CATEGORIES = notificationSchema.path("category").enumValues;
const PRIORITIES = notificationSchema.path("priority").enumValues;
const CHANNEL_ALIASES = { inApp: "in-app", in_app: "in-app", "in-app": "in-app", email: "email", sms: "sms", push: "push" };

// Domain kinds used across the app → category / severity
const KIND_CATEGORY = {
  new_message: "message",
  vendor_response: "booking",
  booking_update: "booking",
  booking_request: "booking",
  payment_due: "payment",
  payment_received: "payment",
  payment_failed: "payment",
  event_update: "event",
  guest_rsvp: "event",
  budget_alert: "event",
  client_approval: "event",
  task_deadline: "reminder",
  reminder: "reminder",
  team_invitation: "system",
  business_verification: "system",
  system: "system",
  security_alert: "security",
};
const WARNING_KINDS = new Set(["payment_due", "budget_alert", "task_deadline", "payment_failed", "security_alert"]);

/** Accepts ["email","push"], { inApp: true, email: false }, "all", etc. */
export const normalizeChannels = (channels) => {
  if (!channels) return ["in-app"];
  let list;
  if (typeof channels === "string") list = [channels];
  else if (Array.isArray(channels)) list = channels;
  else list = Object.entries(channels).filter(([, on]) => on).map(([k]) => k);
  if (list.includes("all")) return ["in-app", "email", "sms", "push"];
  const out = [...new Set(list.map((c) => CHANNEL_ALIASES[c]).filter(Boolean))];
  return out.length ? out : ["in-app"];
};

/**
 * Map the various caller conventions onto this schema:
 * user/userId → recipient, domain `type` → kind (+ severity type/category),
 * priority "medium" → "normal", channels object → array, relatedEntity/metadata → stored.
 */
notificationSchema.statics.normalizeInput = function (input = {}) {
  const recipient = input.recipient || input.user || input.userId;
  const rawType = input.type || "info";
  const isSchemaType = NOTIFICATION_TYPES.includes(rawType);
  const kind = input.kind || (isSchemaType ? undefined : rawType);
  const type = isSchemaType ? rawType : WARNING_KINDS.has(rawType) ? "warning" : "info";
  const category = CATEGORIES.includes(input.category)
    ? input.category
    : KIND_CATEGORY[kind] || (kind?.startsWith("security") ? "security" : "system");
  let priority = input.priority === "medium" ? "normal" : input.priority;
  if (!PRIORITIES.includes(priority)) priority = "normal";

  const data = { ...(input.data || {}) };
  if (input.metadata && typeof input.metadata === "object") data.metadata = input.metadata;

  const doc = {
    recipient,
    type,
    kind,
    category,
    title: input.title,
    message: input.message,
    data: Object.keys(data).length ? data : undefined,
    priority,
    channels: normalizeChannels(input.channels),
    actionUrl: input.actionUrl,
    actionText: input.actionText || input.actionLabel,
    expiresAt: input.expiresAt,
    scheduledFor: input.scheduledFor || null,
  };
  if (input.relatedEntity?.type || input.relatedEntity?.id) {
    doc.relatedEntity = { type: input.relatedEntity.type, id: input.relatedEntity.id };
  }
  if (input.status) doc.status = input.status;
  return doc;
};

notificationSchema.statics.createNotification = function (input) {
  return this.create(this.normalizeInput(input));
};

notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({ recipient: userId, isRead: false, isArchived: { $ne: true } });
};

notificationSchema.statics.markAllAsRead = function (userId) {
  const now = new Date();
  return this.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: now, status: "read" } }
  );
};

// ─── Instance helpers ────────────────────────────────────────────────────────

notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  this.status = "read";
  return this.save();
};

notificationSchema.methods.recordDelivery = function (channel, status, error) {
  this.deliveryResults = [
    ...(this.deliveryResults || []).filter((r) => r.channel !== channel),
    { channel, status, error: error || undefined, at: new Date() },
  ];
  if (status === "sent" || status === "delivered") {
    if (!["delivered", "read"].includes(this.status)) this.status = status;
    if (status === "sent" && !this.sentAt) this.sentAt = new Date();
    if (status === "delivered") this.deliveredAt = new Date();
  }
  return this;
};

notificationSchema.methods.markEmailSent = function () {
  return this.recordDelivery("email", "sent").save();
};
notificationSchema.methods.markSmsSent = function () {
  return this.recordDelivery("sms", "sent").save();
};
notificationSchema.methods.markPushSent = function () {
  return this.recordDelivery("push", "sent").save();
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
