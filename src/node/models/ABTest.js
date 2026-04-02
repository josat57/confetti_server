import mongoose from "mongoose";

const abTestSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ["draft", "running", "paused", "completed", "cancelled"],
      default: "draft",
    },
    variants: [
      {
        name: {
          type: String,
          required: true,
        },
        key: {
          type: String,
          required: true,
        },
        description: String,
        weight: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        config: {
          type: Map,
          of: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    targetAudience: {
      userTypes: [
        {
          type: String,
          enum: ["all", "planner", "vendor", "admin"],
        },
      ],
      subscriptionTiers: [
        {
          type: String,
          enum: ["free", "basic", "premium", "enterprise"],
        },
      ],
      minAge: Number,
      maxAge: Number,
      locations: [String],
    },
    metrics: [
      {
        name: {
          type: String,
          required: true,
        },
        key: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["conversion", "engagement", "revenue", "custom"],
          required: true,
        },
        goal: {
          type: String,
          enum: ["increase", "decrease", "maintain"],
        },
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    sampleSize: {
      target: Number,
      current: {
        type: Number,
        default: 0,
      },
    },
    results: {
      totalParticipants: {
        type: Number,
        default: 0,
      },
      variantResults: [
        {
          variantKey: String,
          participants: {
            type: Number,
            default: 0,
          },
          conversions: {
            type: Number,
            default: 0,
          },
          conversionRate: {
            type: Number,
            default: 0,
          },
          metrics: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            default: {},
          },
        },
      ],
      winner: {
        variantKey: String,
        confidence: Number,
        declaredAt: Date,
      },
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
abTestSchema.index({ key: 1 });
abTestSchema.index({ status: 1 });
abTestSchema.index({ startDate: 1, endDate: 1 });

export default mongoose.model("ABTest", abTestSchema);
