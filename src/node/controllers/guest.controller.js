import mongoose from "mongoose";
import Guest from "../models/guest.model.js";
import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";
import { escapeRegExp } from "../utils/escape-regex.js";
import { findOwnedEvent, ownsEvent } from "../utils/event-access.js";
import { assertWithinLimit, getRequestPlan } from "../services/plan-access.service.js";

/**
 * Guest list, RSVPs (organizer side) and seating for an event the user owns.
 * Public RSVP links live in rsvp.controller.js.
 */

const MAX_IMPORT = 1000;
const STATUSES = ["pending", "accepted", "declined", "tentative"];

/** Fields an organizer may set on a guest */
const pickGuestFields = (body = {}) => {
  const out = {};
  for (const key of ["name", "email", "phone", "plusOneName", "specialRequirements", "category", "relationship", "notes", "tableAssignment"]) {
    if (typeof body[key] === "string") out[key] = body[key].trim();
  }
  if (typeof body.plusOne === "boolean") out.plusOne = body.plusOne;
  if (Number.isInteger(body.seatNumber) && body.seatNumber > 0) out.seatNumber = body.seatNumber;
  if (Array.isArray(body.dietaryRestrictions)) {
    out.dietaryRestrictions = body.dietaryRestrictions.filter((d) => typeof d === "string" && d.trim()).map((d) => d.trim());
  } else if (typeof body.dietaryRestrictions === "string" && body.dietaryRestrictions.trim()) {
    out.dietaryRestrictions = body.dietaryRestrictions.split(/[,;]/).map((d) => d.trim()).filter(Boolean);
  }
  if (STATUSES.includes(body.rsvpStatus)) out.rsvpStatus = body.rsvpStatus;
  if (out.email === "") delete out.email;
  return out;
};

/** The guest if it belongs to an event the user owns */
const findOwnedGuest = async (guestId, user) => {
  if (!mongoose.isValidObjectId(guestId)) throw new AppError("Guest not found", 404);
  const guest = await Guest.findById(guestId);
  if (!guest) throw new AppError("Guest not found", 404);
  const event = await Event.findById(guest.event).select("planner createdBy organizer");
  if (!event || !ownsEvent(event, user)) throw new AppError("Guest not found", 404);
  return guest;
};

/** Guest limit for this event, for the screen ("72 of 100") */
const guestLimitInfo = async (req, eventId, used) => {
  const { plan } = await getRequestPlan(req);
  const max = plan?.limits?.guestsPerEvent;
  if (max === undefined || max === null) return { max: null, used };
  const eventPassService = (await import("../services/event-pass.service.js")).default;
  if ((await eventPassService.featuresFor(eventId)).unlimitedGuests) return { max: null, used, viaPass: true };
  return { max, used };
};

/**
 * List guests for an event
 * GET /api/v1/events/:eventId/guests?rsvpStatus=&tableAssignment=&search=
 */
