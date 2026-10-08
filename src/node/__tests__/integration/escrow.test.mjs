/**
 * Escrow and booking commission (roadmap Phase 5). In-memory MongoDB; providers stubbed.
 * Run: npm run test:escrow
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import axios from "axios";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-x";
process.env.PAYSTACK_SECRET_KEY = "sk_test_x";
process.env.SECRETS_ENCRYPTION_KEY = "a".repeat(64);

const calls = [];
let transferStatus = "pending";
let refundFails = false;
axios.post = async (url, payload) => {
  calls.push({ url, payload });
  if (url.includes("/transferrecipient")) return { data: { data: { recipient_code: "RCP_1" } } };
  if (url.includes("/transfer")) return { data: { data: { status: transferStatus, transfer_code: "TRF_1" } } };
  if (url.includes("/refund")) {
    if (refundFails) throw Object.assign(new Error("no"), { response: { status: 400, data: { message: "Refund not allowed" } } });
    return { data: { data: { status: "processed", id: 99 } } };
  }
  if (url.includes("/transferrecipient")) return { data: { data: { recipient_code: "RCP_1" } } };
  if (url.includes("/subaccount")) return { data: { data: { subaccount_code: "ACCT_1" } } };
  if (url.includes("flutterwave")) return { data: { status: "success", data: { link: "https://pay.test/flw" } } };
  return { data: { status: true, data: { authorization_url: "https://pay.test/ps" } } };
};
const realAxios = axios.create;
axios.get = async () => ({ data: {} });

let mongod;
const m = {};
const s = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_escrow"));
  // Paystack GET/POST via axios(config) in payout-provider
  const axiosModule = (await import("axios")).default;
  axiosModule.request = async (config) => {
    if (config.url.includes("/bank/resolve")) return { data: { data: { account_name: "VEE FOODS LTD", account_number: "0123456789" } } };
    if (config.url.includes("/bank")) return { data: { data: [{ name: "Access Bank", code: "044", active: true }] } };
    return axiosModule.post(config.url, config.data);
  };
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.VendorBooking = await load("../../models/vendor-booking.model.js");
  m.EscrowPayment = await load("../../models/escrow-payment.model.js");
  m.Payment = await load("../../models/payment.model.js");
  m.Subscription = await load("../../models/subscription.model.js");
  s.escrow = await load("../../services/escrow.service.js");
  s.payments = await load("../../services/payment.service.js");
  s.payout = await import("../../services/vendor-payout.service.js");
  s.vendorCtl = await import("../../controllers/vendor.controller.js");
  s.catalogue = await import("../../services/plan-catalogue.service.js");
});

after(async () => {
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  calls.length = 0;
  transferStatus = "pending";
  refundFails = false;
  delete process.env.ESCROW_PAYOUTS;
  await mongoose.connection.db.dropDatabase();
  await s.catalogue.ensurePlans();
});

let seq = 0;
const mkUser = (role) =>
  m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: "A", role, status: "active", isActive: true });

/** A client, a vendor (on `plan`) and a vendor-confirmed booking for ₦400,000 */
const setup = async ({ plan = "Pro", status = "confirmed", eventInDays = 10 } = {}) => {
  const client = await mkUser("user");
  const vendorUser = await mkUser("vendor");
  if (plan !== "Listing") {
    await m.Subscription.create({ user: vendorUser._id, planType: "vendor", planName: plan, status: "active", endDate: new Date(Date.now() + 864e5 * 30), paymentProvider: "none", amount: 1 });
  }
  const vendorId = (await m.Vendor.collection.insertOne({ owner: vendorUser._id, name: "Vee", businessName: "Vee Foods", email: `v${seq}@x.io` })).insertedId;
  const eventDate = new Date(Date.now() + eventInDays * 864e5);
  const booking = await m.VendorBooking.create({
    vendor: vendorId, planner: client._id, clientName: "Ada", eventType: "Wedding", eventDate, eventEndDate: eventDate,
    status, totalAmount: 400000, depositAmount: 100000, currency: "NGN",
  });
  return { client, vendorUser, vendorId, booking };
};
const pay = async (checkout, amountNaira) => {
  const payment = await m.Payment.findOne({ reference: checkout.reference });
  return s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: amountNaira, currency: "NGN", id: 777 } });
};

