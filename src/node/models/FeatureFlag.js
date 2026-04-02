import mongoose from "mongoose";

const featureFlagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    rolloutPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    targetAudience: {
      userTypes: [
        {
          type: String,
          enum: ["all", "planner", "vendor", "admin"],
        },
      ],
      userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      subscriptionTiers: [
        {
          type: String,
          enum: ["free", "basic", "premium", "enterprise"],
        },
      ],
    },
    environment: {
      type: String,
      enum: ["development", "staging", "production", "all"],
      default: "all",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
featureFlagSchema.index({ key: 1 });
featureFlagSchema.index({ enabled: 1 });
featureFlagSchema.index({ environment: 1 });

export default mongoose.models.FeatureFlag ||
  mongoose.model("FeatureFlag", featureFlagSchema);
