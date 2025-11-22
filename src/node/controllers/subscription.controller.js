import subscriptionService from "../services/subscription.service.js";
import { AppError } from "../utils/AppError.js";

// Get all plans
export const getPlans = async (req, res) => {
  res.json({
    status: "success",
    data: {
      vendorPlans,
      plannerPlans,
    },
  });
};

// Start trial
export const startTrial = async (req, res, next) => {
  try {
    const { planType, planName } = req.body;
    const subscription = await subscriptionService.initializeTrial(
      req.user._id,
      planType,
      planName
    );

    res.status(201).json({
      status: "success",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// Create payment intent
export const createPaymentIntent = async (req, res, next) => {
  try {
    const { planType, planName, paymentProvider } = req.body;
    const paymentIntent = await subscriptionService.createPaymentIntent(
      req.user._id,
      planType,
      planName,
      paymentProvider
    );

    res.json({
      status: "success",
      data: paymentIntent,
    });
  } catch (error) {
    next(error);
  }
};

// Verify payment (POST - for manual verification)
export const verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, provider } = req.body;
    const subscription = await subscriptionService.verifyPayment(
      paymentId,
      provider
    );

    res.json({
      status: "success",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// Handle payment callback (GET - for redirect from payment provider)
export const handlePaymentCallback = async (req, res, next) => {
  try {
    const { status, transaction_id, tx_ref, reference } = req.query;

    // Determine provider based on parameters
    const provider = transaction_id ? "flutterwave" : "paystack";
    const paymentId = transaction_id || reference;

    if (status === "successful" || status === "success") {
      // Verify the payment
      const subscription = await subscriptionService.verifyPayment(
        paymentId,
        provider
      );

      // Redirect to frontend success page
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/subscription/success?subscriptionId=${subscription._id}&planName=${subscription.planName}`
      );
    } else if (status === "cancelled" || status === "canceled") {
      // Redirect to frontend cancelled page
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/subscription/cancelled`);
    } else {
      // Redirect to frontend error page
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/subscription/error?message=Payment verification failed`
      );
    }
  } catch (error) {
    // Redirect to frontend error page with error message
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(
      `${frontendUrl}/subscription/error?message=${encodeURIComponent(
        error.message
      )}`
    );
  }
};

// Upgrade subscription
export const upgradeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPlanName, paymentProvider = "flutterwave" } = req.body;

    const result = await subscriptionService.upgradeSubscription(
      id,
      newPlanName,
      paymentProvider
    );

    // If payment is required, return payment URL and prorated details
    if (result.paymentRequired) {
      return res.json({
        status: "success",
        message: "Payment required to complete upgrade",
        data: {
          subscription: result.subscription,
          paymentUrl: result.paymentUrl,
          reference: result.reference,
          prorationDetails: result.prorationDetails,
        },
      });
    }

    // If no payment needed, return success
    return res.json({
      status: "success",
      message: "Subscription upgraded successfully",
      data: {
        subscription: result.subscription,
        prorationDetails: result.prorationDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Downgrade subscription
export const downgradeSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanName } = req.body;
    const subscription = await subscriptionService.downgradeSubscription(
      subscriptionId,
      newPlanName
    );

    res.json({
      status: "success",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const subscription = await subscriptionService.cancelSubscription(
      subscriptionId
    );

    res.json({
      status: "success",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// Get user subscriptions
export const getUserSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionService.getUserSubscriptions(
      req.user._id
    );

    res.json({
      status: "success",
      data: subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

// Check feature access
export const checkFeatureAccess = async (req, res, next) => {
  try {
    const { planType, feature } = req.params;
    const hasAccess = await subscriptionService.checkFeatureAccess(
      req.user._id,
      planType,
      feature
    );

    res.json({
      status: "success",
      data: { hasAccess },
    });
  } catch (error) {
    next(error);
  }
};

// Update usage
export const updateUsage = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { feature, increment } = req.body;
    const subscription = await subscriptionService.updateUsage(
      subscriptionId,
      feature,
      increment
    );

    res.json({
      status: "success",
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

// Get current subscription (Task 8.1)
export const getCurrentSubscription = async (req, res, next) => {
  try {
    const result = await subscriptionService.getCurrentSubscription(
      req.user._id
    );

    res.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Get subscription usage (Task 8.2)
export const getSubscriptionUsage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usage = await subscriptionService.getSubscriptionUsage(id);

    res.json({
      status: "success",
      data: usage,
    });
  } catch (error) {
    next(error);
  }
};

// Get subscription payments (Task 8.3)
export const getSubscriptionPayments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payments = await subscriptionService.getSubscriptionPayments(id);

    res.json({
      status: "success",
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
};
