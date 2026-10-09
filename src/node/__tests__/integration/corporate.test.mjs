/**
 * Corporate (roadmap Phase 11): company, members and roles, contract billing by
 * invoice (transfer or card), events and budgets, purchase approvals enforced on
 * booking and payment, receipts and reports. In-memory MongoDB; providers stubbed.
 * Run: npm run test:corporate
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import mongoose from "mongoose";
import axios from "axios";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-x";
process.env.CORPORATE_ACCOUNT_NUMBER = "0123456789";
process.env.CORPORATE_BANK_NAME = "Test Bank";

const checkouts = [];
axios.post = async (url, payload) => {
  checkouts.push({ url, payload });
  return { data: { status: "success", data: { link: "https://pay.test/flw" } } };
};

let mongod;
const m = {};
const s = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_corporate"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Event = await load("../../models/event.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.VendorBooking = await load("../../models/vendor-booking.model.js");
  m.Payment = await load("../../models/payment.model.js");
  m.EscrowPayment = await load("../../models/escrow-payment.model.js");
  m.Budget = await load("../../models/budget.model.js");
  m.SupportTicket = await load("../../models/supportTicket.model.js");
  m.Quote = await load("../../models/quote.model.js");
  s.quoteCtl = await import("../../controllers/quote.controller.js");
  m.org = await import("../../models/organization.model.js");
  s.orgs = await load("../../services/organization.service.js");
  s.purchases = await load("../../services/purchase.service.js");
  s.billing = await load("../../services/corporate-billing.service.js");
  s.reports = await load("../../services/corporate-report.service.js");
  s.payments = await load("../../services/payment.service.js");
  s.escrow = await load("../../services/escrow.service.js");
  s.passes = await load("../../services/event-pass.service.js");
  s.support = await import("../../services/support.service.js");
  s.bookingCtl = await import("../../controllers/vendor-booking.controller.js");
  s.catalogue = await import("../../services/plan-catalogue.service.js");
});

after(async () => {
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  checkouts.length = 0;
  await mongoose.connection.db.dropDatabase();
  await s.catalogue.ensurePlans();
});

let seq = 0;
const mkUser = (role = "user", extra = {}) =>
  m.User.create({ username: `u${++seq}`, email: `u${seq}@corp.io`, password: "Passw0rd!x", firstName: `F${seq}`, role, status: "active", isActive: true, ...extra });
const mkVendor = async () => {
  const owner = await mkUser("vendor");
  const id = (await m.Vendor.collection.insertOne({ owner: owner._id, name: "AV Co", businessName: "AV Co", category: "audio-visual", status: "approved", isActive: true, email: "av@x.io" })).insertedId;
  return { owner, vendorId: id };
};
const pdfOf = async (fn) => {
  const chunks = [];
  const res = new Writable({ write(c, _e, cb) { chunks.push(c); cb(); } });
  res.headers = {};
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  const done = new Promise((r) => res.on("finish", r));
  await fn(res);
  await done;
  return Buffer.concat(chunks);
};

/** A company with an admin, an approver and a requester, on an active contract */
const setupCompany = async ({ activate = true } = {}) => {
  const admin = await mkUser("event-planner");
  await s.orgs.create(admin, { name: "Dangote Events", legalName: "Dangote Industries Ltd", rcNumber: "RC123", vatNumber: "TIN9", departments: ["Marketing", "HR"] });
  const approver = await mkUser();
  const requester = await mkUser();
  for (const [u, role, department] of [[approver, "approver", "Marketing"], [requester, "requester", "Marketing"]]) {
    const { link } = await s.orgs.invite(admin, { email: u.email, role, department });
    await s.orgs.acceptInvite(u, link.split("/company/join/")[1]);
  }
  const org = await m.org.Organization.findOne({ name: "Dangote Events" });
  if (activate) {
    const invoice = await s.billing.issueInvoice(org._id, { amount: 600000 });
    await s.billing.adminMarkPaid(invoice._id, { reference: "TRF-1" });
  }
  return { admin, approver, requester, org: await m.org.Organization.findById(org._id) };
};

