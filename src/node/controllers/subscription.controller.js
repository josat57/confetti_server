import subscriptionService from "../services/subscription.service.js";
import { getUsageSummary } from "../services/plan-access.service.js";
import { CORPORATE_PLAN, YEARLY_MONTHS_CHARGED } from "../config/plans.js";

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";

/** Shape of a changePlan result for API responses */
const changeResponse = (res, result) => {
  const messages = {
    payment_required: "Payment required to complete the change",
    scheduled: "Your plan will change when the current billing period ends",
    changed: "Your plan has been changed",
  };
  return res.json({
    status: "success",
    message: messages[result.action],
    data: {
      action: result.action,
      subscription: result.subscription,
      paymentUrl: result.paymentUrl,
      reference: result.reference,
      // Older clients read paymentReference
      paymentReference: result.reference,
      amountDue: result.amountDue,
      currency: result.currency,
      effectiveAt: result.effectiveAt,
      freeUntil: result.freeUntil,
      prorationDetails: result.prorationDetails,
    },
  });
};

// Public: active plans with monthly and yearly prices
export const getPlans = async (req, res, next) => {
  try {
    const { planType } = req.query;
    const plans = await subscriptionService.listPlans(
      ["vendor", "planner"].includes(planType) ? planType : undefined
    );
    res.json({
      status: "success",
      data: {
        plans,
        vendorPlans: plans.filter((p) => p.planType === "vendor"),
        plannerPlans: plans.filter((p) => p.planType === "planner"),
        corporate: CORPORATE_PLAN,
        yearlyMonthsCharged: YEARLY_MONTHS_CHARGED,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const startTrial = async (req, res, next) => {
  try {
    const { planType, planName } = req.body;
    const subscription = await subscriptionService.initializeTrial(req.user._id, planType, planName);
    res.status(201).json({ status: "success", data: subscription });
  } catch (error) {
    next(error);
  }
};

export const createPaymentIntent = async (req, res, next) => {
  try {
    const { planName, paymentProvider, billingCycle, currency, couponCode } = req.body;
    const result = await subscriptionService.changePlan(req.user, {
      planName,
      paymentProvider,
      billingCycle,
      currency,
      couponCode,
    });
    return changeResponse(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Change plan (upgrade, downgrade or switch billing cycle)
 * POST /subscriptions/change-plan  { planId | planName, billingCycle, paymentProvider, currency, couponCode }
 * Also serves POST /subscriptions/upgrade and /subscriptions/downgrade ({ newPlanId | newPlanName, paymentMethod }).
 */
export const changePlan = async (req, res, next) => {
  try {
    const body = req.body || {};
    const result = await subscriptionService.changePlan(req.user, {
      planId: body.planId || body.newPlanId,
      planName: body.planName || body.newPlanName,
      billingCycle: body.billingCycle,
      paymentProvider: body.paymentProvider || body.paymentMethod || "flutterwave",
      currency: body.currency,
      couponCode: body.couponCode,
    });
    return changeResponse(res, result);
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, paymentReference, provider } = req.body;
    const subscription = await subscriptionService.verifyPayment(paymentId || paymentReference, provider);
    if (String(subscription.user) !== String(req.user._id) && req.user.role !== "admin") {
      return res.json({ status: "success", data: { verified: true } });
    }
    res.json({ status: "success", data: { verified: true, subscription } });
  } catch (error) {
    next(error);
  }
};

/**
 * Where the payment provider sends the payer back.
 * Flutterwave: ?status=successful&tx_ref=…&transaction_id=…
 * Paystack:    ?trxref=…&reference=…  (no status; the verification call decides)
 */
export const handlePaymentCallback = async (req, res) => {
  const { status, transaction_id, reference, trxref } = req.query;
  try {
    if (status === "cancelled" || status === "canceled") {
      return res.redirect(`${frontendUrl()}/subscription/cancelled`);
    }

    const isFlutterwave = !!transaction_id;
    const paymentId = transaction_id || reference || trxref;
    const flutterwaveOk = status === "successful" || status === "success" || status === "completed";

    if (!paymentId || (isFlutterwave && !flutterwaveOk)) {
      return res.redirect(`${frontendUrl()}/subscription/error?message=${encodeURIComponent("Payment was not completed")}`);
    }

    const subscription = await subscriptionService.verifyPayment(paymentId, isFlutterwave ? "flutterwave" : "paystack");
    return res.redirect(
      `${frontendUrl()}/subscription/success?subscriptionId=${subscription._id}&planName=${encodeURIComponent(subscription.planName)}`
    );
  } catch (error) {
    return res.redirect(`${frontendUrl()}/subscription/error?message=${encodeURIComponent(error.message)}`);
  }
};

export const upgradeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPlanName, paymentProvider = "flutterwave", billingCycle, currency, couponCode } = req.body;
    const result = await subscriptionService.upgradeSubscription(id, newPlanName, paymentProvider, req.user, {
      billingCycle,
      currency,
      couponCode,
    });
    return changeResponse(res, result);
  } catch (error) {
    next(error);
  }
};

export const downgradeSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanName } = req.body;
    const subscription = await subscriptionService.downgradeSubscription(subscriptionId, newPlanName, req.user);
    res.json({ status: "success", data: subscription });
  } catch (error) {
    next(error);
  }
};

export const cancelSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { reason, feedback } = req.body || {};
    const subscription = await subscriptionService.cancelSubscription(subscriptionId, req.user, { reason, feedback });
    res.json({ status: "success", data: subscription });
  } catch (error) {
    next(error);
  }
};

