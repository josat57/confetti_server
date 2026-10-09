import mongoose from "mongoose";
import axios from "axios";
import EventPass from "../models/event-pass.model.js";
import Event from "../models/event.model.js";
import Payment from "../models/payment.model.js";
import Notification from "../models/notification.model.js";
import { EVENT_PASSES, findPass } from "../config/plans.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Per-event passes for people planning their own event (role "user").
 * Checkout → provider payment page → webhook or redirect → completeSubscriptionPayment
 * (atomic, checks the amount) → activateFromPayment.
 */

const toMinor = (amount) => Math.round(amount * 100);
const ownsEvent = (event, userId) =>
  [event.createdBy, event.organizer].some((id) => id && id.toString() === userId.toString());

class EventPassService {
  /** Passes on sale (and the ones coming later) with prices */
  catalogue() {
    return EVENT_PASSES.map((p) => ({
      key: p.key,
      displayName: p.displayName,
      description: p.description,
      prices: p.prices,
      featureList: p.featureList,
      features: p.features,
      available: p.available,
    }));
  }

  /** Active pass for an event, or null */
  activePassFor(eventId) {
    if (!mongoose.isValidObjectId(eventId)) return null;
    return EventPass.findOne({ event: eventId, status: "active" }).lean();
  }

  /** Does the user hold an active pass for any event? (full AI for the account) */
  async hasActivePass(userId) {
    return !!(await EventPass.exists({ user: userId, status: "active" }));
  }

  /** Features of the event's active pass ({} when none) */
  async featuresFor(eventId) {
    const pass = await this.activePassFor(eventId);
    if (pass) return findPass(pass.tier)?.features || {};
    // Company events on an active Corporate contract get the Celebration Plus features
    const { activeOrgForEvent } = await import("./organization.service.js");
    if (await activeOrgForEvent(eventId)) return findPass("plus")?.features || {};
    return {};
  }

  /** Passes for the user's events, keyed by event id */
  async passesForUser(userId) {
    const passes = await EventPass.find({ user: userId, status: "active" }).lean();
    return Object.fromEntries(passes.map((p) => [p.event.toString(), { tier: p.tier, activatedAt: p.activatedAt, currency: p.currency }]));
  }

  /**
   * Start paying for a pass (or an upgrade to a higher one) for an event the user owns.
   * Returns { paymentUrl, reference, amount, currency }.
   */
  async checkout(user, { eventId, tier, paymentProvider = "flutterwave", currency = "NGN" }) {
    if (user.role !== "user") {
      throw new AppError("Event passes are for people planning their own event", 400);
    }
    const pass = findPass(tier);
    if (!pass) throw new AppError("Unknown pass", 400);
    if (!pass.available) throw new AppError(`The ${pass.displayName} isn't available yet`, 400);
    if (!["flutterwave", "paystack"].includes(paymentProvider)) throw new AppError("Invalid payment provider", 400);
    const price = pass.prices[currency];
    if (price === undefined) throw new AppError(`The ${pass.displayName} isn't sold in ${currency}`, 400);

    if (!mongoose.isValidObjectId(eventId)) throw new AppError("Event not found", 404);
    const event = await Event.findById(eventId).select("title createdBy organizer status");
    if (!event || !ownsEvent(event, user._id)) throw new AppError("Event not found", 404);
    if (event.status === "cancelled") throw new AppError("This event is cancelled", 400);

    let doc = await EventPass.findOne({ event: event._id });
    let amountMinor = toMinor(price);
    let previousTier;
    if (doc?.status === "active") {
      const current = findPass(doc.tier);
      if (current.rank >= pass.rank) throw new AppError(`This event already has the ${current.displayName}`, 400);
      const currentPrice = current.prices[currency];
      if (currentPrice === undefined || doc.currency !== currency) {
        throw new AppError(`Upgrade in ${doc.currency}, the currency the pass was bought in`, 400);
      }
      amountMinor = toMinor(price - currentPrice); // pay the difference
      previousTier = doc.tier;
    }

    if (!doc) {
      doc = new EventPass({ event: event._id, user: user._id, tier, status: "pending", currency });
    }
    doc.pendingTier = tier;
    if (doc.status !== "active") {
      doc.tier = tier;
      doc.currency = currency;
    }

    const reference = `PASS-${Date.now()}-${event._id}`;
    doc.paymentRef = reference;
    await doc.save();

    const payment = await Payment.create({
      user: user._id,
      event: event._id,
      eventPass: doc._id,
      paymentType: "event",
      amount: amountMinor,
      currency,
      status: "pending",
      paymentMethod: paymentProvider,
      reference,
      transactionId: reference,
      passDetails: { tier, previousTier },
    });

    const paymentService = (await import("./payment.service.js")).default;
    const paymentUrl = await paymentService.startProviderCheckout({
      provider: paymentProvider,
      amountMinor,
      currency,
      reference,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
      redirectUrl: `${paymentService.publicApiUrl()}/api/v1/event-passes/callback`,
      title: `Confetti ${pass.displayName}`,
      description: `${pass.displayName}${previousTier ? " upgrade" : ""} for ${event.title}`,
      meta: { kind: "event_pass", paymentId: payment._id.toString(), eventPassId: doc._id.toString(), eventId: event._id.toString() },
    });

    return { paymentUrl, reference, amount: amountMinor, currency, eventId: event._id.toString() };
  }