test("company, members and roles: invites by email, roles enforced, at least one admin", async () => {
  const admin = await mkUser("event-planner");
  const vendorUser = await mkUser("vendor");
  await assert.rejects(s.orgs.create(vendorUser, { name: "X" }), /Vendors/);
  const created = await s.orgs.create(admin, { name: "Acme", departments: ["Sales", "Sales", "Ops"] });
  assert.deepEqual(created.departments, ["Sales", "Ops"]);
  assert.equal(created.me.role, "admin");

  const bob = await mkUser();
  const { link } = await s.orgs.invite(admin, { email: bob.email.toUpperCase(), role: "approver", department: "Finance" });
  const token = link.split("/company/join/")[1];
  assert.deepEqual(await s.orgs.previewInvite(token), { organization: "Acme", email: bob.email, role: "approver" });
  const eve = await mkUser();
  await assert.rejects(s.orgs.acceptInvite(eve, token), /Sign in with that email/);
  const joined = await s.orgs.acceptInvite(bob, token);
  assert.deepEqual([joined.me.role, joined.me.department], ["approver", "Finance"]);
  await assert.rejects(s.orgs.acceptInvite(bob, token), /isn't valid/, "used once");

  await assert.rejects(s.orgs.invite(bob, { email: "z@z.io" }), /Only company admins/);
  await assert.rejects(s.orgs.update(bob, { name: "Hacked" }), /Only company admins/);
  await assert.rejects(s.orgs.updateMember(admin, admin._id, { role: "requester" }), /at least one admin/);
  await assert.rejects(s.orgs.removeMember(admin, admin._id), /at least one admin/);
  const list = await s.orgs.members(admin);
  assert.equal(list.members.length, 2);
  await assert.rejects(s.orgs.get(eve), /not part of a company/);
});

test("contract billing: request, invoice with VAT in the company's name, card payment activates once, transfer, renewal and expiry", async () => {
  const { admin } = await setupCompany({ activate: false });
  let org = await m.org.Organization.findOne({});
  // Corporate features need the contract
  await assert.rejects(s.orgs.createEvent(admin, { title: "Retreat", startDate: new Date(Date.now() + 864e5) }), (e) => e.code === "CONTRACT_REQUIRED");

  assert.equal((await s.billing.requestContract(admin, { notes: "50 staff" })).status, "requested");
  await assert.rejects(s.billing.issueInvoice(org._id, { amount: 100000 }), /start at ₦500,000/);
  const invoice = await s.billing.issueInvoice(org._id, { amount: 500000 });
  assert.match(invoice.number, /^CFT-\d{4}-0001$/);
  assert.deepEqual([invoice.subtotal, invoice.vat, invoice.total], [500000, 37500, 537500]);
  assert.equal(invoice.billedTo.name, "Dangote Industries Ltd");
  assert.equal(invoice.billedTo.rcNumber, "RC123");
  await assert.rejects(s.billing.issueInvoice(org._id, { amount: 500000 }), /unpaid invoice/);

  const { invoices, bank } = await s.billing.invoices(admin);
  assert.equal(invoices.length, 1);
  assert.equal(bank.accountNumber, "0123456789");
  const pdf = await pdfOf((res) => s.billing.invoicePdf(admin, invoice._id, res));
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");

  // Card
  const r = await s.billing.payByCard(admin, invoice._id, {});
  assert.equal(checkouts[0].payload.amount, 537500);
  const payment = await m.Payment.findOne({ reference: r.reference });
  assert.equal(payment.paymentType, "corporate");
  await assert.rejects(s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 1000, currency: "NGN" } }), /doesn't match/);
  await m.Payment.updateOne({ _id: payment._id }, { status: "pending" });
  await s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 537500, currency: "NGN" } });
  await s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 537500, currency: "NGN" } });
  org = await m.org.Organization.findById(org._id);
  assert.equal(org.contract.status, "active");
  const days = (org.contract.endsAt - Date.now()) / 864e5;
  assert.ok(days > 364 && days < 367, `${days}`);
  assert.equal((await m.org.CorporateInvoice.findById(invoice._id)).paymentMethod, "card");
  // Paying twice doesn't extend it
  await s.billing.markPaid(invoice._id, { method: "transfer" });
  assert.equal(+(await m.org.Organization.findById(org._id)).contract.endsAt, +org.contract.endsAt);

  // Renewal invoice 30 days before the end, once; transfer marks it paid and extends from the end
  let run = await s.billing.runContractJobs(new Date(org.contract.endsAt.getTime() - 20 * 864e5));
  assert.equal(run.invoiced, 1);
  run = await s.billing.runContractJobs(new Date(org.contract.endsAt.getTime() - 19 * 864e5));
  assert.equal(run.invoiced, 0);
  const renewal = await m.org.CorporateInvoice.findOne({ kind: "renewal" });
  assert.equal(renewal.total, 537500);
  await s.billing.adminMarkPaid(renewal._id, { reference: "TRF-99" });
  const renewed = await m.org.Organization.findById(org._id);
  assert.equal(renewed.contract.endsAt.getFullYear(), org.contract.endsAt.getFullYear() + 1);

  // Expiry
  run = await s.billing.runContractJobs(new Date(renewed.contract.endsAt.getTime() + 864e5));
  assert.equal(run.expired, 1);
  assert.equal((await m.org.Organization.findById(org._id)).contract.status, "expired");
});

