import crypto from "crypto";
import mongoose from "mongoose";
import { Organization, ORG_ROLES } from "../models/organization.model.js";
import User from "../models/user.model.js";
import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";

/**
 * Corporate accounts (roadmap Phase 11): the company, its members and roles,
 * departments and budgets, and its events.
 * Roles: admin (everything), approver (approves purchases, sees reports),
 * requester (creates events and purchase requests).
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MEMBERS = 200;
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const idOf = (v) => String(v?._id || v || "");
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const forbidden = (message = "Only company admins can do this") => new AppError(message, 403);

export const contractActive = (org) => org?.contract?.status === "active" && new Date(org.contract.endsAt) > new Date();

const MAX_COMPANIES_PER_USER = 10;

/**
 * The company the user is working in, and their membership, or 404.
 * People can belong to several companies (planners often serve more than one);
 * the app sends the chosen one as `user.activeOrganization` (X-Organization-Id).
 * Without a choice, the one they joined first is used.
 */
export const myOrganization = async (user, { roles } = {}) => {
  let org = null;
  if (user.activeOrganization && mongoose.isValidObjectId(String(user.activeOrganization))) {
    org = await Organization.findOne({ _id: user.activeOrganization, "members.user": user._id });
  }
  if (!org) org = await Organization.findOne({ "members.user": user._id }).sort({ createdAt: 1 });
  if (!org) throw new AppError("You're not part of a company account", 404);
  const member = org.memberFor(user._id);
  if (roles && !roles.includes(member.role)) throw forbidden(roles.includes("approver") ? "Only approvers and admins can do this" : undefined);
  return { org, member };
};

/** Corporate features need an active contract */
export const assertContract = (org) => {
  if (!contractActive(org)) {
    const error = new AppError("Your company's Corporate contract isn't active. An admin can arrange it under Billing.", 403);
    error.code = "CONTRACT_REQUIRED";
    throw error;
  }
};

/** Organization of an event, when it's a corporate event with an active contract */
export const activeOrgForEvent = async (eventId) => {
  if (!eventId || !mongoose.isValidObjectId(String(eventId._id || eventId))) return null;
  const event = await Event.findById(eventId._id || eventId).select("organization").lean();
  if (!event?.organization) return null;
  const org = await Organization.findById(event.organization).select("contract name").lean();
  return contractActive(org) ? org : null;
};

/** The organization an event belongs to (any contract state) */
export const orgForEvent = async (eventId) => {
  if (!eventId) return null;
  const event = await Event.findById(eventId._id || eventId).select("organization").lean();
  return event?.organization ? Organization.findById(event.organization) : null;
};

const details = (body) => {
  const out = {};
  for (const [key, max] of [["name", 200], ["legalName", 200], ["rcNumber", 40], ["vatNumber", 40], ["phone", 40]]) {
    if (body[key] !== undefined) out[key] = str(body[key], max) || undefined;
  }
  if (body.billingEmail !== undefined) {
    const email = str(body.billingEmail, 160)?.toLowerCase();
    if (email && !EMAIL.test(email)) throw new AppError("Enter a valid billing email", 400);
    out.billingEmail = email || undefined;
  }
  if (body.address && typeof body.address === "object") {
    for (const key of ["street", "city", "state", "country"]) {
      if (body.address[key] !== undefined) out[`address.${key}`] = str(body.address[key], key === "street" ? 200 : 80) || undefined;
    }
  }
  if (body.approvalThreshold !== undefined) {
    const n = Number(body.approvalThreshold);
    if (!Number.isFinite(n) || n < 0) throw new AppError("Enter a valid approval limit", 400);
    out.approvalThreshold = n;
  }
  return out;
};

/** The company as its members see it */
export const shapeOrg = (org, member) => ({
  _id: org._id,
  name: org.name,
  legalName: org.legalName,
  rcNumber: org.rcNumber,
  vatNumber: org.vatNumber,
  billingEmail: org.billingEmail,
  phone: org.phone,
  address: org.address,
  departments: org.departments,
  budgets: org.budgets,
  approvalThreshold: org.approvalThreshold,
  contract: {
    status: contractActive(org) ? "active" : org.contract?.status === "active" ? "expired" : org.contract?.status || "none",
    amount: org.contract?.amount,
    startsAt: org.contract?.startsAt,
    endsAt: org.contract?.endsAt,
    requestedAt: org.contract?.requestedAt,
  },
  me: member ? { role: member.role, department: member.department } : null,
  memberCount: org.members.length,
});

