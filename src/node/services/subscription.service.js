import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import Flutterwave from "flutterwave-node-v3";
import Paystack from "paystack";
import { sendSubscriptionEmail } from "../utils/email.js";
import { AppError } from "../utils/AppError.js";

// Initialize payment providers with error handling
let flutterwave;
try {
  if (
    process.env.FLUTTERWAVE_PUBLIC_KEY &&
    process.env.FLUTTERWAVE_SECRET_KEY
  ) {
    flutterwave = new Flutterwave(
      process.env.FLUTTERWAVE_PUBLIC_KEY,
      process.env.FLUTTERWAVE_SECRET_KEY
    );
  } else {
    console.warn(
      "Flutterwave keys not configured, payment functionality will be limited"
    );
  }
} catch (error) {
  console.error("Failed to initialize Flutterwave:", error.message);
  flutterwave = null;
}

let paystack;
try {
  if (process.env.PAYSTACK_SECRET_KEY) {
    paystack = new Paystack(process.env.PAYSTACK_SECRET_KEY);
  } else {
    console.warn(
      "Paystack key not configured, payment functionality will be limited"
    );
  }
} catch (error) {
  console.error("Failed to initialize Paystack:", error.message);
  paystack = null;
}

// Plan configurations
const vendorPlans = [
  {
    name: "Basic",
    price: 0,
    description: "Perfect for vendors just starting out",
    features: [
      "Basic profile listing",
      "Up to 5 event listings per month",
      "Basic analytics",
      "Email support",
      "Standard search visibility",
    ],
    limitations: [
      "No featured listings",
      "Limited photo uploads",
      "Basic customer reviews",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Professional",
    price: 4900, // $49 in NGN
    period: "/month",
    description: "Ideal for growing vendors",
    features: [
      "Enhanced profile listing",
      "Unlimited event listings",
      "Advanced analytics",
      "Priority support",
      "Featured in search results",
      "Photo gallery (up to 50 images)",
      "Customer review management",
      "Booking calendar",
    ],
    limitations: [],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 9900, // $99 in NGN
    period: "/month",
    description: "For established vendors",
    features: [
      "Premium profile listing",
      "Unlimited event listings",
      "Advanced analytics & reporting",
      "24/7 priority support",
      "Top search visibility",
      "Unlimited photo gallery",
      "Advanced review management",
      "Custom booking system",
      "API access",
      "White-label options",
    ],
    limitations: [],
    cta: "Contact Sales",
    popular: false,
  },
];

const plannerPlans = [
  {
    name: "Starter",
    price: 0,
    description: "Perfect for personal event planning",
    features: [
      "Basic event planning tools",
      "Up to 3 active events",
      "Basic vendor search",
      "Email support",
      "Standard templates",
    ],
    limitations: [
      "No AI recommendations",
      "Limited guest management",
      "Basic budget tracking",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Professional",
    price: 2900, // $29 in NGN
    period: "/month",
    description: "For professional event planners",
    features: [
      "Advanced planning tools",
      "Unlimited active events",
      "AI-powered recommendations",
      "Priority support",
      "Premium templates",
      "Advanced guest management",
      "Budget tracking & analytics",
      "Vendor management tools",
    ],
    limitations: [],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: 7900, // $79 in NGN
    period: "/month",
    description: "For event planning agencies",
    features: [
      "All Professional features",
      "Team collaboration tools",
      "Custom branding",
      "24/7 priority support",
      "Advanced analytics & reporting",
      "API access",
      "White-label options",
      "Dedicated account manager",
    ],
    limitations: [],
    cta: "Contact Sales",
    popular: false,
  },
];

class SubscriptionService {
  /**
   * Create subscription with payment initialization
   * Task 3.1: Implement createWithPayment method
   */
  async createWithPayment(
    userId,
    planType,
    planName,
    amount,
    currency = "NGN"
  ) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    // Get plan from database
    const SubscriptionPlan = (
      await import("../models/subscriptionPlan.model.js")
    ).default;
    const plan = await SubscriptionPlan.findByTypeAndName(planType, planName);

    if (!plan) throw new AppError("Invalid plan", 400);

    // Get pricing for currency
    const pricing = plan.getPriceForCurrency(currency);
    if (!pricing) {
      throw new AppError(`Plan not available in ${currency}`, 400);
    }

    // Verify amount matches plan price (prevent price manipulation)
    // Amount should already be in minor units from validation
    if (pricing.amountInMinorUnits !== amount) {
      throw new AppError("Invalid plan amount", 400);
    }

    // Calculate end date (1 month from now)
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // Create subscription
    const subscription = await Subscription.create({
      user: userId,
      planType,
      planName,
      status: amount === 0 ? "active" : "pending_payment",
      startDate: new Date(),
      endDate,
      paymentProvider: amount === 0 ? "none" : "flutterwave", // Default provider
      amount,
      currency,
      autoRenew: amount > 0,
      history: [
        {
          planName,
          status: amount === 0 ? "active" : "pending_payment",
          startDate: new Date(),
          endDate,
          amount,
          changeType: "created",
        },
      ],
    });

    // If free plan, activate immediately
    if (amount === 0) {
      return {
        subscription,
        paymentRequired: false,
      };
    }

    // Initialize payment for paid plans
    const paymentService = (await import("./payment.service.js")).default;
    const paymentResult = await paymentService.initializePayment({
      userId,
      subscriptionId: subscription._id,
      amount,
      currency,
      planType,
      planName,
      email: user.email,
      name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.username,
    });

    return {
      subscription,
      paymentRequired: true,
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.reference,
      amount: paymentResult.amount,
      currency,
    };
  }

  /**
   * Handle successful payment
   * Task 3.2: Implement handlePaymentSuccess method
   */
  async handlePaymentSuccess(paymentId) {
    const Payment = (await import("../models/payment.model.js")).default;
    const payment = await Payment.findById(paymentId).populate(
      "subscription user"
    );
    if (!payment) throw new AppError("Payment not found", 404);

    const subscription = payment.subscription;
    const user = payment.user;

    // Activate subscription
    await subscription.activate(paymentId);
    subscription.addPaymentRecord(paymentId, payment.amount, "initial");
    await subscription.save();

    // Update user status to pending_verification and activate account
    user.status = "pending_verification";
    user.isActive = true; // Activate user after successful payment
    await user.save();

    // Generate verification token and OTP
    const token = user.generateEmailVerificationToken();
    const otp = user.generateOTP();
    await user.save();

    // Send payment success email with verification link
    const { sendPaymentSuccessEmail, sendVerificationEmail } = await import(
      "../utils/email.js"
    );
    await sendPaymentSuccessEmail(user, subscription, token);

    // Send verification email
    await sendVerificationEmail(user, otp, token);

    return { subscription, user };
  }

  /**
   * Upgrade subscription
   * Task 3.3: Implement upgradeSubscription method
   */
  async upgradeSubscription(
    subscriptionId,
    newPlanName,
    paymentProvider = "flutterwave"
  ) {
    const subscription = await Subscription.findById(subscriptionId).populate(
      "user"
    );
    if (!subscription) throw new AppError("Subscription not found", 404);

    // Validate subscription is active
    if (!subscription.isActive()) {
      throw new AppError("Cannot upgrade inactive subscription", 400);
    }

    const currentPlan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === subscription.planName)
        : plannerPlans.find((p) => p.name === subscription.planName);

    const newPlan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === newPlanName)
        : plannerPlans.find((p) => p.name === newPlanName);

    if (!newPlan) throw new AppError("Invalid plan", 400);

    // Validate new plan is higher tier
    if (newPlan.price <= currentPlan.price) {
      throw new AppError("New plan must be higher tier", 400);
    }

    // Calculate prorated amount
    const prorationDetails = subscription.calculateProration(newPlan.price);

    // If amount due is 0 or negative, upgrade immediately
    if (prorationDetails.amountDue <= 0) {
      const previousPlanName = subscription.planName;
      subscription.planName = newPlanName;
      subscription.amount = newPlan.price;
      subscription.history.push({
        planName: newPlanName,
        status: "active",
        startDate: new Date(),
        endDate: subscription.endDate,
        amount: newPlan.price,
        changeType: "upgrade",
        proratedAmount: 0,
      });
      await subscription.save();

      // Send upgrade confirmation email
      const { sendUpgradeConfirmationEmail } = await import(
        "../utils/email.js"
      );
      await sendUpgradeConfirmationEmail(subscription.user, subscription, {
        previousPlan: previousPlanName,
        proratedAmount: 0,
      });

      return {
        subscription,
        paymentRequired: false,
        prorationDetails,
      };
    }

    // Initialize payment for prorated amount
    const paymentService = (await import("./payment.service.js")).default;
    const paymentResult = await paymentService.initializePayment({
      userId: subscription.user._id,
      subscriptionId: subscription._id,
      amount: prorationDetails.amountDue,
      planType: subscription.planType,
      planName: newPlanName,
      email: subscription.user.email,
      name:
        `${subscription.user.firstName || ""} ${
          subscription.user.lastName || ""
        }`.trim() || subscription.user.username,
      isUpgrade: true,
      previousPlan: subscription.planName,
      proratedAmount: prorationDetails.amountDue,
    });

    // Store pending upgrade details
    subscription.pendingUpgrade = {
      newPlanName,
      amount: newPlan.price,
      proratedAmount: prorationDetails.amountDue,
      paymentReference: paymentResult.reference,
    };
    await subscription.save();

    return {
      subscription,
      paymentRequired: true,
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.reference,
      prorationDetails,
    };
  }

  /**
   * Handle successful upgrade payment
   * Task 3.4: Implement handleUpgradePaymentSuccess method
   */
  async handleUpgradePaymentSuccess(paymentId) {
    const Payment = (await import("../models/payment.model.js")).default;
    const payment = await Payment.findById(paymentId).populate(
      "subscription user"
    );
    if (!payment) throw new AppError("Payment not found", 404);

    const subscription = payment.subscription;
    const newPlanName = payment.subscriptionDetails.planName;

    // Get new plan details
    const newPlan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === newPlanName)
        : plannerPlans.find((p) => p.name === newPlanName);

    if (!newPlan) throw new AppError("Invalid plan", 400);

    const previousPlan = subscription.planName;

    // Apply upgrade
    subscription.planName = newPlanName;
    subscription.amount = newPlan.price;

    subscription.history.push({
      planName: newPlanName,
      status: "active",
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: newPlan.price,
      changeType: "upgrade",
      proratedAmount: payment.subscriptionDetails.proratedAmount,
    });

    subscription.addPaymentRecord(paymentId, payment.amount, "upgrade");
    subscription.pendingUpgrade = undefined;
    await subscription.save();

    // Send upgrade confirmation email
    const { sendUpgradeConfirmationEmail } = await import("../utils/email.js");
    await sendUpgradeConfirmationEmail(subscription.user, subscription, {
      previousPlan,
      proratedAmount: payment.subscriptionDetails.proratedAmount,
    });

    return { subscription };
  }

  // Initialize trial subscription
  async initializeTrial(userId, planType, planName) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial

    const subscription = await Subscription.create({
      user: userId,
      planType,
      planName,
      status: "trial",
      startDate: new Date(),
      endDate: trialEndDate,
      trialEndDate,
      paymentProvider: "none",
      amount: 0,
      autoRenew: false,
    });

    await sendSubscriptionEmail(user, "trial_started", {
      planType,
      planName,
      trialEndDate,
    });

    return subscription;
  }

  // Create payment intent
  async createPaymentIntent(userId, planType, planName, paymentProvider) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const plan =
      planType === "vendor"
        ? vendorPlans.find((p) => p.name === planName)
        : plannerPlans.find((p) => p.name === planName);

    if (!plan) throw new AppError("Invalid plan", 400);

    let paymentIntent;
    if (paymentProvider === "flutterwave") {
      paymentIntent = await flutterwave.Charge.initiate({
        amount: plan.price,
        currency: "NGN",
        email: user.email,
        tx_ref: `SUB-${Date.now()}-${userId}`,
        customer: {
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
        },
        customizations: {
          title: `Confetti ${planType} Subscription`,
          description: `${planName} Plan Subscription`,
        },
      });
    } else if (paymentProvider === "paystack") {
      paymentIntent = await paystack.transaction.initialize({
        amount: plan.price * 100, // Convert to kobo
        email: user.email,
        reference: `SUB-${Date.now()}-${userId}`,
        callback_url: `${process.env.FRONTEND_URL}/subscription/verify`,
        metadata: {
          userId,
          planType,
          planName,
        },
      });
    }

    return paymentIntent;
  }

  // Verify payment and activate subscription
  async verifyPayment(paymentId, provider) {
    let paymentResponse;
    let payment;

    try {
      if (provider === "flutterwave") {
        paymentResponse = await flutterwave.Transaction.verify({
          id: paymentId,
        });
        // Flutterwave returns data in response.data
        payment = paymentResponse.data || paymentResponse;
      } else if (provider === "paystack") {
        paymentResponse = await paystack.transaction.verify(paymentId);
        // Paystack returns data in response.data
        payment = paymentResponse.data || paymentResponse;
      }
    } catch (error) {
      console.error("Payment verification API error:", error);
      throw new AppError(
        `Failed to verify payment with ${provider}: ${error.message}`,
        500
      );
    }

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    // Handle different payment statuses
    const paymentStatus = payment.status || payment.data?.status;

    if (paymentStatus === "pending") {
      throw new AppError(
        "Payment is still pending. Please wait for confirmation.",
        400
      );
    }

    if (paymentStatus === "failed") {
      throw new AppError("Payment failed. Please try again.", 400);
    }

    if (paymentStatus !== "success" && paymentStatus !== "successful") {
      throw new AppError(
        `Payment verification failed. Status: ${paymentStatus}`,
        400
      );
    }

    // Extract metadata - handle different response structures
    const metadata =
      payment.meta ||
      payment.metadata ||
      payment.data?.meta ||
      payment.data?.metadata ||
      {};
    const { userId, planType, planName, subscriptionId } = metadata;
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const plan =
      planType === "vendor"
        ? vendorPlans.find((p) => p.name === planName)
        : plannerPlans.find((p) => p.name === planName);

    // Find existing subscription or create new one
    let subscription;
    if (subscriptionId) {
      // Update existing subscription
      subscription = await Subscription.findById(subscriptionId);
      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      subscription.status = "active";
      subscription.paymentProvider = provider;
      subscription.paymentId = paymentId;
      subscription.startDate = new Date();

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      subscription.endDate = endDate;

      // Add to history
      subscription.history.push({
        planName,
        status: "active",
        startDate: new Date(),
        endDate,
        amount: plan.price,
        changeType: "activated",
      });

      await subscription.save();
    } else {
      // Create new subscription (fallback for old payments without subscriptionId)
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      subscription = await Subscription.create({
        user: userId,
        planType,
        planName,
        status: "active",
        startDate: new Date(),
        endDate,
        paymentProvider: provider,
        paymentId: paymentId,
        amount: plan.price,
        autoRenew: true,
        history: [
          {
            planName,
            status: "active",
            startDate: new Date(),
            endDate,
            amount: plan.price,
            changeType: "created",
          },
        ],
      });
    }

    // Update user status and send verification email
    if (user.status === "pending_payment") {
      user.status = "pending_verification";

      // Generate verification token and OTP
      const token = user.generateEmailVerificationToken();
      const otp = user.generateOTP();
      await user.save();

      // Send verification email
      const { sendVerificationEmail } = await import("../utils/email.js");
      await sendVerificationEmail(user, otp, token);

      console.log("Payment verified, verification email sent to:", user.email);
    }

    await sendSubscriptionEmail(user, "subscription_activated", {
      planType,
      planName,
      endDate: subscription.endDate,
    });

    return subscription;
  }

  // Upgrade subscription
  async upgradeSubscription(subscriptionId, newPlanName) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError("Subscription not found", 404);

    const currentPlan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === subscription.planName)
        : plannerPlans.find((p) => p.name === subscription.planName);

    const newPlan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === newPlanName)
        : plannerPlans.find((p) => p.name === newPlanName);

    if (!newPlan) throw new AppError("Invalid plan", 400);

    // Calculate prorated amount
    const daysRemaining = Math.ceil(
      (subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = Math.ceil(
      (subscription.endDate - subscription.startDate) / (1000 * 60 * 60 * 24)
    );
    const proratedAmount = Math.round(
      (newPlan.price - currentPlan.price) * (daysRemaining / totalDays)
    );

    // Update subscription
    subscription.planName = newPlanName;
    subscription.amount = newPlan.price;
    subscription.history.push({
      planName: newPlanName,
      status: "active",
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: newPlan.price,
      changeType: "upgrade",
      proratedAmount,
    });

    await subscription.save();

    return subscription;
  }

  // Downgrade subscription
  async downgradeSubscription(subscriptionId, newPlanName) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError("Subscription not found", 404);

    const currentPlan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === subscription.planName)
        : plannerPlans.find((p) => p.name === subscription.planName);

    const newPlan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === newPlanName)
        : plannerPlans.find((p) => p.name === newPlanName);

    if (!newPlan) throw new AppError("Invalid plan", 400);

    // Calculate prorated amount
    const daysRemaining = Math.ceil(
      (subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = Math.ceil(
      (subscription.endDate - subscription.startDate) / (1000 * 60 * 60 * 24)
    );
    const proratedAmount = Math.round(
      (currentPlan.price - newPlan.price) * (daysRemaining / totalDays)
    );

    // Update subscription
    subscription.planName = newPlanName;
    subscription.amount = newPlan.price;
    subscription.history.push({
      planName: newPlanName,
      status: "active",
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: newPlan.price,
      changeType: "downgrade",
      proratedAmount,
    });

    await subscription.save();

    return subscription;
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError("Subscription not found", 404);

    subscription.status = "cancelled";
    subscription.autoRenew = false;
    subscription.history.push({
      planName: subscription.planName,
      status: "cancelled",
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: subscription.amount,
      changeType: "cancellation",
    });

    await subscription.save();

    const user = await User.findById(subscription.user);
    await sendSubscriptionEmail(user, "subscription_cancelled", {
      planType: subscription.planType,
      planName: subscription.planName,
      endDate: subscription.endDate,
    });

    return subscription;
  }

  // Get user subscriptions
  async getUserSubscriptions(userId) {
    return Subscription.find({ user: userId });
  }

  // Check feature access
  async checkFeatureAccess(userId, planType, feature) {
    const subscription = await Subscription.findOne({
      user: userId,
      planType,
      status: { $in: ["active", "trial"] },
    });

    if (!subscription) return false;

    switch (feature) {
      case "createEvent":
        return subscription.canCreateEvent();
      case "uploadPhoto":
        return subscription.canUploadPhoto();
      default:
        return false;
    }
  }

  // Update usage
  async updateUsage(subscriptionId, feature, increment = 1) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new AppError("Subscription not found", 404);

    if (feature === "eventsCreated") {
      subscription.usage.eventsCreated += increment;
    } else if (feature === "photosUploaded") {
      subscription.usage.photosUploaded += increment;
    }

    await subscription.save();
    return subscription;
  }

  /**
   * Get current subscription (Task 8.1)
   * Requirements: 11.1, 11.2, 11.5
   */
  async getCurrentSubscription(userId) {
    // Find active subscription for user
    const subscription = await Subscription.findOne({
      user: userId,
      status: { $in: ["active", "trial", "pending_payment"] },
    }).populate("user", "email username firstName lastName");

    if (!subscription) {
      throw new AppError("No active subscription found", 404);
    }

    // Calculate days remaining
    const now = new Date();
    const daysRemaining = Math.ceil(
      (subscription.endDate - now) / (1000 * 60 * 60 * 24)
    );

    // Get payment history
    const Payment = (await import("../models/payment.model.js")).default;
    const paymentHistory = await Payment.find({
      subscription: subscription._id,
      status: "completed",
    })
      .select("amount currency status createdAt paymentMethod")
      .sort({ createdAt: -1 })
      .limit(5);

    return {
      subscription,
      usage: subscription.usage,
      daysRemaining: Math.max(0, daysRemaining),
      paymentHistory,
    };
  }

  /**
   * Get subscription usage (Task 8.2)
   * Requirements: 11.3
   */
  async getSubscriptionUsage(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new AppError("Subscription not found", 404);
    }

    // Get plan limits
    const plan =
      subscription.planType === "vendor"
        ? vendorPlans.find((p) => p.name === subscription.planName)
        : plannerPlans.find((p) => p.name === subscription.planName);

    if (!plan) {
      throw new AppError("Plan configuration not found", 404);
    }

    // Calculate usage percentages and limits
    const eventsLimit = plan.limitations?.includes("Up to")
      ? parseInt(
          plan.features.find((f) => f.includes("event"))?.match(/\d+/)?.[0] ||
            "-1"
        )
      : -1; // -1 means unlimited
    const photosLimit = plan.limitations?.includes("Limited photo")
      ? 10
      : plan.name === "Professional"
      ? 50
      : -1;

    return {
      usage: subscription.usage,
      limits: {
        eventsCreated: eventsLimit,
        photosUploaded: photosLimit,
      },
      percentages: {
        eventsCreated:
          eventsLimit > 0
            ? Math.round((subscription.usage.eventsCreated / eventsLimit) * 100)
            : 0,
        photosUploaded:
          photosLimit > 0
            ? Math.round(
                (subscription.usage.photosUploaded / photosLimit) * 100
              )
            : 0,
      },
      lastResetDate: subscription.usage.lastResetDate,
    };
  }

  /**
   * Get subscription payments (Task 8.3)
   * Requirements: 11.4
   */
  async getSubscriptionPayments(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      throw new AppError("Subscription not found", 404);
    }

    // Get all payments for this subscription
    const Payment = (await import("../models/payment.model.js")).default;
    const payments = await Payment.find({
      subscription: subscriptionId,
    })
      .select(
        "amount currency status paymentMethod paymentType subscriptionDetails createdAt transactionId reference"
      )
      .sort({ createdAt: -1 });

    return payments;
  }
}

export default new SubscriptionService();
