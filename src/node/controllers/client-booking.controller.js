import mongoose from "mongoose";
import VendorBooking from "../models/vendor-booking.model.js";
import Vendor from "../models/vendor.model.js";
import Lead from "../models/lead.model.js";
import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { scheduleView } from "../utils/payment-schedule.js";

/**
 * The client's side of bookings and their dashboard (/api/v1/users/…), for people
 * planning their own event (and planners using the client screens).
 * A quote request creates a booking the client owns plus a lead for the vendor,
 * linked to the client's account so the vendor can message them.
 */

const VENDOR_FIELDS = "businessName name category email phone";
const ACTIVE = ["pending", "contacted", "quoted", "booked", "confirmed"];
const STATUS_LABEL = {
  pending: "Pending",
  contacted: "Contacted",
  quoted: "Quoted",
  booked: "Booked",
  confirmed: "Confirmed",
  completed: "Confirmed",
  cancelled: "Cancelled",
};

/** VendorBooking → the client dashboard's UserBooking shape */
export const formatForClient = (b) => {
  const vendor = b.vendor && typeof b.vendor === "object" && b.vendor._id ? b.vendor : null;
  return {
    _id: b._id.toString(),
    vendor: vendor
      ? {
          _id: vendor._id.toString(),
          businessName: vendor.businessName || vendor.name || "Vendor",
          category: vendor.category || "",
          contactInfo: { email: vendor.email, phone: vendor.phone },
        }
      : b.vendor?.toString(),
    event: b.event && typeof b.event === "object" && b.event._id
      ? { _id: b.event._id.toString(), name: b.event.title, type: b.event.eventType, date: b.event.startDate }
      : b.eventType
      ? { type: b.eventType, date: b.eventDate }
      : undefined,
    // A cancellation by the vendor reads as "Declined" to the client
    status:
      b.status === "cancelled" && b.cancelledBy === "vendor" ? "Declined" : STATUS_LABEL[b.status] || "Pending",
    serviceRequirements: b.serviceRequirements || "",
    budget: b.budget?.amount ?? 0,
    currency: b.budget?.currency || b.currency || "NGN",
    specialRequirements: b.specialRequirements,
    quotedPrice: b.quote?.amount ?? b.totalAmount,
    // What's due when (deposit and balance), once the vendor has set a total
    paymentSchedule: (b.totalAmount ?? b.payment?.totalAmount) ? scheduleView(b) : null,
    notes: [],
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
};

const ownBooking = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError("Booking not found", 404);
  const booking = await VendorBooking.findOne({ _id: req.params.id, planner: req.user._id })
    .populate("vendor", VENDOR_FIELDS)
    .populate("event", "title eventType startDate");
  if (!booking) throw new AppError("Booking not found", 404);
  return booking;
};

