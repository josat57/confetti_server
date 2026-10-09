import mongoose from "mongoose";
import CuratedShortlist from "../models/curated-shortlist.model.js";
import EventPass from "../models/event-pass.model.js";
import Event from "../models/event.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { EVENT_PASSES } from "../config/plans.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { escapeRegExp } from "../utils/escape-regex.js";
import { sendEmailDirect } from "../utils/email.js";
import { findOwnedEvent } from "../utils/event-access.js";

/**
 * Curated vendor shortlist for Celebration Plus events (roadmap Phase 8).
 * Client: tells the team what they need (brief), sees the picks, marks the ones they like.
 * Admin (vendor_management): works through a queue of Plus events and adds vendors with a note.
 */

const MAX_ITEMS = 40;
const VENDOR_FIELDS = "businessName name category rating reviewCount address priceRange photos logo isVerified status isActive";
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const curatedTiers = () => EVENT_PASSES.filter((p) => p.features.curatedShortlist).map((p) => p.key);

const shapeVendor = (v) =>
  v && {
    _id: v._id,
    businessName: v.businessName || v.name,
    category: v.category,
    rating: v.rating,
    reviewCount: v.reviewCount,
    city: v.address?.city,
    state: v.address?.state,
    priceRange: v.priceRange,
    photo: v.logo || v.photos?.[0]?.url || null,
    isVerified: !!v.isVerified,
  };

const shapeShortlist = (list, { forAdmin = false } = {}) => ({
  _id: list?._id || null,
  status: list?.status || "new",
  brief: list?.brief || { categories: [] },
  readyAt: list?.readyAt,
  items: (list?.items || [])
    // A vendor that has since left Confetti drops off the client's list
    .filter((i) => forAdmin || (i.vendor && i.vendor.status === "approved" && i.vendor.isActive !== false))
    .map((i) => ({
      _id: i._id,
      vendor: shapeVendor(i.vendor),
      category: i.category,
      note: i.note,
      clientStatus: i.clientStatus,
      addedAt: i.addedAt,
    })),
});

class CuratedShortlistService {
  async hasCuratedPass(eventId) {
    return !!(await EventPass.exists({ event: eventId, status: "active", tier: { $in: curatedTiers() } }));
  }

  async load(eventId) {
    return CuratedShortlist.findOne({ event: eventId }).populate("items.vendor", VENDOR_FIELDS);
  }

  // ---- Client ----

  async get(user, eventId) {
    const event = await findOwnedEvent(eventId, user);
    return shapeShortlist(await this.load(event._id));
  }

  /** { categories: [], budget, notes } — tells the team what to look for */
  async submitBrief(user, eventId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const categories = (Array.isArray(body.categories) ? body.categories : [])
      .map((c) => str(c, 60))
      .filter(Boolean)
      .slice(0, 20);
    const notes = str(body.notes, 2000);
    if (!categories.length && !notes) throw new AppError("Tell us which vendors you need", 400);
    let budget;
    if (body.budget !== undefined && body.budget !== "" && body.budget !== null) {
      budget = Number(body.budget);
      if (!Number.isFinite(budget) || budget < 0) throw new AppError("Enter a valid budget", 400);
    }
    const list =
      (await CuratedShortlist.findOne({ event: event._id })) ||
      new CuratedShortlist({ event: event._id, user: user._id, items: [] });
    list.brief = { categories, budget, notes, submittedAt: new Date() };
    // A new brief re-opens the request, even after the list was marked ready
    list.status = "requested";
    await list.save();
    return shapeShortlist(await this.load(event._id));
  }

  /** The client likes a pick (interested), hides it (dismissed) or resets it (new) */
  async setItemStatus(user, eventId, itemId, status) {
    if (!["new", "interested", "dismissed"].includes(status)) throw new AppError("Unknown status", 400);
    const event = await findOwnedEvent(eventId, user);
    const list = await CuratedShortlist.findOne({ event: event._id });
    const item = list?.items.id(itemId);
    if (!item) throw new AppError("Vendor not found on your shortlist", 404);
    item.clientStatus = status;
    await list.save();
    return shapeShortlist(await this.load(event._id));
  }

  // ---- Admin ----

