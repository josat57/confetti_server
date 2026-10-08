import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import VendorBooking from "../models/vendor-booking.model.js";
import Vendor from "../models/vendor.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { escapeRegExp } from "../utils/escape-regex.js";

/**
 * Vendor side of bookings (/api/v1/vendors/bookings). Works on the same
 * VendorBooking records clients and planners create, shaped for the vendor
 * dashboard (client, event, payment, notes).
 */

const CLIENT_FIELDS = "firstName lastName email phone profilePicture";
// Booking statuses before the vendor confirms show as "pending" on the vendor side
const OPEN = ["pending", "contacted", "quoted"];
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const myVendor = async (req) => {
  const vendor = await Vendor.findOne({ owner: req.user._id }).select("_id businessName name email phone owner");
  if (!vendor) throw new AppError("Vendor profile not found", 404);
  return vendor;
};

const findBooking = async (req, vendor) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Booking not found", 404);
  const booking = await VendorBooking.findOne({ _id: req.params.id, vendor: vendor._id }).populate("planner", CLIENT_FIELDS);
  if (!booking) throw new AppError("Booking not found", 404);
  return booking;
};

const totals = (b) => {
  const total = b.totalAmount ?? b.payment?.totalAmount ?? b.quote?.amount ?? 0;
  const deposit = b.depositAmount ?? 0;
  const paid = (b.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0) || b.payment?.paidAmount || 0;
  return { total, deposit, paid };
};

const vendorStatus = (b) => {
  if (OPEN.includes(b.status)) return "pending";
  if (b.status === "booked" || b.status === "confirmed") {
    const now = new Date();
    const start = b.eventDate ? new Date(b.eventDate) : null;
    const end = b.eventEndDate ? new Date(b.eventEndDate) : start;
    if (start && end && start <= now && now <= new Date(end.getTime() + 86400000)) return "in_progress";
    return "confirmed";
  }
  if (b.payment?.status === "refunded") return "refunded";
  return b.status; // completed, cancelled
};

/** VendorBooking → the vendor dashboard's Booking shape */
export const formatForVendor = (b) => {
  const client = b.planner && typeof b.planner === "object" && b.planner.email ? b.planner : null;
  const { total, deposit, paid } = totals(b);
  const depositPaid = !!b.depositPaidAt || (deposit > 0 && paid >= deposit);
  const paymentStatus =
    b.payment?.status === "refunded"
      ? "refunded"
      : total > 0 && paid >= total
      ? "paid"
      : depositPaid
      ? "deposit_paid"
      : paid > 0
      ? "partially_paid"
      : "pending";

  return {
    _id: b._id.toString(),
    vendor: b.vendor?.toString(),
    client: {
      _id: client?._id?.toString() || "",
      name: b.clientName || [client?.firstName, client?.lastName].filter(Boolean).join(" ") || client?.email || "Client",
      email: b.clientEmail || client?.email || "",
      phone: b.clientPhone || client?.phone || "",
      avatar: client?.profilePicture,
    },
    event: {
      type: b.eventType || "",
      date: b.eventDate,
      endDate: b.eventEndDate,
      location: b.location || "",
      address: b.address?.city ? b.address : undefined,
      guestCount: b.guestCount,
      notes: b.eventNotes || b.serviceRequirements || b.specialRequirements,
    },
    payment: {
      total,
      deposit,
      depositPaid,
      depositPaidAt: b.depositPaidAt,
      balance: Math.max(total - paid, 0),
      currency: b.currency || b.payment?.currency || b.budget?.currency || "NGN",
      paymentMethod: b.payments?.at(-1)?.method,
      status: paymentStatus,
    },
    status: vendorStatus(b),
    notes: (b.notes || []).map((n) => ({
      _id: n._id?.toString(),
      text: n.content,
      createdBy: n.createdBy?.toString?.() || "",
      createdByName: n.createdByName || "",
      createdAt: n.createdAt,
    })),
    leadId: b.lead?.toString(),
    quoteId: b.quoteRef?.toString(),
    contractSigned: !!b.contract?.signed,
    contractSignedAt: b.contract?.signedAt,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    confirmedAt: b.confirmedAt,
    completedAt: b.completedAt,
    cancelledAt: b.cancelledAt,
    cancellationReason: b.cancellationReason,
  };
};

/** Tell the client (if they have an account) that their booking changed */
const notifyClient = async (booking, vendor, title, message) => {
  const clientId = booking.planner?._id || booking.planner;
  if (!clientId) return;
  try {
    await Notification.createNotification({
      recipient: clientId,
      type: "info",
      kind: "booking_update",
      category: "booking",
      title,
      message,
      data: { bookingId: booking._id.toString(), vendorId: vendor._id.toString() },
      relatedEntity: { type: "booking", id: booking._id },
    });
  } catch (error) {
    logger.warn("Booking notification failed", { error: error.message, booking: booking._id });
  }
};

