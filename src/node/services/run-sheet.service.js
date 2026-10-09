import crypto from "crypto";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import RunSheet from "../models/run-sheet.model.js";
import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { findOwnedEvent } from "../utils/event-access.js";

/**
 * Day-of schedule and vendor run sheet (Celebration Plus, roadmap Phase 8).
 * The organiser lists the vendors and the day's timeline; each vendor can get a
 * private read-only link showing their own slots, the moments for everyone and
 * who to call on the day. The sheet (or one vendor's part) exports to PDF.
 */

const MAX_VENDORS = 50;
const MAX_ITEMS = 300;
const TOKEN = /^[a-f0-9]{48}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const shareUrl = (token) => `${frontendUrl()}/run-sheet/${token}`;
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const sortItems = (items) =>
  [...items].sort((a, b) => `${a.day || ""} ${a.start}`.localeCompare(`${b.day || ""} ${b.start}`));

const venueOf = (event) => {
  const a = event.location?.address;
  return typeof a === "string" ? a : [a?.street, a?.city, a?.state].filter(Boolean).join(", ");
};

const eventSummary = (event) => ({
  _id: event._id,
  title: event.title,
  eventType: event.eventType,
  startDate: event.startDate,
  endDate: event.endDate,
  venue: venueOf(event),
});

const shapeItem = (item, vendorsById) => ({
  _id: item._id,
  day: item.day,
  start: item.start,
  end: item.end,
  title: item.title,
  description: item.description,
  location: item.location,
  vendorKey: item.vendorKey || null,
  vendorName: item.vendorKey ? vendorsById.get(String(item.vendorKey))?.name || null : null,
  forAllVendors: !!item.forAllVendors,
  notes: item.notes,
});

/** The whole sheet, as the organiser sees it */
const ownerView = (event, sheet) => {
  const vendors = sheet?.vendors || [];
  const byId = new Map(vendors.map((v) => [String(v._id), v]));
  return {
    event: eventSummary(event),
    dayOfContact: sheet?.dayOfContact || {},
    notes: sheet?.notes || "",
    vendors: vendors.map((v) => ({
      _id: v._id,
      name: v.name,
      vendor: v.vendor || null,
      role: v.role,
      contactName: v.contactName,
      contactPhone: v.contactPhone,
      contactEmail: v.contactEmail,
      arrivalTime: v.arrivalTime,
      shareLink: v.shareToken ? shareUrl(v.shareToken) : null,
      sharedAt: v.sharedAt,
      lastViewedAt: v.lastViewedAt,
      slots: (sheet.items || []).filter((i) => String(i.vendorKey) === String(v._id)).length,
    })),
    items: sortItems(sheet?.items || []).map((i) => shapeItem(i, byId)),
  };
};

const getOrCreate = async (event, user) =>
  (await RunSheet.findOne({ event: event._id })) ||
  RunSheet.create({ event: event._id, owner: user._id, vendors: [], items: [] });

const vendorInput = (body, current = {}) => {
  const out = {};
  if (body.name !== undefined || !current.name) {
    const name = str(body.name, 120);
    if (!name) throw new AppError("The vendor's name is required", 400);
    out.name = name;
  }
  for (const [key, max] of [["role", 80], ["contactName", 120], ["contactPhone", 40]]) {
    if (body[key] !== undefined) out[key] = str(body[key], max) || undefined;
  }
  if (body.contactEmail !== undefined) {
    const email = str(body.contactEmail, 160)?.toLowerCase();
    if (email && !EMAIL.test(email)) throw new AppError("Enter a valid email address", 400);
    out.contactEmail = email || undefined;
  }
  if (body.arrivalTime !== undefined) {
    if (body.arrivalTime && !TIME.test(body.arrivalTime)) throw new AppError("Arrival time should look like 14:30", 400);
    out.arrivalTime = body.arrivalTime || undefined;
  }
  if (body.vendor !== undefined) {
    if (body.vendor && !mongoose.isValidObjectId(body.vendor)) throw new AppError("Unknown vendor", 400);
    out.vendor = body.vendor || undefined;
  }
  return out;
};

