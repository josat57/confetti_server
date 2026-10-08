import mongoose from "mongoose";
import EscrowPayment from "../models/escrow-payment.model.js";
import VendorBooking from "../models/vendor-booking.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { getActivePlan } from "./plan-access.service.js";
import { automaticPayouts, refundPayment, transfer } from "./payout-provider.service.js";

/**
 * Escrow for booking payments.
 * Client pays through Confetti → held → released (client confirms delivery, automatically
 * ESCROW_AUTO_RELEASE_DAYS after the event, or by an admin) → vendor paid minus commission.
 * Disputes stop the automatic release until an admin resolves them (release, refund or split).
 * Escrow amounts are in kobo; booking amounts are in naira.
 */

const AUTO_RELEASE_DAYS = Number(process.env.ESCROW_AUTO_RELEASE_DAYS) || 3;
const MIN_PAYMENT_MINOR = 10000; // ₦100
const DEFAULT_COMMISSION = 0.05;
const BOOKED = ["booked", "confirmed"];
/** Bookings the client can pay: confirmed by the vendor, or quoted (paying accepts the quote) */
const payable = (booking) => BOOKED.includes(booking.status) || (booking.status === "quoted" && booking.quote?.amount > 0);

const toMinor = (major) => Math.round(Number(major) * 100);
const fromMinor = (minor) => Math.round(minor) / 100;
const idOf = (v) => String(v?._id || v || "");

