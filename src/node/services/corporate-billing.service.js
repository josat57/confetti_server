import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { Organization, CorporateInvoice, nextNumber } from "../models/organization.model.js";
import Payment from "../models/payment.model.js";
import EscrowPayment from "../models/escrow-payment.model.js";
import VendorBooking from "../models/vendor-booking.model.js";
import Event from "../models/event.model.js";
import Notification from "../models/notification.model.js";
import { CORPORATE_PLAN } from "../config/plans.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { myOrganization, contractActive } from "./organization.service.js";

/**
 * Corporate billing (roadmap Phase 11): an annual contract (from ₦500,000 a year)
 * invoiced in the company's name with VAT, paid by bank transfer (Confetti marks it
 * received) or by card; receipts in the company's name for vendor payments made
 * through Confetti; renewal invoices 30 days before the contract ends.
 */

const MIN_CONTRACT = CORPORATE_PLAN.priceFrom.NGN;
const vatRate = () => (process.env.CORPORATE_VAT_RATE !== undefined ? Number(process.env.CORPORATE_VAT_RATE) : 0.075);
const DUE_DAYS = 14;
const RENEW_DAYS = 30;
const round2 = (n) => Math.round(n * 100) / 100;
const naira = (n) => `₦${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const idOf = (v) => String(v?._id || v || "");
const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
export const bankDetails = () => ({
  bankName: process.env.CORPORATE_BANK_NAME || null,
  accountName: process.env.CORPORATE_ACCOUNT_NAME || "Confetti",
  accountNumber: process.env.CORPORATE_ACCOUNT_NUMBER || null,
});

const billedTo = (org) => ({
  name: org.legalName || org.name,
  rcNumber: org.rcNumber,
  vatNumber: org.vatNumber,
  email: org.billingEmail,
  address: [org.address?.street, org.address?.city, org.address?.state, org.address?.country].filter(Boolean).join(", "),
});

const shapeInvoice = (i) => ({
  _id: i._id,
  number: i.number,
  kind: i.kind,
  billedTo: i.billedTo,
  items: i.items,
  subtotal: i.subtotal,
  vatRate: i.vatRate,
  vat: i.vat,
  total: i.total,
  currency: i.currency,
  periodStart: i.periodStart,
  periodEnd: i.periodEnd,
  issuedAt: i.issuedAt,
  dueDate: i.dueDate,
  status: i.status,
  paidAt: i.paidAt,
  paymentMethod: i.paymentMethod,
  paymentReference: i.paymentReference,
});

const notifyAdmins = async (org, title, message) => {
  for (const m of org.members.filter((x) => x.role === "admin")) {
    await Notification.createNotification({ recipient: m.user, type: "info", category: "payment", title, message, actionUrl: "/company/billing" }).catch(() => {});
  }
};

class CorporateBillingService {
  // ---- Company side ----

  /** Ask Confetti for a Corporate contract */
  async requestContract(user, { notes } = {}) {
    const { org } = await myOrganization(user, { roles: ["admin"] });
    if (contractActive(org)) throw new AppError("Your contract is already active", 400);
    if (!org.legalName && !org.rcNumber) throw new AppError("Add the company's legal name or RC number first (they go on the invoice)", 400);
    org.contract.status = org.contract.status === "invoiced" ? "invoiced" : "requested";
    org.contract.requestedAt = new Date();
    org.contract.requestNotes = typeof notes === "string" ? notes.trim().slice(0, 2000) : undefined;
    await org.save();
    return { status: org.contract.status };
  }

  async invoices(user) {
    const { org } = await myOrganization(user, { roles: ["admin", "approver"] });
    const invoices = await CorporateInvoice.find({ organization: org._id }).sort({ issuedAt: -1 }).lean();
    return { invoices: invoices.map(shapeInvoice), bank: bankDetails() };
  }

  async findInvoice(org, id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Invoice not found", 404);
    const invoice = await CorporateInvoice.findOne({ _id: id, organization: org._id });
    if (!invoice) throw new AppError("Invoice not found", 404);
    return invoice;
  }

  /** Pay an invoice by card: returns the payment page */
  async payByCard(user, id, { paymentProvider = "flutterwave" } = {}) {
    const { org } = await myOrganization(user, { roles: ["admin"] });
    const invoice = await this.findInvoice(org, id);
    if (invoice.status !== "issued") throw new AppError(`This invoice is ${invoice.status}`, 400);
    if (!["flutterwave", "paystack"].includes(paymentProvider)) throw new AppError("Invalid payment provider", 400);
    const amountMinor = Math.round(invoice.total * 100);
    const reference = `CORP-${Date.now()}-${invoice._id}`;
    const payment = await Payment.create({
      user: user._id,
      corporateInvoice: invoice._id,
      paymentType: "corporate",
      amount: amountMinor,
      currency: "NGN",
      status: "pending",
      paymentMethod: paymentProvider,
      reference,
      transactionId: reference,
    });
    const paymentService = (await import("./payment.service.js")).default;
    const paymentUrl = await paymentService.startProviderCheckout({
      provider: paymentProvider,
      amountMinor,
      currency: "NGN",
      reference,
      email: org.billingEmail || user.email,
      name: org.legalName || org.name,
      redirectUrl: `${paymentService.publicApiUrl()}/api/v1/organizations/callback`,
      title: "Confetti Corporate",
      description: `Invoice ${invoice.number}`,
      meta: { kind: "corporate", paymentId: payment._id.toString(), invoiceId: invoice._id.toString() },
    });
    return { paymentUrl, reference, amount: amountMinor };
  }

  /** Card payment completed (called once per payment by completeSubscriptionPayment) */
  async markPaidFromPayment(paymentId) {
    const payment = await Payment.findById(paymentId);
    if (!payment?.corporateInvoice) return null;
    return this.markPaid(payment.corporateInvoice, { method: "card", reference: payment.reference, payment: payment._id });
  }

  /** Redirect back from the payment page */
  async verifyAndComplete(id, provider) {
    const paymentService = (await import("./payment.service.js")).default;
    const data = await paymentService.verifyProviderTransaction(id, provider);
    const meta = data.meta || data.metadata || {};
    const reference = data.tx_ref || data.reference;
    let payment = null;
    if (meta.paymentId && mongoose.isValidObjectId(meta.paymentId)) payment = await Payment.findById(meta.paymentId);
    if (!payment && reference) payment = await Payment.findOne({ reference });
    if (!payment?.corporateInvoice) throw new AppError("Payment record not found", 404);
    await paymentService.completeSubscriptionPayment(payment._id, { provider, data });
    return CorporateInvoice.findById(payment.corporateInvoice).lean();
  }

  /**
   * Mark an invoice paid (card or bank transfer) and start or extend the contract.
   * Safe to call twice: only the first call changes anything.
   */
  async markPaid(invoiceId, { method, reference, payment } = {}) {
    const invoice = await CorporateInvoice.findOneAndUpdate(
      { _id: invoiceId, status: "issued" },
      { $set: { status: "paid", paidAt: new Date(), paymentMethod: method, paymentReference: reference, ...(payment ? { payment } : {}) } },
      { new: true }
    );
    if (!invoice) {
      const existing = await CorporateInvoice.findById(invoiceId);
      if (!existing) throw new AppError("Invoice not found", 404);
      if (existing.status === "void") throw new AppError("This invoice was cancelled", 400);
      return existing; // already paid
    }
    const org = await Organization.findById(invoice.organization);
    // The paid period: renewals continue from the current end date
    const now = new Date();
    const start = org.contract?.endsAt && org.contract.endsAt > now && invoice.kind === "renewal" ? org.contract.endsAt : invoice.periodStart && invoice.periodStart > now ? invoice.periodStart : now;
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    org.contract.status = "active";
    org.contract.amount = invoice.subtotal;
    if (!(org.contract.startsAt && invoice.kind === "renewal")) org.contract.startsAt = start;
    org.contract.endsAt = end;
    org.contract.renewalInvoicedAt = undefined;
    await org.save();
    invoice.periodStart = start;
    invoice.periodEnd = end;
    await invoice.save();
    await notifyAdmins(org, "Payment received", `Invoice ${invoice.number} is paid. Your Corporate contract runs until ${end.toDateString()}.`);
    return invoice;
  }

  // ---- Confetti admin ----

  async adminList({ status } = {}) {
    const query = {};
    if (["none", "requested", "invoiced", "active", "expired", "cancelled"].includes(status)) query["contract.status"] = status;
    const orgs = await Organization.find(query).sort({ "contract.requestedAt": -1, createdAt: -1 }).limit(500).lean();
    const open = await CorporateInvoice.find({ organization: { $in: orgs.map((o) => o._id) }, status: "issued" }).select("organization number total dueDate").lean();
    return orgs.map((o) => ({
      _id: o._id,
      name: o.name,
      legalName: o.legalName,
      rcNumber: o.rcNumber,
      billingEmail: o.billingEmail,
      members: o.members.length,
      contract: { ...o.contract, active: contractActive(o) },
      openInvoices: open.filter((i) => idOf(i.organization) === idOf(o._id)),
      createdAt: o.createdAt,
    }));
  }

  async adminGet(orgId) {
    if (!mongoose.isValidObjectId(orgId)) throw new AppError("Company not found", 404);
    const org = await Organization.findById(orgId).populate("members.user", "firstName lastName email").lean();
    if (!org) throw new AppError("Company not found", 404);
    const invoices = await CorporateInvoice.find({ organization: org._id }).sort({ issuedAt: -1 }).lean();
    const events = await Event.countDocuments({ organization: org._id });
    return { organization: { ...org, contractActive: contractActive(org) }, invoices: invoices.map(shapeInvoice), events };
  }

  /** Issue an invoice (new contract or renewal): { amount (naira/year, before VAT), startsAt?, kind? } */
  async issueInvoice(orgId, { amount, startsAt, kind = "contract", notes } = {}) {
    const org = await Organization.findById(orgId);
    if (!org) throw new AppError("Company not found", 404);
    const subtotal = Number(amount ?? org.contract?.amount);
    if (!Number.isFinite(subtotal) || subtotal < MIN_CONTRACT) throw new AppError(`Corporate contracts start at ₦${MIN_CONTRACT.toLocaleString()} a year`, 400);
    if (!["contract", "renewal"].includes(kind)) throw new AppError("Unknown invoice type", 400);
    if (await CorporateInvoice.exists({ organization: org._id, status: "issued", kind })) {
      throw new AppError("There's already an unpaid invoice. Void it first to issue a new one.", 400);
    }
    const periodStart = kind === "renewal" && org.contract?.endsAt ? org.contract.endsAt : startsAt ? new Date(startsAt) : new Date();
    if (Number.isNaN(periodStart.getTime())) throw new AppError("Invalid start date", 400);
    const periodEnd = new Date(periodStart);
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    const rate = vatRate();
    const vat = round2(subtotal * rate);
    const invoice = await CorporateInvoice.create({
      organization: org._id,
      number: await nextNumber("CFT"),
      kind,
      billedTo: billedTo(org),
      items: [
        {
          description: `Confetti Corporate ${kind === "renewal" ? "renewal" : "subscription"}, ${periodStart.toDateString()} to ${periodEnd.toDateString()}${notes ? ` (${String(notes).slice(0, 200)})` : ""}`,
          amount: subtotal,
        },
      ],
      subtotal,
      vatRate: rate,
      vat,
      total: round2(subtotal + vat),
      periodStart,
      periodEnd,
      dueDate: new Date(Date.now() + DUE_DAYS * 86400000),
    });
    if (kind === "contract" && !contractActive(org)) org.contract.status = "invoiced";
    org.contract.amount = subtotal;
    if (kind === "renewal") org.contract.renewalInvoicedAt = new Date();
    await org.save();
    await notifyAdmins(org, `Invoice ${invoice.number}`, `${naira(invoice.total)} due ${invoice.dueDate.toDateString()}. Pay by bank transfer or card under Billing.`);
    if (org.billingEmail) {
      const bank = bankDetails();
      await sendEmailDirect({
        to: org.billingEmail,
        subject: `Invoice ${invoice.number} from Confetti`,
        html: `<p>Hello ${String(org.legalName || org.name).replace(/[<>&"']/g, "")},</p>
          <p>Your invoice ${invoice.number} for ${naira(invoice.total)} (VAT included) is due on ${invoice.dueDate.toDateString()}.</p>
          ${bank.accountNumber ? `<p>Bank transfer: ${bank.bankName}, ${bank.accountName}, ${bank.accountNumber}. Use <strong>${invoice.number}</strong> as the reference.</p>` : ""}
          <p><a href="${frontendUrl()}/company/billing">Download the invoice or pay by card</a></p>`,
      }).catch((error) => logger.warn("Corporate invoice email failed", { error: error.message }));
    }
    return shapeInvoice(invoice);
  }

  async adminMarkPaid(invoiceId, { reference } = {}) {
    if (!mongoose.isValidObjectId(invoiceId)) throw new AppError("Invoice not found", 404);
    const invoice = await this.markPaid(invoiceId, { method: "transfer", reference: typeof reference === "string" ? reference.trim().slice(0, 100) : undefined });
    return shapeInvoice(invoice);
  }

  async adminVoid(invoiceId) {
    if (!mongoose.isValidObjectId(invoiceId)) throw new AppError("Invoice not found", 404);
    const invoice = await CorporateInvoice.findOneAndUpdate({ _id: invoiceId, status: "issued" }, { $set: { status: "void" } }, { new: true });
    if (!invoice) throw new AppError("Only unpaid invoices can be voided", 400);
    const org = await Organization.findById(invoice.organization);
    if (org && org.contract.status === "invoiced" && !(await CorporateInvoice.exists({ organization: org._id, status: "issued" }))) {
      org.contract.status = "requested";
      await org.save();
    }
    return shapeInvoice(invoice);
  }

  async adminCancelContract(orgId) {
    const org = await Organization.findById(orgId);
    if (!org) throw new AppError("Company not found", 404);
    org.contract.status = "cancelled";
    org.contract.endsAt = new Date();
    await org.save();
    return { status: "cancelled" };
  }

  // ---- Receipts for vendor payments, in the company's name ----

  async receipts(user) {
    const { org } = await myOrganization(user, { roles: ["admin", "approver"] });
    const events = await Event.find({ organization: org._id }).select("_id title").lean();
    const bookings = await VendorBooking.find({ event: { $in: events.map((e) => e._id) } }).select("_id event vendor").populate("vendor", "businessName name").lean();
    const escrows = await EscrowPayment.find({ booking: { $in: bookings.map((b) => b._id) }, status: { $in: ["held", "released", "refunded", "disputed"] } })
      .sort({ paidAt: -1 })
      .lean();
    const bookingBy = new Map(bookings.map((b) => [idOf(b._id), b]));
    const eventBy = new Map(events.map((e) => [idOf(e._id), e]));
    return escrows.map((e) => {
      const b = bookingBy.get(idOf(e.booking));
      return {
        _id: e._id,
        number: `RCT-${idOf(e._id).slice(-8).toUpperCase()}`,
        paidAt: e.paidAt,
        amount: e.amount / 100,
        refunded: (e.refund?.amount || 0) / 100,
        vendor: b?.vendor?.businessName || b?.vendor?.name,
        event: eventBy.get(idOf(b?.event))?.title,
        status: e.status,
      };
    });
  }

  // ---- PDFs ----

  async invoicePdf(user, id, res) {
    const { org } = await myOrganization(user, { roles: ["admin", "approver"] });
    const invoice = await this.findInvoice(org, id);
    this.renderInvoice(invoice, res);
  }

  async adminInvoicePdf(id, res) {
    if (!mongoose.isValidObjectId(id)) throw new AppError("Invoice not found", 404);
    const invoice = await CorporateInvoice.findById(id);
    if (!invoice) throw new AppError("Invoice not found", 404);
    this.renderInvoice(invoice, res);
  }

  pdfHeader(doc, title, number) {
    doc.fontSize(22).fillColor("#4f46e5").text("Confetti", { continued: false });
    doc.fontSize(9).fillColor("#555").text(process.env.CONFETTI_LEGAL_NAME || "Confetti Events Ltd");
    if (process.env.CONFETTI_RC_NUMBER) doc.text(`RC ${process.env.CONFETTI_RC_NUMBER}`);
    if (process.env.CONFETTI_VAT_NUMBER) doc.text(`VAT/TIN ${process.env.CONFETTI_VAT_NUMBER}`);
    doc.moveDown().fillColor("#000").fontSize(16).text(`${title} ${number}`);
  }

  pdfBilledTo(doc, to) {
    doc.moveDown(0.5).fontSize(10).fillColor("#555").text("Billed to").fillColor("#000").fontSize(11);
    doc.text(to.name || "");
    if (to.rcNumber) doc.fontSize(9).text(`RC ${to.rcNumber}`);
    if (to.vatNumber) doc.fontSize(9).text(`VAT/TIN ${to.vatNumber}`);
    if (to.address) doc.fontSize(9).text(to.address);
    if (to.email) doc.fontSize(9).text(to.email);
  }

  renderInvoice(invoice, res) {
    const paid = invoice.status === "paid";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.number}.pdf"`);
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);
    this.pdfHeader(doc, paid ? "Receipt for invoice" : invoice.status === "void" ? "VOID invoice" : "Invoice", invoice.number);
    doc.fontSize(9).fillColor("#555").text(`Issued ${new Date(invoice.issuedAt).toDateString()}${invoice.dueDate && !paid ? ` · due ${new Date(invoice.dueDate).toDateString()}` : ""}`).fillColor("#000");
    this.pdfBilledTo(doc, invoice.billedTo || {});
    doc.moveDown();
    for (const item of invoice.items) {
      doc.fontSize(10).text(item.description, { width: 380, continued: false });
      doc.moveUp().text(naira(item.amount), { align: "right" });
    }
    doc.moveDown();
    doc.fontSize(10).text(`Subtotal: ${naira(invoice.subtotal)}`, { align: "right" });
    doc.text(`VAT (${(invoice.vatRate * 100).toFixed(1)}%): ${naira(invoice.vat)}`, { align: "right" });
    doc.fontSize(12).text(`Total: ${naira(invoice.total)}`, { align: "right" });
    doc.moveDown();
    if (paid) {
      doc.fontSize(12).fillColor("#15803d").text(`PAID ${new Date(invoice.paidAt).toDateString()} by ${invoice.paymentMethod === "card" ? "card" : "bank transfer"}${invoice.paymentReference ? ` (ref ${invoice.paymentReference})` : ""}`);
      doc.fillColor("#000");
    } else if (invoice.status === "issued") {
      const bank = bankDetails();
      if (bank.accountNumber) {
        doc.fontSize(10).text("Pay by bank transfer");
        doc.fontSize(9).text(`${bank.bankName} · ${bank.accountName} · ${bank.accountNumber}`);
        doc.text(`Reference: ${invoice.number}`);
      }
    }
    doc.end();
  }

  async receiptPdf(user, escrowId, res) {
    const { org } = await myOrganization(user, { roles: ["admin", "approver"] });
    if (!mongoose.isValidObjectId(escrowId)) throw new AppError("Receipt not found", 404);
    const escrow = await EscrowPayment.findById(escrowId).lean();
    const booking = escrow && (await VendorBooking.findById(escrow.booking).select("event vendor").populate("vendor", "businessName name").lean());
    const event = booking && (await Event.findOne({ _id: booking.event, organization: org._id }).select("title department").lean());
    if (!event || escrow.status === "pending_payment") throw new AppError("Receipt not found", 404);
    const number = `RCT-${idOf(escrow._id).slice(-8).toUpperCase()}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${number}.pdf"`);
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);
    this.pdfHeader(doc, "Payment receipt", number);
    doc.fontSize(9).fillColor("#555").text(`Paid ${new Date(escrow.paidAt || escrow.createdAt).toDateString()}`).fillColor("#000");
    this.pdfBilledTo(doc, billedTo(org));
    doc.moveDown();
    doc.fontSize(10).text(`Payment to ${booking.vendor?.businessName || booking.vendor?.name || "vendor"} for ${event.title}${event.department ? ` (${event.department})` : ""}`);
    doc.text(`Kind: ${escrow.kind}`);
    doc.moveDown();
    doc.fontSize(12).text(`Amount received: ${naira(escrow.amount / 100)}`, { align: "right" });
    if (escrow.refund?.amount) doc.fontSize(10).text(`Refunded: ${naira(escrow.refund.amount / 100)}`, { align: "right" });
    doc.moveDown().fontSize(9).fillColor("#555").text("Held by Confetti and paid to the vendor after the event. The vendor issues their own tax invoice for their services.");
    doc.end();
  }

  // ---- Background job: renewals and expiry (daily) ----

  async runContractJobs(now = new Date()) {
    const soon = new Date(now.getTime() + RENEW_DAYS * 86400000);
    const renewing = await Organization.find({
      "contract.status": "active",
      "contract.endsAt": { $gt: now, $lte: soon },
      "contract.renewalInvoicedAt": { $exists: false },
    }).limit(200);
    let invoiced = 0;
    for (const org of renewing) {
      try {
        await this.issueInvoice(org._id, { kind: "renewal" });
        invoiced++;
      } catch (error) {
        logger.warn("Corporate renewal invoice failed", { org: org._id, error: error.message });
      }
    }
    const lapsed = await Organization.find({ "contract.status": "active", "contract.endsAt": { $lte: now } }).limit(200);
    for (const org of lapsed) {
      org.contract.status = "expired";
      await org.save();
      await notifyAdmins(org, "Corporate contract ended", "Pay the renewal invoice to keep approvals, reports and company events.");
    }
    return { invoiced, expired: lapsed.length };
  }
}

const corporateBillingService = new CorporateBillingService();
export default corporateBillingService;

let corporateTimer = null;
export const startCorporateJobs = (intervalMs = 6 * 60 * 60 * 1000) => {
  if (corporateTimer) return;
  const tick = () => corporateBillingService.runContractJobs().catch((error) => logger.error("Corporate jobs failed", { error: error.message }));
  corporateTimer = setInterval(tick, intervalMs);
  corporateTimer.unref?.();
  setTimeout(tick, 3 * 60 * 1000).unref?.();
};