const send = (res, booking, status = 200) =>
  res.status(status).json({ status: "success", data: { booking: formatForVendor(booking) } });

const STATUS_FILTER = {
  pending: { status: { $in: OPEN } },
  confirmed: { status: { $in: ["booked", "confirmed"] } },
  in_progress: { status: { $in: ["booked", "confirmed"] } },
  completed: { status: "completed" },
  cancelled: { status: "cancelled" },
  refunded: { "payment.status": "refunded" },
};

export const listVendorBookings = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const { status, startDate, endDate, search } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    const query = { vendor: vendor._id, ...(STATUS_FILTER[status] || {}) };
    if (startDate || endDate) {
      query.eventDate = {};
      if (startDate) query.eventDate.$gte = new Date(startDate);
      if (endDate) query.eventDate.$lte = new Date(endDate);
    }
    if (search) {
      const rx = new RegExp(escapeRegExp(String(search)), "i");
      query.$or = [{ clientName: rx }, { clientEmail: rx }, { eventType: rx }, { location: rx }];
    }

    const [bookings, total] = await Promise.all([
      VendorBooking.find(query).populate("planner", CLIENT_FIELDS).sort({ eventDate: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      VendorBooking.countDocuments(query),
    ]);
    let shaped = bookings.map(formatForVendor);
    if (status === "in_progress" || status === "confirmed") shaped = shaped.filter((b) => b.status === status);

    res.status(200).json({
      status: "success",
      data: { bookings: shaped, total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorBookingStats = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const bookings = (await VendorBooking.find({ vendor: vendor._id })).map(formatForVendor);
    const now = Date.now();
    const within = (b, days) => b.event.date && new Date(b.event.date) >= now && new Date(b.event.date) <= now + days * 86400000;
    const count = (s) => bookings.filter((b) => b.status === s).length;
    const live = bookings.filter((b) => b.status !== "cancelled");

    res.status(200).json({
      status: "success",
      data: {
        total: bookings.length,
        pending: count("pending"),
        confirmed: count("confirmed"),
        inProgress: count("in_progress"),
        completed: count("completed"),
        cancelled: count("cancelled"),
        totalRevenue: live.reduce((sum, b) => sum + (b.payment.total - b.payment.balance), 0),
        pendingPayments: live.reduce((sum, b) => sum + b.payment.balance, 0),
        upcomingThisWeek: live.filter((b) => within(b, 7)).length,
        upcomingThisMonth: live.filter((b) => within(b, 30)).length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUpcomingVendorBookings = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 5, 1), 50);
    const bookings = await VendorBooking.find({
      vendor: vendor._id,
      status: { $nin: ["cancelled", "completed"] },
      eventDate: { $gte: new Date() },
    })
      .populate("planner", CLIENT_FIELDS)
      .sort({ eventDate: 1 })
      .limit(limit);
    res.status(200).json({ status: "success", data: { bookings: bookings.map(formatForVendor) } });
  } catch (error) {
    next(error);
  }
};

export const getBookingsByDateRange = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) throw new AppError("startDate and endDate are required", 400);
    const bookings = await VendorBooking.find({
      vendor: vendor._id,
      eventDate: { $gte: new Date(startDate), $lte: new Date(endDate) },
    })
      .populate("planner", CLIENT_FIELDS)
      .sort({ eventDate: 1 });
    res.status(200).json({ status: "success", data: { bookings: bookings.map(formatForVendor) } });
  } catch (error) {
    next(error);
  }
};

export const getVendorBooking = async (req, res, next) => {
  try {
    send(res, await findBooking(req, await myVendor(req)));
  } catch (error) {
    next(error);
  }
};

const applyFields = (booking, body) => {
  const map = {
    clientName: "clientName",
    clientEmail: "clientEmail",
    clientPhone: "clientPhone",
    eventType: "eventType",
    eventDate: "eventDate",
    eventEndDate: "eventEndDate",
    location: "location",
    address: "address",
    guestCount: "guestCount",
    eventNotes: "eventNotes",
    totalAmount: "totalAmount",
    depositAmount: "depositAmount",
    currency: "currency",
  };
  for (const [from, to] of Object.entries(map)) {
    if (body[from] !== undefined) booking.set(to, body[from]);
  }
  if (body.totalAmount !== undefined) booking.set("payment.totalAmount", body.totalAmount);
  if (body.leadId && mongoose.isValidObjectId(body.leadId)) booking.lead = body.leadId;
  if (body.quoteId && mongoose.isValidObjectId(body.quoteId)) booking.quoteRef = body.quoteId;
};

/** Vendor records a booking themselves (e.g. a phone booking) */
export const createVendorBooking = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const body = req.body || {};
    if (!body.clientName || !body.eventType || !body.eventDate) {
      throw new AppError("Client name, event type and event date are required", 400);
    }
    const booking = new VendorBooking({ vendor: vendor._id, status: "confirmed", confirmedAt: new Date() });
    if (body.clientId && mongoose.isValidObjectId(body.clientId)) booking.planner = body.clientId;
    applyFields(booking, body);
    booking.statusHistory.push({ status: "confirmed", changedBy: req.user._id, note: "Created by vendor" });
    await booking.save();
    await booking.populate("planner", CLIENT_FIELDS);
    send(res, booking, 201);
  } catch (error) {
    next(error);
  }
};

