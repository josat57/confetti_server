import mongoose from "mongoose";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import User from "../models/user.model.js";
import Flutterwave from "flutterwave-node-v3";
import axios from "axios";
import { sendSubscriptionEmail } from "../utils/email.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { planTypeForRole, resolvePlan } from "../config/plans.js";
import { periodEnd, priceFor } from "./plan-catalogue.service.js";
import { getActivePlan, getUsageSummary } from "./plan-access.service.js";

/**
 * Subscriptions. Prices come from the SubscriptionPlan collection (admin-editable,
 * synced from config/plans.js) and are handled in minor units (kobo, cents) throughout.
 * Plan changes go through changePlan(): upgrades are paid before they apply,
 * downgrades and cancellations take effect when the paid period ends.
 */

// Prorated amounts below this (₦100 / $1) are waived instead of charged
const MIN_CHARGE_MINOR = 10000;
// Free plans don't expire
const FREE_PLAN_YEARS = 100;
const TRIAL_DAYS = 14;

let flutterwave;
try {
  if (process.env.FLUTTERWAVE_PUBLIC_KEY && process.env.FLUTTERWAVE_SECRET_KEY) {
    flutterwave = new Flutterwave(process.env.FLUTTERWAVE_PUBLIC_KEY, process.env.FLUTTERWAVE_SECRET_KEY);
  }
} catch (error) {
  logger.error("Failed to initialize Flutterwave:", { message: error.message });
  flutterwave = null;
}

// Paystack REST API, called directly: the `paystack` npm package depends on
// the deprecated, vulnerable `request` library.
const paystackVerify = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, timeout: 30000 }
    );
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message);
  }
};

const normaliseCycle = (cycle) => (cycle === "yearly" || cycle === "annual" ? "yearly" : "monthly");
const displayName = (user) => `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || user.email;
const idOf = (v) => (v?._id || v)?.toString();

const freePlanEnd = () => {
  const end = new Date();
  end.setFullYear(end.getFullYear() + FREE_PLAN_YEARS);
  return end;
};

/** A plan document by id or name (old names resolve to their replacement) */
const findPlanDoc = async (planType, { planId, planName }) => {
  let doc = null;
  if (planId && mongoose.isValidObjectId(planId)) {
    doc = await SubscriptionPlan.findOne({ _id: planId, isActive: true });
  }
  if (!doc && (planName || planId)) {
    doc = await SubscriptionPlan.findByTypeAndName(planType, planName || planId);
  }
  if (!doc || doc.planType !== planType) throw new AppError("Invalid plan", 400);
  return doc;
};

/** Price per month of a plan doc, for comparing plans billed on different cycles */
const monthlyMinor = (planDoc, currency) => planDoc?.getPriceForCurrency(currency)?.amountInMinorUnits ?? 0;

/** Make sure the subscription belongs to the user (admins may act on any) */
const loadOwnSubscription = async (subscriptionId, user) => {
  if (!mongoose.isValidObjectId(subscriptionId)) throw new AppError("Subscription not found", 404);
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) throw new AppError("Subscription not found", 404);
  if (user && user.role !== "admin" && idOf(subscription.user) !== idOf(user)) {
    throw new AppError("Subscription not found", 404);
  }
  return subscription;
};

/** The user's newest subscription of a type, whatever its status */
const latestSubscription = (userId, planType) =>
  Subscription.findOne({ user: userId, planType }).sort({ createdAt: -1 });

/**
 * Check a coupon for a plan purchase. Returns null when no code was given.
 * Coupon amounts (fixed value, minimum purchase) are in major units of the coupon's currency.
 * `free_trial` coupons give `value` months of the plan without payment.
 */
const evaluateCoupon = async ({ code, user, planType, planDoc, amountMinor, currency }) => {
  if (!code) return null;
  const couponService = (await import("./couponService.js")).default;
  const Coupon = (await import("../models/Coupon.js")).default;
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  if (!coupon) throw new AppError("Invalid coupon code", 400);

  const allowedPlans = (coupon.applicableTo?.subscriptionPlans || []).map((p) => p.toLowerCase());
  if (allowedPlans.length && !allowedPlans.includes(planDoc.planName.toLowerCase())) {
    throw new AppError(`This coupon doesn't apply to the ${planDoc.displayName} plan`, 400);
  }
  if (coupon.type === "fixed" && coupon.currency !== currency) {
    throw new AppError(`This coupon can only be used for payments in ${coupon.currency}`, 400);
  }

  const result = await couponService.validateCoupon(coupon.code, user._id, planType, null, amountMinor / 100);
  if (!result.valid) throw new AppError(result.reason || "This coupon can't be used", 400);

  if (coupon.type === "free_trial") {
    const months = Math.max(1, Math.round(coupon.value));
    return { code: coupon.code, freeMonths: months, discountMinor: amountMinor };
  }
  const discountMinor = Math.min(amountMinor, Math.round((result.discount || 0) * 100));
  return { code: coupon.code, discountMinor };
};

