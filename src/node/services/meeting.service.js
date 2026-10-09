import crypto from "crypto";
import mongoose from "mongoose";
import axios from "axios";
import Meeting from "../models/meeting.model.js";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import VendorBooking from "../models/vendor-booking.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { getParticipantConversation, postMessage } from "./conversation.service.js";

/**
 * Video calls with vendors (Diaspora Pass, roadmap Phase 10), started from a
 * conversation or a booking. With DAILY_API_KEY, each call is a private Daily.co room
 * with a personal join link per person (no sign-in, expires after the call); without
 * it, a Jitsi Meet room (JITSI_BASE_URL). Invites go out as .ics calendar files.
 */

const jitsiBase = () => (process.env.JITSI_BASE_URL || "https://meet.jit.si").replace(/\/$/, "");
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const idOf = (v) => String(v?._id || v || "");
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nameOf = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.username || u?.email || "Someone";

// ---- Calendar invite (RFC 5545) ----
const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line) => {
  const out = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? " " : "") + line.slice(i, i + 73));
  return out.join("\r\n");
};
export const buildIcs = (meeting, { organizerEmail, attendees = [], joinUrl } = {}) => {
  const link = joinUrl || meeting.url;
  const end = new Date(new Date(meeting.startsAt).getTime() + meeting.durationMinutes * 60000);
  const cancelled = meeting.status === "cancelled";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Confetti//Video calls//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:meeting-${meeting._id}@confetti`,
    `SEQUENCE:${meeting.sequence || 0}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(meeting.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(meeting.title)}`,
    `DESCRIPTION:${icsText(`${meeting.agenda ? `${meeting.agenda}\n\n` : ""}Join the video call: ${link}`)}`,
    `LOCATION:${icsText(link)}`,
    `URL:${link}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    ...(organizerEmail ? [`ORGANIZER;CN=Confetti:mailto:${organizerEmail}`] : []),
    ...attendees.map((a) => `ATTENDEE;CN=${icsText(a.name || a.email)};RSVP=TRUE:mailto:${a.email}`),
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Video call in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
};

// ---- Daily.co (https://docs.daily.co/reference/rest-api) ----
const daily = {
  enabled: () => !!process.env.DAILY_API_KEY,
  request: async (method, path, data) => {
    const res = await axios.request({
      method,
      url: `https://api.daily.co/v1${path}`,
      data,
      headers: { Authorization: `Bearer ${process.env.DAILY_API_KEY}`, "Content-Type": "application/json" },
      timeout: 15000,
    });
    return res.data;
  },
  /** Joinable from 30 minutes before the start until 60 minutes after the planned end */
  window: (meeting) => {
    const start = new Date(meeting.startsAt).getTime();
    return {
      nbf: Math.floor((start - 30 * 60000) / 1000),
      exp: Math.floor((start + (meeting.durationMinutes + 60) * 60000) / 1000),
    };
  },
  createRoom: async (meeting) =>
    daily.request("post", "/rooms", {
      name: `confetti-${crypto.randomBytes(10).toString("hex")}`,
      privacy: "private",
      properties: { ...daily.window(meeting), eject_at_room_exp: true, enable_prejoin_ui: true, enable_chat: true },
    }),
  updateRoom: async (meeting) => daily.request("post", `/rooms/${encodeURIComponent(meeting.roomName)}`, { properties: daily.window(meeting) }),
  deleteRoom: async (name) => daily.request("delete", `/rooms/${encodeURIComponent(name)}`),
  /** A personal join token for each participant and guest */
  tokensFor: async (meeting) => {
    const { exp } = daily.window(meeting);
    const people = await User.find({ _id: { $in: meeting.participants } }).select("firstName lastName username email").lean();
    const out = [];
    for (const p of people) {
      const { token } = await daily.request("post", "/meeting-tokens", {
        properties: { room_name: meeting.roomName, exp, user_name: nameOf(p), is_owner: idOf(p._id) === idOf(meeting.createdBy) },
      });
      out.push({ user: p._id, token });
    }
    for (const email of meeting.guestEmails || []) {
      const { token } = await daily.request("post", "/meeting-tokens", { properties: { room_name: meeting.roomName, exp, user_name: email } });
      out.push({ email, token });
    }
    return out;
  },
};

class MeetingService {
  /** Who the call is with, from a conversation or a booking the user is part of */
  async resolveContext(user, { conversationId, bookingId }) {
    if (conversationId) {
      const conversation = await getParticipantConversation(conversationId, user._id);
      return { conversation, participants: conversation.participants.map(idOf), guestEmails: [] };
    }
    if (bookingId) {
      if (!mongoose.isValidObjectId(bookingId)) throw new AppError("Booking not found", 404);
      const booking = await VendorBooking.findById(bookingId).select("vendor planner clientEmail clientName");
      if (!booking) throw new AppError("Booking not found", 404);
      const vendor = await Vendor.findById(booking.vendor).select("owner").lean();
      const parties = [idOf(booking.planner), idOf(vendor?.owner)].filter(Boolean);
      if (!parties.includes(idOf(user._id))) throw new AppError("Booking not found", 404);
      const guestEmails = !booking.planner && booking.clientEmail ? [booking.clientEmail.toLowerCase()] : [];
      if (parties.length < 2 && !guestEmails.length) throw new AppError("Add the client's email to the booking first", 400);
      return { booking, participants: [...new Set(parties)], guestEmails };
    }
    throw new AppError("Start a call from a conversation or a booking", 400);
  }