const itemInput = (body, sheet, current = {}) => {
  const out = {};
  if (body.title !== undefined || !current.title) {
    const title = str(body.title, 200);
    if (!title) throw new AppError("What happens at this time?", 400);
    out.title = title;
  }
  if (body.start !== undefined || !current.start) {
    if (!TIME.test(body.start || "")) throw new AppError("Start time should look like 14:30", 400);
    out.start = body.start;
  }
  if (body.end !== undefined) {
    if (body.end && !TIME.test(body.end)) throw new AppError("End time should look like 16:00", 400);
    out.end = body.end || undefined;
  }
  if (body.day !== undefined) {
    if (body.day && !DAY.test(body.day)) throw new AppError("Day should be a date", 400);
    out.day = body.day || undefined;
  }
  const start = out.start ?? current.start;
  const end = out.end !== undefined || body.end !== undefined ? out.end : current.end;
  if (end && start && end < start) throw new AppError("The end time is before the start time", 400);
  for (const [key, max] of [["description", 2000], ["location", 200], ["notes", 1000]]) {
    if (body[key] !== undefined) out[key] = str(body[key], max) || undefined;
  }
  if (body.forAllVendors !== undefined) out.forAllVendors = !!body.forAllVendors;
  if (body.vendorKey !== undefined) {
    if (!body.vendorKey) out.vendorKey = undefined;
    else if (!sheet.vendors.id(body.vendorKey)) throw new AppError("Add that vendor to the run sheet first", 400);
    else out.vendorKey = body.vendorKey;
  }
  return out;
};

class RunSheetService {
  async get(user, eventId) {
    const event = await findOwnedEvent(eventId, user);
    return ownerView(event, await RunSheet.findOne({ event: event._id }));
  }

  /** { dayOfContact: { name, phone }, notes } */
  async updateSettings(user, eventId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await getOrCreate(event, user);
    if (body.dayOfContact && typeof body.dayOfContact === "object") {
      sheet.dayOfContact = { name: str(body.dayOfContact.name, 120), phone: str(body.dayOfContact.phone, 40) };
    }
    if (body.notes !== undefined) sheet.notes = str(body.notes, 4000) || "";
    await sheet.save();
    return ownerView(event, sheet);
  }

  async addVendor(user, eventId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await getOrCreate(event, user);
    if (sheet.vendors.length >= MAX_VENDORS) throw new AppError(`A run sheet can have up to ${MAX_VENDORS} vendors`, 400);
    sheet.vendors.push(vendorInput(body));
    await sheet.save();
    return ownerView(event, sheet);
  }

  async updateVendor(user, eventId, vendorKey, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await RunSheet.findOne({ event: event._id });
    const vendor = sheet?.vendors.id(vendorKey);
    if (!vendor) throw new AppError("Vendor not found on this run sheet", 404);
    Object.assign(vendor, vendorInput(body, vendor));
    await sheet.save();
    return ownerView(event, sheet);
  }