test("approvals: requests, self-approval refused, auto-approve under the limit, enforced on vendor confirmation and payment", async () => {
  const { admin, approver, requester, org } = await setupCompany();
  const { owner, vendorId } = await mkVendor();
  const event = await s.orgs.createEvent(requester, { title: "Product launch", startDate: new Date(Date.now() + 30 * 864e5), budget: 3000000 });
  assert.equal(String(event.organization), String(org._id));
  assert.equal(event.department, "Marketing", "requester's department");
  assert.ok(await m.Budget.exists({ event: event._id }));
  // Company events get the Plus features
  assert.equal((await s.passes.featuresFor(event._id)).runSheet, true);

  const booking = await m.VendorBooking.create({ vendor: vendorId, planner: requester._id, event: event._id, status: "quoted", totalAmount: 1000000, quote: { amount: 1000000 } });
  // Vendor can't confirm, client can't pay
  const confirm = () =>
    new Promise((resolve) => {
      const res = { status() { return this; }, json(b) { resolve({ ok: true, body: b }); } };
      s.bookingCtl.confirmVendorBooking({ user: owner, params: { id: String(booking._id) }, body: {} }, res, (err) => resolve({ ok: false, err }));
    });
  assert.equal((await confirm()).err?.code, "APPROVAL_REQUIRED");
  await assert.rejects(s.escrow.checkout(requester, { bookingId: booking._id, amount: 500000 }), (e) => e.code === "APPROVAL_REQUIRED");

  const pr = await s.purchases.create(requester, { bookingId: booking._id, description: "Sound and screens" });
  assert.match(pr.number, /^PR-\d{4}-0001$/);
  assert.deepEqual([pr.status, pr.amount], ["pending", 1000000]);
  await assert.rejects(s.purchases.create(requester, { bookingId: booking._id }), /already a request/);
  await assert.rejects(s.purchases.decide(requester, pr._id, "approved"), /approvers and admins/);
  await assert.rejects(s.purchases.decide(approver, pr._id, "rejected"), /Say why/);
  const approved = await s.purchases.decide(approver, pr._id, "approved", "OK within budget");
  assert.equal(approved.status, "approved");
  assert.deepEqual(approved.log.map((l) => l.action), ["requested", "approved"]);
  await assert.rejects(s.purchases.decide(admin, pr._id, "approved"), /already approved/);

  assert.equal((await confirm()).ok, true, "vendor can confirm now");
  const r = await s.escrow.checkout(requester, { bookingId: booking._id, amount: 600000 });
  const payment = await m.Payment.findOne({ reference: r.reference });
  await s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 600000, currency: "NGN" } });
  // Over the approval
  await m.VendorBooking.updateOne({ _id: booking._id }, { totalAmount: 1500000 });
  await assert.rejects(s.escrow.checkout(requester, { bookingId: booking._id, amount: 500000 }), /go over it/);

  // The admin's own request needs someone else; small ones are approved automatically
  await s.orgs.update(admin, { approvalThreshold: 200000 });
  const small = await m.VendorBooking.create({ vendor: vendorId, planner: admin._id, event: event._id, status: "quoted", totalAmount: 150000, quote: { amount: 150000 } });
  // Admins can raise requests on any company booking
  const auto = await s.purchases.create(admin, { bookingId: small._id });
  assert.deepEqual([auto.status, auto.autoApproved], ["approved", true]);
  assert.deepEqual(auto.log.map((l) => l.action), ["requested", "auto_approved"]);

  // Requesters see only their own; approvers see all
  assert.equal((await s.purchases.list(requester)).length, 1);
  assert.equal((await s.purchases.list(approver, { status: "approved" })).length, 2);
  // A requester can't raise one on someone else's event
  const hrEvent = await s.orgs.createEvent(admin, { title: "HR day", startDate: new Date(Date.now() + 20 * 864e5) });
  const hrBooking = await m.VendorBooking.create({ vendor: vendorId, planner: admin._id, event: hrEvent._id, status: "quoted", totalAmount: 900000, quote: { amount: 900000 } });
  await assert.rejects(s.purchases.create(requester, { bookingId: hrBooking._id }), /not found/);
  // Admin's own request needs someone else to approve it
  const own = await s.purchases.create(admin, { bookingId: hrBooking._id });
  await assert.rejects(s.purchases.decide(admin, own._id, "approved"), /Someone else/);
  assert.equal((await s.purchases.decide(approver, own._id, "approved")).status, "approved");

  // Outsiders can't raise requests on company bookings
  const outsider = await mkUser();
  await assert.rejects(s.purchases.create(outsider, { bookingId: booking._id }), /not part of a company/);

  // Corporate members get priority support
  const ticket = await s.support.createTicket(requester, { subject: "Help", description: "Invoice question" });
  assert.equal(ticket.isPriority, true);
});