  input(body, current) {
    const out = {};
    if (body.title !== undefined || !current) out.title = str(body.title, 200) || "Video call";
    if (body.agenda !== undefined) out.agenda = str(body.agenda, 2000) || undefined;
    if (body.startsAt !== undefined || !current) {
      const at = new Date(body.startsAt);
      if (!body.startsAt || Number.isNaN(at.getTime())) throw new AppError("Choose a date and time", 400);
      if (at < new Date(Date.now() - 5 * 60000)) throw new AppError("Choose a time in the future", 400);
      if (at - Date.now() > 365 * 86400000) throw new AppError("Choose a time within a year", 400);
      out.startsAt = at;
    }
    if (body.durationMinutes !== undefined) {
      const n = Number(body.durationMinutes);
      if (!Number.isInteger(n) || n < 10 || n > 240) throw new AppError("Calls can be 10 to 240 minutes", 400);
      out.durationMinutes = n;
    }
    if (body.timezone !== undefined) out.timezone = str(body.timezone, 60);
    return out;
  }

  async create(user, body = {}) {
    const ctx = await this.resolveContext(user, body);
    const upcoming = await Meeting.countDocuments({ createdBy: user._id, status: "scheduled", startsAt: { $gt: new Date() } });
    if (upcoming >= 50) throw new AppError("You have too many upcoming calls", 400);
    const meeting = new Meeting({
      createdBy: user._id,
      participants: ctx.participants,
      guestEmails: ctx.guestEmails,
      conversation: ctx.conversation?._id,
      booking: ctx.booking?._id,
      ...this.input(body),
    });
    await this.openRoom(meeting);
    await meeting.save();
    await this.announce(meeting, user, "scheduled", ctx.conversation);
    return this.shapeFor(meeting, user);
  }

  /**
   * The room: a private Daily room with a join link per person when DAILY_API_KEY is
   * set (no sign-in needed, rooms expire after the call), otherwise a Jitsi room.
   * If Daily can't be reached the call falls back to Jitsi rather than failing.
   */
  async openRoom(meeting) {
    if (daily.enabled()) {
      try {
        const room = await daily.createRoom(meeting);
        meeting.provider = "daily";
        meeting.roomName = room.name;
        meeting.url = room.url;
        meeting.joinTokens = await daily.tokensFor(meeting);
        return;
      } catch (error) {
        logger.warn("Daily room failed; using Jitsi", { error: error.message });
      }
    }
    meeting.provider = "jitsi";
    meeting.roomName = `Confetti-${crypto.randomBytes(12).toString("hex")}`;
    meeting.url = `${jitsiBase()}/${meeting.roomName}`;
    meeting.joinTokens = [];
  }

  /** The link this person uses to join */
  joinUrlFor(meeting, { userId, email } = {}) {
    if (meeting.provider !== "daily") return meeting.url;
    const t = (meeting.joinTokens || []).find((x) => (userId && idOf(x.user) === idOf(userId)) || (email && x.email === email));
    return t ? `${meeting.url}?t=${t.token}` : meeting.url;
  }

  /** A meeting as one participant sees it (their own join link, nobody else's) */
  shapeFor(meeting, user) {
    const m = meeting.toObject ? meeting.toObject() : { ...meeting };
    const joinUrl = this.joinUrlFor(meeting, { userId: user._id });
    delete m.joinTokens;
    return { ...m, url: joinUrl };
  }

  async findMine(user, id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Call not found", 404);
    const meeting = await Meeting.findOne({ _id: id, participants: user._id }).select("+joinTokens");
    if (!meeting) throw new AppError("Call not found", 404);
    return meeting;
  }

  async reschedule(user, id, body = {}) {
    const meeting = await this.findMine(user, id);
    if (meeting.status === "cancelled") throw new AppError("This call was cancelled", 400);
    Object.assign(meeting, this.input(body, meeting));
    meeting.sequence = (meeting.sequence || 0) + 1;
    if (meeting.provider === "daily") {
      try {
        await daily.updateRoom(meeting);
        meeting.joinTokens = await daily.tokensFor(meeting);
      } catch (error) {
        logger.warn("Daily room update failed; moving to a new room", { error: error.message });
        await this.openRoom(meeting);
      }
    }
    await meeting.save();
    await this.announce(meeting, user, "rescheduled");
    return this.shapeFor(meeting, user);
  }

  async cancel(user, id) {
    const meeting = await this.findMine(user, id);
    if (meeting.status === "cancelled") return this.shapeFor(meeting, user);
    meeting.status = "cancelled";
    meeting.cancelledAt = new Date();
    meeting.sequence = (meeting.sequence || 0) + 1;
    await meeting.save();
    if (meeting.provider === "daily") await daily.deleteRoom(meeting.roomName).catch(() => {});
    await this.announce(meeting, user, "cancelled");
    return this.shapeFor(meeting, user);
  }