  /** Removing a vendor keeps their slots, unassigned */
  async removeVendor(user, eventId, vendorKey) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await RunSheet.findOne({ event: event._id });
    const vendor = sheet?.vendors.id(vendorKey);
    if (!vendor) throw new AppError("Vendor not found on this run sheet", 404);
    for (const item of sheet.items) if (String(item.vendorKey) === String(vendor._id)) item.vendorKey = undefined;
    vendor.deleteOne();
    await sheet.save();
    return ownerView(event, sheet);
  }

  /** Add the vendors booked for this event through Confetti (skips ones already listed) */
  async importBookedVendors(user, eventId) {
    const event = await findOwnedEvent(eventId, user);
    const VendorBooking = (await import("../models/vendor-booking.model.js")).default;
    const bookings = await VendorBooking.find({ event: event._id, status: { $in: ["booked", "confirmed", "completed"] } })
      .populate("vendor", "businessName name category phone email")
      .lean();
    const sheet = await getOrCreate(event, user);
    const listed = new Set(sheet.vendors.filter((v) => v.vendor).map((v) => String(v.vendor)));
    let added = 0;
    for (const b of bookings) {
      const v = b.vendor;
      if (!v || listed.has(String(v._id)) || sheet.vendors.length >= MAX_VENDORS) continue;
      listed.add(String(v._id));
      sheet.vendors.push({
        name: (v.businessName || v.name || "Vendor").slice(0, 120),
        vendor: v._id,
        role: v.category ? String(v.category).slice(0, 80) : undefined,
        contactPhone: v.phone ? String(v.phone).slice(0, 40) : undefined,
        contactEmail: v.email && EMAIL.test(v.email) ? String(v.email).toLowerCase().slice(0, 160) : undefined,
      });
      added++;
    }
    if (added) await sheet.save();
    return { ...ownerView(event, sheet), added };
  }

  async addItem(user, eventId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await getOrCreate(event, user);
    if (sheet.items.length >= MAX_ITEMS) throw new AppError(`A run sheet can have up to ${MAX_ITEMS} entries`, 400);
    sheet.items.push(itemInput(body, sheet));
    await sheet.save();
    return ownerView(event, sheet);
  }

  async updateItem(user, eventId, itemId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await RunSheet.findOne({ event: event._id });
    const item = sheet?.items.id(itemId);
    if (!item) throw new AppError("Entry not found", 404);
    const changes = itemInput(body, sheet, item);
    for (const [key, value] of Object.entries(changes)) item.set(key, value);
    await sheet.save();
    return ownerView(event, sheet);
  }

  async removeItem(user, eventId, itemId) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await RunSheet.findOne({ event: event._id });
    const item = sheet?.items.id(itemId);
    if (!item) throw new AppError("Entry not found", 404);
    item.deleteOne();
    await sheet.save();
    return ownerView(event, sheet);
  }

  /** Create (or keep) the vendor's read-only link; optionally email it to them */
  async shareWithVendor(user, eventId, vendorKey, { email = false } = {}) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await RunSheet.findOne({ event: event._id });
    const vendor = sheet?.vendors.id(vendorKey);
    if (!vendor) throw new AppError("Vendor not found on this run sheet", 404);
    if (!vendor.shareToken) {
      vendor.shareToken = crypto.randomBytes(24).toString("hex");
      vendor.sharedAt = new Date();
      await sheet.save();
    }
    let emailed = false;
    if (email) {
      if (!vendor.contactEmail) throw new AppError("Add the vendor's email address first", 400);
      try {
        const host = [user.firstName, user.lastName].filter(Boolean).join(" ") || "The host";
        await sendEmailDirect({
          to: vendor.contactEmail,
          subject: `Run sheet for ${event.title}`,
          html: `<p>Hi ${escapeHtml(vendor.contactName || vendor.name)},</p>
            <p>${escapeHtml(host)} has shared the day-of schedule for <strong>${escapeHtml(event.title)}</strong> with you, including your times and who to call on the day.</p>
            <p><a href="${shareUrl(vendor.shareToken)}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Open the run sheet</a></p>
            <p style="color:#6b7280;font-size:12px">The link always shows the latest version.</p>`,
        });
        emailed = true;
      } catch (error) {
        logger.warn("Run sheet email failed", { error: error.message });
      }
    }
    return { ...ownerView(event, sheet), emailed };
  }

  async revokeShare(user, eventId, vendorKey) {
    const event = await findOwnedEvent(eventId, user);
    const sheet = await RunSheet.findOne({ event: event._id });
    const vendor = sheet?.vendors.id(vendorKey);
    if (!vendor) throw new AppError("Vendor not found on this run sheet", 404);
    vendor.shareToken = undefined;
    vendor.sharedAt = undefined;
    await sheet.save();
    return ownerView(event, sheet);
  }

  /** What a vendor sees from their link: their slots, moments for everyone, contacts */
  async viewShared(token, { touch = true } = {}) {
    if (!TOKEN.test(String(token))) throw new AppError("This link isn't valid", 404);
    const sheet = await RunSheet.findOne({ "vendors.shareToken": token });
    const vendor = sheet?.vendors.find((v) => v.shareToken === token);
    const event = sheet && (await Event.findById(sheet.event).select("title eventType startDate endDate location status"));
    if (!vendor || !event || event.status === "cancelled") throw new AppError("This link isn't valid", 404);
    if (touch) {
      await RunSheet.updateOne(
        { _id: sheet._id, "vendors._id": vendor._id },
        { $set: { "vendors.$.lastViewedAt": new Date() } }
      );
    }
    const byId = new Map(sheet.vendors.map((v) => [String(v._id), v]));
    const items = sortItems(sheet.items)
      .filter((i) => String(i.vendorKey) === String(vendor._id) || i.forAllVendors)
      .map((i) => ({ ...shapeItem(i, byId), mine: String(i.vendorKey) === String(vendor._id) }));
    return {
      event: eventSummary(event),
      vendor: { name: vendor.name, role: vendor.role, arrivalTime: vendor.arrivalTime },
      dayOfContact: sheet.dayOfContact || {},
      notes: sheet.notes || "",
      items,
      otherVendors: sheet.vendors
        .filter((v) => String(v._id) !== String(vendor._id))
        .map((v) => ({ name: v.name, role: v.role, arrivalTime: v.arrivalTime })),
      updatedAt: sheet.updatedAt,
    };
  }

  /** PDF of the whole sheet (owner) */
  async ownerPdf(user, eventId, res) {
    const view = await this.get(user, eventId);
    this.renderPdf(view, res, { full: true });
  }

  /** PDF of one vendor's part (from their link) */
  async sharedPdf(token, res) {
    const view = await this.viewShared(token, { touch: false });
    this.renderPdf(view, res, { full: false });
  }

  renderPdf(view, res, { full }) {
    const safe = (view.event.title || "run-sheet").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safe}-run-sheet.pdf"`);
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    doc.pipe(res);

    doc.fontSize(20).text(view.event.title || "Run sheet");
    doc.fontSize(11).fillColor("#555");
    if (view.event.startDate) doc.text(new Date(view.event.startDate).toDateString());
    if (view.event.venue) doc.text(view.event.venue);
    if (!full) doc.text(`For: ${view.vendor.name}${view.vendor.role ? ` (${view.vendor.role})` : ""}`);
    if (!full && view.vendor.arrivalTime) doc.text(`Arrive by: ${view.vendor.arrivalTime}`);
    const contact = view.dayOfContact || {};
    if (contact.name || contact.phone) doc.text(`On the day, call: ${[contact.name, contact.phone].filter(Boolean).join(" · ")}`);
    doc.fillColor("#000").moveDown();
    if (view.notes) doc.fontSize(10).text(view.notes).moveDown();

    doc.fontSize(14).text("Schedule").moveDown(0.3);
    if (!view.items.length) doc.fontSize(10).fillColor("#555").text("Nothing scheduled yet.").fillColor("#000");
    let lastDay = null;
    for (const item of view.items) {
      if (item.day && item.day !== lastDay) {
        lastDay = item.day;
        doc.moveDown(0.3).fontSize(12).fillColor("#7c3aed").text(new Date(`${item.day}T12:00:00Z`).toDateString()).fillColor("#000");
      }
      const time = `${item.start}${item.end ? `–${item.end}` : ""}`;
      const who = item.vendorName ? ` · ${item.vendorName}` : item.forAllVendors ? " · Everyone" : "";
      doc.fontSize(11).text(`${time}  ${item.title}${who}`, { continued: false });
      const extra = [item.location, item.description, item.notes].filter(Boolean).join(" — ");
      if (extra) doc.fontSize(9).fillColor("#555").text(extra, { indent: 70 }).fillColor("#000");
    }

    const vendors = full ? view.vendors : view.otherVendors;
    if (vendors.length) {
      doc.moveDown().fontSize(14).text(full ? "Vendors" : "Other vendors on the day").moveDown(0.3);
      for (const v of vendors) {
        const parts = [v.role, v.arrivalTime ? `arrives ${v.arrivalTime}` : null];
        if (full) parts.push(v.contactName, v.contactPhone, v.contactEmail);
        doc.fontSize(10).text(`${v.name}${parts.filter(Boolean).length ? ` — ${parts.filter(Boolean).join(" · ")}` : ""}`);
      }
    }
    doc.end();
  }
}

export default new RunSheetService();
