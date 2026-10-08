import Guest from "../models/guest.model.js";
import Event from "../models/event.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { invitationView } from "../services/invitation.service.js";

/**
 * Public RSVP (no login): /api/v1/rsvp/:token
 * The token is the only key, so every failure looks the same (404).
 */

const TOKEN = /^[a-f0-9]{64}$/;
const ANSWERS = ["accepted", "declined", "tentative"];
// 1×1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

const findByToken = async (token) => {
  if (!TOKEN.test(String(token))) return null;
  return Guest.findOne({ rsvpToken: token }).select("+rsvpToken");
};

const markOpened = async (guest) => {
  if (guest.invitation?.status === "opened") return;
  guest.set("invitation.status", "opened");
  guest.set("invitation.openedAt", new Date());
  await guest.save().catch(() => {});
};

/** GET /rsvp/:token — the invitation and the guest's current answer */
export const getRsvp = async (req, res, next) => {
  try {
    const guest = await findByToken(req.params.token);
    const event = guest ? await Event.findById(guest.event) : null;
    if (!guest || !event || event.status === "cancelled") throw new AppError("This invitation link isn't valid", 404);
    await markOpened(guest);

    const view = invitationView(event);
    const closed = view.rsvpDeadline && new Date(view.rsvpDeadline) < new Date();
    res.status(200).json({
      status: "success",
      data: {
        invitation: view,
        guest: {
          name: guest.name,
          rsvpStatus: guest.rsvpStatus,
          plusOne: guest.plusOne,
          plusOneName: guest.plusOneName || "",
          dietaryRestrictions: guest.dietaryRestrictions || [],
          rsvpMessage: guest.rsvpMessage || "",
        },
        canRespond: !closed && new Date(event.endDate || event.startDate) > new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /rsvp/:token { status, plusOneName?, dietaryRestrictions?, message? } */
export const submitRsvp = async (req, res, next) => {
  try {
    const guest = await findByToken(req.params.token);
    const event = guest ? await Event.findById(guest.event) : null;
    if (!guest || !event || event.status === "cancelled") throw new AppError("This invitation link isn't valid", 404);

    const view = invitationView(event);
    if (view.rsvpDeadline && new Date(view.rsvpDeadline) < new Date()) {
      throw new AppError("RSVPs for this event have closed. Please contact the host.", 400);
    }
    if (new Date(event.endDate || event.startDate) <= new Date()) {
      throw new AppError("This event has already taken place", 400);
    }

    const { status, plusOneName, dietaryRestrictions, message } = req.body || {};
    if (!ANSWERS.includes(status)) throw new AppError("Choose whether you can attend", 400);

    const previous = guest.rsvpStatus;
    guest.rsvpStatus = status;
    guest.rsvpDate = new Date();
    guest.respondedVia = "link";
    if (typeof message === "string") guest.rsvpMessage = message.trim().slice(0, 1000);
    if (view.allowPlusOnes && typeof plusOneName === "string") {
      guest.plusOneName = plusOneName.trim().slice(0, 100);
      guest.plusOne = status === "accepted" && !!guest.plusOneName;
    }
    if (Array.isArray(dietaryRestrictions)) {
      guest.dietaryRestrictions = dietaryRestrictions
        .filter((d) => typeof d === "string" && d.trim())
        .slice(0, 10)
        .map((d) => d.trim().slice(0, 60));
    }
    await markOpened(guest);
    await guest.save();

    // Tell the host (once per change of answer)
    if (previous !== status) {
      const host = event.createdBy || event.planner || event.organizer;
      if (host) {
        const label = { accepted: "is coming", declined: "can't make it", tentative: "might come" }[status];
        Notification.createNotification({
          recipient: host,
          type: "info",
          category: "event",
          title: `${guest.name} ${label}`,
          message: `RSVP for ${event.title}${guest.rsvpMessage ? `: "${guest.rsvpMessage.slice(0, 100)}"` : ""}`,
          actionUrl: `/user/dashboard/events/${event._id}/guests`,
          data: { eventId: event._id.toString(), guestId: guest._id.toString(), rsvpStatus: status },
        }).catch((error) => logger.warn("RSVP notification failed", { error: error.message }));
      }
    }

    res.status(200).json({ status: "success", data: { rsvpStatus: guest.rsvpStatus } });
  } catch (error) {
    next(error);
  }
};

/** GET /rsvp/:token/open.gif — email open tracking pixel */
export const openPixel = async (req, res) => {
  try {
    const guest = await findByToken(req.params.token);
    if (guest) await markOpened(guest);
  } catch {
    // never fail the image
  }
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" });
  res.status(200).end(PIXEL);
};
