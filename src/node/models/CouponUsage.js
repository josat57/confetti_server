import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    couponCode: {
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
      enum: ["planner", "vendor"],
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "orderType",
    },
    orderType: {
      type: String,
      enum: ["Subscription", "Booking", "Event"],
    },
    originalAmount: {
      type: Number,
      required: true,
    },
    discountAmount: {
      type: Number,
      required: true,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["applied", "refunded", "cancelled"],
      default: "applied",
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    usedAt: {
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
couponUsageSchema.index({ couponId: 1, userId: 1 });
couponUsageSchema.index({ couponId: 1, usedAt: -1 });
couponUsageSchema.index({ userId: 1, usedAt: -1 });

export default mongoose.model("CouponUsage", couponUsageSchema);
