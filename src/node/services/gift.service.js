import mongoose from "mongoose";
import Gift from "../models/gift.model.js";
import Guest from "../models/guest.model.js";
import { AppError } from "../utils/AppError.js";
import { findOwnedEvent } from "../utils/event-access.js";

/**
 * Gift registry and gifts received for an event, with thank-you tracking
 * (Celebration Plus, roadmap Phase 8). Amounts are in naira.
 */

const MAX_GIFTS = 2000;
const CATEGORIES = ["item", "cash", "voucher", "experience", "other"];
const THANK_YOU_METHODS = ["card", "message", "call", "in_person", "other"];
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const money = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new AppError("Enter a valid amount", 400);
  return Math.round(n * 100) / 100;
};
const url = (v) => {
  const s = str(v, 1000);
  if (!s) return undefined;
  if (!/^https?:\/\//i.test(s)) throw new AppError("The link should start with http:// or https://", 400);
  return s;
};

const summarize = (gifts) => {
  const registry = gifts.filter((g) => g.kind === "registry");
  const received = gifts.filter((g) => g.kind === "received");
  return {
    registry: {
      items: registry.length,
      fulfilled: registry.filter((g) => g.quantityReceived >= g.quantityWanted).length,
    },
    received: {
      count: received.length,
      cashTotal: received.filter((g) => g.category === "cash").reduce((s, g) => s + (g.amount || 0), 0),
      thankYouSent: received.filter((g) => g.thankYou?.status === "sent").length,
      thankYouPending: received.filter((g) => g.thankYou?.status !== "sent").length,
    },
  };
};

class GiftService {
  async list(user, eventId, { kind, thankYou } = {}) {
    const event = await findOwnedEvent(eventId, user);
    const all = await Gift.find({ event: event._id }).sort({ createdAt: -1 }).populate("guest", "name").lean();
    let gifts = all;
    if (["registry", "received"].includes(kind)) gifts = gifts.filter((g) => g.kind === kind);
    if (thankYou === "pending") gifts = gifts.filter((g) => g.kind === "received" && g.thankYou?.status !== "sent");
    if (thankYou === "sent") gifts = gifts.filter((g) => g.kind === "received" && g.thankYou?.status === "sent");
    return { gifts, summary: summarize(all) };
  }

  async findOwned(user, eventId, giftId) {
    const event = await findOwnedEvent(eventId, user);
    if (!mongoose.isValidObjectId(giftId)) throw new AppError("Gift not found", 404);
    const gift = await Gift.findOne({ _id: giftId, event: event._id });
    if (!gift) throw new AppError("Gift not found", 404);
    return { event, gift };
  }

  async guestFor(event, guestId) {
    if (!guestId) return null;
    if (!mongoose.isValidObjectId(guestId)) throw new AppError("Guest not found", 404);
    const guest = await Guest.findOne({ _id: guestId, event: event._id }).select("name").lean();
    if (!guest) throw new AppError("Guest not found", 404);
    return guest;
  }

  async registryFor(event, registryId) {
    if (!registryId) return null;
    if (!mongoose.isValidObjectId(registryId)) throw new AppError("Registry item not found", 404);
    const item = await Gift.findOne({ _id: registryId, event: event._id, kind: "registry" });
    if (!item) throw new AppError("Registry item not found", 404);
    return item;
  }

  /** Fields shared by both kinds; `current` is the gift being edited */
  common(body, current) {
    const out = {};
    if (body.title !== undefined || !current) {
      const title = str(body.title, 200);
      if (!title) throw new AppError("Describe the gift", 400);
      out.title = title;
    }
    if (body.description !== undefined) out.description = str(body.description, 2000) || undefined;
    if (body.notes !== undefined) out.notes = str(body.notes, 1000) || undefined;
    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) throw new AppError("Unknown gift type", 400);
      out.category = body.category;
    }
    if (body.amount !== undefined) out.amount = money(body.amount);
    return out;
  }

  async create(user, eventId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    if ((await Gift.countDocuments({ event: event._id })) >= MAX_GIFTS) throw new AppError("Gift list is full", 400);
    const kind = body.kind;
    if (!["registry", "received"].includes(kind)) throw new AppError("Choose registry or received", 400);
    const data = { event: event._id, kind, ...this.common(body) };

    if (kind === "registry") {
      data.link = url(body.link);
      const qty = Number(body.quantityWanted ?? 1);
      if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new AppError("Quantity should be 1 to 1000", 400);
      data.quantityWanted = qty;
      return Gift.create(data);
    }

    const guest = await this.guestFor(event, body.guest);
    const registry = await this.registryFor(event, body.registryItem);
    data.guest = guest?._id;
    data.fromName = str(body.fromName, 200) || guest?.name;
    if (!data.fromName) throw new AppError("Who is the gift from?", 400);
    data.registryItem = registry?._id;
    data.receivedAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
    if (Number.isNaN(data.receivedAt.getTime())) throw new AppError("Invalid date", 400);
    if (body.thankYouSent) data.thankYou = { status: "sent", sentAt: new Date(), method: THANK_YOU_METHODS.includes(body.thankYouMethod) ? body.thankYouMethod : undefined };
    const gift = await Gift.create(data);
    if (registry) await Gift.updateOne({ _id: registry._id }, { $inc: { quantityReceived: 1 } });
    return gift;
  }

  async update(user, eventId, giftId, body = {}) {
    const { event, gift } = await this.findOwned(user, eventId, giftId);
    Object.assign(gift, this.common(body, gift));
    if (gift.kind === "registry") {
      if (body.link !== undefined) gift.link = url(body.link);
      if (body.quantityWanted !== undefined) {
        const qty = Number(body.quantityWanted);
        if (!Number.isInteger(qty) || qty < 1 || qty > 1000) throw new AppError("Quantity should be 1 to 1000", 400);
        gift.quantityWanted = qty;
      }
    } else {
      if (body.guest !== undefined) {
        const guest = await this.guestFor(event, body.guest);
        gift.guest = guest?._id;
        if (guest && body.fromName === undefined) gift.fromName = guest.name;
      }
      if (body.fromName !== undefined) {
        const from = str(body.fromName, 200);
        if (!from) throw new AppError("Who is the gift from?", 400);
        gift.fromName = from;
      }
      if (body.receivedAt !== undefined) {
        const at = new Date(body.receivedAt);
        if (Number.isNaN(at.getTime())) throw new AppError("Invalid date", 400);
        gift.receivedAt = at;
      }
      if (body.registryItem !== undefined && String(body.registryItem || "") !== String(gift.registryItem || "")) {
        const next = await this.registryFor(event, body.registryItem);
        if (gift.registryItem) await Gift.updateOne({ _id: gift.registryItem, quantityReceived: { $gt: 0 } }, { $inc: { quantityReceived: -1 } });
        if (next) await Gift.updateOne({ _id: next._id }, { $inc: { quantityReceived: 1 } });
        gift.registryItem = next?._id;
      }
    }
    await gift.save();
    return gift;
  }

  async remove(user, eventId, giftId) {
    const { gift } = await this.findOwned(user, eventId, giftId);
    if (gift.kind === "received" && gift.registryItem) {
      await Gift.updateOne({ _id: gift.registryItem, quantityReceived: { $gt: 0 } }, { $inc: { quantityReceived: -1 } });
    }
    if (gift.kind === "registry") await Gift.updateMany({ event: gift.event, registryItem: gift._id }, { $unset: { registryItem: 1 } });
    await gift.deleteOne();
  }

  /** Mark thank-yous sent (or not sent) for one or more received gifts */
  async setThankYou(user, eventId, { giftIds, sent = true, method }) {
    const event = await findOwnedEvent(eventId, user);
    const ids = (Array.isArray(giftIds) ? giftIds : [giftIds]).filter((id) => mongoose.isValidObjectId(id));
    if (!ids.length) throw new AppError("Choose at least one gift", 400);
    if (method !== undefined && !THANK_YOU_METHODS.includes(method)) throw new AppError("Unknown thank-you method", 400);
    const update = sent
      ? { $set: { "thankYou.status": "sent", "thankYou.sentAt": new Date(), ...(method ? { "thankYou.method": method } : {}) } }
      : { $set: { "thankYou.status": "not_sent" }, $unset: { "thankYou.sentAt": 1, "thankYou.method": 1 } };
    const result = await Gift.updateMany({ _id: { $in: ids }, event: event._id, kind: "received" }, update);
    return { updated: result.modifiedCount };
  }
}

export default new GiftService();
