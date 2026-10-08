import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: false,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    // Featured listing boost (paymentType "boost")
    featuredBoost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeaturedBoost",
    },
    // Booking payment held in escrow (paymentType "escrow")
    escrowPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EscrowPayment",
    },
    // Event pass purchase (paymentType "event")
    eventPass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventPass",
    },
    passDetails: {
      tier: String,
      previousTier: String,
    },
    paymentType: {
      type: String,
      enum: ["subscription", "event", "refund", "escrow", "boost"],
      required: true,
      default: "event",
    },
    subscriptionDetails: {
      planType: String,
      planName: String,
      billingCycle: String,
      isUpgrade: Boolean,
      previousPlan: String,
      proratedAmount: Number,
      // Upgrade from a free or lapsed plan: start a new billing period on payment
      newPeriod: Boolean,
      // Automatic renewal charge (saved card)
      isRenewal: Boolean,
      couponCode: String,
      originalAmount: Number,
      discountAmount: Number,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["flutterwave", "paystack"],
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentDetails: {
      cardLast4: String,
      cardBrand: String,
      paymentIntentId: String,
      chargeId: String,
      customerEmail: String,
      customerName: String,
    },
    webhookReceived: {
      type: Boolean,
      default: false,
    },
    webhookData: {
      type: mongoose.Schema.Types.Mixed,
    },
    requeryAttempts: {
      type: Number,
      default: 0,
    },
    lastRequeryAt: Date,
    refundDetails: {
      refundId: String,
      refundAmount: Number,
      refundReason: String,
      refundedAt: Date,
    },
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ event: 1, status: 1 });
paymentSchema.index({ transactionId: 1 }, { unique: true });
paymentSchema.index({ reference: 1 }, { unique: true });
paymentSchema.index({ user: 1, paymentType: 1, createdAt: -1 });
paymentSchema.index({ subscription: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