test("checkout: only the client, only confirmed bookings, within the balance; commission from the vendor's plan", async () => {
  const { client, booking } = await setup({ plan: "Pro" });
  const stranger = await mkUser("user");
  await assert.rejects(s.escrow.checkout(stranger, { bookingId: booking._id }), /not found/);
  await assert.rejects(s.escrow.checkout(client, { bookingId: booking._id, amount: 500000 }), /up to the outstanding/);

  const pending = await setup({ status: "pending" });
  await assert.rejects(s.escrow.checkout(pending.client, { bookingId: pending.booking._id }), /confirmed/);

  const r = await s.escrow.checkout(client, { bookingId: booking._id, amount: 100000 });
  assert.equal(r.amount, 10000000);
  assert.equal(calls.at(-1).payload.amount, 100000, "Flutterwave gets naira");
  const escrow = await m.EscrowPayment.findById(r.escrowId);
  assert.deepEqual([escrow.kind, escrow.commissionRate, escrow.status], ["deposit", 0.03, "pending_payment"]);

  const listing = await setup({ plan: "Listing" });
  const r2 = await s.escrow.checkout(listing.client, { bookingId: listing.booking._id });
  assert.equal((await m.EscrowPayment.findById(r2.escrowId)).commissionRate, 0.05);
  const biz = await setup({ plan: "Business" });
  const r3 = await s.escrow.checkout(biz.client, { bookingId: biz.booking._id });
  assert.equal((await m.EscrowPayment.findById(r3.escrowId)).commissionRate, 0.02);
});

test("paid → held (once), booking updated; client confirms → released and paid out by transfer", async () => {
  const { client, vendorUser, vendorId, booking } = await setup({ plan: "Pro" });
  const r = await s.escrow.checkout(client, { bookingId: booking._id });
  await assert.rejects(pay(r, 1000), /doesn't match/, "underpaid is rejected");
  const r2 = await s.escrow.checkout(client, { bookingId: booking._id });
  const [a, b] = await Promise.all([pay(r2, 400000), pay(r2, 400000)]);
  assert.equal([a, b].filter((x) => !x.alreadyProcessed).length, 1);

  let escrow = await m.EscrowPayment.findById(r2.escrowId);
  assert.equal(escrow.status, "held");
  assert.ok(escrow.releaseAfter > booking.eventDate);
  const updated = await m.VendorBooking.findById(booking._id);
  assert.equal(updated.payment.paidAmount, 400000);
  assert.equal(updated.payment.status, "paid");
  await assert.rejects(s.escrow.checkout(client, { bookingId: booking._id }), /fully paid/);

  // Payout setup: account checked, recipient created; account number not stored in clear
  process.env.ESCROW_PAYOUTS = "paystack";
  const account = await s.payout.savePayoutAccount(vendorUser, { bankCode: "044", accountNumber: "0123456789" });
  assert.deepEqual([account.accountLast4, account.accountName, account.payoutsReady], ["6789", "VEE FOODS LTD", true]);
  const raw = await m.Vendor.collection.findOne({ _id: vendorId });
  assert.notEqual(raw.payoutAccount.accountNumberEnc, "0123456789");
  assert.equal(raw.payoutAccount.subaccountCode, undefined, "not verified yet");

  // Vendor verified → subaccount created
  const vendorDoc = await m.Vendor.findById(vendorId);
  vendorDoc.isVerified = true;
  await vendorDoc.save({ validateBeforeSave: false });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await m.Vendor.collection.findOne({ _id: vendorId })).payoutAccount.subaccountCode, "ACCT_1");

  const stranger = await mkUser("user");
  await assert.rejects(s.escrow.confirmDelivery(stranger, escrow._id), /not found/);
  await assert.rejects(s.escrow.confirmDelivery(vendorUser, escrow._id), /Only the client/);
  await s.escrow.confirmDelivery(client, escrow._id);
  escrow = await m.EscrowPayment.findById(escrow._id);
  assert.deepEqual([escrow.status, escrow.releaseReason, escrow.commissionAmount, escrow.vendorAmount], ["released", "client_confirmed", 1200000, 38800000]);
  assert.equal(escrow.payout.status, "processing");
  const transferCall = calls.find((c) => c.url.includes("/transfer") && !c.url.includes("recipient"));
  assert.equal(transferCall.payload.amount, 38800000);

  // Transfer webhook marks it paid
  await s.escrow.handleTransferEvent({ reference: escrow.payout.reference, succeeded: true });
  assert.equal((await m.EscrowPayment.findById(escrow._id)).payout.status, "paid");

  // Vendor's view and revenue
  const summary = await s.escrow.vendorSummary(vendorUser);
  assert.equal(summary.totals.paidOut, 388000);
  assert.equal(summary.totals.fees, 12000);
});

