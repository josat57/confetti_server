import mongoose from "mongoose";
import crypto from "crypto";

const apiKeySchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "API key name is required"],
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    prefix: {
      type: String,
      required: true,
    },
    permissions: [
      {
        type: String,
        enum: [
          "read:leads",
          "write:leads",
          "read:quotes",
          "write:quotes",
          "read:bookings",
          "write:bookings",
          "read:clients",
          "write:clients",
          "read:analytics",
          "webhooks",
        ],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsedAt: Date,
    expiresAt: Date,
    usageCount: {
      type: Number,
      default: 0,
    },
    rateLimit: {
      requestsPerHour: {
        type: Number,
        default: 1000,
      },
      requestsPerDay: {
        type: Number,
        default: 10000,
      },
    },
    ipWhitelist: [String],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
apiKeySchema.index({ vendor: 1, isActive: 1 });
apiKeySchema.index({ key: 1 });
apiKeySchema.index({ prefix: 1 });

// Virtual for checking if expired
apiKeySchema.virtual("isExpired").get(function () {
  if (!this.expiresAt) return false;
  return this.expiresAt < new Date();
});

// Method to generate API key
apiKeySchema.statics.generateKey = function () {
  const key = crypto.randomBytes(32).toString("hex");
  const prefix = "ck_" + crypto.randomBytes(4).toString("hex");
  return { key: `${prefix}_${key}`, prefix };
};

// Method to hash key
apiKeySchema.statics.hashKey = function (key) {
  return crypto.createHash("sha256").update(key).digest("hex");
};

// Method to verify key
apiKeySchema.methods.verifyKey = function (key) {
  const hashedKey = this.constructor.hashKey(key);
  return this.key === hashedKey;
};

// Method to record usage
apiKeySchema.methods.recordUsage = function () {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save({ validateBeforeSave: false });
};

// Method to check permission
apiKeySchema.methods.hasPermission = function (permission) {
  return this.permissions.includes(permission);
};

// Method to revoke
apiKeySchema.methods.revoke = function () {
  this.isActive = false;
  return this.save();
};

// Pre-save middleware to hash key
apiKeySchema.pre("save", function (next) {
  if (this.isNew && this.key && !this.key.startsWith("$")) {
    // Only hash if it's a new key and not already hashed
    this.key = this.constructor.hashKey(this.key);
  }
  next();
});

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

export default ApiKey;