test("reports and receipts: spending by event, department and vendor; budgets; CSV and PDF; receipts in the company's name", async () => {
  const { admin, approver, requester, org } = await setupCompany();
  await s.orgs.setBudgets(admin, { budgets: [{ department: "Marketing", year: new Date().getFullYear(), amount: 2000000 }, { department: "HR", year: new Date().getFullYear(), amount: 500000 }] });
  const { vendorId } = await mkVendor();
  const launch = await s.orgs.createEvent(requester, { title: "Launch", startDate: new Date(Date.now() + 10 * 864e5) });
  const booking = await m.VendorBooking.create({ vendor: vendorId, planner: requester._id, event: launch._id, status: "confirmed", totalAmount: 800000 });
  const pr = await s.purchases.create(requester, { bookingId: booking._id });
  await s.purchases.decide(approver, pr._id, "approved");
  const r = await s.escrow.checkout(requester, { bookingId: booking._id, amount: 300000 });
  const payment = await m.Payment.findOne({ reference: r.reference });
  await s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 300000, currency: "NGN" } });

  const report = await s.reports.build(admin, {});
  assert.equal(report.totals.paid, 300000);
  assert.equal(report.totals.committed, 500000, "approved but unpaid");
  assert.equal(report.byEvent[0].name, "Launch");
  assert.equal(report.byVendor[0].name, "AV Co");
  const marketing = report.byDepartment.find((d) => d.name === "Marketing");
  assert.deepEqual([marketing.paid, marketing.budget, marketing.remaining], [300000, 2000000, 1700000]);
  assert.ok(report.byDepartment.some((d) => d.name === "HR" && d.paid === 0), "budgeted departments show with no spending");
  await assert.rejects(s.reports.build(requester, {}), /approvers and admins/);

  const csv = await s.reports.csv(approver, {});
  assert.match(csv, /^Date,Event,Department,Vendor/);
  assert.match(csv, /Launch,Marketing,AV Co/);
  const pdf = await pdfOf((res) => s.reports.pdf(admin, {}, res));
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");

  const events = await s.orgs.events(admin);
  assert.deepEqual([events[0].spent, events[0].committed], [300000, 500000]);
  assert.equal((await s.orgs.events(requester)).length, 1);

  const receipts = await s.billing.receipts(admin);
  assert.equal(receipts.length, 1);
  assert.deepEqual([receipts[0].amount, receipts[0].vendor, receipts[0].event], [300000, "AV Co", "Launch"]);
  const receiptPdf = await pdfOf((res) => s.billing.receiptPdf(admin, receipts[0]._id, res));
  assert.equal(receiptPdf.subarray(0, 4).toString(), "%PDF");
  // Another company can't download it
  const other = await mkUser("event-planner");
  await s.orgs.create(other, { name: "Other Co" });
  await assert.rejects(s.billing.receiptPdf(other, receipts[0]._id, { setHeader() {} }), /not found/);
  void org;
});