class OrganizationService {
  async create(user, body = {}) {
    if (user.role === "vendor") throw new AppError("Vendors can't create a company account", 400);
    if ((await Organization.countDocuments({ "members.user": user._id })) >= MAX_COMPANIES_PER_USER) {
      throw new AppError(`You can be part of up to ${MAX_COMPANIES_PER_USER} company accounts`, 400);
    }
    const name = str(body.name, 200);
    if (!name) throw new AppError("Enter the company name", 400);
    const org = new Organization({ name, createdBy: user._id, members: [{ user: user._id, role: "admin" }], departments: [] });
    for (const [k, v] of Object.entries(details({ ...body, name }))) org.set(k, v);
    if (!org.billingEmail) org.billingEmail = user.email;
    const departments = Array.isArray(body.departments) ? body.departments.map((d) => str(d, 80)).filter(Boolean) : [];
    org.departments = [...new Set(departments)].slice(0, 50);
    await org.save();
    return shapeOrg(org, org.memberFor(user._id));
  }

  /** Every company the user belongs to (for the company switcher) */
  async listMine(user) {
    const orgs = await Organization.find({ "members.user": user._id }).sort({ createdAt: 1 }).lean();
    return orgs.map((o) => {
      const m = o.members.find((x) => idOf(x.user) === idOf(user._id));
      return { _id: o._id, name: o.name, role: m?.role, contractActive: contractActive(o) };
    });
  }

  async get(user) {
    const { org, member } = await myOrganization(user);
    return shapeOrg(org, member);
  }

  async update(user, body = {}) {
    const { org, member } = await myOrganization(user, { roles: ["admin"] });
    for (const [k, v] of Object.entries(details(body))) org.set(k, v);
    if (body.name !== undefined && !org.name) throw new AppError("Enter the company name", 400);
    if (Array.isArray(body.departments)) {
      org.departments = [...new Set(body.departments.map((d) => str(d, 80)).filter(Boolean))].slice(0, 50);
    }
    await org.save();
    return shapeOrg(org, member);
  }

  /** PUT budgets: [{ department, year, amount }] (replaces the year's budgets given) */
  async setBudgets(user, { budgets } = {}) {
    const { org, member } = await myOrganization(user, { roles: ["admin"] });
    if (!Array.isArray(budgets)) throw new AppError("Send the budgets as a list", 400);
    const clean = budgets.map((b) => {
      const year = Number(b?.year);
      const amount = Number(b?.amount);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError("Each budget needs a year", 400);
      if (!Number.isFinite(amount) || amount < 0) throw new AppError("Each budget needs an amount", 400);
      const department = str(b?.department, 80) || undefined;
      if (department && !org.departments.includes(department)) org.departments.push(department);
      return { department, year, amount };
    });
    const years = new Set(clean.map((b) => b.year));
    org.budgets = [...org.budgets.filter((b) => !years.has(b.year)), ...clean];
    await org.save();
    return shapeOrg(org, member);
  }

  // ---- Members ----

  async members(user) {
    const { org } = await myOrganization(user);
    await org.populate("members.user", "firstName lastName email username");
    return {
      members: org.members.map((m) => ({
        user: { _id: m.user?._id, name: [m.user?.firstName, m.user?.lastName].filter(Boolean).join(" ") || m.user?.username, email: m.user?.email },
        role: m.role,
        department: m.department,
        addedAt: m.addedAt,
      })),
      invites: org.invites.filter((i) => i.status === "pending").map((i) => ({ _id: i._id, email: i.email, role: i.role, department: i.department, createdAt: i.createdAt })),
    };
  }

  async invite(user, { email, role = "requester", department } = {}) {
    const { org } = await myOrganization(user, { roles: ["admin"] });
    const address = str(email, 160)?.toLowerCase();
    if (!address || !EMAIL.test(address)) throw new AppError("Enter a valid email address", 400);
    if (!ORG_ROLES.includes(role)) throw new AppError("Choose admin, approver or requester", 400);
    if (org.members.length + org.invites.filter((i) => i.status === "pending").length >= MAX_MEMBERS) {
      throw new AppError(`Up to ${MAX_MEMBERS} people per company`, 400);
    }
    const existingUser = await User.findOne({ email: address }).select("_id").lean();
    if (existingUser && org.memberFor(existingUser._id)) throw new AppError("They're already a member", 400);
    let invite = org.invites.find((i) => i.email === address && i.status === "pending");
    if (!invite) {
      org.invites.push({ email: address, role, department: str(department, 80), token: crypto.randomBytes(24).toString("hex"), invitedBy: user._id });
      invite = org.invites.at(-1);
    } else {
      invite.role = role;
      invite.department = str(department, 80);
    }
    if (invite.department && !org.departments.includes(invite.department)) org.departments.push(invite.department);
    await org.save();
    const link = `${frontendUrl()}/company/join/${invite.token}`;
    await sendEmailDirect({
      to: address,
      subject: `Join ${org.name} on Confetti`,
      html: `<p>Hello,</p>
        <p>${escapeHtml([user.firstName, user.lastName].filter(Boolean).join(" ") || "A colleague")} invited you to ${escapeHtml(org.name)}'s company account on Confetti as ${role === "admin" ? "an admin" : `a${role === "approver" ? "n approver" : " requester"}`}.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Accept the invitation</a></p>
        <p style="color:#6b7280;font-size:12px">Sign in (or create an account) with this email address to accept.</p>`,
    }).catch((error) => logger.warn("Company invite email failed", { error: error.message }));
    return { invite: { _id: invite._id, email: invite.email, role: invite.role, department: invite.department }, link };
  }