test("auto-release after the event; manual payouts when transfers are off", async () => {
  const { client, booking } = await setup({ eventInDays: -5 });
  const r = await s.escrow.checkout(client, { bookingId: booking._id });
  await pay(r, 400000);
  assert.equal(await s.escrow.runAutoRelease(), 1);
  const escrow = await m.EscrowPayment.findById(r.escrowId);
  assert.deepEqual([escrow.status, escrow.releaseReason, escrow.payout.status], ["released", "auto", "manual"]);
  await s.escrow.markPayoutPaid(new mongoose.Types.ObjectId(), escrow._id, "Sent by bank app");
  assert.equal((await m.EscrowPayment.findById(escrow._id)).payout.status, "paid");
});

test("disputes stop auto-release; admin refunds, splits or releases", async () => {
  // Dispute → no auto release
  const one = await setup({ eventInDays: -5 });
  let r = await s.escrow.checkout(one.client, { bookingId: one.booking._id });
  await pay(r, 400000);
  await assert.rejects(s.escrow.openDispute(one.client, r.escrowId, "bad"), /at least 10/);
  await s.escrow.openDispute(one.client, r.escrowId, "The caterer never showed up");
  assert.equal(await s.escrow.runAutoRelease(), 0);

  // Full refund
  await s.escrow.resolve(new mongoose.Types.ObjectId(), r.escrowId, { resolution: "refund", note: "No-show" });
  let escrow = await m.EscrowPayment.findById(r.escrowId);
  assert.deepEqual([escrow.status, escrow.refund.amount, escrow.refund.status], ["refunded", 40000000, "done"]);
  assert.equal((await m.VendorBooking.findById(one.booking._id)).payment.paidAmount, 0, "booking shows nothing paid");

  // Split: ₦100,000 back to the client, the rest released with commission on it
  const two = await setup({ plan: "Pro" });
  r = await s.escrow.checkout(two.client, { bookingId: two.booking._id });
  await pay(r, 400000);
  await s.escrow.openDispute(two.vendorUser, r.escrowId, "Client changed the menu at the last minute");
  await assert.rejects(s.escrow.resolve(null, r.escrowId, { resolution: "split", refundAmount: 400000 }), /less than/);
  await s.escrow.resolve(new mongoose.Types.ObjectId(), r.escrowId, { resolution: "split", refundAmount: 100000 });
  escrow = await m.EscrowPayment.findById(r.escrowId);
  assert.deepEqual([escrow.status, escrow.refund.amount, escrow.releasedAmount, escrow.commissionAmount], ["released", 10000000, 30000000, 900000]);

  // Refund that the provider refuses → marked for a manual refund, not lost
  const three = await setup();
  r = await s.escrow.checkout(three.client, { bookingId: three.booking._id });
  await pay(r, 400000);
  refundFails = true;
  await s.escrow.resolve(new mongoose.Types.ObjectId(), r.escrowId, { resolution: "refund" });
  assert.equal((await m.EscrowPayment.findById(r.escrowId)).refund.status, "manual");

  // Report
  const report = await s.escrow.report({});
  assert.equal(report.released.commission, 9000);
  assert.ok(report.collected.amount >= 1200000);
});

test("paying a quoted booking accepts the quote", async () => {
  const { client, booking } = await setup({ status: "quoted" });
  await m.VendorBooking.updateOne({ _id: booking._id }, { $unset: { totalAmount: 1 }, $set: { "quote.amount": 250000 } });
  const view = await s.escrow.listForBooking(client, booking._id);
  assert.equal(view.canPay, true);
  assert.equal(view.totals.outstanding, 250000);
  const r = await s.escrow.checkout(client, { bookingId: booking._id });
  await pay(r, 250000);
  assert.equal((await m.VendorBooking.findById(booking._id)).status, "booked");
});

test("vendor dashboard revenue includes escrow payments", async () => {
  const { client, vendorUser, booking } = await setup({ plan: "Business" });
  const r = await s.escrow.checkout(client, { bookingId: booking._id, amount: 150000 });
  await pay(r, 150000);
  const out = {};
  await s.vendorCtl.getDashboardSummary(
    { user: vendorUser, query: {} },
    { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } },
    (e) => (out.error = e)
  );
  assert.equal(out.status, 200, out.error?.message);
  assert.equal(out.body.data.revenue.total, 150000);
});
