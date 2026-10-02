import mongoose from "mongoose";

const adminAPILogSchema = new mongoose.Schema(
  {
    apiKey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminAPIKey",
      index: true,
    },
    keyPrefix: String,
    endpoint: { type: String, required: true },
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      required: true,
    },
    statusCode: { type: Number, required: true },
    responseTimeMs: Number,
    ipAddress: String,
    userAgent: String,
    requestSize: Number,
    responseSize: Number,
    error: String,
  },
  { timestamps: true }
);

// Auto-delete logs older than 30 days
adminAPILogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);
adminAPILogSchema.index({ apiKey: 1, createdAt: -1 });
adminAPILogSchema.index({ endpoint: 1, statusCode: 1 });
adminAPILogSchema.index({ statusCode: 1, createdAt: -1 });

const AdminAPILog = mongoose.model("AdminAPILog", adminAPILogSchema);
export default AdminAPILog;
