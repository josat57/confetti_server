import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    planType: {
      type: String,
      enum: ["vendor", "planner"],
      required: [true, "Plan type is required"],
    },
    planName: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    pricing: [
      {
        currency: {
          type: String,
          required: true,
          enum: ["NGN", "USD", "EUR", "GBP"],
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        // Amount in smallest unit (kobo, cents, etc.)
        amountInMinorUnits: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    limitations: [
      {
        type: String,
        trim: true,
      },
    ],
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly", "lifetime"],
      default: "monthly",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
subscriptionPlanSchema.index({ planType: 1, planName: 1, isActive: 1 });
subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

// Method to get price for a specific currency
subscriptionPlanSchema.methods.getPriceForCurrency = function (currency) {
  const pricing = this.pricing.find((p) => p.currency === currency);
  return pricing || null;
};

// Method to add or update pricing for a currency
subscriptionPlanSchema.methods.setPricing = function (
  currency,
  amount,
  amountInMinorUnits
) {
  const existingIndex = this.pricing.findIndex((p) => p.currency === currency);

  if (existingIndex >= 0) {
    this.pricing[existingIndex] = { currency, amount, amountInMinorUnits };
  } else {
    this.pricing.push({ currency, amount, amountInMinorUnits });
  }
};

// Static method to get active plans
subscriptionPlanSchema.statics.getActivePlans = function (planType, currency) {
  const query = { isActive: true };
  if (planType) query.planType = planType;

  return this.find(query).sort({ sortOrder: 1, planName: 1 });
};

// Static method to find plan by type and name
subscriptionPlanSchema.statics.findByTypeAndName = function (
  planType,
  planName
) {
  return this.findOne({ planType, planName, isActive: true });
};

// Virtual for formatted price display
subscriptionPlanSchema.virtual("formattedPricing").get(function () {
  return this.pricing.map((p) => ({
    currency: p.currency,
    amount: p.amount,
    formatted:
      p.currency === "NGN"
        ? `₦${p.amount.toLocaleString()}`
        : p.currency === "USD"
        ? `$${p.amount.toFixed(2)}`
        : `${p.currency} ${p.amount}`,
  }));
});

const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);

export default SubscriptionPlan;