/** POST /users/bookings/request — ask a vendor for a quote */
export const requestBooking = async (req, res, next) => {
  try {
    const body = req.body || {};
    const vendorId = body.vendor || body.vendorId;
    if (!mongoose.isValidObjectId(vendorId)) throw new AppError("Choose a vendor", 400);
    const vendor = await Vendor.findById(vendorId).select("_id owner businessName name");
    if (!vendor) throw new AppError("Vendor not found", 404);
    if (String(vendor.owner) === String(req.user._id)) throw new AppError("You can't book yourself", 400);
    if (!body.eventType) throw new AppError("Event type is required", 400);

    const name =
      (typeof body.contactName === "string" && body.contactName.trim()) ||
      [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") ||
      req.user.username;
    const email = (typeof body.contactEmail === "string" && body.contactEmail.trim()) || req.user.email;
    const budget = Number(body.budget) > 0 ? Number(body.budget) : undefined;

    const booking = await VendorBooking.create({
      vendor: vendor._id,
      planner: req.user._id,
      clientName: name,
      clientEmail: email,
      clientPhone: body.contactPhone,
      eventType: body.eventType,
      eventDate: body.eventDate || undefined,
      location: body.location,
      guestCount: Number(body.guestCount) > 0 ? Number(body.guestCount) : undefined,
      serviceRequirements: body.serviceRequirements,
      specialRequirements: body.specialRequirements,
      budget: budget ? { amount: budget, currency: "NGN" } : undefined,
      status: "pending",
    });

    // The vendor works enquiries from Leads; link it to the client so they can reply by message
    const lead = await Lead.create({
      vendor: vendor._id,
      customer: { name, email, phone: body.contactPhone },
      customerUser: req.user._id,
      booking: booking._id,
      eventDetails: {
        type: body.eventType,
        date: body.eventDate || undefined,
        location: body.location,
        guestCount: Number(body.guestCount) > 0 ? Number(body.guestCount) : undefined,
        budget,
        description: [body.serviceRequirements, body.specialRequirements].filter(Boolean).join("\n\n").slice(0, 2000),
      },
      source: "website",
    });
    booking.lead = lead._id;
    await booking.save();

    try {
      await Notification.createNotification({
        recipient: vendor.owner,
        type: "info",
        kind: "booking_update",
        category: "booking",
        title: `New booking request from ${name}`,
        message: `${body.eventType}${body.eventDate ? ` on ${new Date(body.eventDate).toDateString()}` : ""}`,
        actionUrl: `/vendor/dashboard/leads/${lead._id}`,
        data: { bookingId: booking._id.toString(), leadId: lead._id.toString() },
      });
    } catch (error) {
      logger.warn("Booking request notification failed", { error: error.message });
    }

    await booking.populate("vendor", VENDOR_FIELDS);
    res.status(201).json({ status: "success", data: { booking: formatForClient(booking) } });
  } catch (error) {
    next(error);
  }
};

/** GET /users/bookings */
export const listMyBookings = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 100);
    const query = { planner: req.user._id };
    const wanted = Object.entries(STATUS_LABEL).filter(([, label]) => label === req.query.status).map(([s]) => s);
    if (wanted.length) query.status = { $in: wanted };

    const [bookings, total] = await Promise.all([
      VendorBooking.find(query)
        .populate("vendor", VENDOR_FIELDS)
        .populate("event", "title eventType startDate")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      VendorBooking.countDocuments(query),
    ]);
    res.status(200).json({
      status: "success",
      data: { bookings: bookings.map(formatForClient), total, totalPages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /users/bookings/:id */
export const getMyBooking = async (req, res, next) => {
  try {
    res.status(200).json({ status: "success", data: { booking: formatForClient(await ownBooking(req)) } });
  } catch (error) {
    next(error);
  }
};

/** PATCH /users/bookings/:id/cancel — only before the vendor confirms */
export const cancelMyBooking = async (req, res, next) => {
  try {
    const booking = await ownBooking(req);
    if (!["pending", "contacted", "quoted"].includes(booking.status)) {
      throw new AppError("This booking can no longer be cancelled here. Message the vendor instead.", 400);
    }
    booking.statusHistory.push({ status: "cancelled", changedBy: req.user._id, note: req.body?.reason });
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancellationReason = req.body?.reason;
    booking.cancelledBy = "client";
    await booking.save();
    if (booking.lead) await Lead.updateOne({ _id: booking.lead, status: { $ne: "won" } }, { status: "lost" });
    res.status(200).json({ status: "success", data: { booking: formatForClient(booking) } });
  } catch (error) {
    next(error);
  }
};

/** GET /users/dashboard/stats */
export const getMyDashboardStats = async (req, res, next) => {
  try {
    const me = req.user._id;
    const now = new Date();
    const mine = { $or: [{ createdBy: me }, { planner: me }] };
    const [totalEvents, upcomingEvents, activeBookings, user] = await Promise.all([
      Event.countDocuments({ ...mine, status: { $ne: "cancelled" } }),
      Event.countDocuments({ ...mine, status: { $in: ["draft", "published"] }, startDate: { $gte: now } }),
      VendorBooking.countDocuments({ planner: me, status: { $in: ACTIVE } }),
      User.findById(me).select("favorites").lean(),
    ]);
    res.status(200).json({
      status: "success",
      data: {
        upcomingEvents,
        totalEvents,
        savedVendors: user?.favorites?.vendors?.length || 0,
        activeBookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /users/activity — recent events and booking updates */
export const getMyActivity = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 50);
    const me = req.user._id;
    const [events, bookings] = await Promise.all([
      Event.find({ $or: [{ createdBy: me }, { planner: me }] }).sort({ createdAt: -1 }).limit(limit).select("title createdAt").lean(),
      VendorBooking.find({ planner: me }).sort({ updatedAt: -1 }).limit(limit).populate("vendor", "businessName name").lean(),
    ]);
    const activities = [
      ...events.map((e) => ({
        id: `event-${e._id}`,
        type: "event",
        title: "Event created",
        description: e.title,
        timestamp: e.createdAt,
      })),
      ...bookings.map((b) => ({
        id: `booking-${b._id}`,
        type: "booking",
        title: `Booking ${STATUS_LABEL[b.status] || b.status}`.trim(),
        description: b.vendor?.businessName || b.vendor?.name || "Vendor",
        timestamp: b.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    res.status(200).json({ status: "success", data: { activities } });
  } catch (error) {
    next(error);
  }
};
