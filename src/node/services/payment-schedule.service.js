import mongoose from "mongoose";
import VendorBooking from "../models/vendor-booking.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { scheduleView, instalmentsFor, DUE_SOON_DAYS } from "../utils/payment-schedule.js";

/**
 * Deposit and balance schedules on vendor bookings, with reminders (roadmap Phase 9).
 */

const naira = (n) => `₦${Math.round(n || 0).toLocaleString()}`;
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * PUT schedule: [{ label, amount, dueDate }]. The instalments must add up to the
 * booking total (when there is one). An empty list goes back to deposit + balance.
 */
export const setPaymentSchedule = async (user, bookingId, { items, totalAmount } = {}) => {
  const vendor = await Vendor.findOne({ owner: user._id }).select("_id");
  if (!vendor) throw new AppError("Vendor profile not found", 404);
  if (!mongoose.isValidObjectId(bookingId)) throw new AppError("Booking not found", 404);
  const booking = await VendorBooking.findOne({ _id: bookingId, vendor: vendor._id });
  if (!booking) throw new AppError("Booking not found", 404);
  if (!Array.isArray(items)) throw new AppError("Send the instalments as a list", 400);
  if (items.length > 12) throw new AppError("Up to 12 instalments", 400);

  if (totalAmount !== undefined && totalAmount !== "") {
    const t = Number(totalAmount);
    if (!Number.isFinite(t) || t < 0) throw new AppError("Enter a valid total", 400);
    booking.totalAmount = t;
  }
  const clean = items.map((i, n) => {
    const amount = Number(i?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError(`Instalment ${n + 1} needs an amount`, 400);
    const dueDate = new Date(i?.dueDate);
    if (!i?.dueDate || Number.isNaN(dueDate.getTime())) throw new AppError(`Instalment ${n + 1} needs a due date`, 400);
    const label = typeof i.label === "string" && i.label.trim() ? i.label.trim().slice(0, 80) : n === 0 ? "Deposit" : `Instalment ${n + 1}`;
    // Keep reminder history for an unchanged instalment
    const existing = booking.paymentSchedule.find((e) => e.amount === amount && +e.dueDate === +dueDate);
    return { label, amount: Math.round(amount * 100) / 100, dueDate, reminders: existing?.reminders || [] };
  });
  const sum = clean.reduce((s, i) => s + i.amount, 0);
  const total = booking.totalAmount ?? booking.payment?.totalAmount ?? booking.quote?.amount;
  if (clean.length && total && Math.abs(sum - total) > 0.01) {
    throw new AppError(`The instalments add up to ${naira(sum)}, but the booking total is ${naira(total)}`, 400);
  }
  if (clean.length && !total) booking.totalAmount = sum;
  booking.paymentSchedule = clean;
  // The first instalment is the deposit
  if (clean.length) {
    const first = [...clean].sort((a, b) => a.dueDate - b.dueDate)[0];
    booking.depositAmount = first.amount;
    booking.depositDueDate = first.dueDate;
  }
  await booking.save({ validateModifiedOnly: true });
  return booking;
};

/** Remind the vendor and the client about instalments due soon or overdue (once per stage) */
export const runPaymentReminders = async (now = new Date()) => {
  const horizon = new Date(now.getTime() + DUE_SOON_DAYS * 86400000);
  // Instalments overdue for longer than this aren't chased (avoids a burst for old bookings)
  const oldest = new Date(now.getTime() - 14 * 86400000);
  const bookings = await VendorBooking.find({
    status: { $in: ["booked", "confirmed"] },
    $or: [
      { "paymentSchedule.dueDate": { $lte: horizon } },
      { depositAmount: { $gt: 0 }, depositDueDate: { $lte: horizon }, depositPaidAt: { $exists: false } },
      { "paymentSchedule.0": { $exists: false }, totalAmount: { $gt: 0 }, eventDate: { $lte: horizon, $gte: oldest } },
    ],
  })
    .limit(1000)
    .populate("vendor", "businessName name owner")
    .populate("planner", "email firstName");
  let sent = 0;
  for (const b of bookings) {
    const view = scheduleView(b, now);
    const raw = instalmentsFor(b);
    for (let i = 0; i < view.items.length; i++) {
      const item = view.items[i];
      const stage = item.status === "overdue" ? "overdue" : item.status === "due_soon" ? "due_soon" : null;
      if (!stage || !item.dueDate) continue;
      if (new Date(item.dueDate) < oldest) continue;
      if (raw[i].reminders.includes(stage)) continue;

      // Record the stage first so two runs can't both send it
      if (item.explicit) {
        const res = await VendorBooking.updateOne(
          { _id: b._id, paymentSchedule: { $elemMatch: { _id: item._id, reminders: { $ne: stage } } } },
          { $push: { "paymentSchedule.$.reminders": stage } }
        );
        if (!res.modifiedCount) continue;
      } else {
        const key = `${item.label.toLowerCase()}:${stage}`;
        const res = await VendorBooking.updateOne({ _id: b._id, scheduleReminders: { $ne: key } }, { $addToSet: { scheduleReminders: key } });
        if (!res.modifiedCount) continue;
      }

      const vendorName = b.vendor?.businessName || b.vendor?.name || "your vendor";
      const client = b.clientName || b.planner?.firstName || "The client";
      const when = new Date(item.dueDate).toDateString();
      const what = `${item.label} of ${naira(item.outstanding)}`;
      if (b.vendor?.owner) {
        await Notification.createNotification({
          recipient: b.vendor.owner,
          type: stage === "overdue" ? "warning" : "info",
          category: "payment",
          title: stage === "overdue" ? "Payment overdue" : "Payment due soon",
          message: `${client}: ${what} ${stage === "overdue" ? "was due" : "is due"} ${when}.`,
          actionUrl: `/vendor/dashboard/bookings/${b._id}`,
        }).catch(() => {});
      }
      if (b.planner?._id) {
        await Notification.createNotification({
          recipient: b.planner._id,
          type: stage === "overdue" ? "warning" : "info",
          category: "payment",
          title: stage === "overdue" ? `Payment to ${vendorName} is overdue` : `Payment to ${vendorName} due soon`,
          message: `${what} ${stage === "overdue" ? "was due" : "is due"} ${when}.`,
          actionUrl: "/user/dashboard/bookings",
        }).catch(() => {});
      }
      const email = b.clientEmail || b.planner?.email;
      if (email) {
        await sendEmailDirect({
          to: email,
          subject: stage === "overdue" ? `Overdue: ${what} for ${vendorName}` : `Reminder: ${what} for ${vendorName} is due ${when}`,
          html: `<p>Hi ${String(b.clientName || b.planner?.firstName || "there").replace(/[<>&"']/g, "")},</p>
            <p>This is a reminder that the ${item.label.toLowerCase()} of <strong>${naira(item.outstanding)}</strong> for your booking with ${String(vendorName).replace(/[<>&"']/g, "")} ${stage === "overdue" ? "was due" : "is due"} on ${when}.</p>
            <p>If you've already paid, please let them know so they can record it.</p>
            ${b.planner?._id ? `<p><a href="${frontendUrl()}/user/dashboard/bookings">See your bookings</a></p>` : ""}`,
        }).catch((error) => logger.warn("Payment reminder email failed", { error: error.message }));
      }
      sent++;
    }
  }
  return { sent };
};
