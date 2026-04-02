import mongoose from "mongoose";

const featureUsageSchema = new mongoose.Schema(
  {
    featureKey: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ["planner", "vendor", "admin"],
      required: true,
    },
    enabled: {
      type: Boolean,
      required: true,
    },
    variant: {
      type: String,
      default: null,
    },
    sessionId: String,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
featureUsageSchema.index({ featureKey: 1, userId: 1 });
featureUsageSchema.index({ featureKey: 1, timestamp: -1 });
featureUsageSchema.index({ userId: 1, timestamp: -1 });

// TTL index - auto-delete after 90 days
featureUsageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model("FeatureUsage", featureUsageSchema);