  async revokeInvite(user, inviteId) {
    const { org } = await myOrganization(user, { roles: ["admin"] });
    const invite = org.invites.id(inviteId);
    if (!invite || invite.status !== "pending") throw new AppError("Invite not found", 404);
    invite.status = "revoked";
    await org.save();
    return { revoked: true };
  }

  async previewInvite(token) {
    if (!/^[a-f0-9]{48}$/.test(String(token))) throw new AppError("This invitation isn't valid", 404);
    const org = await Organization.findOne({ invites: { $elemMatch: { token, status: "pending" } } }).select("name invites");
    if (!org) throw new AppError("This invitation isn't valid", 404);
    const invite = org.invites.find((i) => i.token === token);
    return { organization: org.name, email: invite.email, role: invite.role };
  }

  /** Accept with the account the invite was sent to */
  async acceptInvite(user, token) {
    if (!/^[a-f0-9]{48}$/.test(String(token))) throw new AppError("This invitation isn't valid", 404);
    const org = await Organization.findOne({ invites: { $elemMatch: { token, status: "pending" } } });
    if (!org) throw new AppError("This invitation isn't valid", 404);
    const invite = org.invites.find((i) => i.token === token);
    if (String(user.email).toLowerCase() !== invite.email) {
      throw new AppError(`This invitation is for ${invite.email}. Sign in with that email to accept it.`, 403);
    }
    if (user.role === "vendor") throw new AppError("Vendor accounts can't join a company account", 400);
    if (!org.memberFor(user._id) && (await Organization.countDocuments({ "members.user": user._id })) >= MAX_COMPANIES_PER_USER) {
      throw new AppError(`You can be part of up to ${MAX_COMPANIES_PER_USER} company accounts`, 400);
    }
    if (!org.memberFor(user._id)) org.members.push({ user: user._id, role: invite.role, department: invite.department });
    invite.status = "accepted";
    await org.save();
    return shapeOrg(org, org.memberFor(user._id));
  }

  async updateMember(user, memberUserId, { role, department } = {}) {
    const { org } = await myOrganization(user, { roles: ["admin"] });
    const member = org.memberFor(memberUserId);
    if (!member) throw new AppError("Member not found", 404);
    if (role !== undefined) {
      if (!ORG_ROLES.includes(role)) throw new AppError("Choose admin, approver or requester", 400);
      if (member.role === "admin" && role !== "admin" && org.members.filter((m) => m.role === "admin").length === 1) {
        throw new AppError("The company needs at least one admin", 400);
      }
      member.role = role;
    }
    if (department !== undefined) {
      member.department = str(department, 80) || undefined;
      if (member.department && !org.departments.includes(member.department)) org.departments.push(member.department);
    }
    await org.save();
    return this.members(user);
  }

  async removeMember(user, memberUserId) {
    const { org } = await myOrganization(user, { roles: ["admin"] });
    const member = org.memberFor(memberUserId);
    if (!member) throw new AppError("Member not found", 404);
    if (member.role === "admin" && org.members.filter((m) => m.role === "admin").length === 1) {
      throw new AppError("The company needs at least one admin", 400);
    }
    member.deleteOne();
    await org.save();
    return this.members(user);
  }

  // ---- Events and budgets ----

  /** The company's events with their budgets and spending (requesters see their own) */
  async events(user, { department } = {}) {
    const { org, member } = await myOrganization(user);
    const query = { organization: org._id };
    if (member.role === "requester") query.createdBy = user._id;
    if (department) query.department = String(department);
    const events = await Event.find(query).select("title eventType startDate endDate status department createdBy budget guestCount").sort({ startDate: -1 }).limit(500).lean();
    const { spendByEvent } = await import("./corporate-report.service.js");
    const spend = await spendByEvent(events.map((e) => e._id));
    const Budget = (await import("../models/budget.model.js")).default;
    const budgets = await Budget.find({ event: { $in: events.map((e) => e._id) } }).select("event totalBudget").lean();
    const budgetBy = new Map(budgets.map((b) => [idOf(b.event), b.totalBudget]));
    return events.map((e) => ({
      _id: e._id,
      title: e.title,
      eventType: e.eventType,
      startDate: e.startDate,
      status: e.status,
      department: e.department,
      guestCount: e.guestCount,
      budget: budgetBy.get(idOf(e._id)) ?? e.budget?.amount ?? null,
      spent: spend.get(idOf(e._id))?.paid || 0,
      committed: spend.get(idOf(e._id))?.committed || 0,
      mine: idOf(e.createdBy) === idOf(user._id),
    }));
  }

