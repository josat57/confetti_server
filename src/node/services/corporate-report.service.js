import PDFDocument from "pdfkit";
import { PurchaseRequest } from "../models/organization.model.js";
import VendorBooking from "../models/vendor-booking.model.js";
import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";
import { myOrganization } from "./organization.service.js";

/**
 * Corporate reports (roadmap Phase 11): spending by event, department and vendor
 * over a period, against department budgets, with CSV and PDF export.
 * "Paid" is money paid to vendors in the period; "committed" is approved
 * purchases not yet paid.
 */

const idOf = (v) => String(v?._id || v || "");
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const naira = (n) => `₦${Math.round(n || 0).toLocaleString()}`;

/** Paid and committed per event id (all time), for the events list */
export const spendByEvent = async (eventIds) => {
  const out = new Map();
  if (!eventIds.length) return out;
  const bookings = await VendorBooking.find({ event: { $in: eventIds }, status: { $ne: "cancelled" } }).select("event payments").lean();
  const prs = await PurchaseRequest.find({ event: { $in: eventIds }, status: "approved" }).select("event booking amount").lean();
  const paidByBooking = new Map(bookings.map((b) => [idOf(b._id), (b.payments || []).reduce((s, p) => s + (p.amount || 0), 0)]));
  for (const b of bookings) {
    const e = out.get(idOf(b.event)) || { paid: 0, committed: 0 };
    e.paid += paidByBooking.get(idOf(b._id)) || 0;
    out.set(idOf(b.event), e);
  }
  // Committed = approved and not yet paid, per booking
  const approvedByBooking = new Map();
  for (const pr of prs) approvedByBooking.set(idOf(pr.booking), (approvedByBooking.get(idOf(pr.booking)) || 0) + pr.amount);
  for (const pr of prs) {
    const key = idOf(pr.booking);
    if (!approvedByBooking.has(key)) continue;
    const e = out.get(idOf(pr.event)) || { paid: 0, committed: 0 };
    e.committed += Math.max(approvedByBooking.get(key) - (paidByBooking.get(key) || 0), 0);
    approvedByBooking.delete(key);
    out.set(idOf(pr.event), e);
  }
  return out;
};

