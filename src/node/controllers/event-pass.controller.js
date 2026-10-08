import eventPassService from "../services/event-pass.service.js";
import EventPass from "../models/event-pass.model.js";
import { AppError } from "../utils/AppError.js";
import mongoose from "mongoose";

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";

/** GET /event-passes/catalogue (public) */
export const getPassCatalogue = (req, res) => {
  res.status(200).json({ status: "success", data: { passes: eventPassService.catalogue() } });
};

/** GET /event-passes — my passes keyed by event id; ?eventId= for one event */
export const getMyPasses = async (req, res, next) => {
  try {
    if (req.query.eventId) {
      if (!mongoose.isValidObjectId(req.query.eventId)) throw new AppError("Event not found", 404);
      const pass = await EventPass.findOne({ event: req.query.eventId, user: req.user._id }).lean();
      return res.status(200).json({
        status: "success",
        data: { pass: pass && pass.status === "active" ? { tier: pass.tier, activatedAt: pass.activatedAt } : null },
      });
    }
    res.status(200).json({ status: "success", data: { passes: await eventPassService.passesForUser(req.user._id) } });
  } catch (error) {
    next(error);
  }
};

/** POST /event-passes/checkout { eventId, tier, paymentProvider } */
export const startPassCheckout = async (req, res, next) => {
  try {
    const { eventId, tier, paymentProvider, currency } = req.body || {};
    const result = await eventPassService.checkout(req.user, { eventId, tier, paymentProvider, currency });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Where the payment provider sends the payer back.
 * Flutterwave: ?status=successful&transaction_id=…  Paystack: ?reference=…
 */
export const passPaymentCallback = async (req, res) => {
  const { status, transaction_id, reference, trxref, tx_ref } = req.query;
  const ref = tx_ref || reference || trxref || "";
  const eventFromRef = /^PASS-\d+-([a-f0-9]{24})$/.exec(ref)?.[1];
  const back = (outcome, eventId = eventFromRef, message) =>
    res.redirect(
      `${frontendUrl()}/user/dashboard/events/${eventId || ""}?pass=${outcome}${message ? `&message=${encodeURIComponent(message)}` : ""}`
    );

  try {
    if (status === "cancelled" || status === "canceled") return back("cancelled");
    const isFlutterwave = !!transaction_id;
    if (isFlutterwave && !["successful", "success", "completed"].includes(status)) return back("failed");
    const id = transaction_id || reference || trxref;
    if (!id) return back("failed");
    const pass = await eventPassService.verifyAndComplete(id, isFlutterwave ? "flutterwave" : "paystack");
    return back("success", pass?.event?.toString());
  } catch (error) {
    return back("failed", eventFromRef, error.message);
  }
};
