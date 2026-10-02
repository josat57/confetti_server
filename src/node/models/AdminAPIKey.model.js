import mongoose from "mongoose";
import crypto from "crypto";

const adminAPIKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    keyHash: { type: String, required: true, unique: true, select: false },
    prefix: { type: String, required: true },
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      default: "production",
    },
    permissions: [
      {
        type: String,
        enum: [
          "read:users",
          "write:users",
          "read:events",
          "write:events",
          "read:vendors",
          "write:vendors",
          "read:payments",
          "write:payments",
          "read:analytics",
          "admin:system",
        ],
      },
    ],
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: Date,
    lastUsedAt: Date,
    usageCount: { type: Number, default: 0 },
    rateLimit: {
      requestsPerHour: { type: Number, default: 1000 },
      requestsPerDay: { type: Number, default: 10000 },
    },
    ipWhitelist: [String],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  { timestamps: true }
);

adminAPIKeySchema.index({ prefix: 1 });
adminAPIKeySchema.index({ createdBy: 1, isActive: 1 });

adminAPIKeySchema.virtual("isExpired").get(function () {
  return this.expiresAt ? this.expiresAt < new Date() : false;
});

adminAPIKeySchema.statics.generateKey = function () {
  const raw = crypto.randomBytes(32).toString("hex");
  const prefix = "ak_" + crypto.randomBytes(4).toString("hex");
  const full = `${prefix}_${raw}`;
  const hash = crypto.createHash("sha256").update(full).digest("hex");
  return { raw: full, prefix, hash };
};

adminAPIKeySchema.methods.recordUsage = function () {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save({ validateBeforeSave: false });
};

adminAPIKeySchema.methods.revoke = function () {
  this.isActive = false;
  return this.save();
};

const AdminAPIKey = mongoose.model("AdminAPIKey", adminAPIKeySchema);
export default AdminAPIKey;
