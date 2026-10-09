import mongoose from "mongoose";
import SupportTicket from "../models/supportTicket.model.js";
import EventPass from "../models/event-pass.model.js";
import { AppError } from "../utils/AppError.js";
import { EVENT_PASSES } from "../config/plans.js";
import { getActivePlan } from "./plan-access.service.js";

/**
 * Support tickets for clients, planners and vendors (/api/v1/support/tickets).
 * Priority support (Celebration Plus and Diaspora passes, the Agency plan, Corporate)
 * marks tickets high priority with a shorter first-response target.
 */

const CATEGORIES = ["technical", "billing", "account", "event", "vendor", "general", "other"];
const HOURS = 3600000;

/** Does this user get priority support, and why? */
export const prioritySupportFor = async (user) => {
  const { plan } = await getActivePlan(user);
  if (plan?.features?.prioritySupport) return `${plan.displayName} plan`;
  const tiers = EVENT_PASSES.filter((p) => p.features.prioritySupport).map((p) => p.key);
  const pass = await EventPass.findOne({ user: user._id, status: "active", tier: { $in: tiers } }).select("tier").lean();
  if (pass) return `${EVENT_PASSES.find((p) => p.key === pass.tier)?.displayName}`;
  // Members of a company on an active Corporate contract
  const { Organization } = await import("../models/organization.model.js");
  const org = await Organization.findOne({ "members.user": user._id, "contract.status": "active", "contract.endsAt": { $gt: new Date() } }).select("_id").lean();
  if (org) return "Corporate";
  return null;
};

/** A ticket as its owner sees it (no internal notes or admin ids) */
const shape = (t) => ({
  _id: t._id,
  ticketNumber: t.ticketNumber,
  subject: t.subject,
  description: t.description,
  category: t.category,
  priority: t.priority,
  isPriority: !!t.isPriority,
  status: t.status,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  resolution: t.resolution?.content ? { content: t.resolution.content, resolvedAt: t.resolution.resolvedAt } : null,
  satisfaction: t.satisfaction?.rating ? { rating: t.satisfaction.rating, feedback: t.satisfaction.feedback } : null,
  messages: (t.messages || []).map((m) => ({
    _id: m._id,
    from: m.senderType === "Admin" ? "support" : "you",
    content: m.content,
    createdAt: m.createdAt,
  })),
});

const findOwn = async (user, id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Ticket not found", 404);
  const ticket = await SupportTicket.findOne({ _id: id, user: user._id });
  if (!ticket) throw new AppError("Ticket not found", 404);
  return ticket;
};

const text = (value, max, label) => {
  if (typeof value !== "string" || !value.trim()) throw new AppError(`${label} is required`, 400);
  return value.trim().slice(0, max);
};

export const createTicket = async (user, body = {}) => {
  const subject = text(body.subject, 200, "A subject");
  const description = text(body.description, 5000, "A description");
  const category = CATEGORIES.includes(body.category) ? body.category : "general";
  const open = await SupportTicket.countDocuments({ user: user._id, status: { $in: ["open", "in_progress"] } });
  if (open >= 20) throw new AppError("You have 20 open tickets. Please wait for replies before opening more.", 429);

  const source = await prioritySupportFor(user);
  const now = Date.now();
  const ticket = await SupportTicket.create({
    user: user._id,
    subject,
    description,
    category,
    priority: source ? "high" : "medium",
    isPriority: !!source,
    prioritySource: source || undefined,
    relatedEvent: mongoose.isValidObjectId(body.relatedEvent) ? body.relatedEvent : undefined,
    relatedVendor: mongoose.isValidObjectId(body.relatedVendor) ? body.relatedVendor : undefined,
    messages: [{ sender: user._id, senderType: "User", content: description }],
    sla: {
      firstResponseDue: new Date(now + (source ? 4 : 24) * HOURS),
      resolutionDue: new Date(now + (source ? 48 : 120) * HOURS),
    },
  });
  return shape(ticket);
};

export const listTickets = async (user, { status } = {}) => {
  const query = { user: user._id };
  if (["open", "in_progress", "resolved", "closed"].includes(status)) query.status = status;
  const tickets = await SupportTicket.find(query).sort({ updatedAt: -1 }).limit(100);
  return { tickets: tickets.map((t) => ({ ...shape(t), messages: undefined, messageCount: t.messages.length })), priority: await prioritySupportFor(user) };
};

export const getTicket = async (user, id) => shape(await findOwn(user, id));

/** Reply; a resolved ticket reopens, a closed one can't take replies */
export const replyToTicket = async (user, id, content) => {
  const ticket = await findOwn(user, id);
  if (ticket.status === "closed") throw new AppError("This ticket is closed. Please open a new one.", 400);
  ticket.messages.push({ sender: user._id, senderType: "User", content: text(content, 5000, "A message") });
  if (ticket.status === "resolved") ticket.status = "open";
  await ticket.save();
  return shape(ticket);
};

export const closeTicket = async (user, id) => {
  const ticket = await findOwn(user, id);
  ticket.status = "closed";
  await ticket.save();
  return shape(ticket);
};

export const rateTicket = async (user, id, { rating, feedback }) => {
  const ticket = await findOwn(user, id);
  if (!["resolved", "closed"].includes(ticket.status)) throw new AppError("You can rate a ticket once it's resolved", 400);
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) throw new AppError("Rate from 1 to 5", 400);
  ticket.satisfaction = { rating: r, feedback: typeof feedback === "string" ? feedback.slice(0, 1000) : undefined, ratedAt: new Date() };
  await ticket.save();
  return shape(ticket);
};