  async list(user, { conversationId, bookingId, upcoming } = {}) {
    const query = { participants: user._id };
    if (conversationId && mongoose.isValidObjectId(conversationId)) query.conversation = conversationId;
    if (bookingId && mongoose.isValidObjectId(bookingId)) query.booking = bookingId;
    if (upcoming === "true" || upcoming === true) {
      query.status = "scheduled";
      query.startsAt = { $gt: new Date(Date.now() - 2 * 3600000) };
    }
    const meetings = await Meeting.find(query)
      .select("+joinTokens")
      .sort({ startsAt: 1 })
      .limit(100)
      .populate("participants", "firstName lastName username")
      .lean();
    return meetings.map((m) => this.shapeFor(m, user));
  }

  async ics(user, id) {
    const meeting = await this.findMine(user, id);
    const people = await User.find({ _id: { $in: meeting.participants } }).select("email firstName lastName username").lean();
    return buildIcs(meeting, {
      organizerEmail: process.env.FROM_EMAIL,
      attendees: [...people.map((p) => ({ email: p.email, name: nameOf(p) })), ...meeting.guestEmails.map((email) => ({ email }))],
      joinUrl: this.joinUrlFor(meeting, { userId: user._id }),
    });
  }

  /** Message in the conversation, in-app notification and email with the calendar invite */
  async announce(meeting, actor, change, conversation) {
    const people = await User.find({ _id: { $in: meeting.participants } }).select("email firstName lastName username role").lean();
    const when = new Date(meeting.startsAt).toUTCString().replace(" GMT", " UTC");
    const verb = { scheduled: "scheduled a video call", rescheduled: "moved the video call", cancelled: "cancelled the video call" }[change];
    // Daily links are personal, so the shared conversation doesn't carry one
    const joinHint = meeting.provider === "daily" ? "Join from the call button here or your email invite." : `Join: ${meeting.url}`;
    const line = `${nameOf(actor)} ${verb}: ${meeting.title}${change === "cancelled" ? "" : ` — ${when} (${meeting.durationMinutes} min). ${joinHint}`}`;

    const convo =
      conversation ||
      (meeting.conversation ? await getParticipantConversation(meeting.conversation, actor._id).catch(() => null) : null);
    if (convo) await postMessage({ conversation: convo, sender: actor._id, content: line, subject: "Video call" }).catch((error) => logger.warn("Meeting message failed", { error: error.message }));

    const attendees = [...people.map((p) => ({ email: p.email, name: nameOf(p) })), ...meeting.guestEmails.map((email) => ({ email }))];
    for (const person of people) {
      if (idOf(person._id) !== idOf(actor._id)) {
        const dashboard = person.role === "vendor" ? "/vendor/dashboard/messages" : person.role === "event-planner" ? "/planner/dashboard/messages" : "/user/dashboard/messages";
        await Notification.createNotification({
          recipient: person._id,
          type: change === "cancelled" ? "warning" : "info",
          category: "message",
          title: `${nameOf(actor)} ${verb}`,
          message: change === "cancelled" ? meeting.title : `${meeting.title} · ${when}`,
          actionUrl: dashboard,
          data: { meetingId: idOf(meeting._id) },
        }).catch(() => {});
      }
    }
    const recipients = [
      ...people.map((p) => ({ email: p.email, name: nameOf(p), joinUrl: this.joinUrlFor(meeting, { userId: p._id }) })),
      ...meeting.guestEmails.map((email) => ({ email, name: "", joinUrl: this.joinUrlFor(meeting, { email }) })),
    ];
    for (const r of recipients) {
      if (!r.email) continue;
      const ics = buildIcs(meeting, { organizerEmail: process.env.FROM_EMAIL, attendees, joinUrl: r.joinUrl });
      await sendEmailDirect({
        to: r.email,
        subject: `${change === "cancelled" ? "Cancelled" : change === "rescheduled" ? "Updated" : "Invitation"}: ${meeting.title}`,
        html: `<p>Hi ${escapeHtml(r.name || "there")},</p>
          <p>${escapeHtml(nameOf(actor))} ${verb}${change === "cancelled" ? "" : ` for <strong>${escapeHtml(when)}</strong> (${meeting.durationMinutes} minutes)`}.</p>
          ${meeting.agenda ? `<p>${escapeHtml(meeting.agenda)}</p>` : ""}
          ${change === "cancelled" ? "" : `<p><a href="${r.joinUrl}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Join the call</a></p>
          <p style="color:#6b7280;font-size:12px">This link is just for you. Open the attached invite to add it to your calendar. It works in your browser, no download or sign-in needed.</p>`}
          <p style="color:#6b7280;font-size:12px"><a href="${frontendUrl()}">Confetti</a></p>`,
        attachments: [{ filename: "invite.ics", content: ics, contentType: `text/calendar; charset=utf-8; method=${change === "cancelled" ? "CANCEL" : "REQUEST"}` }],
      }).catch((error) => logger.warn("Meeting email failed", { error: error.message }));
    }
  }
}

export default new MeetingService();
