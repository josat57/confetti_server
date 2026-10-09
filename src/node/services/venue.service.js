import mongoose from "mongoose";
import { VenueSpace, VenueReservation, VenueSlotLock, RESERVATION_ACTIVE } from "../models/venue.model.js";
import Vendor from "../models/vendor.model.js";
import VendorBooking from "../models/vendor-booking.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Venue plan (roadmap Phase 9): spaces, a calendar per space, timed holds that
 * expire on their own, bookings (linked to VendorBooking so they show on the
 * bookings page) and blocked dates. Slots are locked per space, day and half-day.
 */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 14;
const MAX_HOLD_DAYS = 60;
const DEFAULT_HOLD_DAYS = Number(process.env.VENUE_HOLD_DAYS) || 3;
const HALVES = { full: ["am", "pm"], morning: ["am"], evening: ["pm"] };
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseDay = (s) => {
  if (!DAY_RE.test(String(s || ""))) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
};
const daysBetween = (from, to) => {
  const out = [];
  for (let d = parseDay(from); d <= parseDay(to); d = new Date(d.getTime() + 86400000)) out.push(d.toISOString().slice(0, 10));
  return out;
};
const keysFor = (r) => daysBetween(r.dateFrom, r.dateTo).flatMap((date) => HALVES[r.session || "full"].map((half) => ({ date, half })));
const keyStr = (k) => `${k.date}|${k.half}`;

const vendorFor = async (user) => {
  const vendor = await Vendor.findOne({ owner: user._id }).select("_id businessName name owner category");
  if (!vendor) throw new AppError("Vendor profile not found", 404);
  return vendor;
};

let lockIndexReady = null;

const conflictError = (conflicts) => {
  const error = new AppError("That space is already taken for some of those dates", 409);
  error.code = "VENUE_DATE_TAKEN";
  error.details = { conflicts };
  return error;
};

class VenueService {
  // ---- Spaces ----

  async listSpaces(user) {
    const vendor = await vendorFor(user);
    return VenueSpace.find({ vendor: vendor._id }).sort({ active: -1, name: 1 }).lean();
  }