  /** The payment for a pass completed: switch the pass on (called once per payment) */
  async activateFromPayment(paymentId) {
    const payment = await Payment.findById(paymentId);
    if (!payment?.eventPass) return null;
    const doc = await EventPass.findById(payment.eventPass);
    if (!doc) throw new AppError("Event pass not found", 404);

    const tier = payment.passDetails?.tier || doc.pendingTier || doc.tier;
    doc.tier = tier;
    doc.status = "active";
    doc.amount = (doc.amount || 0) + payment.amount;
    doc.currency = payment.currency;
    doc.activatedAt = doc.activatedAt || new Date();
    doc.pendingTier = undefined;
    doc.history.push({ tier, amount: payment.amount, currency: payment.currency, payment: payment._id });
    await doc.save();

    try {
      const event = await Event.findById(doc.event).select("title").lean();
      await Notification.createNotification({
        recipient: doc.user,
        type: "success",
        category: "payment",
        title: `${findPass(tier)?.displayName || "Pass"} active`,
        message: `Your ${findPass(tier)?.displayName} for ${event?.title || "your event"} is ready.`,
        actionUrl: `/user/dashboard/events/${doc.event}`,
        data: { eventId: doc.event.toString(), tier },
      });
    } catch (error) {
      logger.warn("Pass notification failed", { error: error.message });
    }
    return doc;
  }

  /**
   * Verify a pass payment with the provider (redirect back from the payment page)
   * and complete it. `id` is Flutterwave's transaction id or Paystack's reference.
   */
  async verifyAndComplete(id, provider) {
    let data;
    try {
      if (provider === "flutterwave") {
        const response = await axios.get(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(id)}/verify`, {
          headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
          timeout: 30000,
        });
        data = response.data?.data;
      } else {
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
          timeout: 30000,
        });
        data = response.data?.data;
      }
    } catch (error) {
      throw new AppError(`Failed to verify payment: ${error.response?.data?.message || error.message}`, 502);
    }
    if (!data) throw new AppError("Payment not found", 404);
    if (!["success", "successful"].includes(data.status)) throw new AppError("Payment was not completed", 400);

    const meta = data.meta || data.metadata || {};
    const reference = data.tx_ref || data.reference;
    let payment = null;
    if (meta.paymentId && mongoose.isValidObjectId(meta.paymentId)) payment = await Payment.findById(meta.paymentId);
    if (!payment && reference) payment = await Payment.findOne({ reference });
    if (!payment?.eventPass) throw new AppError("Payment record not found", 404);

    const paymentService = (await import("./payment.service.js")).default;
    await paymentService.completeSubscriptionPayment(payment._id, { provider, data });
    return EventPass.findById(payment.eventPass).lean();
  }
}

export default new EventPassService();