// POST /subscriptions/cancel — cancel my current plan at the end of its period
export const cancelMySubscription = async (req, res, next) => {
  try {
    const { reason, feedback } = req.body || {};
    const subscription = await subscriptionService.cancelOwn(req.user, { reason, feedback });
    res.json({
      status: "success",
      message: "Your plan stays active until the end of the billing period",
      data: { subscription },
    });
  } catch (error) {
    next(error);
  }
};

// POST /subscriptions/reactivate — undo a cancellation or scheduled downgrade
export const reactivateSubscription = async (req, res, next) => {
  try {
    const subscription = await subscriptionService.reactivate(req.user);
    res.json({ status: "success", data: { subscription } });
  } catch (error) {
    next(error);
  }
};

// GET /subscriptions/usage — my plan, limits and usage
export const getMyUsage = async (req, res, next) => {
  try {
    res.json({ status: "success", data: await getUsageSummary(req.user) });
  } catch (error) {
    next(error);
  }
};

// GET /subscriptions/history — my plan changes
export const getMyHistory = async (req, res, next) => {
  try {
    res.json({ status: "success", data: { history: await subscriptionService.getHistory(req.user) } });
  } catch (error) {
    next(error);
  }
};

export const getUserSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionService.getUserSubscriptions(req.user._id);
    res.json({ status: "success", data: subscriptions });
  } catch (error) {
    next(error);
  }
};

export const checkFeatureAccess = async (req, res, next) => {
  try {
    const { planType, feature } = req.params;
    const hasAccess = await subscriptionService.checkFeatureAccess(req.user._id, planType, feature);
    res.json({ status: "success", data: { hasAccess } });
  } catch (error) {
    next(error);
  }
};

export const updateUsage = async (req, res, next) => {
  try {
    const { subscriptionId } = req.params;
    const { feature, increment } = req.body;
    const subscription = await subscriptionService.updateUsage(subscriptionId, feature, increment, req.user);
    res.json({ status: "success", data: subscription });
  } catch (error) {
    next(error);
  }
};

export const getCurrentSubscription = async (req, res, next) => {
  try {
    const result = await subscriptionService.getCurrentSubscription(req.user._id);
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionUsage = async (req, res, next) => {
  try {
    const usage = await subscriptionService.getSubscriptionUsage(req.params.id, req.user);
    res.json({ status: "success", data: usage });
  } catch (error) {
    next(error);
  }
};

export const getSubscriptionPayments = async (req, res, next) => {
  try {
    const payments = await subscriptionService.getSubscriptionPayments(req.params.id, req.user);
    res.json({ status: "success", data: { payments } });
  } catch (error) {
    next(error);
  }
};