test("several companies per person: switch with the active company; vendors still can't join", async () => {
  const planner = await mkUser("event-planner");
  const a = await s.orgs.create(planner, { name: "Client A" });
  const b = await s.orgs.create(planner, { name: "Client B" });
  const mine = await s.orgs.listMine(planner);
  assert.deepEqual(mine.map((o) => [o.name, o.role]), [["Client A", "admin"], ["Client B", "admin"]]);

  // Without a choice: the first; with a choice: that one
  assert.equal((await s.orgs.get(planner)).name, "Client A");
  assert.equal((await s.orgs.get({ ...planner.toObject(), activeOrganization: String(b._id) })).name, "Client B");
  // A company they're not in is ignored, not leaked
  const stranger = await mkUser("event-planner");
  const c = await s.orgs.create(stranger, { name: "Client C" });
  assert.equal((await s.orgs.get({ ...planner.toObject(), activeOrganization: String(c._id) })).name, "Client A");

  // Joining another company by invite works too
  const { link } = await s.orgs.invite(stranger, { email: planner.email, role: "approver" });
  await s.orgs.acceptInvite(planner, link.split("/company/join/")[1]);
  assert.equal((await s.orgs.listMine(planner)).length, 3);
  const inC = { ...planner.toObject(), activeOrganization: String(c._id) };
  assert.equal((await s.orgs.get(inC)).me.role, "approver");
  await assert.rejects(s.orgs.update(inC, { name: "x" }), /Only company admins/, "role is per company");

  // Vendors still can't create or join one
  const vendorUser = await mkUser("vendor");
  await assert.rejects(s.orgs.create(vendorUser, { name: "V" }), /Vendors/);
  const inv = await s.orgs.invite(planner, { email: vendorUser.email });
  await assert.rejects(s.orgs.acceptInvite(vendorUser, inv.link.split("/company/join/")[1]), /Vendor accounts/);
  void a;
});

test("public quote link: a quote for a company booking can't be accepted until its amount is approved", async () => {
  const { approver, requester } = await setupCompany();
  const { vendorId } = await mkVendor();
  const event = await s.orgs.createEvent(requester, { title: "Gala", startDate: new Date(Date.now() + 30 * 864e5) });
  const quote = await m.Quote.create({
    vendor: vendorId, quoteNumber: `Q-${Date.now()}`, customer: { name: "Req", email: requester.email },
    items: [{ description: "Band", quantity: 1, unitPrice: 700000, total: 700000 }], subtotal: 700000, total: 700000, status: "sent", createdBy: requester._id, validUntil: new Date(Date.now() + 30 * 864e5),
  });
  const booking = await m.VendorBooking.create({ vendor: vendorId, planner: requester._id, event: event._id, status: "quoted", totalAmount: 700000, quote: { amount: 700000 }, quoteRef: quote._id });
  const accept = () =>
    new Promise((resolve) => {
      const res = { status() { return this; }, json(b) { resolve({ ok: true, body: b }); } };
      s.quoteCtl.acceptQuote({ params: { id: String(quote._id) }, body: {} }, res, (err) => resolve({ ok: false, err }));
    });
  assert.equal((await accept()).err?.code, "APPROVAL_REQUIRED");

  // An approval for less than the quote isn't enough
  const low = await s.purchases.create(requester, { bookingId: booking._id, amount: 500000 });
  await s.purchases.decide(approver, low._id, "approved");
  const short = await accept();
  assert.equal(short.err?.code, "APPROVAL_REQUIRED");
  assert.match(short.err.message, /₦500,000/);

  const rest = await s.purchases.create(requester, { bookingId: booking._id, amount: 200000 });
  await s.purchases.decide(approver, rest._id, "approved");
  assert.equal((await accept()).ok, true);
  assert.equal((await m.Quote.findById(quote._id)).status, "accepted");

  // Quotes with no company booking are unaffected
  const plain = await m.Quote.create({
    vendor: vendorId, quoteNumber: `Q-${Date.now()}-2`, customer: { name: "Someone", email: "s@x.io" },
    items: [{ description: "DJ", quantity: 1, unitPrice: 1, total: 1 }], subtotal: 1, total: 1, status: "sent", createdBy: requester._id, validUntil: new Date(Date.now() + 30 * 864e5),
  });
  const ok = await new Promise((resolve) => {
    const res = { status() { return this; }, json(b) { resolve({ ok: true, body: b }); } };
    s.quoteCtl.acceptQuote({ params: { id: String(plain._id) }, body: {} }, res, (err) => resolve({ ok: false, err }));
  });
  assert.equal(ok.ok, true);
});
