import mongoose from "mongoose";
import { Organization, PurchaseRequest, nextNumber } from "../models/organization.model.js";
import VendorBooking from "../models/vendor-booking.model.js";
import Event from "../models/event.model.js";
import Notification from "../models/notification.model.js";
import { AppError } from "../utils/AppError.js";
import { myOrganization, assertContract, orgForEvent } from "./organization.service.js";

/**
 * Buying from vendors with approvals (roadmap Phase 11). A booking on a company
 * event needs an approved purchase request before the vendor can confirm it or
 * anyone can pay for it. Requesters can't approve their own requests; amounts at
 * or under the company's approval limit are approved automatically. Every step
 * is logged.
 */

const idOf = (v) => String(v?._id || v || "");
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const naira = (n) => `₦${Math.round(n || 0).toLocaleString()}`;

const notify = (recipient, title, message) =>
  Notification.createNotification({ recipient, type: "info", category: "payment", title, message, actionUrl: "/company/approvals" }).catch(() => {});

const shape = (pr) => ({
  _id: pr._id,
  number: pr.number,
  event: pr.event,
  booking: pr.booking,
  vendor: pr.vendor,
  department: pr.department,
  description: pr.description,
  amount: pr.amount,
  currency: pr.currency,
  requestedBy: pr.requestedBy,
  status: pr.status,
  autoApproved: pr.autoApproved,
  decidedBy: pr.decidedBy,
  decidedAt: pr.decidedAt,
  decisionNote: pr.decisionNote,
  log: pr.log,
  createdAt: pr.createdAt,
});

/** Approved spending on a booking (naira) */
const approvedAmount = async (bookingId) => {
  const prs = await PurchaseRequest.find({ booking: bookingId, status: "approved" }).select("amount").lean();
  return prs.reduce((s, p) => s + p.amount, 0);
};

/**
 * Throws unless the booking (when it's on a company event) has approved spending
 * that covers `alsoPaying` on top of what's already paid.
 */
