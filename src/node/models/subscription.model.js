import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planType: {
      type: String,
      enum: ["vendor", "planner"],
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending_payment", "active", "trial", "cancelled", "expired"],
      default: "trial",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    trialEndDate: {
      type: Date,
    },
    paymentProvider: {
      type: String,
      enum: ["flutterwave", "paystack", "none"],
      required: true,
    },
    paymentId: {
      type: String,
    },
    currentPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    usage: {
      eventsCreated: {
        type: Number,
        default: 0,
      },
      photosUploaded: {
        type: Number,
        default: 0,
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
    },
    paymentHistory: [
      {
        payment: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Payment",
        },
        amount: Number,
        status: String,
        paidAt: Date,
        type: {
          type: String,
          enum: ["initial", "renewal", "upgrade", "downgrade"],
        },
      },
    ],
    history: [
      {
        planName: String,
        status: String,
        startDate: Date,
        endDate: Date,
        amount: Number,
        paymentId: String,
        changeType: {
          type: String,
          enum: [
            "created",
            "activated",
            "upgrade",
            "downgrade",
            "cancellation",
            "renewal",
            "expired",
          ],
        },
        proratedAmount: Number,
        reason: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    cancellationDetails: {
      cancelledAt: Date,
      reason: String,
      feedback: String,
    },
    pendingUpgrade: {
      newPlanName: String,
      amount: Number,
      proratedAmount: Number,
      paymentReference: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
subscriptionSchema.index({ user: 1, planType: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ user: 1, status: 1 });

// Methods
subscriptionSchema.methods.isActive = function () {
  return this.status === "active" || this.status === "trial";
};

subscriptionSchema.methods.isTrial = function () {
  return this.status === "trial";
};

subscriptionSchema.methods.canCreateEvent = function () {
  if (!this.isActive()) return false;

  const plan =
    this.planType === "vendor"
      ? vendorPlans.find((p) => p.name === this.planName)
      : plannerPlans.find((p) => p.name === this.planName);

  if (!plan) return false;

  if (plan.name === "Basic" || plan.name === "Starter") {
    return this.usage.eventsCreated < 5;
  }

  return true;
};

subscriptionSchema.methods.canUploadPhoto = function () {
  if (!this.isActive()) return false;

  const plan =
    this.planType === "vendor"
      ? vendorPlans.find((p) => p.name === this.planName)
      : plannerPlans.find((p) => p.name === this.planName);

  if (!plan) return false;

  if (plan.name === "Basic" || plan.name === "Starter") {
    return this.usage.photosUploaded < 10;
  }

  if (plan.name === "Professional") {
    return this.usage.photosUploaded < 50;
  }

  return true;
};

subscriptionSchema.methods.resetUsage = function () {
  this.usage = {
    eventsCreated: 0,
    photosUploaded: 0,
    lastResetDate: new Date(),
  };
  return this.save();
};

// Check if subscription is pending payment
subscriptionSchema.methods.isPendingPayment = function () {
  return this.status === "pending_payment";
};

// Activate subscription
subscriptionSchema.methods.activate = async function (paymentId) {
  this.status = "active";
  this.currentPaymentId = paymentId;
  this.history.push({
    planName: this.planName,
    status: "active",
    startDate: this.startDate,
    endDate: this.endDate,
    amount: this.amount,
    changeType: "activated",
  });
  await this.save();
};

// Add payment record to payment history
subscriptionSchema.methods.addPaymentRecord = function (
  paymentId,
  amount,
  type = "initial"
) {
  this.paymentHistory.push({
    payment: paymentId,
    amount,
    status: "completed",
    paidAt: new Date(),
    type,
  });
};

// Calculate prorated amount for upgrades
subscriptionSchema.methods.calculateProration = function (newPlanPrice) {
  const now = new Date();
  const daysRemaining = Math.ceil((this.endDate - now) / (1000 * 60 * 60 * 24));
  const totalDays = Math.ceil(
    (this.endDate - this.startDate) / (1000 * 60 * 60 * 24)
  );

  const currentPlanCredit = (this.amount / totalDays) * daysRemaining;
  const newPlanCost = (newPlanPrice / totalDays) * daysRemaining;

  return {
    daysRemaining,
    currentPlanCredit: Math.round(currentPlanCredit),
    newPlanCost: Math.round(newPlanCost),
    amountDue: Math.round(newPlanCost - currentPlanCredit),
  };
};

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
