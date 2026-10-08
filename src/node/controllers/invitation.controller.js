import mongoose from "mongoose";
import Guest from "../models/guest.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { findOwnedEvent } from "../utils/event-access.js";
import {
  THEMES,
  ensureToken,
  invitationView,
  renderInvitationEmail,
  rsvpUrl,
  whatsappLink,
} from "../services/invitation.service.js";

/**
 * Digital invitations for an event the user owns.
 * Mounted at /api/v1/events/:eventId/invitation (and guest links under /guests).
 * Clients need an event pass (checked in the routes).
 */

const MAX_SEND = 500;

const invitationStats = async (eventId) => {
  const guests = await Guest.find({ event: eventId }).select("email phone invitation.status rsvpStatus").lean();
  const byStatus = { not_sent: 0, sent: 0, failed: 0, opened: 0 };
  for (const g of guests) byStatus[g.invitation?.status || "not_sent"] += 1;
  return {
    guests: guests.length,
    withEmail: guests.filter((g) => g.email).length,
    withPhone: guests.filter((g) => g.phone).length,
    byStatus,
    responded: guests.filter((g) => g.rsvpStatus && g.rsvpStatus !== "pending").length,
  };
};

/** GET / — the design (filled in from the event) and delivery stats */
export const getInvitation = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    res.status(200).json({
      status: "success",
      data: {
        invitation: invitationView(event),
        themes: Object.keys(THEMES),
        stats: await invitationStats(event._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** PUT / — save the design */
export const saveInvitation = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const body = req.body || {};
    const text = (key, max) => (typeof body[key] === "string" ? body[key].trim().slice(0, max) : undefined);
    const design = event.invitation?.toObject?.() || {};
    for (const [key, max] of [["title", 120], ["hosts", 200], ["message", 2000], ["dressCode", 120], ["venueText", 300]]) {
      const value = text(key, max);
      if (value !== undefined) design[key] = value;
    }
    if (body.theme !== undefined) {
      if (!THEMES[body.theme]) throw new AppError("Unknown theme", 400);
      design.theme = body.theme;
    }
    if (body.accentColor !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(body.accentColor)) throw new AppError("Accent colour must look like #7c3aed", 400);
      design.accentColor = body.accentColor;
    }
    if (body.rsvpDeadline !== undefined) design.rsvpDeadline = body.rsvpDeadline ? new Date(body.rsvpDeadline) : undefined;
    if (typeof body.allowPlusOnes === "boolean") design.allowPlusOnes = body.allowPlusOnes;
    design.updatedAt = new Date();
    event.invitation = design;
    await event.save({ validateModifiedOnly: true });
    res.status(200).json({ status: "success", data: { invitation: invitationView(event) } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /send { guestIds?: string[], resend?: boolean }
 * Emails the invitation with each guest's RSVP link. Without guestIds: every guest
 * with an email who hasn't been sent one yet (or everyone with `resend`).
 */
export const sendInvitations = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const { guestIds, resend } = req.body || {};
    const query = { event: event._id, email: { $exists: true, $ne: "" } };
    if (Array.isArray(guestIds) && guestIds.length) {
      query._id = { $in: guestIds.filter((id) => mongoose.isValidObjectId(id)) };
    } else if (!resend) {
      query["invitation.status"] = { $in: [null, "not_sent", "failed"] };
    }
    const guests = await Guest.find(query).limit(MAX_SEND + 1);
    if (guests.length === 0) throw new AppError("No guests with an email address to invite", 400);
    if (guests.length > MAX_SEND) throw new AppError(`Send to up to ${MAX_SEND} guests at a time`, 400);

    const view = invitationView(event);
    let sent = 0;
    const failed = [];
    for (const guest of guests) {
      try {
        const token = await ensureToken(guest._id);
        const { subject, html } = renderInvitationEmail(view, guest, token);
        await sendEmailDirect({ to: guest.email, subject, html });
        guest.set("invitation", {
          ...(guest.invitation?.toObject?.() || {}),
          status: guest.invitation?.status === "opened" ? "opened" : "sent",
          channel: "email",
          sentAt: new Date(),
          lastError: undefined,
        });
        guest.invitationSent = true;
        guest.invitationSentDate = new Date();
        await guest.save();
        sent += 1;
      } catch (error) {
        logger.warn("Invitation email failed", { guest: guest._id, error: error.message });
        guest.set("invitation.status", "failed");
        guest.set("invitation.lastError", String(error.message).slice(0, 300));
        await guest.save().catch(() => {});
        failed.push({ guestId: guest._id, name: guest.name, error: "Couldn't send the email" });
      }
    }

    res.status(200).json({
      status: "success",
      message: `Invitations sent: ${sent}${failed.length ? `, failed: ${failed.length}` : ""}`,
      data: { sent, failed, stats: await invitationStats(event._id) },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /events/:eventId/guests/:guestId/rsvp-link → { url, whatsappUrl } */
export const getGuestRsvpLink = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    if (!mongoose.isValidObjectId(req.params.guestId)) throw new AppError("Guest not found", 404);
    const guest = await Guest.findOne({ _id: req.params.guestId, event: event._id });
    if (!guest) throw new AppError("Guest not found", 404);
    const token = await ensureToken(guest._id);
    res.status(200).json({
      status: "success",
      data: { url: rsvpUrl(token), whatsappUrl: whatsappLink(invitationView(event), guest, token) },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /events/:eventId/guests/:guestId/invitation/shared — invitation sent by WhatsApp */
export const markInvitationShared = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    if (!mongoose.isValidObjectId(req.params.guestId)) throw new AppError("Guest not found", 404);
    const guest = await Guest.findOne({ _id: req.params.guestId, event: event._id });
    if (!guest) throw new AppError("Guest not found", 404);
    if (guest.invitation?.status !== "opened") guest.set("invitation.status", "sent");
    guest.set("invitation.channel", "whatsapp");
    guest.set("invitation.sentAt", new Date());
    guest.invitationSent = true;
    guest.invitationSentDate = new Date();
    await guest.save();
    res.status(200).json({ status: "success", data: { invitation: guest.invitation } });
  } catch (error) {
    next(error);
  }
};
