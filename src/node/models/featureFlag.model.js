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
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    enabledFor: {
      type: String,
      enum: ["all", "none", "specific_users", "specific_roles", "percentage"],
      default: "all",
    },
    targetUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    targetRoles: [
      {
        type: String,
        enum: ["vendor", "event-planner", "guest", "admin"],
      },
    ],
    rolloutPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    environment: {
      type: String,
      enum: ["development", "staging", "production", "all"],
      default: "all",
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedBy: {
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
featureFlagSchema.index({ isEnabled: 1 });

const FeatureFlag = mongoose.model("FeatureFlag", featureFlagSchema);

export default FeatureFlag;
