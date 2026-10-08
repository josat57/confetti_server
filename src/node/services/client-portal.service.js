import crypto from "crypto";
import mongoose from "mongoose";
import ClientPortal from "../models/client-portal.model.js";
import Event from "../models/event.model.js";
import Document from "../models/document.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { findOwnedEvent } from "../utils/event-access.js";

/**
 * Planner client portal (roadmap Phase 7).
 * The planner invites their client by email; the client opens a private link
 * (no account) to see the event's schedule, checklist, budget, shared documents
 * and approvals, and to comment or answer approvals.
 */

const TOKEN = /^[a-f0-9]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const portalUrl = (token) => `${frontendUrl()}/portal/${token}`;
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plannerName = (user) => [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Your planner";

const getOrCreate = async (event, plannerId) =>
  (await ClientPortal.findOne({ event: event._id })) ||
  ClientPortal.create({ event: event._id, planner: plannerId, invites: [], approvals: [], comments: [] });

const emailClients = async (portal, subject, intro, event) => {
  for (const invite of portal.invites.filter((i) => i.status !== "revoked")) {
    try {
      await sendEmailDirect({
        to: invite.email,
        subject,
        html: `<p>Hi ${escapeHtml(invite.name || "there")},</p>
          <p>${escapeHtml(intro)}</p>
          <p><a href="${portalUrl(invite.token)}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;">Open ${escapeHtml(event.title)}</a></p>
          <p style="color:#6b7280;font-size:12px">This link is just for you. Please don't forward it.</p>`,
      });
    } catch (error) {
      logger.warn("Portal email failed", { error: error.message });
    }
  }
};

/** The portal as the planner manages it */
const plannerView = async (event, portal) => {
  const documents = await Document.find({ event: event._id, status: { $ne: "deleted" } })
    .select("name type mimeType size sharedWithClient createdAt")
    .sort({ createdAt: -1 })
    .lean();
  return {
    event: { _id: event._id, title: event.title },
    invites: (portal?.invites || []).map((i) => ({
      _id: i._id,
      name: i.name,
      email: i.email,
      status: i.status,
      invitedAt: i.invitedAt,
      lastViewedAt: i.lastViewedAt,
      link: i.status === "revoked" ? null : portalUrl(i.token),
    })),
    approvals: portal?.approvals || [],
    comments: portal?.comments || [],
    documents,
  };
};

class ClientPortalService {
  async getForPlanner(user, eventId) {
    const event = await findOwnedEvent(eventId, user);
    return plannerView(event, await ClientPortal.findOne({ event: event._id }));
  }

  async invite(user, eventId, { email, name }) {
    const event = await findOwnedEvent(eventId, user);
    const address = String(email || "").trim().toLowerCase();
    if (!EMAIL.test(address)) throw new AppError("Enter a valid email address", 400);
    const portal = await getOrCreate(event, user._id);
    let invite = portal.invites.find((i) => i.email === address && i.status !== "revoked");
    if (!invite) {
      if (portal.invites.filter((i) => i.status !== "revoked").length >= 10) throw new AppError("Up to 10 people can have access", 400);
      portal.invites.push({ email: address, name: typeof name === "string" ? name.trim().slice(0, 100) : undefined, token: crypto.randomBytes(32).toString("hex") });
      invite = portal.invites.at(-1);
      await portal.save();
    }
    await emailClients(
      { invites: [invite] },
      `${plannerName(user)} shared ${event.title} with you`,
      `${plannerName(user)} has shared the plan for ${event.title} with you. You can follow progress, see the budget and documents, and reply to approvals.`,
      event
    );
    return plannerView(event, portal);
  }

  async revokeInvite(user, eventId, inviteId) {
    const event = await findOwnedEvent(eventId, user);
    const portal = await ClientPortal.findOne({ event: event._id });
    const invite = portal?.invites.id(inviteId);
    if (!invite) throw new AppError("Invite not found", 404);
    invite.status = "revoked";
    await portal.save();
    return plannerView(event, portal);
  }

  async addApproval(user, eventId, { title, description, amount }) {
    const event = await findOwnedEvent(eventId, user);
    if (typeof title !== "string" || !title.trim()) throw new AppError("A title is required", 400);
    const portal = await getOrCreate(event, user._id);
    portal.approvals.push({
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : undefined,
      amount: Number(amount) > 0 ? Number(amount) : undefined,
    });
    await portal.save();
    await emailClients(portal, `Approval needed: ${title.trim()}`, `${plannerName(user)} needs your approval for "${title.trim()}".`, event);
    return plannerView(event, portal);
  }

  async deleteApproval(user, eventId, approvalId) {
    const event = await findOwnedEvent(eventId, user);
    const portal = await ClientPortal.findOne({ event: event._id });
    const approval = portal?.approvals.id(approvalId);
    if (!approval) throw new AppError("Approval not found", 404);
    approval.deleteOne();
    await portal.save();
    return plannerView(event, portal);
  }

  async plannerComment(user, eventId, body) {
    const event = await findOwnedEvent(eventId, user);
    if (typeof body !== "string" || !body.trim()) throw new AppError("Write a comment", 400);
    const portal = await getOrCreate(event, user._id);
    portal.comments.push({ author: "planner", name: plannerName(user), body: body.trim() });
    await portal.save();
    await emailClients(portal, `New message about ${event.title}`, `${plannerName(user)} wrote: "${body.trim().slice(0, 300)}"`, event);
    return plannerView(event, portal);
  }

  async setDocumentShared(user, eventId, documentId, shared) {
    const event = await findOwnedEvent(eventId, user);
    if (!mongoose.isValidObjectId(documentId)) throw new AppError("Document not found", 404);
    const doc = await Document.findOneAndUpdate(
      { _id: documentId, event: event._id, status: { $ne: "deleted" } },
      { $set: { sharedWithClient: !!shared } },
      { new: true }
    );
    if (!doc) throw new AppError("Document not found", 404);
    return plannerView(event, await ClientPortal.findOne({ event: event._id }));
  }

  // ---- Client (private link, no account) ----

  async findByToken(token) {
    if (!TOKEN.test(String(token))) throw new AppError("This link isn't valid", 404);
    const portal = await ClientPortal.findOne({ invites: { $elemMatch: { token, status: { $ne: "revoked" } } } });
    if (!portal) throw new AppError("This link isn't valid", 404);
    const invite = portal.invites.find((i) => i.token === token);
    const event = await Event.findById(portal.event);
    if (!event) throw new AppError("This link isn't valid", 404);
    return { portal, invite, event };
  }

  async viewByToken(token) {
    const { portal, invite, event } = await this.findByToken(token);
    invite.status = "active";
    invite.lastViewedAt = new Date();
    await portal.save();

    const Budget = (await import("../models/budget.model.js")).default;
    const { createShareToken } = await import("../controllers/planner-document.controller.js");
    const [budget, documents] = await Promise.all([
      Budget.findOne({ event: event._id }),
      Document.find({ event: event._id, sharedWithClient: true, status: { $ne: "deleted" } }).select("name type mimeType size createdAt").lean(),
    ]);
    const base = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:9600";
    const address = event.location?.address;

    return {
      viewer: { name: invite.name, email: invite.email },
      event: {
        title: event.title,
        eventType: event.eventType,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
        venue: typeof address === "string" ? address : [address?.street, address?.city, address?.state].filter(Boolean).join(", "),
        guestCount: event.guestCount,
      },
      timeline: (event.timeline || [])
        .map((t) => ({ title: t.title, description: t.description, startTime: t.startTime, endTime: t.endTime, location: t.location }))
        .sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0)),
      checklist: (event.tasks || []).map((t) => ({ title: t.title, status: t.status, dueDate: t.dueDate })),
      budget: budget
        ? {
            total: budget.totalBudget,
            currency: budget.currency,
            spent: budget.totalSpent,
            remaining: budget.remaining,
            expenses: budget.expenses.map((e) => ({ description: e.description, category: e.category, amount: e.amount, paymentStatus: e.paymentStatus })),
          }
        : null,
      documents: documents.map((d) => ({
        _id: d._id,
        name: d.name,
        type: d.type,
        size: d.size,
        url: `${base}/api/v1/shared/documents/${d._id}?token=${encodeURIComponent(createShareToken(d._id, 7))}`,
      })),
      approvals: portal.approvals,
      comments: portal.comments,
    };
  }

  async notifyPlanner(portal, event, title, message) {
    await Notification.createNotification({
      recipient: portal.planner,
      type: "info",
      category: "event",
      title,
      message,
      actionUrl: `/planner/dashboard/events/${event._id}/portal`,
      data: { eventId: event._id.toString() },
    }).catch(() => {});
  }

  async clientComment(token, body) {
    const { portal, invite, event } = await this.findByToken(token);
    if (typeof body !== "string" || !body.trim()) throw new AppError("Write a comment", 400);
    portal.comments.push({ author: "client", name: invite.name || invite.email, body: body.trim().slice(0, 2000) });
    await portal.save();
    await this.notifyPlanner(portal, event, `${invite.name || invite.email} commented on ${event.title}`, body.trim().slice(0, 140));
    return { comments: portal.comments };
  }

  async respondToApproval(token, approvalId, { decision, comment }) {
    const { portal, invite, event } = await this.findByToken(token);
    if (!["approved", "changes_requested"].includes(decision)) throw new AppError("Approve or ask for changes", 400);
    if (!mongoose.isValidObjectId(approvalId)) throw new AppError("Approval not found", 404);
    const approval = portal.approvals.id(approvalId);
    if (!approval) throw new AppError("Approval not found", 404);
    if (decision === "changes_requested" && !(typeof comment === "string" && comment.trim())) {
      throw new AppError("Tell your planner what to change", 400);
    }
    approval.status = decision;
    approval.respondedAt = new Date();
    approval.respondedBy = invite.name || invite.email;
    approval.response = typeof comment === "string" ? comment.trim().slice(0, 2000) : undefined;
    if (approval.response) portal.comments.push({ author: "client", name: approval.respondedBy, body: approval.response, approval: approval._id });
    await portal.save();
    await this.notifyPlanner(
      portal,
      event,
      `${approval.respondedBy} ${decision === "approved" ? "approved" : "asked for changes to"} "${approval.title}"`,
      approval.response || ""
    );
    return { approvals: portal.approvals, comments: portal.comments };
  }
}

export default new ClientPortalService();