const bookingTotals = (booking) => {
  const total = booking.totalAmount ?? booking.payment?.totalAmount ?? booking.quote?.amount ?? 0;
  const paid = (booking.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  return { total, paid, outstanding: Math.max(total - paid, 0), deposit: booking.depositAmount || 0 };
};

const notify = (recipient, title, message, data = {}, actionUrl) =>
  recipient
    ? Notification.createNotification({
        recipient,
        type: "info",
        category: "payment",
        title,
        message,
        actionUrl,
        data,
      }).catch((error) => logger.warn("Escrow notification failed", { error: error.message }))
    : null;

const pushHistory = (escrow, status, note) => escrow.history.push({ status, note });

/** Keep the booking's payment record in step with the escrow (naira) */
const syncBookingPayment = async (escrow) => {
  const booking = await VendorBooking.findById(escrow.booking);
  if (!booking) return;
  const kept = fromMinor(escrow.amount - (escrow.refund?.amount || 0));
  const entry = booking.payments.find((p) => idOf(p.escrow) === idOf(escrow._id));
  if (entry) entry.amount = kept;
  else if (kept > 0) {
    booking.payments.push({ amount: kept, method: "confetti_escrow", notes: "Paid through Confetti", escrow: escrow._id, paidAt: escrow.paidAt });
  }
  const { total, paid, deposit } = bookingTotals(booking);
  booking.set("payment.paidAmount", paid);
  booking.set("payment.status", total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "pending");
  if (deposit > 0 && paid >= deposit && !booking.depositPaidAt) booking.depositPaidAt = new Date();
  await booking.save();
};

class EscrowService {
  /**
   * Start paying a vendor-confirmed booking through Confetti.
   * `amount` (naira) defaults to the outstanding balance.
   */
  async checkout(user, { bookingId, amount, paymentProvider = "flutterwave" }) {
    if (!["flutterwave", "paystack"].includes(paymentProvider)) throw new AppError("Invalid payment provider", 400);
    if (!mongoose.isValidObjectId(bookingId)) throw new AppError("Booking not found", 404);
    const booking = await VendorBooking.findOne({ _id: bookingId, planner: user._id });
    if (!booking) throw new AppError("Booking not found", 404);
    if (!payable(booking)) {
      throw new AppError("You can pay once the vendor has quoted or confirmed the booking", 400);
    }
    const { total, paid, outstanding, deposit } = bookingTotals(booking);
    if (!(total > 0)) throw new AppError("The vendor hasn't set a price for this booking yet", 400);
    if (outstanding <= 0) throw new AppError("This booking is fully paid", 400);

    const payNaira = amount === undefined || amount === null || amount === "" ? outstanding : Number(amount);
    if (!(payNaira > 0) || payNaira > outstanding) {
      throw new AppError(`Enter an amount up to the outstanding ₦${outstanding.toLocaleString()}`, 400);
    }
    const amountMinor = toMinor(payNaira);
    if (amountMinor < MIN_PAYMENT_MINOR) throw new AppError("The minimum payment is ₦100", 400);

    const vendor = await Vendor.findById(booking.vendor).select("owner businessName name");
    if (!vendor) throw new AppError("Vendor not found", 404);
    const vendorUser = await User.findById(vendor.owner).select("role");
    const { plan } = vendorUser ? await getActivePlan(vendorUser) : { plan: null };
    const commissionRate = plan?.commissionRate ?? DEFAULT_COMMISSION;

    const kind = payNaira >= total ? "full" : paid === 0 && deposit > 0 && payNaira <= deposit ? "deposit" : "balance";
    const currency = booking.currency || booking.payment?.currency || "NGN";
    const reference = `ESC-${Date.now()}-${booking._id}`;

    const escrow = await EscrowPayment.create({
      booking: booking._id,
      client: user._id,
      vendor: vendor._id,
      vendorUser: vendor.owner,
      amount: amountMinor,
      currency,
      kind,
      commissionRate,
      vendorPlan: plan?.key,
      status: "pending_payment",
      paymentProvider,
      reference,
      history: [{ status: "pending_payment", note: `Checkout for ₦${payNaira.toLocaleString()}` }],
    });
    const payment = await Payment.create({
      user: user._id,
      escrowPayment: escrow._id,
      paymentType: "escrow",
      amount: amountMinor,
      currency,
      status: "pending",
      paymentMethod: paymentProvider,
      reference,
      transactionId: reference,
    });
    escrow.payment = payment._id;
    await escrow.save();

    const paymentService = (await import("./payment.service.js")).default;
    const paymentUrl = await paymentService.startProviderCheckout({
      provider: paymentProvider,
      amountMinor,
      currency,
      reference,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
      redirectUrl: `${paymentService.publicApiUrl()}/api/v1/escrow/callback`,
      title: "Confetti booking payment",
      description: `Payment to ${vendor.businessName || vendor.name}, held by Confetti until your event`,
      meta: { kind: "escrow", paymentId: payment._id.toString(), escrowId: escrow._id.toString(), bookingId: booking._id.toString() },
    });

    return { paymentUrl, reference, amount: amountMinor, currency, escrowId: escrow._id.toString(), bookingId: booking._id.toString() };
  }

  /** The client's payment arrived: hold it (called once per payment) */
  async markHeldFromPayment(paymentId) {
    const payment = await Payment.findById(paymentId);
    if (!payment?.escrowPayment) return null;
    const escrow = await EscrowPayment.findById(payment.escrowPayment);
    if (!escrow || escrow.status !== "pending_payment") return escrow;

    const booking = await VendorBooking.findById(escrow.booking).select("eventDate eventEndDate clientName status statusHistory planner");
    const eventEnd = booking?.eventEndDate || booking?.eventDate || new Date();
    escrow.status = "held";
    escrow.paidAt = new Date();
    escrow.releaseAfter = new Date(new Date(eventEnd).getTime() + AUTO_RELEASE_DAYS * 86400000);
    pushHistory(escrow, "held", "Payment received and held");
    await escrow.save();
    // Paying a quote accepts it
    if (booking?.status === "quoted") {
      booking.statusHistory.push({ status: "booked", changedBy: booking.planner, note: "Quote accepted by payment" });
      booking.status = "booked";
      await booking.save();
    }
    await syncBookingPayment(escrow);

    const naira = `₦${fromMinor(escrow.amount).toLocaleString()}`;
    await notify(
      escrow.vendorUser,
      `${naira} paid for a booking`,
      `${booking?.clientName || "Your client"} paid ${naira} through Confetti. It's released to you after the event.`,
      { escrowId: escrow._id.toString(), bookingId: idOf(escrow.booking) },
      "/vendor/dashboard/payments"
    );
    await notify(
      escrow.client,
      "Payment received",
      `${naira} is held safely by Confetti and released to the vendor after your event.`,
      { escrowId: escrow._id.toString(), bookingId: idOf(escrow.booking) },
      `/user/dashboard/bookings/${idOf(escrow.booking)}`
    );
    return escrow;
  }

  /** Verify a redirect back from the payment page and complete the payment */
  async verifyAndComplete(id, provider) {
    const paymentService = (await import("./payment.service.js")).default;
    const data = await paymentService.verifyProviderTransaction(id, provider);
    const meta = data.meta || data.metadata || {};
    const reference = data.tx_ref || data.reference;
    let payment = null;
    if (meta.paymentId && mongoose.isValidObjectId(meta.paymentId)) payment = await Payment.findById(meta.paymentId);
    if (!payment && reference) payment = await Payment.findOne({ reference });
    if (!payment?.escrowPayment) throw new AppError("Payment record not found", 404);
    await paymentService.completeSubscriptionPayment(payment._id, { provider, data });
    return EscrowPayment.findById(payment.escrowPayment).lean();
  }

  /** Release held money to the vendor (all of what remains after refunds) */
  async release(escrow, reason, note) {
    if (!["held", "disputed"].includes(escrow.status)) throw new AppError(`This payment is ${escrow.status}`, 400);
    const amount = escrow.amount - (escrow.refund?.amount || 0);
    const commission = Math.round(amount * escrow.commissionRate);
    escrow.status = "released";
    escrow.releasedAt = new Date();
    escrow.releaseReason = reason;
    escrow.releasedAmount = amount;
    escrow.commissionAmount = commission;
    escrow.vendorAmount = amount - commission;
    pushHistory(escrow, "released", note || reason);
    await escrow.save();
    await this.payout(escrow);

    await notify(
      escrow.vendorUser,
      "Payment released",
      `₦${fromMinor(escrow.vendorAmount).toLocaleString()} is on its way to you (after Confetti's ${Math.round(escrow.commissionRate * 100)}% fee).`,
      { escrowId: escrow._id.toString() },
      "/vendor/dashboard/payments"
    );
    return escrow;
  }

  /** Pay the vendor's share: Paystack transfer when enabled, otherwise by hand (admin) */
  async payout(escrow) {
    if (escrow.vendorAmount <= 0) {
      escrow.set("payout", { status: "paid", paidAt: new Date() });
      return escrow.save();
    }
    const vendor = await Vendor.findById(escrow.vendor).select("payoutAccount businessName name");
    const recipient = vendor?.payoutAccount?.recipientCode;
    if (!automaticPayouts() || !recipient) {
      escrow.set("payout", {
        status: "manual",
        failureReason: !recipient ? "The vendor hasn't added a payout account" : undefined,
      });
      pushHistory(escrow, "payout_manual", "Payout to be made by an admin");
      return escrow.save();
    }

    const reference = `PAYOUT-${escrow._id}-${Date.now()}`;
    try {
      const result = await transfer({
        amountMinor: escrow.vendorAmount,
        recipientCode: recipient,
        reference,
        reason: `Confetti booking payout ${escrow._id}`,
      });
      escrow.set("payout", {
        status: result.status === "success" ? "paid" : "processing",
        provider: "paystack",
        reference,
        transferCode: result.transferCode,
        paidAt: result.status === "success" ? new Date() : undefined,
      });
      pushHistory(escrow, "payout_started", `Transfer ${result.transferCode || reference}`);
    } catch (error) {
      escrow.set("payout", { status: "failed", provider: "paystack", reference, failureReason: error.message });
      pushHistory(escrow, "payout_failed", error.message);
    }
    return escrow.save();
  }

  /** Refund part or all of what is held */
  async refund(escrow, amountMinor, reason) {
    const refundable = escrow.amount - (escrow.refund?.amount || 0);
    if (!(amountMinor > 0) || amountMinor > refundable) throw new AppError("Refund amount is more than what is held", 400);
    const payment = await Payment.findById(escrow.payment);
    let status = "done";
    let providerReference;
    try {
      const result = await refundPayment({
        provider: escrow.paymentProvider,
        reference: escrow.reference,
        transactionId: payment?.transactionId,
        amountMinor,
      });
      providerReference = result.reference;
      status = ["processed", "completed", "success"].includes(result.status) ? "done" : "processing";
    } catch (error) {
      // Refund by hand; the record still shows the client is owed it
      logger.warn("Provider refund failed; marked for manual refund", { escrow: escrow._id, error: error.message });
      status = "manual";
    }
    escrow.set("refund", {
      amount: (escrow.refund?.amount || 0) + amountMinor,
      reason,
      refundedAt: new Date(),
      providerReference,
      status,
    });
    pushHistory(escrow, "refund", `₦${fromMinor(amountMinor).toLocaleString()} (${status})`);
    if (escrow.refund.amount >= escrow.amount) escrow.status = "refunded";
    await escrow.save();
    await syncBookingPayment(escrow);
    await notify(
      escrow.client,
      "Refund issued",
      `₦${fromMinor(amountMinor).toLocaleString()} is being refunded to you.`,
      { escrowId: escrow._id.toString() },
      `/user/dashboard/bookings/${idOf(escrow.booking)}`
    );
    return escrow;
  }

  async findForParty(user, escrowId) {
    if (!mongoose.isValidObjectId(escrowId)) throw new AppError("Payment not found", 404);
    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow || (idOf(escrow.client) !== idOf(user._id) && idOf(escrow.vendorUser) !== idOf(user._id))) {
      throw new AppError("Payment not found", 404);
    }
    return escrow;
  }

  /** Client: the vendor delivered, release the money now */
  async confirmDelivery(user, escrowId) {
    const escrow = await this.findForParty(user, escrowId);
    if (idOf(escrow.client) !== idOf(user._id)) throw new AppError("Only the client can confirm delivery", 403);
    if (escrow.status !== "held") throw new AppError(`This payment is ${escrow.status}`, 400);
    return this.release(escrow, "client_confirmed", "Client confirmed delivery");
  }

  /** Client or vendor: something went wrong; hold the money for an admin */
  async openDispute(user, escrowId, reason) {
    const escrow = await this.findForParty(user, escrowId);
    if (escrow.status !== "held") throw new AppError("Only payments still held can be disputed", 400);
    if (typeof reason !== "string" || reason.trim().length < 10) throw new AppError("Tell us what went wrong (at least 10 characters)", 400);
    const byClient = idOf(escrow.client) === idOf(user._id);
    escrow.status = "disputed";
    escrow.set("dispute", { openedBy: user._id, openedByRole: byClient ? "client" : "vendor", reason: reason.trim().slice(0, 2000), openedAt: new Date() });
    pushHistory(escrow, "disputed", `Opened by the ${byClient ? "client" : "vendor"}`);
    await escrow.save();
    await notify(
      byClient ? escrow.vendorUser : escrow.client,
      "A payment is under review",
      "A problem was reported with a booking payment. Confetti will review it and get in touch.",
      { escrowId: escrow._id.toString() }
    );
    return escrow;
  }

  /**
   * Admin: settle a dispute (or a held payment).
   * release → vendor gets it all; refund → client gets it all; split → refundAmount (naira) to the client, the rest to the vendor.
   */
  async resolve(adminId, escrowId, { resolution, refundAmount, note }) {
    if (!mongoose.isValidObjectId(escrowId)) throw new AppError("Payment not found", 404);
    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow) throw new AppError("Payment not found", 404);
    if (!["held", "disputed"].includes(escrow.status)) throw new AppError(`This payment is ${escrow.status}`, 400);
    if (!["release", "refund", "split"].includes(resolution)) throw new AppError("Choose release, refund or split", 400);

    const remaining = escrow.amount - (escrow.refund?.amount || 0);
    escrow.set("dispute.resolvedAt", new Date());
    escrow.set("dispute.resolution", resolution);
    escrow.set("dispute.adminNote", typeof note === "string" ? note.slice(0, 2000) : undefined);
    escrow.set("dispute.resolvedBy", adminId);

    if (resolution === "refund") {
      await this.refund(escrow, remaining, note || "Refunded by Confetti");
      return escrow;
    }
    if (resolution === "split") {
      const refundMinor = toMinor(refundAmount);
      if (!(refundMinor > 0) || refundMinor >= remaining) throw new AppError("The refund must be more than 0 and less than the amount held", 400);
      await this.refund(escrow, refundMinor, note || "Partial refund");
    }
    return this.release(escrow, "admin", note || `Resolved by admin (${resolution})`);
  }

  /** Release held payments whose release date has passed (no dispute) */
  async runAutoRelease() {
    const due = await EscrowPayment.find({ status: "held", releaseAfter: { $lte: new Date() } }).limit(200);
    let released = 0;
    for (const escrow of due) {
      try {
        await this.release(escrow, "auto", "Released automatically after the event");
        released += 1;
      } catch (error) {
        logger.error("Auto-release failed", { escrow: escrow._id, error: error.message });
      }
    }
    if (released) logger.info("Escrow auto-release", { released });
    return released;
  }

  /** Paystack/Flutterwave transfer webhook for a payout */
  async handleTransferEvent({ reference, succeeded, failureReason }) {
    if (!reference?.startsWith("PAYOUT-")) return false;
    const escrow = await EscrowPayment.findOne({ "payout.reference": reference });
    if (!escrow) return true;
    if (succeeded) {
      escrow.set("payout.status", "paid");
      escrow.set("payout.paidAt", new Date());
      pushHistory(escrow, "paid_out", "Transfer completed");
    } else {
      escrow.set("payout.status", "failed");
      escrow.set("payout.failureReason", failureReason || "Transfer failed");
      pushHistory(escrow, "payout_failed", failureReason || "Transfer failed");
    }
    await escrow.save();
    return true;
  }

  async retryPayout(escrowId) {
    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow || escrow.status !== "released") throw new AppError("Only released payments can be paid out", 400);
    if (escrow.payout?.status === "paid") throw new AppError("Already paid out", 400);
    return this.payout(escrow);
  }

  /** Admin paid the vendor by hand */
  async markPayoutPaid(adminId, escrowId, note) {
    const escrow = await EscrowPayment.findById(escrowId);
    if (!escrow || escrow.status !== "released") throw new AppError("Only released payments can be marked paid", 400);
    escrow.set("payout.status", "paid");
    escrow.set("payout.paidAt", new Date());
    escrow.set("payout.markedPaidBy", adminId);
    pushHistory(escrow, "paid_out", note || "Paid by hand");
    return escrow.save();
  }

  /** Payments for a booking, for the client or the vendor */
  async listForBooking(user, bookingId) {
    if (!mongoose.isValidObjectId(bookingId)) throw new AppError("Booking not found", 404);
    const booking = await VendorBooking.findById(bookingId).select("planner vendor totalAmount depositAmount payments payment quote currency status");
    if (!booking) throw new AppError("Booking not found", 404);
    const vendor = await Vendor.findById(booking.vendor).select("owner");
    const isClient = idOf(booking.planner) === idOf(user._id);
    const isVendor = idOf(vendor?.owner) === idOf(user._id);
    if (!isClient && !isVendor) throw new AppError("Booking not found", 404);
    const payments = await EscrowPayment.find({ booking: booking._id, status: { $ne: "pending_payment" } }).sort({ createdAt: -1 }).lean();
    const totals = bookingTotals(booking);
    return {
      payments: payments.map(this.shape),
      totals: { ...totals, currency: booking.currency || "NGN" },
      canPay: isClient && payable(booking) && totals.total > 0 && totals.outstanding > 0,
      bookingStatus: booking.status,
      autoReleaseDays: AUTO_RELEASE_DAYS,
    };
  }

  shape(e) {
    return {
      _id: e._id,
      booking: e.booking,
      amount: fromMinor(e.amount),
      currency: e.currency,
      kind: e.kind,
      status: e.status,
      paidAt: e.paidAt,
      releaseAfter: e.releaseAfter,
      releasedAt: e.releasedAt,
      releaseReason: e.releaseReason,
      commissionRate: e.commissionRate,
      commission: fromMinor(e.commissionAmount || Math.round((e.amount - (e.refund?.amount || 0)) * e.commissionRate)),
      vendorAmount: fromMinor(e.vendorAmount || 0),
      refunded: fromMinor(e.refund?.amount || 0),
      refundStatus: e.refund?.status || "none",
      payoutStatus: e.payout?.status || "not_started",
      dispute: e.dispute?.openedAt ? { reason: e.dispute.reason, openedByRole: e.dispute.openedByRole, resolution: e.dispute.resolution, resolvedAt: e.dispute.resolvedAt } : null,
    };
  }

  /** Vendor payouts page: payments and totals */
  async vendorSummary(vendorUser) {
    const vendor = await Vendor.findOne({ owner: vendorUser._id }).select("_id payoutAccount");
    if (!vendor) throw new AppError("Vendor profile not found", 404);
    const payments = await EscrowPayment.find({ vendor: vendor._id, status: { $ne: "pending_payment" } })
      .populate("booking", "clientName eventType eventDate")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const sum = (list, fn) => fromMinor(list.reduce((s, e) => s + fn(e), 0));
    const held = payments.filter((e) => ["held", "disputed"].includes(e.status));
    const released = payments.filter((e) => e.status === "released");
    return {
      payoutAccount: vendor.payoutAccount?.recipientCode || vendor.payoutAccount?.accountLast4
        ? {
            bankName: vendor.payoutAccount.bankName,
            accountLast4: vendor.payoutAccount.accountLast4,
            accountName: vendor.payoutAccount.accountName,
            verified: !!vendor.payoutAccount.verifiedAt,
          }
        : null,
      totals: {
        held: sum(held, (e) => Math.round((e.amount - (e.refund?.amount || 0)) * (1 - e.commissionRate))),
        awaitingPayout: sum(released.filter((e) => e.payout?.status !== "paid"), (e) => e.vendorAmount || 0),
        paidOut: sum(released.filter((e) => e.payout?.status === "paid"), (e) => e.vendorAmount || 0),
        fees: sum(released, (e) => e.commissionAmount || 0),
      },
      payments: payments.map((e) => ({
        ...this.shape(e),
        clientName: e.booking?.clientName,
        eventType: e.booking?.eventType,
        eventDate: e.booking?.eventDate,
      })),
    };
  }

  /** Admin list */
  async adminList({ status, payoutStatus, page = 1, limit = 50 } = {}) {
    const query = {};
    if (status) query.status = status;
    else query.status = { $ne: "pending_payment" };
    if (payoutStatus) query["payout.status"] = payoutStatus;
    const p = Math.max(parseInt(page) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const [items, total] = await Promise.all([
      EscrowPayment.find(query)
        .populate("client", "firstName lastName email")
        .populate("vendor", "businessName name")
        .populate("booking", "eventType eventDate clientName")
        .sort({ updatedAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      EscrowPayment.countDocuments(query),
    ]);
    return {
      items: items.map((e) => ({
        ...this.shape(e),
        client: e.client ? { name: [e.client.firstName, e.client.lastName].filter(Boolean).join(" "), email: e.client.email } : null,
        vendor: e.vendor ? { _id: e.vendor._id, name: e.vendor.businessName || e.vendor.name } : null,
        event: e.booking ? { type: e.booking.eventType, date: e.booking.eventDate } : null,
        payoutFailure: e.payout?.failureReason,
        history: e.history,
      })),
      total,
      page: p,
      totalPages: Math.max(Math.ceil(total / l), 1),
    };
  }

  /** Admin commission report for a period (by release date) */
  async report({ from, to } = {}) {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
    const [released, collected, heldNow, byMonth, byRate] = await Promise.all([
      EscrowPayment.aggregate([
        { $match: { status: "released", releasedAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, gross: { $sum: "$releasedAmount" }, commission: { $sum: "$commissionAmount" }, vendor: { $sum: "$vendorAmount" }, count: { $sum: 1 } } },
      ]),
      EscrowPayment.aggregate([
        { $match: { paidAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, amount: { $sum: "$amount" }, refunded: { $sum: "$refund.amount" }, count: { $sum: 1 } } },
      ]),
      EscrowPayment.aggregate([
        { $match: { status: { $in: ["held", "disputed"] } } },
        { $group: { _id: "$status", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      EscrowPayment.aggregate([
        { $match: { status: "released", releasedAt: { $gte: start, $lte: end } } },
        { $group: { _id: { y: { $year: "$releasedAt" }, m: { $month: "$releasedAt" } }, commission: { $sum: "$commissionAmount" }, gross: { $sum: "$releasedAmount" } } },
        { $sort: { "_id.y": 1, "_id.m": 1 } },
      ]),
      EscrowPayment.aggregate([
        { $match: { status: "released", releasedAt: { $gte: start, $lte: end } } },
        { $group: { _id: "$commissionRate", commission: { $sum: "$commissionAmount" }, gross: { $sum: "$releasedAmount" }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const r = released[0] || {};
    const c = collected[0] || {};
    const owed = await EscrowPayment.aggregate([
      { $match: { status: "released", "payout.status": { $ne: "paid" } } },
      { $group: { _id: null, amount: { $sum: "$vendorAmount" }, count: { $sum: 1 } } },
    ]);
    return {
      period: { from: start, to: end },
      collected: { amount: fromMinor(c.amount || 0), refunded: fromMinor(c.refunded || 0), payments: c.count || 0 },
      released: { gross: fromMinor(r.gross || 0), commission: fromMinor(r.commission || 0), toVendors: fromMinor(r.vendor || 0), payments: r.count || 0 },
      heldNow: Object.fromEntries(heldNow.map((h) => [h._id, { amount: fromMinor(h.amount), payments: h.count }])),
      owedToVendors: { amount: fromMinor(owed[0]?.amount || 0), payments: owed[0]?.count || 0 },
      byMonth: byMonth.map((m) => ({ period: `${m._id.y}-${String(m._id.m).padStart(2, "0")}`, commission: fromMinor(m.commission), gross: fromMinor(m.gross) })),
      byRate: byRate.map((b) => ({ rate: b._id, commission: fromMinor(b.commission), gross: fromMinor(b.gross), payments: b.count })),
    };
  }
}

const escrowService = new EscrowService();
export default escrowService;

let escrowTimer = null;
/** Release due payments hourly */
export const startEscrowJobs = (intervalMs = 60 * 60 * 1000) => {
  if (escrowTimer) return;
  const tick = () => escrowService.runAutoRelease().catch((error) => logger.error("Escrow job failed", { error: error.message }));
  escrowTimer = setInterval(tick, intervalMs);
  escrowTimer.unref?.();
  setTimeout(tick, 90 * 1000).unref?.();
};