class CorporateReportService {
  /** { from, to } (dates); defaults to this calendar year */
  async build(user, { from, to } = {}) {
    const { org } = await myOrganization(user, { roles: ["admin", "approver"] });
    const year = new Date().getFullYear();
    const start = from ? new Date(from) : new Date(year, 0, 1);
    const end = to ? new Date(to) : new Date(year + 1, 0, 1);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new AppError("Choose a valid period", 400);
    if (to) end.setHours(23, 59, 59, 999);

    const events = await Event.find({ organization: org._id }).select("title department startDate").lean();
    const eventBy = new Map(events.map((e) => [idOf(e._id), e]));
    const bookings = await VendorBooking.find({ event: { $in: events.map((e) => e._id) } })
      .select("event vendor payments status totalAmount")
      .populate("vendor", "businessName name category")
      .lean();

    const rows = []; // one per payment in the period
    for (const b of bookings) {
      for (const p of b.payments || []) {
        const at = new Date(p.paidAt || 0);
        if (at < start || at > end || !(p.amount > 0)) continue;
        const ev = eventBy.get(idOf(b.event));
        rows.push({
          date: at,
          event: ev?.title || "Event",
          eventId: idOf(b.event),
          department: ev?.department || "Unassigned",
          vendor: b.vendor?.businessName || b.vendor?.name || "Vendor",
          vendorId: idOf(b.vendor),
          category: b.vendor?.category || "",
          amount: p.amount,
          method: p.method === "confetti_escrow" ? "Confetti" : p.method || "",
        });
      }
    }
    const group = (key, label) => {
      const map = new Map();
      for (const r of rows) {
        const g = map.get(r[key]) || { key: r[key], name: r[label], paid: 0, payments: 0 };
        g.paid += r.amount;
        g.payments++;
        map.set(r[key], g);
      }
      return [...map.values()].sort((a, b) => b.paid - a.paid);
    };

    const committed = await spendByEvent(events.map((e) => e._id));
    const byEvent = group("eventId", "event").map((g) => ({ ...g, department: eventBy.get(g.key)?.department || "Unassigned", committed: committed.get(g.key)?.committed || 0 }));
    const byVendor = group("vendorId", "vendor");
    const byDepartment = group("department", "department").map((g) => {
      const budget = org.budgets.find((b) => (b.department || "Unassigned") === g.key && b.year === start.getFullYear());
      return { ...g, budget: budget?.amount ?? null, remaining: budget ? budget.amount - g.paid : null };
    });
    // Departments with a budget but no spending yet
    for (const b of org.budgets.filter((x) => x.year === start.getFullYear())) {
      const key = b.department || "Unassigned";
      if (!byDepartment.some((d) => d.key === key)) byDepartment.push({ key, name: key, paid: 0, payments: 0, budget: b.amount, remaining: b.amount });
    }
    const pending = await PurchaseRequest.aggregate([
      { $match: { organization: org._id, status: "pending" } },
      { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    return {
      organization: { name: org.legalName || org.name },
      period: { from: start, to: end },
      totals: {
        paid: rows.reduce((s, r) => s + r.amount, 0),
        payments: rows.length,
        committed: [...committed.values()].reduce((s, c) => s + c.committed, 0),
        pendingApproval: pending[0]?.amount || 0,
        pendingCount: pending[0]?.count || 0,
      },
      byEvent,
      byDepartment,
      byVendor,
      payments: rows.sort((a, b) => b.date - a.date),
    };
  }

  async csv(user, query) {
    const r = await this.build(user, query);
    const lines = [["Date", "Event", "Department", "Vendor", "Category", "Amount (NGN)", "Paid via"]];
    for (const p of r.payments) lines.push([p.date.toISOString().slice(0, 10), p.event, p.department, p.vendor, p.category, p.amount, p.method]);
    lines.push([]);
    lines.push(["Department", "Paid", "Budget", "Remaining"]);
    for (const d of r.byDepartment) lines.push([d.name, d.paid, d.budget ?? "", d.remaining ?? ""]);
    return lines.map((l) => l.map(csvCell).join(",")).join("\n");
  }

  async pdf(user, query, res) {
    const r = await this.build(user, query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="spending-report.pdf"');
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);
    doc.fontSize(18).text(`${r.organization.name}: spending report`);
    doc.fontSize(10).fillColor("#555").text(`${r.period.from.toDateString()} to ${r.period.to.toDateString()}`).fillColor("#000").moveDown();
    doc.fontSize(11).text(`Paid to vendors: ${naira(r.totals.paid)} (${r.totals.payments} payments)`);
    doc.text(`Approved, not yet paid: ${naira(r.totals.committed)}`);
    doc.text(`Waiting for approval: ${naira(r.totals.pendingApproval)} (${r.totals.pendingCount})`).moveDown();
    const section = (title, items, line) => {
      doc.fontSize(13).text(title).moveDown(0.2).fontSize(10);
      if (!items.length) doc.fillColor("#555").text("Nothing in this period").fillColor("#000");
      for (const i of items) doc.text(line(i));
      doc.moveDown();
    };
    section("By department", r.byDepartment, (d) => `${d.name}: ${naira(d.paid)}${d.budget !== null ? ` of ${naira(d.budget)} budget (${naira(d.remaining)} left)` : ""}`);
    section("By event", r.byEvent, (e) => `${e.name} (${e.department}): ${naira(e.paid)}${e.committed ? `, ${naira(e.committed)} committed` : ""}`);
    section("By vendor", r.byVendor, (v) => `${v.name}: ${naira(v.paid)} (${v.payments})`);
    doc.end();
  }
}

export default new CorporateReportService();