const recordCouponUse = async ({ code, user, planType, orderId, originalMinor, currency }) => {
  if (!code) return;
  try {
    const couponService = (await import("./couponService.js")).default;
    await couponService.applyCoupon(code, user._id || user, planType, orderId, "Subscription", originalMinor / 100, currency);
  } catch (error) {
    logger.warn("Coupon usage not recorded", { code, error: error.message });
  }
};

class SubscriptionService {
  /**
   * Check a coupon for a plan before an account exists (sign-up). Throws AppError when
   * it can't be used. Returns null when no code is given.
   */
  async previewCoupon({ code, planType, planName, billingCycle = "monthly", currency = "NGN" }) {
    if (!code) return null;
    const planDoc = await findPlanDoc(planType, { planName });
    const price = priceFor(planDoc, currency, normaliseCycle(billingCycle));
    if (!price) throw new AppError(`The ${planDoc.displayName} plan isn't available in ${currency}`, 400);
    return evaluateCoupon({
      code,
      user: { _id: new mongoose.Types.ObjectId() },
      planType,
      planDoc,
      amountMinor: price.amountInMinorUnits,
      currency,
    });
  }

  /**
   * Subscription created at registration. Free plans activate at once; paid plans
   * wait for payment. `amount` is in minor units and must match the plan's price.
   */
  async createWithPayment(userId, planType, planName, amount, currency = "NGN", billingCycle = "monthly") {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const plan = await SubscriptionPlan.findByTypeAndName(planType, planName);
    if (!plan) throw new AppError("Invalid plan", 400);

    const cycle = normaliseCycle(billingCycle);
    const pricing = priceFor(plan, currency, cycle);
    if (!pricing) throw new AppError(`Plan not available in ${currency}`, 400);

    // Verify amount matches plan price (prevent price manipulation)
    if (pricing.amountInMinorUnits !== amount) {
      throw new AppError("Invalid plan amount", 400);
    }

    const isFree = amount === 0;
    const endDate = isFree ? freePlanEnd() : periodEnd(cycle);
    const subscription = await Subscription.create({
      user: userId,
      planType,
      planName: plan.planName,
      status: isFree ? "active" : "pending_payment",
      startDate: new Date(),
      endDate,
      paymentProvider: isFree ? "none" : "flutterwave",
      amount,
      currency,
      billingCycle: isFree ? "monthly" : cycle,
      autoRenew: !isFree,
      history: [
        {
          planName: plan.planName,
          status: isFree ? "active" : "pending_payment",
          startDate: new Date(),
          endDate,
          amount,
          changeType: "created",
        },
      ],
    });

    if (isFree) return { subscription, paymentRequired: false };

    const paymentService = (await import("./payment.service.js")).default;
    const paymentResult = await paymentService.initializePayment({
      userId,
      subscriptionId: subscription._id,
      amount,
      currency,
      planType,
      planName: plan.planName,
      billingCycle: cycle,
      email: user.email,
      name: displayName(user),
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
   * First payment for a subscription created at registration succeeded.
   * Called once per payment (payment.service claims the payment atomically).
   */
  async handlePaymentSuccess(paymentId) {
    const Payment = (await import("../models/payment.model.js")).default;
    const payment = await Payment.findById(paymentId).populate("subscription user");
    if (!payment) throw new AppError("Payment not found", 404);

    const subscription = payment.subscription;
    const user = payment.user;
    const details = payment.subscriptionDetails || {};

    // The paid period starts when the payment arrives, not when the account was created
    const cycle = normaliseCycle(details.billingCycle || subscription.billingCycle);
    subscription.billingCycle = cycle;
    subscription.startDate = new Date();
    subscription.endDate = periodEnd(cycle);
    subscription.paymentProvider = payment.paymentMethod || subscription.paymentProvider;
    await subscription.activate(paymentId);
    subscription.addPaymentRecord(paymentId, payment.amount, "initial");
    await subscription.save();

    await recordCouponUse({
      code: details.couponCode,
      user,
      planType: subscription.planType,
      orderId: subscription._id,
      originalMinor: details.originalAmount || payment.amount,
      currency: payment.currency,
    });

    // New accounts: payment done, now verify the email address
    if (user.status === "pending_payment") {
      user.status = "pending_verification";
      user.isActive = true;
      const token = user.generateEmailVerificationToken();
      const otp = user.generateOTP();
      await user.save();

      try {
        const { sendPaymentSuccessEmail, sendVerificationEmail } = await import("../utils/email.js");
        await sendPaymentSuccessEmail(user, subscription, token);
        await sendVerificationEmail(user, otp, token);
      } catch (error) {
        logger.warn("Payment success emails failed", { error: error.message, user: user._id });
      }
    }

    return { subscription, user };
  }

  /**
   * Change to another plan (vendor or planner). Upgrades return a payment link and
   * apply once paid; moving to a cheaper plan is scheduled for the end of the paid period.
   * Returns { action: "payment_required" | "changed" | "scheduled", subscription, … }.
   */
  async changePlan(userOrId, { planId, planName, billingCycle, paymentProvider = "flutterwave", currency, couponCode } = {}) {
    const user = userOrId?.email ? userOrId : await User.findById(userOrId);
    if (!user) throw new AppError("User not found", 404);
    const planType = planTypeForRole(user.role);
    if (planType === "client") {
      throw new AppError("Event passes for your account type are coming soon", 400);
    }
    if (!["flutterwave", "paystack"].includes(paymentProvider)) {
      throw new AppError("Invalid payment provider", 400);
    }

    const target = await findPlanDoc(planType, { planId, planName });
    const current = await latestSubscription(user._id, planType);
    const currentDoc = current ? await SubscriptionPlan.findByTypeAndName(planType, current.planName) : null;
    const cycle = normaliseCycle(billingCycle || current?.billingCycle);
    const payCurrency = currency || current?.currency || "NGN";
    const targetPrice = priceFor(target, payCurrency, cycle);
    if (!targetPrice) throw new AppError(`The ${target.displayName} plan isn't available in ${payCurrency}`, 400);

    const now = new Date();
    const currentIsLive = current && current.isActive() && current.endDate > now && current.status !== "pending_payment";
    const currentIsPaid = currentIsLive && current.status !== "trial" && monthlyMinor(currentDoc, payCurrency) > 0;
    const samePlan = currentDoc && idOf(currentDoc) === idOf(target);

    if (samePlan && currentIsLive && (current.billingCycle === cycle || targetPrice.amountInMinorUnits === 0)) {
      if (current.status === "cancelled") {
        throw new AppError("You're already on this plan. Reactivate it to keep it after it ends.", 400);
      }
      if (current.pendingChange?.planName) {
        // Changing back to the current plan cancels a scheduled downgrade
        current.pendingChange = undefined;
        await current.save();
        return { action: "changed", subscription: current };
      }
      throw new AppError("You're already on this plan", 400);
    }

    // Cheaper plan while a paid period is running: switch when the period ends
    const isDowngrade =
      currentIsPaid && monthlyMinor(target, payCurrency) < monthlyMinor(currentDoc, payCurrency);
    if (isDowngrade) {
      current.pendingChange = {
        planName: target.planName,
        billingCycle: cycle,
        effectiveAt: current.endDate,
        requestedAt: now,
      };
      // Renewal switches to the cheaper plan (services/subscription-renewal.service.js)
      current.history.push({
        planName: target.planName,
        status: current.status,
        startDate: current.endDate,
        endDate: current.endDate,
        amount: targetPrice.amountInMinorUnits,
        changeType: "downgrade",
        reason: `Scheduled change from ${current.planName} to ${target.planName}`,
      });
      await current.save();
      return { action: "scheduled", subscription: current, effectiveAt: current.endDate };
    }

    // Free target with nothing paid running: switch now
    if (targetPrice.amountInMinorUnits === 0) {
      const subscription = await this._applyPlan({
        user,
        subscription: current,
        planType,
        planDoc: target,
        cycle: "monthly",
        amount: 0,
        currency: payCurrency,
        newPeriod: true,
        changeType: current ? "downgrade" : "created",
      });
      return { action: "changed", subscription };
    }

    // Upgrade. From a paid plan on the same cycle: pay the difference for the days left.
    // Otherwise (free, trial, lapsed, or switching to yearly): pay the full price for a
    // new period, less the unused part of the current paid period.
    let amountDue = targetPrice.amountInMinorUnits;
    let newPeriod = true;
    if (currentIsPaid) {
      const currentPrice = priceFor(currentDoc, payCurrency, current.billingCycle)?.amountInMinorUnits || 0;
      const total = Math.max(current.endDate - current.startDate, 1);
      const remaining = Math.min(Math.max(current.endDate - now, 0) / total, 1);
      if (current.billingCycle === cycle) {
        amountDue = Math.round((targetPrice.amountInMinorUnits - currentPrice) * remaining);
        newPeriod = false;
      } else {
        amountDue = Math.round(targetPrice.amountInMinorUnits - currentPrice * remaining);
      }
    }

    const coupon = await evaluateCoupon({
      code: couponCode,
      user,
      planType,
      planDoc: target,
      amountMinor: Math.max(amountDue, 0),
      currency: payCurrency,
    });

    if (coupon?.freeMonths) {
      const end = new Date(now);
      end.setMonth(end.getMonth() + coupon.freeMonths);
      const subscription = await this._applyPlan({
        user,
        subscription: current,
        planType,
        planDoc: target,
        cycle,
        amount: 0,
        currency: payCurrency,
        newPeriod: true,
        endDate: end,
        changeType: "upgrade",
        reason: `Coupon ${coupon.code}: ${coupon.freeMonths} month(s) free`,
      });
      subscription.couponCode = coupon.code;
      subscription.autoRenew = false;
      await subscription.save();
      await recordCouponUse({
        code: coupon.code,
        user,
        planType,
        orderId: subscription._id,
        originalMinor: targetPrice.amountInMinorUnits,
        currency: payCurrency,
      });
      return { action: "changed", subscription, freeUntil: end };
    }

    const originalAmount = amountDue;
    if (coupon) amountDue -= coupon.discountMinor;

    if (amountDue < MIN_CHARGE_MINOR) {
      const subscription = await this._applyPlan({
        user,
        subscription: current,
        planType,
        planDoc: target,
        cycle,
        amount: targetPrice.amountInMinorUnits,
        currency: payCurrency,
        newPeriod,
        changeType: "upgrade",
      });
      return { action: "changed", subscription };
    }

    // The payment attaches to the existing subscription (or a new pending one)
    const subscription =
      current ||
      (await Subscription.create({
        user: user._id,
        planType,
        planName: target.planName,
        status: "pending_payment",
        startDate: now,
        endDate: periodEnd(cycle),
        paymentProvider,
        amount: targetPrice.amountInMinorUnits,
        currency: payCurrency,
        billingCycle: cycle,
        history: [{ planName: target.planName, status: "pending_payment", startDate: now, amount: amountDue, changeType: "created" }],
      }));

    const paymentService = (await import("./payment.service.js")).default;
    const paymentResult = await paymentService.initializePayment({
      userId: user._id,
      subscriptionId: subscription._id,
      amount: amountDue,
      currency: payCurrency,
      planType,
      planName: target.planName,
      billingCycle: cycle,
      email: user.email,
      name: displayName(user),
      paymentProvider,
      isUpgrade: true,
      previousPlan: current?.planName,
      proratedAmount: amountDue,
      newPeriod,
      couponCode: coupon?.code,
      originalAmount,
      discountAmount: coupon?.discountMinor,
    });

    subscription.pendingUpgrade = {
      newPlanName: target.planName,
      amount: targetPrice.amountInMinorUnits,
      proratedAmount: amountDue,
      paymentReference: paymentResult.reference,
    };
    await subscription.save();

    return {
      action: "payment_required",
      subscription,
      paymentRequired: true,
      paymentUrl: paymentResult.paymentUrl,
      reference: paymentResult.reference,
      amountDue,
      currency: payCurrency,
      prorationDetails: { amountDue, newPeriod, originalAmount, discount: coupon?.discountMinor || 0 },
    };
  }

  /** Put a subscription on a plan now (no payment involved) */
  async _applyPlan({ user, subscription, planType, planDoc, cycle, amount, currency, newPeriod, endDate, startAt, changeType, reason }) {
    const now = new Date();
    const isFree = (planDoc.getPriceForCurrency(currency)?.amountInMinorUnits ?? 0) === 0;
    const periodStart = startAt || now;
    const start = newPeriod || !subscription ? periodStart : subscription.startDate;
    const end = endDate || (isFree ? freePlanEnd() : newPeriod || !subscription ? periodEnd(cycle, periodStart) : subscription.endDate);
    const previousPlan = subscription?.planName;

    if (!subscription) {
      subscription = new Subscription({ user: user._id, planType, paymentProvider: "none", history: [] });
    }
    subscription.set({
      planName: planDoc.planName,
      status: "active",
      startDate: start,
      endDate: end,
      amount,
      currency,
      billingCycle: isFree ? "monthly" : cycle,
      autoRenew: !isFree,
      cancelAtPeriodEnd: false,
      pendingChange: undefined,
      pendingUpgrade: undefined,
      renewalAttempts: 0,
    });
    subscription.history.push({
      planName: planDoc.planName,
      status: "active",
      startDate: start,
      endDate: end,
      amount,
      changeType,
      reason: reason || (previousPlan ? `Changed from ${previousPlan}` : undefined),
    });
    await subscription.save();

    if (idOf(user.subscription) !== idOf(subscription)) {
      await User.updateOne({ _id: user._id }, { $set: { subscription: subscription._id } });
    }
    return subscription;
  }

  /**
   * Upgrade payment succeeded: apply the plan it paid for.
   * Called once per payment (payment.service claims the payment atomically).
   */
  async handleUpgradePaymentSuccess(paymentId) {
    const Payment = (await import("../models/payment.model.js")).default;
    const payment = await Payment.findById(paymentId).populate("subscription user");
    if (!payment) throw new AppError("Payment not found", 404);

    const subscription = payment.subscription;
    const user = payment.user;
    const details = payment.subscriptionDetails || {};
    const planDoc = await SubscriptionPlan.findByTypeAndName(subscription.planType, details.planName);
    if (!planDoc) throw new AppError("Invalid plan", 400);

    const cycle = normaliseCycle(details.billingCycle || subscription.billingCycle);
    const fullPrice = priceFor(planDoc, payment.currency, cycle)?.amountInMinorUnits ?? payment.amount;
    const previousPlan = details.previousPlan || subscription.planName;
    const lapsed = !subscription.isActive() || subscription.status === "pending_payment" || subscription.endDate <= new Date();
    const isRenewal = !!details.isRenewal;

    await this._applyPlan({
      user,
      subscription,
      planType: subscription.planType,
      planDoc,
      cycle,
      amount: fullPrice,
      currency: payment.currency,
      newPeriod: !!details.newPeriod || lapsed,
      // A renewal charged before the end continues from the old end date
      startAt: isRenewal && subscription.endDate > new Date() ? subscription.endDate : undefined,
      changeType: isRenewal ? "renewal" : "upgrade",
      reason: isRenewal ? `Renewed (${cycle})` : `Upgraded from ${previousPlan}`,
    });
    subscription.paymentProvider = payment.paymentMethod || subscription.paymentProvider;
    subscription.addPaymentRecord(paymentId, payment.amount, isRenewal ? "renewal" : "upgrade");
    await subscription.save();

    await recordCouponUse({
      code: details.couponCode,
      user,
      planType: subscription.planType,
      orderId: subscription._id,
      originalMinor: details.originalAmount || payment.amount,
      currency: payment.currency,
    });

    if (isRenewal) return { subscription };

    try {
      const { sendUpgradeConfirmationEmail } = await import("../utils/email.js");
      await sendUpgradeConfirmationEmail(user, subscription, {
        previousPlan,
        proratedAmount: details.proratedAmount,
      });
    } catch (error) {
      logger.warn("Upgrade confirmation email failed", { error: error.message, user: user._id });
    }

    return { subscription };
  }

  /** 14-day trial of a paid plan: once per account, and not while a paid plan is running */
  async initializeTrial(userId, planType, planName) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);
    const userType = planTypeForRole(user.role);
    if (planType && planType !== userType) throw new AppError("Invalid plan type", 400);

    const plan = await findPlanDoc(userType, { planName });
    if (monthlyMinor(plan, "NGN") === 0) throw new AppError("Free plans don't need a trial", 400);

    const hadTrial = await Subscription.exists({
      user: userId,
      $or: [{ status: "trial" }, { trialEndDate: { $exists: true } }],
    });
    if (hadTrial) throw new AppError("You've already used your free trial", 400);

    const { subscription: running } = await getActivePlan(user);
    if (running && running.amount > 0 && running.status !== "trial") {
      throw new AppError("You already have a paid plan", 400);
    }

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

    const subscription = await Subscription.create({
      user: userId,
      planType: userType,
      planName: plan.planName,
      status: "trial",
      startDate: new Date(),
      endDate: trialEndDate,
      trialEndDate,
      paymentProvider: "none",
      amount: 0,
      autoRenew: false,
      history: [{ planName: plan.planName, status: "trial", startDate: new Date(), endDate: trialEndDate, amount: 0, changeType: "created" }],
    });
    await User.updateOne({ _id: userId }, { $set: { subscription: subscription._id } });

    try {
      await sendSubscriptionEmail(user, "trial_started", { planType: userType, planName: plan.planName, trialEndDate });
    } catch (error) {
      logger.warn("Trial email failed", { error: error.message, user: userId });
    }
    return subscription;
  }

  /** Older endpoint: start paying for a plan. Same as changePlan. */
  async createPaymentIntent(userId, planType, planName, paymentProvider) {
    return this.changePlan(userId, { planName, paymentProvider });
  }

  /**
   * Confirm a payment after the provider redirects back (or from the app).
   * `paymentId` is Flutterwave's transaction id or Paystack's reference.
   */
  async verifyPayment(paymentId, provider) {
    if (!paymentId) throw new AppError("Payment reference is required", 400);
    let data;
    try {
      if (provider === "flutterwave") {
        if (!flutterwave) throw new Error("Flutterwave not configured");
        const response = await flutterwave.Transaction.verify({ id: paymentId });
        data = response?.data;
      } else if (provider === "paystack") {
        if (!process.env.PAYSTACK_SECRET_KEY) throw new Error("Paystack not configured");
        const response = await paystackVerify(paymentId);
        data = response?.data;
      } else {
        throw new AppError("Invalid payment provider", 400);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error("Payment verification API error", { provider, error: error.message });
      throw new AppError(`Failed to verify payment with ${provider}: ${error.message}`, 502);
    }

    if (!data) throw new AppError("Payment not found", 404);

    const status = data.status;
    if (status === "pending") throw new AppError("Payment is still pending. Please wait for confirmation.", 400);
    if (status === "failed") throw new AppError("Payment failed. Please try again.", 400);
    if (status !== "success" && status !== "successful") {
      throw new AppError(`Payment verification failed. Status: ${status}`, 400);
    }

    const Payment = (await import("../models/payment.model.js")).default;
    const meta = data.meta || data.metadata || {};
    const reference = data.tx_ref || data.reference;
    let payment = null;
    if (meta.paymentId && mongoose.isValidObjectId(meta.paymentId)) payment = await Payment.findById(meta.paymentId);
    if (!payment && reference) payment = await Payment.findOne({ reference });
    if (!payment) throw new AppError("Payment record not found", 404);

    const paymentService = (await import("./payment.service.js")).default;
    await paymentService.completeSubscriptionPayment(payment._id, { provider, data });

    const subscription = await Subscription.findById(payment.subscription);
    if (!subscription) throw new AppError("Subscription not found", 404);
    return subscription;
  }

  /** Upgrade a subscription the user owns (older endpoint; see changePlan) */
  async upgradeSubscription(subscriptionId, newPlanName, paymentProvider = "flutterwave", user = null, options = {}) {
    const subscription = await loadOwnSubscription(subscriptionId, user);
    return this.changePlan(subscription.user, {
      planName: newPlanName,
      paymentProvider,
      billingCycle: options.billingCycle || subscription.billingCycle,
      currency: options.currency || subscription.currency,
      couponCode: options.couponCode,
    });
  }

  /** Move a subscription the user owns to a cheaper plan at the end of its period */
  async downgradeSubscription(subscriptionId, newPlanName, user = null) {
    const subscription = await loadOwnSubscription(subscriptionId, user);
    const result = await this.changePlan(subscription.user, {
      planName: newPlanName,
      billingCycle: subscription.billingCycle,
      currency: subscription.currency,
    });
    return result.subscription;
  }

  /** Cancel: the plan stays until the paid period ends, then the account moves to the free plan */
  async cancelSubscription(subscriptionId, user = null, { reason, feedback } = {}) {
    const subscription = await loadOwnSubscription(subscriptionId, user);
    if (subscription.status === "cancelled") return subscription;

    subscription.status = "cancelled";
    subscription.autoRenew = false;
    subscription.cancelAtPeriodEnd = true;
    subscription.cancellationDetails = { cancelledAt: new Date(), reason, feedback };
    subscription.history.push({
      planName: subscription.planName,
      status: "cancelled",
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: subscription.amount,
      changeType: "cancellation",
      reason,
    });
    await subscription.save();

    try {
      const owner = await User.findById(subscription.user);
      await sendSubscriptionEmail(owner, "subscription_cancelled", {
        planType: subscription.planType,
        planName: subscription.planName,
        endDate: subscription.endDate,
      });
    } catch (error) {
      logger.warn("Cancellation email failed", { error: error.message, subscription: subscription._id });
    }
    return subscription;
  }

  /** The user's current subscription (for the "my subscription" endpoints) */
  async getOwnCurrentSubscription(user) {
    const subscription = await Subscription.findOne({
      user: user._id,
      planType: planTypeForRole(user.role),
      status: { $in: ["active", "trial", "cancelled", "pending_payment"] },
    }).sort({ createdAt: -1 });
    if (!subscription) throw new AppError("No subscription found", 404);
    return subscription;
  }

  async cancelOwn(user, details) {
    const subscription = await this.getOwnCurrentSubscription(user);
    return this.cancelSubscription(subscription._id, user, details);
  }

  /** Undo a cancellation (or a scheduled downgrade) before the period ends */
  async reactivate(user) {
    const subscription = await Subscription.findOne({
      user: user._id,
      planType: planTypeForRole(user.role),
      endDate: { $gt: new Date() },
      $or: [{ status: "cancelled" }, { "pendingChange.planName": { $exists: true } }],
    }).sort({ createdAt: -1 });
    if (!subscription) throw new AppError("There's no cancelled plan to reactivate", 400);

    subscription.status = "active";
    subscription.cancelAtPeriodEnd = false;
    subscription.autoRenew = true;
    subscription.pendingChange = undefined;
    subscription.history.push({
      planName: subscription.planName,
      status: "active",
      startDate: new Date(),
      endDate: subscription.endDate,
      amount: subscription.amount,
      changeType: "activated",
      reason: "Reactivated",
    });
    await subscription.save();
    return subscription;
  }

  /** Plan changes across all of the user's subscriptions, newest first */
  async getHistory(user) {
    const subscriptions = await Subscription.find({ user: user._id }).select("history").lean();
    return subscriptions
      .flatMap((s) => s.history || [])
      .sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
  }

  async getUserSubscriptions(userId) {
    return Subscription.find({ user: userId }).sort({ createdAt: -1 });
  }

  /** Can the user do `feature` now? Limits are checked against current usage. */
  async checkFeatureAccess(userId, planType, feature) {
    const user = await User.findById(userId).select("role");
    if (!user) return false;
    const { plan } = await getActivePlan(user);
    if (!plan) return false;

    const limitFor = { createEvent: plan.limits.activeEvents !== undefined ? "activeEvents" : "events", uploadPhoto: "portfolioPhotos" };
    const resource = limitFor[feature];
    if (resource) {
      const limit = plan.limits[resource];
      if (limit === undefined || limit === null) return true;
      const { countResourceUsage } = await import("./plan-access.service.js");
      const used = await countResourceUsage(resource, user, planTypeForRole(user.role));
      return used < limit;
    }
    return !!plan.features[feature];
  }

  // Usage counters kept for older clients; limits are counted from real data
  async updateUsage(subscriptionId, feature, increment = 1, user = null) {
    const subscription = await loadOwnSubscription(subscriptionId, user);
    if (feature === "eventsCreated") {
      subscription.usage.eventsCreated += increment;
    } else if (feature === "photosUploaded") {
      subscription.usage.photosUploaded += increment;
    }
    await subscription.save();
    return subscription;
  }

  async getCurrentSubscription(userId) {
    const user = await User.findById(userId).select("role");
    const subscription = await Subscription.findOne({
      user: userId,
      ...(user ? { planType: planTypeForRole(user.role) } : {}),
      $or: [
        { status: { $in: ["active", "trial", "pending_payment"] } },
        { status: "cancelled", endDate: { $gt: new Date() } },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("user", "email username firstName lastName");

    if (!subscription) throw new AppError("No active subscription found", 404);

    const daysRemaining = Math.ceil((subscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
    const Payment = (await import("../models/payment.model.js")).default;
    const paymentHistory = await Payment.find({ subscription: subscription._id, status: "completed" })
      .select("amount currency status createdAt paymentMethod")
      .sort({ createdAt: -1 })
      .limit(5);

    const plan = resolvePlan(subscription.planType, subscription.planName);
    return {
      subscription,
      plan: plan ? { key: plan.key, displayName: plan.displayName, level: plan.level, limits: plan.limits, features: plan.features } : null,
      usage: subscription.usage,
      daysRemaining: Math.max(0, daysRemaining),
      paymentHistory,
    };
  }

  /** Plan, limits and real usage, for the subscription page and usage meters */
  async getSubscriptionUsage(subscriptionId, user = null) {
    const subscription = await loadOwnSubscription(subscriptionId, user);
    const owner = user && idOf(user) === idOf(subscription.user) ? user : await User.findById(subscription.user);
    return getUsageSummary(owner);
  }

  async getSubscriptionPayments(subscriptionId, user = null) {
    await loadOwnSubscription(subscriptionId, user);
    const Payment = (await import("../models/payment.model.js")).default;
    return Payment.find({ subscription: subscriptionId })
      .select("amount currency status paymentMethod paymentType subscriptionDetails createdAt transactionId reference")
      .sort({ createdAt: -1 });
  }

  /** Active plans for a plan type with monthly and yearly prices (pricing pages) */
  async listPlans(planType) {
    const query = { isActive: true };
    if (planType) query.planType = planType;
    const plans = await SubscriptionPlan.find(query).sort({ planType: 1, sortOrder: 1 });
    return plans.map((plan) => ({
      ...plan.toObject(),
      yearlyPricing: plan.pricing.map((p) => priceFor(plan, p.currency, "yearly")),
    }));
  }
}

export default new SubscriptionService();