export const updateVendorBooking = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    applyFields(booking, req.body || {});
    await booking.save();
    send(res, booking);
  } catch (error) {
    next(error);
  }
};

const setStatus = async (req, res, next, status, { reason } = {}) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    if (["cancelled", "completed"].includes(booking.status)) {
      throw new AppError(`This booking is already ${booking.status}`, 400);
    }
    if (status === "completed" && OPEN.includes(booking.status)) {
      throw new AppError("Confirm the booking before completing it", 400);
    }
    booking.statusHistory.push({ status, changedBy: req.user._id, note: reason });
    booking.status = status;
    if (status === "confirmed") booking.confirmedAt = new Date();
    if (status === "completed") booking.completedAt = new Date();
    if (status === "cancelled") {
      booking.cancelledAt = new Date();
      booking.cancellationReason = reason;
      booking.cancelledBy = "vendor";
    }
    await booking.save();

    const name = vendor.businessName || vendor.name;
    const messages = {
      confirmed: [`${name} confirmed your booking`, "Your booking has been confirmed."],
      completed: [`${name} marked your booking complete`, "Thanks for booking through Confetti."],
      cancelled: [`${name} cancelled your booking`, reason || "The vendor cancelled this booking."],
    };
    await notifyClient(booking, vendor, ...messages[status]);
    send(res, booking);
  } catch (error) {
    next(error);
  }
};

export const confirmVendorBooking = (req, res, next) => setStatus(req, res, next, "confirmed");
export const completeVendorBooking = (req, res, next) => setStatus(req, res, next, "completed");
export const cancelVendorBooking = (req, res, next) => setStatus(req, res, next, "cancelled", { reason: req.body?.reason });

/** PATCH /:id/status { status } — vendor-side status names */
export const updateVendorBookingStatus = (req, res, next) => {
  const map = { confirmed: "confirmed", completed: "completed", cancelled: "cancelled", in_progress: "confirmed" };
  const status = map[req.body?.status];
  if (!status) return next(new AppError("Invalid status", 400));
  return setStatus(req, res, next, status, { reason: req.body?.reason });
};

export const addVendorBookingNote = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    const text = typeof req.body?.note === "string" ? req.body.note.trim() : typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) throw new AppError("Note text is required", 400);
    booking.notes.push({ content: text.slice(0, 5000), createdBy: req.user._id });
    await booking.save();
    const note = booking.notes.at(-1);
    res.status(201).json({
      status: "success",
      data: {
        note: {
          _id: note._id.toString(),
          text: note.content,
          createdBy: req.user._id.toString(),
          createdByName: [req.user.firstName, req.user.lastName].filter(Boolean).join(" "),
          createdAt: note.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const recordVendorBookingPayment = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    const amount = Number(req.body?.amount);
    if (!(amount > 0)) throw new AppError("Please enter a valid amount", 400);
    booking.payments.push({ amount, method: req.body?.paymentMethod, notes: req.body?.notes });
    const { total, deposit, paid } = totals(booking);
    booking.set("payment.paidAmount", paid);
    booking.set("payment.status", total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "pending");
    if (deposit > 0 && paid >= deposit && !booking.depositPaidAt) booking.depositPaidAt = new Date();
    await booking.save();
    send(res, booking);
  } catch (error) {
    next(error);
  }
};

export const markVendorDepositPaid = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    if (booking.depositPaidAt) throw new AppError("The deposit is already marked as paid", 400);
    const { deposit, paid } = totals(booking);
    if (deposit > paid) {
      booking.payments.push({ amount: deposit - paid, method: req.body?.paymentMethod || "manual", notes: "Deposit" });
    }
    booking.depositPaidAt = new Date();
    const after = totals(booking);
    booking.set("payment.paidAmount", after.paid);
    booking.set("payment.status", after.total > 0 && after.paid >= after.total ? "paid" : "partial");
    await booking.save();
    send(res, booking);
  } catch (error) {
    next(error);
  }
};

