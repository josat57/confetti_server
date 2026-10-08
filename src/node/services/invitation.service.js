import crypto from "crypto";
import Guest from "../models/guest.model.js";

/**
 * Digital invitations and RSVP links.
 * Each guest gets a random token (32 bytes); /rsvp/:token on the website shows the
 * invitation and records the answer. Tokens are unguessable, and the public endpoints
 * are rate limited.
 */

export const THEMES = {
  classic: { background: "#fdfbf7", text: "#1f2937", border: "#d6c7a1" },
  floral: { background: "#fff5f7", text: "#4a2c38", border: "#f4b6c8" },
  modern: { background: "#f8fafc", text: "#0f172a", border: "#cbd5e1" },
  festive: { background: "#fff8e6", text: "#3b2a07", border: "#f5c451" },
  elegant: { background: "#111827", text: "#f9fafb", border: "#a78bfa" },
};

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const apiUrl = () =>
  (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:9600").replace(/\/$/, "");
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const newToken = () => crypto.randomBytes(32).toString("hex");

/** The guest's RSVP token, created on first use */
export const ensureToken = async (guestId) => {
  const guest = await Guest.findById(guestId).select("+rsvpToken");
  if (!guest) return null;
  if (!guest.rsvpToken) {
    guest.rsvpToken = newToken();
    await guest.save();
  }
  return guest.rsvpToken;
};

export const rsvpUrl = (token) => `${frontendUrl()}/rsvp/${token}`;

/** The invitation as guests see it: the saved design, filled in from the event */
export const invitationView = (event) => {
  const design = event.invitation?.toObject?.() || event.invitation || {};
  const address = event.location?.address;
  const venue =
    design.venueText ||
    (typeof address === "string"
      ? address
      : [address?.street, address?.city, address?.state].filter(Boolean).join(", "));
  return {
    title: design.title || event.title,
    hosts: design.hosts || "",
    message: design.message || "We would love for you to celebrate with us.",
    dressCode: design.dressCode || "",
    venue: venue || "",
    theme: design.theme || "classic",
    accentColor: design.accentColor || "#7c3aed",
    rsvpDeadline: design.rsvpDeadline || null,
    allowPlusOnes: design.allowPlusOnes !== false,
    startDate: event.startDate,
    endDate: event.endDate,
    eventType: event.eventType,
  };
};

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
      })
    : "";

/** Invitation email for one guest */
export const renderInvitationEmail = (view, guest, token) => {
  const theme = THEMES[view.theme] || THEMES.classic;
  const link = rsvpUrl(token);
  const subject = `You're invited: ${view.title}`;
  const html = `
  <div style="background:${theme.background};color:${theme.text};font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px;border:2px solid ${theme.border};border-radius:12px;text-align:center">
    <p style="margin:0 0 8px;font-size:14px;letter-spacing:2px;text-transform:uppercase">Dear ${escapeHtml(guest.name)}</p>
    ${view.hosts ? `<p style="margin:0 0 16px;font-size:15px">${escapeHtml(view.hosts)} invite you to</p>` : ""}
    <h1 style="margin:0 0 16px;font-size:28px;color:${view.accentColor}">${escapeHtml(view.title)}</h1>
    <p style="margin:0 0 8px;font-size:16px">${escapeHtml(formatDate(view.startDate))}</p>
    ${view.venue ? `<p style="margin:0 0 16px;font-size:15px">${escapeHtml(view.venue)}</p>` : ""}
    <p style="margin:16px 0;font-size:15px;line-height:1.6;white-space:pre-line">${escapeHtml(view.message)}</p>
    ${view.dressCode ? `<p style="margin:0 0 16px;font-size:14px">Dress code: ${escapeHtml(view.dressCode)}</p>` : ""}
    <a href="${link}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:${view.accentColor};color:#fff;text-decoration:none;border-radius:999px;font-family:Arial,sans-serif;font-weight:bold">RSVP</a>
    ${view.rsvpDeadline ? `<p style="margin:16px 0 0;font-size:13px">Kindly reply by ${escapeHtml(new Date(view.rsvpDeadline).toDateString())}</p>` : ""}
    <img src="${apiUrl()}/api/v1/rsvp/${token}/open.gif" width="1" height="1" alt="" style="display:block;border:0" />
  </div>`;
  return { subject, html, link };
};

/** WhatsApp share link for a guest's invitation */
export const whatsappLink = (view, guest, token) => {
  const text = `Dear ${guest.name}, you're invited to ${view.title}${
    view.startDate ? ` on ${new Date(view.startDate).toDateString()}` : ""
  }. Please RSVP here: ${rsvpUrl(token)}`;
  const digits = String(guest.phone || "").replace(/\D/g, "");
  // Nigerian numbers written locally (080…) become international (23480…)
  const phone = digits.startsWith("0") && digits.length === 11 ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${phone.length >= 10 ? phone : ""}?text=${encodeURIComponent(text)}`;
};