export const listEventGuests = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const { rsvpStatus, tableAssignment, search } = req.query;
    const query = { event: event._id };

    if (STATUSES.includes(rsvpStatus)) query.rsvpStatus = rsvpStatus;
    if (typeof tableAssignment === "string" && tableAssignment) query.tableAssignment = tableAssignment;
    if (typeof search === "string" && search) {
      const rx = { $regex: escapeRegExp(search), $options: "i" };
      query.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [guests, all] = await Promise.all([
      Guest.find(query).sort({ name: 1 }).lean(),
      Guest.find({ event: event._id }).select("plusOne rsvpStatus invitation.status").lean(),
    ]);

    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const g of all) byStatus[g.rsvpStatus || "pending"] += 1;
    const plusOnes = all.filter((g) => g.plusOne).length;
    const invitations = all.reduce((acc, g) => {
      const status = g.invitation?.status || "not_sent";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      status: "success",
      data: {
        guests,
        stats: {
          total: all.length,
          withPlusOne: plusOnes,
          estimatedAttendance: all.length + plusOnes,
          attending: byStatus.accepted + all.filter((g) => g.plusOne && g.rsvpStatus === "accepted").length,
          byStatus,
          invitations,
        },
        limit: await guestLimitInfo(req, event._id, all.length),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add guest to event
 * POST /api/v1/events/:eventId/guests
 */
export const addGuest = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const fields = pickGuestFields(req.body);
    if (!fields.name) throw new AppError("Guest name is required", 400);

    await assertWithinLimit(req, "guestsPerEvent", { eventId: event._id });

    const guest = await Guest.create({ ...fields, event: event._id, planner: req.user._id });
    res.status(201).json({ status: "success", data: { guest } });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk import guests (e.g. from a CSV). Rows without a name, and emails already
 * on the list, are skipped.
 * POST /api/v1/events/:eventId/guests/import  { guests: [{ name, email, phone, … }] }
 */
export const importGuests = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const { guests } = req.body || {};
    if (!Array.isArray(guests) || guests.length === 0) {
      throw new AppError("Guests array is required", 400);
    }
    if (guests.length > MAX_IMPORT) throw new AppError(`Import up to ${MAX_IMPORT} guests at a time`, 400);

    const existingEmails = new Set(
      (await Guest.find({ event: event._id, email: { $exists: true } }).select("email").lean()).map((g) => g.email)
    );
    const rows = [];
    let skipped = 0;
    for (const raw of guests) {
      const fields = pickGuestFields(raw);
      const email = fields.email?.toLowerCase();
      if (!fields.name || (email && existingEmails.has(email))) {
        skipped += 1;
        continue;
      }
      if (email) existingEmails.add(email);
      rows.push({ ...fields, event: event._id, planner: req.user._id });
    }
    if (rows.length === 0) throw new AppError("No new guests to import (each needs a name; emails already listed are skipped)", 400);

    await assertWithinLimit(req, "guestsPerEvent", { eventId: event._id, adding: rows.length });

    const imported = await Guest.insertMany(rows);
    res.status(201).json({
      status: "success",
      data: { imported: imported.length, skipped, guests: imported },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get guest details
 * GET /api/v1/guests/:id
 */
export const getGuest = async (req, res, next) => {
  try {
    const guest = await findOwnedGuest(req.params.id, req.user);
    await guest.populate("event", "title eventType startDate");
    res.status(200).json({ status: "success", data: { guest } });
  } catch (error) {
    next(error);
  }
};

/**
 * Update guest
 * PATCH /api/v1/guests/:id
 */
export const updateGuest = async (req, res, next) => {
  try {
    const guest = await findOwnedGuest(req.params.id, req.user);
    const fields = pickGuestFields(req.body);
    if ("name" in fields && !fields.name) throw new AppError("Guest name is required", 400);
    if (req.body?.email === "") guest.email = undefined;
    guest.set(fields);
    if (fields.rsvpStatus) {
      guest.rsvpDate = new Date();
      guest.respondedVia = "organizer";
    }
    await guest.save();
    res.status(200).json({ status: "success", data: { guest } });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete guest
 * DELETE /api/v1/guests/:id
 */
export const deleteGuest = async (req, res, next) => {
  try {
    const guest = await findOwnedGuest(req.params.id, req.user);
    await guest.deleteOne();
    res.status(200).json({ status: "success", message: "Guest deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * Record a guest's RSVP for them (the organizer heard back by phone, etc.)
 * POST /api/v1/guests/:id/rsvp { status }
 */
export const updateRSVP = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) throw new AppError("Invalid RSVP status", 400);
    const guest = await findOwnedGuest(req.params.id, req.user);
    guest.rsvpStatus = status;
    guest.rsvpDate = new Date();
    guest.respondedVia = "organizer";
    await guest.save();
    res.status(200).json({ status: "success", data: { guest } });
  } catch (error) {
    next(error);
  }
};

/**
 * Seating plan: tables and who sits where
 * GET /api/v1/events/:eventId/seating
 */
export const getSeatingChart = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const guests = await Guest.find({ event: event._id })
      .select("name tableAssignment seatNumber rsvpStatus plusOne plusOneName")
      .sort({ tableAssignment: 1, seatNumber: 1, name: 1 })
      .lean();

    // Tables named on guests but not (yet) defined still show up
    const tables = (event.seatingTables || []).map((t) => ({ _id: t._id, name: t.name, capacity: t.capacity }));
    const known = new Set(tables.map((t) => t.name));
    for (const g of guests) {
      if (g.tableAssignment && !known.has(g.tableAssignment)) {
        known.add(g.tableAssignment);
        tables.push({ name: g.tableAssignment, capacity: null });
      }
    }

    const seatingChart = guests.reduce((acc, guest) => {
      const table = guest.tableAssignment || "Unassigned";
      (acc[table] ||= []).push(guest);
      return acc;
    }, {});

    res.status(200).json({ status: "success", data: { tables, seatingChart, guests } });
  } catch (error) {
    next(error);
  }
};

/**
 * Save the event's tables
 * PUT /api/v1/events/:eventId/seating/tables { tables: [{ name, capacity }] }
 * Guests at a removed table become unassigned.
 */
export const updateSeatingTables = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const { tables } = req.body || {};
    if (!Array.isArray(tables) || tables.length > 200) throw new AppError("tables must be a list (up to 200)", 400);

    const seen = new Set();
    const clean = [];
    for (const t of tables) {
      const name = typeof t?.name === "string" ? t.name.trim().slice(0, 60) : "";
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const capacity = Number.isInteger(Number(t.capacity)) && Number(t.capacity) > 0 ? Math.min(Number(t.capacity), 1000) : 10;
      clean.push({ name, capacity });
    }

    const removed = (event.seatingTables || []).map((t) => t.name).filter((n) => !clean.some((c) => c.name === n));
    event.seatingTables = clean;
    await event.save({ validateModifiedOnly: true });
    if (removed.length) {
      await Guest.updateMany(
        { event: event._id, tableAssignment: { $in: removed } },
        { $unset: { tableAssignment: 1, seatNumber: 1 } }
      );
    }
    res.status(200).json({ status: "success", data: { tables: event.seatingTables } });
  } catch (error) {
    next(error);
  }
};

/**
 * Update seating assignments (only guests of this event)
 * POST /api/v1/events/:eventId/seating { assignments: [{ guestId, table, seat }] }
 * An empty table unassigns the guest.
 */
export const updateSeating = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const { assignments } = req.body || {};
    if (!Array.isArray(assignments)) throw new AppError("Assignments array is required", 400);

    const ops = assignments
      .filter((a) => mongoose.isValidObjectId(a?.guestId))
      .map((a) => {
        const table = typeof a.table === "string" ? a.table.trim() : "";
        return {
          updateOne: {
            filter: { _id: a.guestId, event: event._id },
            update: table
              ? { $set: { tableAssignment: table, ...(Number.isInteger(a.seat) && a.seat > 0 ? { seatNumber: a.seat } : {}) } }
              : { $unset: { tableAssignment: 1, seatNumber: 1 } },
          },
        };
      });
    const result = ops.length ? await Guest.bulkWrite(ops) : { modifiedCount: 0 };

    res.status(200).json({
      status: "success",
      message: "Seating updated successfully",
      data: { updated: result.modifiedCount || 0 },
    });
  } catch (error) {
    next(error);
  }
};