export const sendVendorBookingConfirmation = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    const shaped = formatForVendor(booking);
    if (!shaped.client.email) throw new AppError("This booking has no client email", 400);
    const name = vendor.businessName || vendor.name;
    const date = shaped.event.date ? new Date(shaped.event.date).toDateString() : "the agreed date";
    await sendEmailDirect({
      to: shaped.client.email,
      subject: `Booking confirmation from ${name}`,
      html: `
        <h2>Your booking with ${escapeHtml(name)}</h2>
        <p>Hi ${escapeHtml(shaped.client.name)},</p>
        <p>This confirms your ${escapeHtml(shaped.event.type || "event")} booking on ${escapeHtml(date)}${
          shaped.event.location ? ` at ${escapeHtml(shaped.event.location)}` : ""
        }.</p>
        ${
          shaped.payment.total
            ? `<p>Total: ${escapeHtml(shaped.payment.currency)} ${shaped.payment.total.toLocaleString()} · Balance due: ${escapeHtml(
                shaped.payment.currency
              )} ${shaped.payment.balance.toLocaleString()}</p>`
            : ""
        }
        <p>Reply to this email or message ${escapeHtml(name)} on Confetti with any questions.</p>`,
    });
    booking.addCommunication(req.user._id, "Confirmation email sent", "note").catch(() => {});
    res.status(200).json({ status: "success", message: "Confirmation email sent" });
  } catch (error) {
    next(error);
  }
};

/** POST /:id/contract → { contractUrl } pointing at the PDF below */
export const generateVendorContract = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    const base = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get("host")}`;
    res.status(200).json({
      status: "success",
      data: { contractUrl: `${base}/api/v1/vendors/bookings/${booking._id}/contract.pdf` },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /:id/contract.pdf — service agreement for the booking */
export const downloadVendorContract = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    const b = formatForVendor(booking);
    const name = vendor.businessName || vendor.name;
    const money = (n) => `${b.payment.currency} ${Number(n || 0).toLocaleString()}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="contract-${b._id}.pdf"`);
    const doc = new PDFDocument({ margin: 56 });
    doc.pipe(res);
    doc.fontSize(18).text("Service Agreement", { align: "center" }).moveDown();
    doc.fontSize(11);
    doc.text(`Vendor: ${name}${vendor.email ? ` (${vendor.email})` : ""}`);
    doc.text(`Client: ${b.client.name}${b.client.email ? ` (${b.client.email})` : ""}`);
    doc.text(`Date: ${new Date().toDateString()}`).moveDown();
    doc.fontSize(13).text("Event").fontSize(11);
    doc.text(`Type: ${b.event.type || "—"}`);
    doc.text(`Date: ${b.event.date ? new Date(b.event.date).toDateString() : "—"}`);
    doc.text(`Location: ${b.event.location || "—"}`);
    if (b.event.guestCount) doc.text(`Guests: ${b.event.guestCount}`);
    doc.moveDown().fontSize(13).text("Payment").fontSize(11);
    doc.text(`Total fee: ${money(b.payment.total)}`);
    doc.text(`Deposit: ${money(b.payment.deposit)}${b.payment.depositPaid ? " (paid)" : ""}`);
    doc.text(`Balance: ${money(b.payment.balance)}`);
    if (booking.contract?.terms) doc.moveDown().fontSize(13).text("Terms").fontSize(11).text(booking.contract.terms);
    if (b.event.notes) doc.moveDown().fontSize(13).text("Details").fontSize(11).text(b.event.notes);
    doc.moveDown(2).text("Vendor signature: ______________________      Client signature: ______________________");
    doc.end();
  } catch (error) {
    next(error);
  }
};

export const markVendorContractSigned = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    booking.set("contract.signed", true);
    booking.set("contract.signedAt", new Date());
    await booking.save();
    send(res, booking);
  } catch (error) {
    next(error);
  }
};

/** Vendors don't delete client bookings; cancel instead. Their own manual bookings can go. */
export const deleteVendorBooking = async (req, res, next) => {
  try {
    const vendor = await myVendor(req);
    const booking = await findBooking(req, vendor);
    if (booking.planner) throw new AppError("Bookings made by clients can be cancelled, not deleted", 400);
    await booking.deleteOne();
    res.status(200).json({ status: "success", message: "Booking deleted" });
  } catch (error) {
    next(error);
  }
};
