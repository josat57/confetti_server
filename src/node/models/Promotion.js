import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "seasonal",
        "flash_sale",
        "referral",
        "loyalty",
        "bundle",
        "first_time",
        "winback",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "active",
        "paused",
        "completed",
        "cancelled",
      ],
      default: "draft",
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    coupons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
    ],
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    targeting: {
      userTypes: [
        {
          type: String,
          enum: ["all", "planner", "vendor"],
        },
      ],
      subscriptionTiers: [
        {
          type: String,
          enum: ["free", "basic", "premium", "enterprise"],
        },
      ],
      segments: [
        {
          type: String,
        },
      ],
      locations: [
        {
          type: String,
        },
      ],
    },
    budget: {
      total: {
        type: Number,
        default: null,
      },
      spent: {
        type: Number,
        default: 0,
      },
      currency: {
        type: String,
        default: "USD",
      },
    },
    goals: {
      targetRevenue: Number,
      targetConversions: Number,
      targetNewUsers: Number,
    },
    performance: {
      impressions: {
        type: Number,
        default: 0,
      },
      clicks: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
      revenue: {
        type: Number,
        default: 0,
      },
      newUsers: {
        type: Number,
        default: 0,
      },
    },
    banners: [
      {
        type: {
          type: String,
          enum: ["hero", "sidebar", "popup", "notification"],
        },
        title: String,
        message: String,
        imageUrl: String,
        ctaText: String,
        ctaUrl: String,
      },
    ],
    emailCampaign: {
      enabled: {
        type: Boolean,
        default: false,
      },
      subject: String,
      templateId: String,
      sentCount: {
        type: Number,
        default: 0,
      },
      openRate: {
        type: Number,
        default: 0,
      },
      clickRate: {
        type: Number,
        default: 0,
      },
    },
    pushNotification: {
      enabled: {
        type: Boolean,
        default: false,
      },
      title: String,
      message: String,
      sentCount: {
        type: Number,
        default: 0,
      },
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
promotionSchema.index({ status: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });
promotionSchema.index({ type: 1 });
promotionSchema.index({ priority: -1 });

// Virtual for checking if promotion is active
promotionSchema.virtual("isActive").get(function () {
  const now = new Date();
  return (
    this.status === "active" && this.startDate <= now && this.endDate >= now
  );
});

// Method to calculate ROI
promotionSchema.methods.calculateROI = function () {
  if (this.budget.spent === 0) {
    return 0;
  }
  return (
    ((this.performance.revenue - this.budget.spent) / this.budget.spent) * 100
  );
};

// Method to calculate conversion rate
promotionSchema.methods.calculateConversionRate = function () {
  if (this.performance.clicks === 0) {
    return 0;
  }
  return (this.performance.conversions / this.performance.clicks) * 100;
};

export default mongoose.model("Promotion", promotionSchema);