  /** A new event under the company (needs an active contract) */
  async createEvent(user, body = {}) {
    const { org, member } = await myOrganization(user);
    assertContract(org);
    const title = str(body.title, 200);
    if (!title) throw new AppError("Name the event", 400);
    const start = new Date(body.startDate);
    if (!body.startDate || Number.isNaN(start.getTime())) throw new AppError("Choose a start date", 400);
    const end = body.endDate ? new Date(body.endDate) : new Date(start.getTime() + 8 * 3600000);
    if (Number.isNaN(end.getTime()) || end < start) throw new AppError("The end is before the start", 400);
    const department = str(body.department, 80) || member.department;
    if (department && !org.departments.includes(department)) throw new AppError("Unknown department", 400);
    const event = await Event.create({
      title,
      description: str(body.description, 5000) || title,
      eventType: "corporate",
      startDate: start,
      endDate: end,
      createdBy: user._id,
      organizer: user._id,
      organization: org._id,
      department,
      guestCount: Number(body.guestCount) > 0 ? Math.floor(Number(body.guestCount)) : undefined,
      location: body.city ? { address: { city: str(body.city, 80), state: str(body.state, 80) } } : undefined,
      budget: Number(body.budget) > 0 ? { amount: Number(body.budget), currency: "NGN" } : undefined,
      status: "draft",
    });
    if (Number(body.budget) > 0) {
      const Budget = (await import("../models/budget.model.js")).default;
      await Budget.create({ event: event._id, planner: user._id, totalBudget: Number(body.budget), currency: "NGN" }).catch((error) =>
        logger.warn("Corporate event budget failed", { error: error.message })
      );
    }
    return event;
  }

  /** Move an existing event (that the user created) under the company */
  async attachEvent(user, eventId, { department } = {}) {
    const { org, member } = await myOrganization(user);
    assertContract(org);
    if (!mongoose.isValidObjectId(eventId)) throw new AppError("Event not found", 404);
    const event = await Event.findOne({ _id: eventId, createdBy: user._id });
    if (!event) throw new AppError("Event not found", 404);
    if (event.organization && String(event.organization) !== String(org._id)) throw new AppError("This event belongs to another company", 400);
    event.organization = org._id;
    const dep = str(department, 80) || member.department;
    if (dep && !org.departments.includes(dep)) throw new AppError("Unknown department", 400);
    event.department = dep;
    await event.save({ validateModifiedOnly: true });
    return event;
  }

  /** Bookings on the company's events (to raise purchase requests from) */
  async bookings(user) {
    const { org, member } = await myOrganization(user);
    const eventQuery = { organization: org._id };
    if (member.role === "requester") eventQuery.createdBy = user._id;
    const events = await Event.find(eventQuery).select("_id title department").lean();
    const VendorBooking = (await import("../models/vendor-booking.model.js")).default;
    const { PurchaseRequest } = await import("../models/organization.model.js");
    const bookings = await VendorBooking.find({ event: { $in: events.map((e) => e._id) }, status: { $ne: "cancelled" } })
      .populate("vendor", "businessName name category")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const prs = await PurchaseRequest.find({ booking: { $in: bookings.map((b) => b._id) }, status: { $in: ["pending", "approved"] } })
      .select("booking status amount number")
      .lean();
    const eventBy = new Map(events.map((e) => [idOf(e._id), e]));
    return bookings.map((b) => ({
      _id: b._id,
      vendor: { _id: b.vendor?._id, businessName: b.vendor?.businessName || b.vendor?.name, category: b.vendor?.category },
      event: { _id: b.event, title: eventBy.get(idOf(b.event))?.title, department: eventBy.get(idOf(b.event))?.department },
      status: b.status,
      amount: b.totalAmount ?? b.quote?.amount ?? null,
      paid: (b.payments || []).reduce((s, p) => s + (p.amount || 0), 0),
      purchaseRequests: prs.filter((p) => idOf(p.booking) === idOf(b._id)).map((p) => ({ _id: p._id, number: p.number, status: p.status, amount: p.amount })),
    }));
  }
}

export default new OrganizationService();