  spaceInput(body, current) {
    const out = {};
    if (body.name !== undefined || !current) {
      const name = str(body.name, 120);
      if (!name) throw new AppError("Name the space (e.g. Main hall)", 400);
      out.name = name;
    }
    if (body.description !== undefined) out.description = str(body.description, 2000) || undefined;
    for (const key of ["seated", "standing"]) {
      const v = body.capacity?.[key];
      if (v === undefined) continue;
      if (v === null || v === "") out[`capacity.${key}`] = undefined;
      else {
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0) throw new AppError("Capacity should be a whole number", 400);
        out[`capacity.${key}`] = n;
      }
    }
    if (body.pricePerDay !== undefined) {
      if (body.pricePerDay === null || body.pricePerDay === "") out.pricePerDay = undefined;
      else {
        const n = Number(body.pricePerDay);
        if (!Number.isFinite(n) || n < 0) throw new AppError("Enter a valid price", 400);
        out.pricePerDay = n;
      }
    }
    if (body.active !== undefined) out.active = !!body.active;
    return out;
  }

  async createSpace(user, body = {}) {
    const vendor = await vendorFor(user);
    if ((await VenueSpace.countDocuments({ vendor: vendor._id })) >= 30) throw new AppError("Up to 30 spaces per venue", 400);
    const space = new VenueSpace({ vendor: vendor._id });
    for (const [k, v] of Object.entries(this.spaceInput(body))) space.set(k, v);
    await space.save();
    return space;
  }

  async findSpace(vendor, spaceId) {
    if (!mongoose.isValidObjectId(spaceId)) throw new AppError("Space not found", 404);
    const space = await VenueSpace.findOne({ _id: spaceId, vendor: vendor._id });
    if (!space) throw new AppError("Space not found", 404);
    return space;
  }

  async updateSpace(user, spaceId, body = {}) {
    const vendor = await vendorFor(user);
    const space = await this.findSpace(vendor, spaceId);
    for (const [k, v] of Object.entries(this.spaceInput(body, space))) space.set(k, v);
    await space.save();
    return space;
  }

  /** Spaces with history are switched off instead of deleted */
  async deleteSpace(user, spaceId) {
    const vendor = await vendorFor(user);
    const space = await this.findSpace(vendor, spaceId);
    const today = new Date().toISOString().slice(0, 10);
    if (await VenueReservation.exists({ space: space._id, status: { $in: RESERVATION_ACTIVE }, dateTo: { $gte: today } })) {
      throw new AppError("This space has upcoming holds or bookings. Move or cancel them first.", 400);
    }
    if (await VenueReservation.exists({ space: space._id })) {
      space.active = false;
      await space.save();
      return { archived: true };
    }
    await space.deleteOne();
    return { deleted: true };
  }

  // ---- Calendar and availability ----

  async calendar(user, { from, to, space } = {}) {
    const vendor = await vendorFor(user);
    const start = parseDay(from) ? from : new Date().toISOString().slice(0, 8) + "01";
    const end = parseDay(to) ? to : new Date(parseDay(start).getTime() + 41 * 86400000).toISOString().slice(0, 10);
    if (end < start) throw new AppError("The end date is before the start date", 400);
    if (daysBetween(start, end).length > 400) throw new AppError("Pick a shorter range", 400);
    const query = { vendor: vendor._id, status: { $in: RESERVATION_ACTIVE }, dateFrom: { $lte: end }, dateTo: { $gte: start } };
    if (space && mongoose.isValidObjectId(space)) query.space = space;
    const [spaces, reservations] = await Promise.all([
      VenueSpace.find({ vendor: vendor._id }).sort({ active: -1, name: 1 }).lean(),
      VenueReservation.find(query).sort({ dateFrom: 1 }).lean(),
    ]);
    return { from: start, to: end, spaces, reservations };
  }

  /** Who already has the slots for a proposed reservation (empty when free) */
  async conflictsFor(spaceId, r, excludeId) {
    const keys = keysFor(r);
    const locks = await VenueSlotLock.find({
      space: spaceId,
      $or: keys.map((k) => ({ date: k.date, half: k.half })),
      ...(excludeId ? { reservation: { $ne: excludeId } } : {}),
    }).lean();
    if (!locks.length) return [];
    const ids = [...new Set(locks.map((l) => String(l.reservation)))];
    const others = await VenueReservation.find({ _id: { $in: ids } }).select("status dateFrom dateTo session title clientName holdExpiresAt").lean();
    return others.map((o) => ({ ...o, dates: locks.filter((l) => String(l.reservation) === String(o._id)).map((l) => `${l.date} ${l.half}`) }));
  }

  async availability(user, { space, dateFrom, dateTo, session = "full" } = {}) {
    const vendor = await vendorFor(user);
    const s = await this.findSpace(vendor, space);
    const r = this.datesInput({ dateFrom, dateTo: dateTo || dateFrom, session });
    const conflicts = await this.conflictsFor(s._id, r);
    return { available: conflicts.length === 0, conflicts };
  }

  datesInput(body, current = {}) {
    const dateFrom = body.dateFrom ?? current.dateFrom;
    const dateTo = body.dateTo ?? body.dateFrom ?? current.dateTo;
    const session = body.session ?? current.session ?? "full";
    if (!parseDay(dateFrom) || !parseDay(dateTo)) throw new AppError("Choose valid dates", 400);
    if (dateTo < dateFrom) throw new AppError("The end date is before the start date", 400);
    if (!HALVES[session]) throw new AppError("Session should be full, morning or evening", 400);
    if (daysBetween(dateFrom, dateTo).length > MAX_DAYS) throw new AppError(`Up to ${MAX_DAYS} days at a time`, 400);
    return { dateFrom, dateTo, session };
  }

  /**
   * Take the slots for a reservation. Slots it already holds are kept; new ones are
   * inserted (the unique index rejects any taken in the meantime); old ones are freed.
   */
  async lockSlots(reservation) {
    // The unique index is what prevents double booking; make sure it exists
    lockIndexReady ||= VenueSlotLock.createIndexes();
    await lockIndexReady;
    const wanted = keysFor(reservation);
    const held = await VenueSlotLock.find({ reservation: reservation._id }).lean();
    const heldKeys = new Set(held.filter((l) => String(l.space) === String(reservation.space)).map(keyStr));
    const toAdd = wanted.filter((k) => !heldKeys.has(keyStr(k)));
    if (toAdd.length) {
      try {
        await VenueSlotLock.insertMany(
          toAdd.map((k) => ({ space: reservation.space, date: k.date, half: k.half, reservation: reservation._id })),
          { ordered: true }
        );
      } catch (error) {
        // Undo what this attempt inserted, then report who has the slots
        await VenueSlotLock.deleteMany({
          reservation: reservation._id,
          space: reservation.space,
          $or: toAdd.map((k) => ({ date: k.date, half: k.half })),
        });
        if (error.code === 11000 || error.writeErrors?.some?.((e) => e.code === 11000)) {
          throw conflictError(await this.conflictsFor(reservation.space, reservation, reservation._id));
        }
        throw error;
      }
    }
    const wantedKeys = new Set(wanted.map(keyStr));
    const stale = held.filter((l) => String(l.space) !== String(reservation.space) || !wantedKeys.has(keyStr(l)));
    if (stale.length) await VenueSlotLock.deleteMany({ _id: { $in: stale.map((l) => l._id) } });
  }

  freeSlots(reservationId) {
    return VenueSlotLock.deleteMany({ reservation: reservationId });
  }

  // ---- Reservations ----

  detailsInput(body) {
    const out = {};
    for (const [key, max] of [["title", 200], ["clientName", 200], ["clientPhone", 40], ["notes", 2000]]) {
      if (body[key] !== undefined) out[key] = str(body[key], max) || undefined;
    }
    if (body.clientEmail !== undefined) {
      const email = str(body.clientEmail, 160)?.toLowerCase();
      if (email && !EMAIL.test(email)) throw new AppError("Enter a valid email address", 400);
      out.clientEmail = email || undefined;
    }
    if (body.guestCount !== undefined) {
      if (body.guestCount === "" || body.guestCount === null) out.guestCount = undefined;
      else {
        const n = Number(body.guestCount);
        if (!Number.isInteger(n) || n < 0) throw new AppError("Guest count should be a whole number", 400);
        out.guestCount = n;
      }
    }
    return out;
  }

  holdExpiry(value) {
    const at = value ? new Date(value) : new Date(Date.now() + DEFAULT_HOLD_DAYS * 86400000);
    if (Number.isNaN(at.getTime()) || at <= new Date()) throw new AppError("The hold must end in the future", 400);
    if (at - Date.now() > MAX_HOLD_DAYS * 86400000) throw new AppError(`Holds can last up to ${MAX_HOLD_DAYS} days`, 400);
    return at;
  }

  async findReservation(vendor, id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Reservation not found", 404);
    const r = await VenueReservation.findOne({ _id: id, vendor: vendor._id });
    if (!r) throw new AppError("Reservation not found", 404);
    return r;
  }

  async listReservations(user, { status, space, upcoming } = {}) {
    const vendor = await vendorFor(user);
    const query = { vendor: vendor._id };
    if (["held", "booked", "blocked", "released", "expired", "cancelled"].includes(status)) query.status = status;
    if (space && mongoose.isValidObjectId(space)) query.space = space;
    if (upcoming === "true" || upcoming === true) query.dateTo = { $gte: new Date().toISOString().slice(0, 10) };
    return VenueReservation.find(query).sort({ dateFrom: 1 }).limit(500).populate("space", "name").lean();
  }

  /**
   * POST { space, status: held|booked|blocked, dateFrom, dateTo, session, title, client…,
   *        holdExpiresAt (holds), booking (existing VendorBooking id), totalAmount, depositAmount, depositDueDate }
   */
  async createReservation(user, body = {}) {
    const vendor = await vendorFor(user);
    const space = await this.findSpace(vendor, body.space);
    if (!space.active) throw new AppError("This space is switched off", 400);
    const status = body.status || "held";
    if (!RESERVATION_ACTIVE.includes(status)) throw new AppError("Choose hold, booking or blocked", 400);

    let linked = null;
    if (body.booking) {
      if (!mongoose.isValidObjectId(body.booking)) throw new AppError("Booking not found", 404);
      linked = await VendorBooking.findOne({ _id: body.booking, vendor: vendor._id });
      if (!linked) throw new AppError("Booking not found", 404);
      if (await VenueReservation.exists({ booking: linked._id, status: { $in: RESERVATION_ACTIVE } })) {
        throw new AppError("That booking already has a space", 400);
      }
    }
    const dates = this.datesInput({
      dateFrom: body.dateFrom || (linked?.eventDate ? linked.eventDate.toISOString().slice(0, 10) : undefined),
      dateTo: body.dateTo || (linked?.eventEndDate ? linked.eventEndDate.toISOString().slice(0, 10) : undefined),
      session: body.session,
    });
    const reservation = new VenueReservation({
      vendor: vendor._id,
      space: space._id,
      status,
      ...dates,
      ...this.detailsInput(body),
      history: [{ action: status === "held" ? "hold" : status === "booked" ? "booked" : "blocked" }],
    });
    if (linked && !reservation.clientName) reservation.clientName = linked.clientName;
    if (linked && !reservation.clientEmail) reservation.clientEmail = linked.clientEmail;
    if (status === "held") reservation.holdExpiresAt = this.holdExpiry(body.holdExpiresAt);

    await this.lockSlots(reservation); // throws VENUE_DATE_TAKEN before anything is saved
    try {
      if (status === "booked") await this.attachBooking(reservation, vendor, linked, body);
      await reservation.save();
    } catch (error) {
      await this.freeSlots(reservation._id);
      throw error;
    }
    return reservation;
  }

  /** Link (or create) the VendorBooking for a booked reservation */
  async attachBooking(reservation, vendor, linked, body = {}) {
    let booking = linked;
    if (!booking) {
      if (!reservation.clientName) throw new AppError("Who is the booking for?", 400);
      booking = new VendorBooking({
        vendor: vendor._id,
        status: "confirmed",
        confirmedAt: new Date(),
        clientName: reservation.clientName,
        clientEmail: reservation.clientEmail,
        clientPhone: reservation.clientPhone,
        eventType: reservation.title || "Venue booking",
        eventDate: parseDay(reservation.dateFrom),
        eventEndDate: parseDay(reservation.dateTo),
        guestCount: reservation.guestCount,
        currency: "NGN",
        statusHistory: [{ status: "confirmed", note: "Booked from the venue calendar" }],
      });
    } else if (["pending", "contacted", "quoted", "booked"].includes(booking.status)) {
      booking.status = "confirmed";
      booking.confirmedAt = booking.confirmedAt || new Date();
      booking.statusHistory.push({ status: "confirmed", note: "Space booked on the venue calendar" });
    } else if (booking.status === "cancelled") {
      throw new AppError("That booking was cancelled", 400);
    }
    const money = (v, label) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new AppError(`Enter a valid ${label}`, 400);
      return n;
    };
    if (body.totalAmount !== undefined && body.totalAmount !== "") booking.totalAmount = money(body.totalAmount, "total");
    if (body.depositAmount !== undefined && body.depositAmount !== "") booking.depositAmount = money(body.depositAmount, "deposit");
    if ((booking.depositAmount || 0) > (booking.totalAmount ?? Infinity)) throw new AppError("The deposit is more than the total", 400);
    if (body.depositDueDate) {
      const due = new Date(body.depositDueDate);
      if (Number.isNaN(due.getTime())) throw new AppError("Invalid deposit due date", 400);
      booking.depositDueDate = due;
    }
    await booking.save({ validateModifiedOnly: true });
    reservation.booking = booking._id;
    reservation.bookedAt = new Date();
    return booking;
  }

  /** Change details, dates, session or space (slots are re-checked) */
  async updateReservation(user, id, body = {}) {
    const vendor = await vendorFor(user);
    const r = await this.findReservation(vendor, id);
    if (!RESERVATION_ACTIVE.includes(r.status)) throw new AppError("This reservation has ended", 400);
    Object.assign(r, this.detailsInput(body));
    const moving = ["dateFrom", "dateTo", "session", "space"].some((k) => body[k] !== undefined);
    if (moving) {
      if (body.space !== undefined && String(body.space) !== String(r.space)) {
        const space = await this.findSpace(vendor, body.space);
        if (!space.active) throw new AppError("This space is switched off", 400);
        r.space = space._id;
      }
      Object.assign(r, this.datesInput(body, r));
      await this.lockSlots(r);
      r.history.push({ action: "moved", note: `${r.dateFrom}${r.dateTo !== r.dateFrom ? ` to ${r.dateTo}` : ""} (${r.session})` });
      if (r.booking) {
        await VendorBooking.updateOne(
          { _id: r.booking },
          { $set: { eventDate: parseDay(r.dateFrom), eventEndDate: parseDay(r.dateTo) } }
        );
      }
    }
    await r.save();
    return r;
  }

  async extendHold(user, id, { holdExpiresAt } = {}) {
    const vendor = await vendorFor(user);
    const r = await this.findReservation(vendor, id);
    if (r.status !== "held") throw new AppError("Only holds can be extended", 400);
    r.holdExpiresAt = this.holdExpiry(holdExpiresAt);
    r.holdReminderSentAt = undefined;
    r.history.push({ action: "extended", note: r.holdExpiresAt.toISOString() });
    await r.save();
    return r;
  }

  /** Turn a hold into a booking */
  async convertHold(user, id, body = {}) {
    const vendor = await vendorFor(user);
    const r = await this.findReservation(vendor, id);
    if (r.status !== "held") throw new AppError("Only an active hold can be booked", 400);
    Object.assign(r, this.detailsInput(body));
    let linked = null;
    if (body.booking) {
      if (!mongoose.isValidObjectId(body.booking)) throw new AppError("Booking not found", 404);
      linked = await VendorBooking.findOne({ _id: body.booking, vendor: vendor._id });
      if (!linked) throw new AppError("Booking not found", 404);
    }
    await this.attachBooking(r, vendor, linked, body);
    r.status = "booked";
    r.holdExpiresAt = undefined;
    r.history.push({ action: "booked", note: "Hold converted to a booking" });
    await r.save();
    return r;
  }

  /** Release a hold, unblock dates, or cancel a booking's space (the VendorBooking is left as is) */
  async release(user, id, { reason } = {}) {
    const vendor = await vendorFor(user);
    const r = await this.findReservation(vendor, id);
    if (!RESERVATION_ACTIVE.includes(r.status)) throw new AppError("This reservation has already ended", 400);
    r.status = r.status === "held" || r.status === "blocked" ? "released" : "cancelled";
    r.endedAt = new Date();
    r.holdExpiresAt = undefined;
    r.history.push({ action: r.status, note: str(reason, 500) });
    await r.save();
    await this.freeSlots(r._id);
    return r;
  }

  /** A VendorBooking was cancelled elsewhere: free its space */
  async releaseForBooking(bookingId) {
    const rs = await VenueReservation.find({ booking: bookingId, status: { $in: RESERVATION_ACTIVE } });
    for (const r of rs) {
      r.status = "cancelled";
      r.endedAt = new Date();
      r.history.push({ action: "cancelled", note: "Booking cancelled" });
      await r.save();
      await this.freeSlots(r._id);
    }
    return rs.length;
  }

  // ---- Background job: expire holds, warn a day before ----

  async runHoldJobs(now = new Date()) {
    const expired = await VenueReservation.find({ status: "held", holdExpiresAt: { $lte: now } }).limit(500);
    for (const r of expired) {
      const claimed = await VenueReservation.findOneAndUpdate(
        { _id: r._id, status: "held", holdExpiresAt: { $lte: now } },
        { $set: { status: "expired", endedAt: now }, $push: { history: { action: "expired" } } },
        { new: true }
      );
      if (!claimed) continue;
      await this.freeSlots(r._id);
      await this.notifyOwner(r.vendor, {
        title: "A hold has expired",
        message: `${r.title || r.clientName || "A hold"} on ${r.dateFrom} has expired and the date is free again.`,
      });
    }

    const soon = new Date(now.getTime() + 24 * 3600000);
    const warn = await VenueReservation.find({
      status: "held",
      holdExpiresAt: { $gt: now, $lte: soon },
      holdReminderSentAt: { $exists: false },
    }).limit(500);
    for (const r of warn) {
      const claimed = await VenueReservation.updateOne(
        { _id: r._id, holdReminderSentAt: { $exists: false } },
        { $set: { holdReminderSentAt: now } }
      );
      if (!claimed.modifiedCount) continue;
      await this.notifyOwner(r.vendor, {
        title: "A hold ends within a day",
        message: `${r.title || r.clientName || "A hold"} on ${r.dateFrom} ends ${r.holdExpiresAt.toUTCString()}. Book it, extend it or let it go.`,
      });
    }
    return { expired: expired.length, reminded: warn.length };
  }

  async notifyOwner(vendorId, { title, message }) {
    const vendor = await Vendor.findById(vendorId).select("owner").lean();
    if (!vendor?.owner) return;
    await Notification.createNotification({
      recipient: vendor.owner,
      type: "warning",
      category: "booking",
      title,
      message,
      actionUrl: "/vendor/dashboard/venue",
    }).catch((error) => logger.warn("Venue notification failed", { error: error.message }));
  }
}

const venueService = new VenueService();
export default venueService;

let venueTimer = null;
export const startVenueJobs = (intervalMs = 15 * 60 * 1000) => {
  if (venueTimer) return;
  const tick = async () => {
    try {
      await venueService.runHoldJobs();
      const { runPaymentReminders } = await import("./payment-schedule.service.js");
      await runPaymentReminders();
    } catch (error) {
      logger.error("Venue jobs failed", { error: error.message });
    }
  };
  venueTimer = setInterval(tick, intervalMs);
  venueTimer.unref?.();
  setTimeout(tick, 2 * 60 * 1000).unref?.();
};
