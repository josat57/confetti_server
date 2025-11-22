import mongoose from "mongoose";

const aiPlannerUsageSchema = new mongoose.Schema(
  {
    planner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    usageType: {
      type: String,
      enum: ["generate-plan", "suggest-vendors", "optimize-budget"],
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
aiPlannerUsageSchema.index({ planner: 1, month: 1, year: 1, usageType: 1 });

// Static method to increment usage
aiPlannerUsageSchema.statics.incrementUsage = async function (
  plannerId,
  usageType
) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const usage = await this.findOneAndUpdate(
    {
      planner: plannerId,
      usageType,
      month,
      year,
    },
    {
      $inc: { count: 1 },
      $set: { lastUsedAt: now },
    },
    {
      upsert: true,
      new: true,
    }
  );

  return usage;
};

// Static method to get current month usage
aiPlannerUsageSchema.statics.getCurrentMonthUsage = async function (
  plannerId,
  usageType
) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const usage = await this.findOne({
    planner: plannerId,
    usageType,
    month,
    year,
  });

  return usage ? usage.count : 0;
};

// Static method to check if planner can use AI feature
aiPlannerUsageSchema.statics.canUseFeature = async function (
  plannerId,
  usageType,
  planName
) {
  // Define tier limits
  const tierLimits = {
    Starter: 2,
    Professional: Infinity,
    Business: Infinity,
    Enterprise: Infinity,
  };

  const limit = tierLimits[planName] || 0;

  if (limit === Infinity) {
    return { allowed: true, remaining: Infinity };
  }

  const currentUsage = await this.getCurrentMonthUsage(plannerId, usageType);

  return {
    allowed: currentUsage < limit,
    remaining: Math.max(0, limit - currentUsage),
    limit,
    used: currentUsage,
  };
};

const AIPlannerUsage = mongoose.model("AIPlannerUsage", aiPlannerUsageSchema);

export default AIPlannerUsage;
