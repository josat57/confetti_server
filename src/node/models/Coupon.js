import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
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
      enum: ["percentage", "fixed", "free_shipping", "free_trial"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "EUR", "GBP", "NGN"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "depleted"],
      default: "active",
      index: true,
    },
    usageLimit: {
      total: {
        type: Number,
        default: null, // null = unlimited
      },
      perUser: {
        type: Number,
        default: 1,
      },
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    minimumPurchase: {
      type: Number,
      default: 0,
    },
    maximumDiscount: {
      type: Number,
      default: null, // null = no maximum
    },
    validFrom: {
      type: Date,
      required: true,
      index: true,
    },
    validUntil: {
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
      specificUsers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      newUsersOnly: {
        type: Boolean,
        default: false,
      },
      firstPurchaseOnly: {
        type: Boolean,
        default: false,
      },
    },
    applicableTo: {
      subscriptionPlans: [
        {
          type: String,
        },
      ],
      eventTypes: [
        {
          type: String,
        },
      ],
      categories: [
        {
          type: String,
        },
      ],
    },
    stackable: {
      type: Boolean,
      default: false,
    },
    autoApply: {
      type: Boolean,
      default: false,
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
couponSchema.index({ code: 1 });
couponSchema.index({ status: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ createdAt: -1 });

// Virtual for checking if coupon is valid
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.status === "active" &&
    this.validFrom <= now &&
    this.validUntil >= now &&
    (this.usageLimit.total === null || this.usageCount < this.usageLimit.total)
  );
});

// Method to check if user can use coupon
couponSchema.methods.canBeUsedBy = async function (
  userId,
  userType,
  subscriptionTier
) {
  // Check if coupon is valid
  if (!this.isValid) {
    return { valid: false, reason: "Coupon is not valid or has expired" };
  }

  // Check user type targeting
  if (this.targeting.userTypes && this.targeting.userTypes.length > 0) {
    if (
      !this.targeting.userTypes.includes("all") &&
      !this.targeting.userTypes.includes(userType)
    ) {
      return {
        valid: false,
        reason: "Coupon not available for your user type",
      };
    }
  }

  // Check subscription tier targeting
  if (
    this.targeting.subscriptionTiers &&
    this.targeting.subscriptionTiers.length > 0
  ) {
    if (!this.targeting.subscriptionTiers.includes(subscriptionTier)) {
      return {
        valid: false,
        reason: "Coupon not available for your subscription tier",
      };
    }
  }

  // Check specific users
  if (this.targeting.specificUsers && this.targeting.specificUsers.length > 0) {
    if (
      !this.targeting.specificUsers.some(
        (id) => id.toString() === userId.toString()
      )
    ) {
      return { valid: false, reason: "Coupon not available for your account" };
    }
  }

  // Check per-user usage limit
  const CouponUsage = mongoose.model("CouponUsage");
  const userUsageCount = await CouponUsage.countDocuments({
    couponId: this._id,
    userId: userId,
  });

  if (userUsageCount >= this.usageLimit.perUser) {
    return {
      valid: false,
      reason: "You have already used this coupon the maximum number of times",
    };
  }

  return { valid: true };
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function (amount) {
  if (amount < this.minimumPurchase) {
    return 0;
  }

  let discount = 0;

  if (this.type === "percentage") {
    discount = (amount * this.value) / 100;
  } else if (this.type === "fixed") {
    discount = this.value;
  }

  // Apply maximum discount if set
  if (this.maximumDiscount && discount > this.maximumDiscount) {
    discount = this.maximumDiscount;
  }

  // Discount cannot exceed the amount
  if (discount > amount) {
    discount = amount;
  }

  return discount;
};

export default mongoose.model("Coupon", couponSchema);