export const assertPurchaseApproved = async (booking, { alsoPaying = 0, action = "pay for" } = {}) => {
  if (!booking?.event) return;
  const org = await orgForEvent(booking.event);
  if (!org) return;
  const approved = await approvedAmount(booking._id);
  const paid = (booking.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  if (approved <= 0 || paid + alsoPaying > approved + 0.01) {
    const error = new AppError(
      approved <= 0
        ? `${org.name} needs to approve this purchase before you can ${action} it`
        : `${org.name} has approved ${naira(approved)} for this booking; this would go over it. Ask for a new approval.`,
      403
    );
    error.code = "APPROVAL_REQUIRED";
    error.details = { approved, paid };
    throw error;
  }
};

/**
 * Accepting a vendor's quote for a company event (the public quote link) needs an
 * approval that covers the quote's total.
 */
export const assertQuoteApproved = async (quote) => {
  const or = [{ quoteRef: quote._id }];
  if (quote.lead) or.push({ lead: quote.lead });
  const bookings = await VendorBooking.find({ $or: or, event: { $exists: true, $ne: null } }).select("event payments").lean();
  for (const booking of bookings) {
    const org = await orgForEvent(booking.event);
    if (!org) continue;
    const approved = await approvedAmount(booking._id);
    if (approved + 0.01 < (quote.total || 0)) {
      const error = new AppError(
        approved <= 0
          ? `${org.name} needs to approve this purchase before the quote can be accepted`
          : `${org.name} has approved ${naira(approved)}; this quote is ${naira(quote.total)}. Ask for a new approval.`,
        403
      );
      error.code = "APPROVAL_REQUIRED";
      error.details = { approved, quoteTotal: quote.total };
      throw error;
    }
  }
};

class PurchaseService {
  async list(user, { status, mine } = {}) {
    const { org, member } = await myOrganization(user);
    const query = { organization: org._id };
    if (member.role === "requester" || mine === "true") query.requestedBy = user._id;
    if (["pending", "approved", "rejected", "cancelled"].includes(status)) query.status = status;
    const prs = await PurchaseRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("event", "title")
      .populate("vendor", "businessName name")
      .populate("requestedBy", "firstName lastName email")
      .populate("decidedBy", "firstName lastName")
      .lean();
    return prs.map(shape);
  }

  async get(user, id) {
    const { org, member } = await myOrganization(user);
    if (!mongoose.isValidObjectId(id)) throw new AppError("Request not found", 404);
    const pr = await PurchaseRequest.findOne({ _id: id, organization: org._id })
      .populate("event", "title")
      .populate("vendor", "businessName name")
      .populate("requestedBy", "firstName lastName email")
      .populate("log.by", "firstName lastName");
    if (!pr || (member.role === "requester" && idOf(pr.requestedBy) !== idOf(user._id))) throw new AppError("Request not found", 404);
    return shape(pr);
  }

  /** { bookingId, amount?, description } */
  async create(user, body = {}) {
    const { org, member } = await myOrganization(user);
    assertContract(org);
    if (!mongoose.isValidObjectId(body.bookingId)) throw new AppError("Booking not found", 404);
    const booking = await VendorBooking.findById(body.bookingId).select("event vendor totalAmount quote payments status");
    if (!booking?.event) throw new AppError("Booking not found", 404);
    const event = await Event.findOne({ _id: booking.event, organization: org._id }).select("title department createdBy");
    if (!event) throw new AppError("Booking not found", 404);
    if (member.role === "requester" && idOf(event.createdBy) !== idOf(user._id)) throw new AppError("Booking not found", 404);
    if (booking.status === "cancelled") throw new AppError("This booking was cancelled", 400);
    if (await PurchaseRequest.exists({ booking: booking._id, status: "pending" })) throw new AppError("There's already a request waiting for approval", 400);

    const quoted = booking.totalAmount ?? booking.quote?.amount;
    const amount = body.amount !== undefined && body.amount !== "" ? Number(body.amount) : quoted;
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError("Enter the amount to approve", 400);

    const pr = new PurchaseRequest({
      organization: org._id,
      number: await nextNumber("PR"),
      event: event._id,
      booking: booking._id,
      vendor: booking.vendor,
      department: event.department || member.department,
      description: str(body.description, 2000),
      amount,
      requestedBy: user._id,
      log: [{ action: "requested", by: user._id, note: `${naira(amount)}${quoted ? ` (quote ${naira(quoted)})` : ""}` }],
    });
    // Small purchases are approved automatically
    if (org.approvalThreshold > 0 && amount <= org.approvalThreshold) {
      pr.status = "approved";
      pr.autoApproved = true;
      pr.decidedAt = new Date();
      pr.log.push({ action: "auto_approved", note: `At or under the ${naira(org.approvalThreshold)} limit` });
    }
    await pr.save();
    if (pr.status === "pending") {
      for (const m of org.members.filter((x) => ["admin", "approver"].includes(x.role) && idOf(x.user) !== idOf(user._id))) {
        await notify(m.user, "Purchase waiting for approval", `${pr.number}: ${naira(amount)} for ${event.title}`);
      }
    }
    return shape(pr);
  }

  async decide(user, id, decision, note) {
    const { org } = await myOrganization(user, { roles: ["admin", "approver"] });
    if (!mongoose.isValidObjectId(id)) throw new AppError("Request not found", 404);
    const pr = await PurchaseRequest.findOne({ _id: id, organization: org._id });
    if (!pr) throw new AppError("Request not found", 404);
    if (pr.status !== "pending") throw new AppError(`This request is already ${pr.status}`, 400);
    if (idOf(pr.requestedBy) === idOf(user._id)) throw new AppError("Someone else has to approve your own request", 403);
    const reason = str(note, 1000);
    if (decision === "rejected" && !reason) throw new AppError("Say why it's rejected", 400);
    // Claim it atomically so two approvers can't both decide
    const updated = await PurchaseRequest.findOneAndUpdate(
      { _id: pr._id, status: "pending" },
      {
        $set: { status: decision, decidedBy: user._id, decidedAt: new Date(), decisionNote: reason },
        $push: { log: { action: decision, by: user._id, note: reason } },
      },
      { new: true }
    );
    if (!updated) throw new AppError("This request was just decided by someone else", 409);
    await notify(
      pr.requestedBy,
      decision === "approved" ? "Purchase approved" : "Purchase rejected",
      `${pr.number}: ${naira(pr.amount)}${reason ? ` — ${reason}` : ""}`
    );
    return shape(updated);
  }

  async cancel(user, id) {
    const { org, member } = await myOrganization(user);
    if (!mongoose.isValidObjectId(id)) throw new AppError("Request not found", 404);
    const pr = await PurchaseRequest.findOne({ _id: id, organization: org._id });
    if (!pr) throw new AppError("Request not found", 404);
    if (idOf(pr.requestedBy) !== idOf(user._id) && member.role !== "admin") throw new AppError("Request not found", 404);
    if (pr.status === "cancelled" || pr.status === "rejected") throw new AppError(`This request is already ${pr.status}`, 400);
    if (pr.status === "approved") {
      const booking = await VendorBooking.findById(pr.booking).select("payments");
      const paid = (booking?.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      if (paid > 0) throw new AppError("Money has already been paid against this approval", 400);
    }
    pr.status = "cancelled";
    pr.log.push({ action: "cancelled", by: user._id });
    await pr.save();
    return shape(pr);
  }
}

export default new PurchaseService();