  /** Plus events, the ones waiting for picks first */
  async adminQueue({ status, page = 1, limit = 20 } = {}) {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const passes = await EventPass.find({ status: "active", tier: { $in: curatedTiers() } }).select("event user tier activatedAt").lean();
    const eventIds = passes.map((x) => x.event);
    const [lists, events] = await Promise.all([
      CuratedShortlist.find({ event: { $in: eventIds } }).select("event status brief items readyAt updatedAt").lean(),
      Event.find({ _id: { $in: eventIds }, status: { $ne: "cancelled" } }).select("title eventType startDate location createdBy").lean(),
    ]);
    const listBy = new Map(lists.map((x) => [String(x.event), x]));
    const passBy = new Map(passes.map((x) => [String(x.event), x]));
    const ORDER = { requested: 0, in_progress: 1, new: 2, ready: 3 };
    let rows = events.map((e) => {
      const list = listBy.get(String(e._id));
      return {
        eventId: e._id,
        title: e.title,
        eventType: e.eventType,
        startDate: e.startDate,
        city: e.location?.address?.city,
        tier: passBy.get(String(e._id))?.tier,
        status: list?.status || "new",
        brief: list?.brief || null,
        picks: list?.items?.length || 0,
        interested: (list?.items || []).filter((i) => i.clientStatus === "interested").length,
        updatedAt: list?.updatedAt || passBy.get(String(e._id))?.activatedAt,
      };
    });
    if (["new", "requested", "in_progress", "ready"].includes(status)) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || new Date(a.startDate || 0) - new Date(b.startDate || 0));
    const counts = { new: 0, requested: 0, in_progress: 0, ready: 0 };
    for (const r of events.map((e) => listBy.get(String(e._id))?.status || "new")) counts[r]++;
    return { events: rows.slice((p - 1) * l, p * l), total: rows.length, page: p, totalPages: Math.max(Math.ceil(rows.length / l), 1), counts };
  }

  async adminEvent(eventId) {
    if (!mongoose.isValidObjectId(eventId)) throw new AppError("Event not found", 404);
    if (!(await this.hasCuratedPass(eventId))) throw new AppError("This event doesn't have Celebration Plus", 404);
    const event = await Event.findById(eventId).select("title description eventType startDate endDate location guestCount budget createdBy").lean();
    if (!event) throw new AppError("Event not found", 404);
    const owner = await User.findById(event.createdBy).select("firstName lastName email").lean();
    return {
      event: {
        _id: event._id,
        title: event.title,
        description: event.description,
        eventType: event.eventType,
        startDate: event.startDate,
        city: event.location?.address?.city,
        state: event.location?.address?.state,
        guestCount: event.guestCount,
        budget: event.budget,
        client: owner ? { name: [owner.firstName, owner.lastName].filter(Boolean).join(" "), email: owner.email } : null,
      },
      shortlist: shapeShortlist(await this.load(event._id), { forAdmin: true }),
    };
  }

  /** Approved vendors to pick from */
  async adminSearchVendors({ q, category, city, limit = 20 } = {}) {
    const query = { status: "approved", isActive: { $ne: false } };
    if (typeof category === "string" && category.trim()) query.category = new RegExp(`^${escapeRegExp(category.trim())}$`, "i");
    if (typeof city === "string" && city.trim()) query["address.city"] = new RegExp(escapeRegExp(city.trim()), "i");
    if (typeof q === "string" && q.trim()) {
      const re = new RegExp(escapeRegExp(q.trim()), "i");
      query.$or = [{ businessName: re }, { name: re }];
    }
    const vendors = await Vendor.find(query)
      .select(VENDOR_FIELDS)
      .sort({ rating: -1 })
      .limit(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50))
      .lean();
    return vendors.map(shapeVendor);
  }

  async adminAdd(admin, eventId, { vendorId, note } = {}) {
    const { event } = await this.adminEvent(eventId);
    if (!mongoose.isValidObjectId(vendorId)) throw new AppError("Vendor not found", 404);
    const vendor = await Vendor.findOne({ _id: vendorId, status: "approved", isActive: { $ne: false } }).select("category").lean();
    if (!vendor) throw new AppError("Vendor not found or not approved", 404);
    const list =
      (await CuratedShortlist.findOne({ event: event._id })) ||
      new CuratedShortlist({ event: event._id, user: (await Event.findById(event._id).select("createdBy")).createdBy, items: [] });
    if (list.items.some((i) => String(i.vendor) === String(vendor._id))) throw new AppError("Already on the shortlist", 400);
    if (list.items.length >= MAX_ITEMS) throw new AppError(`A shortlist can have up to ${MAX_ITEMS} vendors`, 400);
    list.items.push({ vendor: vendor._id, category: vendor.category, note: str(note, 1000), addedBy: admin?._id });
    if (list.status !== "ready") list.status = "in_progress";
    await list.save();
    return shapeShortlist(await this.load(event._id), { forAdmin: true });
  }

  async adminUpdateNote(eventId, itemId, note) {
    const { event } = await this.adminEvent(eventId);
    const list = await CuratedShortlist.findOne({ event: event._id });
    const item = list?.items.id(itemId);
    if (!item) throw new AppError("Not on the shortlist", 404);
    item.note = str(note, 1000);
    await list.save();
    return shapeShortlist(await this.load(event._id), { forAdmin: true });
  }

  async adminRemove(eventId, itemId) {
    const { event } = await this.adminEvent(eventId);
    const list = await CuratedShortlist.findOne({ event: event._id });
    const item = list?.items.id(itemId);
    if (!item) throw new AppError("Not on the shortlist", 404);
    item.deleteOne();
    await list.save();
    return shapeShortlist(await this.load(event._id), { forAdmin: true });
  }

  /** Send the shortlist to the client (in-app and email) */
  async adminMarkReady(eventId) {
    const { event } = await this.adminEvent(eventId);
    const list = await CuratedShortlist.findOne({ event: event._id });
    if (!list?.items.length) throw new AppError("Add at least one vendor first", 400);
    list.status = "ready";
    list.readyAt = new Date();
    await list.save();

    const path = `/user/dashboard/events/${event._id}/shortlist`;
    await Notification.createNotification({
      recipient: list.user,
      type: "success",
      category: "event",
      title: "Your vendor shortlist is ready",
      message: `We've picked ${list.items.length} vendor${list.items.length > 1 ? "s" : ""} for ${event.title}.`,
      actionUrl: path,
      data: { eventId: String(event._id) },
    }).catch(() => {});
    const user = await User.findById(list.user).select("email firstName").lean();
    if (user?.email) {
      await sendEmailDirect({
        to: user.email,
        subject: `Your vendor shortlist for ${event.title} is ready`,
        html: `<p>Hi ${String(user.firstName || "there").replace(/[<>&"']/g, "")},</p>
          <p>Our team has picked vendors for your event. Have a look, mark the ones you like and message them from Confetti.</p>
          <p><a href="${frontendUrl()}${path}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">See your shortlist</a></p>`,
      }).catch((error) => logger.warn("Shortlist email failed", { error: error.message }));
    }
    return shapeShortlist(await this.load(event._id), { forAdmin: true });
  }
}

export default new CuratedShortlistService();
