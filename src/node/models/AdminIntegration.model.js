import mongoose from "mongoose";

export const INTEGRATION_PROVIDERS = [
  { type: "payment", name: "Stripe", description: "Payment processing via Stripe" },
  { type: "payment", name: "Flutterwave", description: "African payment gateway" },
  { type: "payment", name: "Paystack", description: "Online payment for Africa" },
  { type: "notification", name: "SendGrid", description: "Email delivery service" },
  { type: "notification", name: "Twilio", description: "SMS and voice communication" },
  { type: "notification", name: "Firebase", description: "Push notifications via FCM" },
  { type: "analytics", name: "Google Analytics", description: "Web analytics platform" },
  { type: "analytics", name: "Mixpanel", description: "Product analytics" },
  { type: "storage", name: "AWS S3", description: "Object storage on Amazon Web Services" },
  { type: "storage", name: "Cloudinary", description: "Media management and delivery" },
  { type: "communication", name: "Slack", description: "Team messaging and notifications" },
  { type: "communication", name: "Discord", description: "Community and team communication" },
  { type: "crm", name: "HubSpot", description: "CRM and marketing platform" },
  { type: "crm", name: "Salesforce", description: "Enterprise CRM platform" },
];

const adminIntegrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["payment", "notification", "analytics", "storage", "communication", "crm", "other"],
    },
    provider: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    isEnabled: { type: Boolean, default: false },
    credentials: {
      apiKey: { type: String, select: false },
      secretKey: { type: String, select: false },
      accessToken: { type: String, select: false },
      webhookSecret: { type: String, select: false },
      extra: { type: Map, of: String, select: false },
    },
    config: {
      baseUrl: String,
      environment: {
        type: String,
        enum: ["sandbox", "production"],
        default: "sandbox",
      },
      settings: { type: Map, of: mongoose.Schema.Types.Mixed },
    },
    health: {
      lastCheck: Date,
      status: {
        type: String,
        enum: ["healthy", "degraded", "unhealthy", "unknown"],
        default: "unknown",
      },
      latencyMs: Number,
      errorRate: { type: Number, default: 0 },
    },
    syncedAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

adminIntegrationSchema.index({ type: 1, provider: 1 });
adminIntegrationSchema.index({ isEnabled: 1 });

const AdminIntegration = mongoose.model("AdminIntegration", adminIntegrationSchema);
export default AdminIntegration;
