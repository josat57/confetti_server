import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import { priceFor } from "./plan-catalogue.service.js";
import { logger } from "../utils/logger.js";

/**
 * Automatic renewal: charge the saved card for the next period of paid
 * subscriptions that are about to end (auto-renew on, not cancelled).
 * A scheduled downgrade (pendingChange) is applied at renewal.
 * Subscriptions that can't be charged (no card, failed charges) lapse to the
 * free plan at endDate; the reminder service emails those users beforehand.
 */

// Charge up to this long before the period ends
const RENEW_AHEAD_MS = 6 * 60 * 60 * 1000;
// Still try within this long after the end (e.g. the server was asleep)
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const RETRY_AFTER_MS = 12 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;

const defaultCard = (user) => {
  const cards = (user?.paymentMethods || []).filter((m) => m.providerPaymentMethodId);
  return cards.find((m) => m.isDefault) || cards[0] || null;
};

/** Renew one subscription. Returns "renewed" | "changed" | "no_card" | "failed" | "skipped". */
export const renewSubscription = async (subscriptionId) => {
  const now = new Date();
  // Claim it so overlapping runs never charge twice
  const subscription = await Subscription.findOneAndUpdate(
    {
      _id: subscriptionId,
      status: "active",
      autoRenew: true,
      renewalAttempts: { $lt: MAX_ATTEMPTS },
      $or: [
        { lastRenewalAttemptAt: { $exists: false } },
        { lastRenewalAttemptAt: null },
        { lastRenewalAttemptAt: { $lt: new Date(now - RETRY_AFTER_MS) } },
      ],
    },
    { $set: { lastRenewalAttemptAt: now } },
    { new: true }
  );
  if (!subscription) return "skipped";

  const user = await User.findById(subscription.user);
  const planName = subscription.pendingChange?.planName || subscription.planName;
  const cycle = subscription.pendingChange?.billingCycle || subscription.billingCycle || "monthly";
  const planDoc = await SubscriptionPlan.findByTypeAndName(subscription.planType, planName);
  const price = planDoc ? priceFor(planDoc, subscription.currency || "NGN", cycle) : null;

  const fail = async (reason) => {
    await Subscription.updateOne(
      { _id: subscription._id },
      { $inc: { renewalAttempts: 1 }, $set: { lastRenewalError: reason } }
    );
    logger.warn("Subscription renewal failed", { subscription: subscription._id, reason });
    return "failed";
  };

  if (!user || !planDoc || !price) return fail("Plan or price not found");

  const subscriptionService = (await import("./subscription.service.js")).default;

  // Downgraded to a free plan: switch at the end of the period, nothing to charge
  if (price.amountInMinorUnits === 0) {
    await subscriptionService._applyPlan({
      user,
      subscription,
      planType: subscription.planType,
      planDoc,
      cycle: "monthly",
      amount: 0,
      currency: subscription.currency || "NGN",
      newPeriod: true,
      changeType: "downgrade",
      reason: "Scheduled change applied at renewal",
    });
    return "changed";
  }

  const card = defaultCard(user);
  if (!card) {
    await Subscription.updateOne({ _id: subscription._id }, { $set: { lastRenewalError: "No saved card" } });
    return "no_card";
  }

  const reference = `RENEW-${Date.now()}-${subscription._id}`;
  const payment = await Payment.create({
    user: user._id,
    subscription: subscription._id,
    paymentType: "subscription",
    amount: price.amountInMinorUnits,
    currency: price.currency,
    status: "pending",
    paymentMethod: "flutterwave",
    reference,
    transactionId: reference,
    subscriptionDetails: {
      planType: subscription.planType,
      planName: planDoc.planName,
      billingCycle: cycle,
      isUpgrade: true,
      isRenewal: true,
      newPeriod: true,
      previousPlan: subscription.planName,
      proratedAmount: price.amountInMinorUnits,
    },
  });

  try {
    const paymentMethodService = (await import("./paymentMethod.service.js")).default;
    const charge = await paymentMethodService.chargeCard(
      card.providerPaymentMethodId,
      price.amountInMinorUnits / 100, // Flutterwave takes major units
      price.currency,
      user.email,
      reference
    );
    if (charge?.status !== "successful") {
      await Payment.updateOne({ _id: payment._id }, { $set: { status: "failed" } });
      return fail(`Charge status: ${charge?.status || "unknown"}`);
    }

    const paymentService = (await import("./payment.service.js")).default;
    await paymentService.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: charge });
    await Subscription.updateOne(
      { _id: subscription._id },
      { $set: { renewalAttempts: 0 }, $unset: { lastRenewalError: 1 } }
    );
    logger.info("Subscription renewed", { subscription: subscription._id, plan: planDoc.planName });
    return "renewed";
  } catch (error) {
    await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed" } });
    try {
      const { sendPaymentFailedEmail } = await import("../utils/email.js");
      await sendPaymentFailedEmail(user, payment);
    } catch {
      // email is best effort
    }
    return fail(error.message);
  }
};

/** Renew every subscription that's due. */
export const runRenewals = async () => {
  const now = Date.now();
  const due = await Subscription.find({
    status: "active",
    autoRenew: true,
    amount: { $gt: 0 },
    renewalAttempts: { $lt: MAX_ATTEMPTS },
    endDate: { $lte: new Date(now + RENEW_AHEAD_MS), $gte: new Date(now - GRACE_MS) },
  })
    .select("_id")
    .lean();

  const results = {};
  for (const { _id } of due) {
    try {
      const outcome = await renewSubscription(_id);
      results[outcome] = (results[outcome] || 0) + 1;
    } catch (error) {
      logger.error("Renewal error", { subscription: _id, error: error.message });
    }
  }
  if (due.length) logger.info("Subscription renewal run", results);
  return results;
};

let renewalTimer = null;

/** Renew hourly and send expiry reminders (each reminder is sent once per period). */
export const startSubscriptionJobs = (intervalMs = 60 * 60 * 1000) => {
  if (renewalTimer) return;
  const tick = async () => {
    await runRenewals().catch((error) => logger.error("Renewal run failed", { error: error.message }));
    const reminders = (await import("./subscription-reminder.service.js")).default;
    await reminders.sendExpirationReminders().catch((error) =>
      logger.error("Reminder run failed", { error: error.message })
    );
  };
  renewalTimer = setInterval(tick, intervalMs);
  renewalTimer.unref?.();
  setTimeout(tick, 60 * 1000).unref?.(); // first run shortly after start
};

export const stopSubscriptionJobs = () => {
  if (renewalTimer) clearInterval(renewalTimer);
  renewalTimer = null;
};
