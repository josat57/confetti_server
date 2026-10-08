/**
 * Fixes for the roadmap's open issues: client accounts and bookings, vendor
 * bookings, lead messaging, invoice revenue, renewals, API keys, admin-only routes.
 * Run: npm run test:issues
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import axios from "axios";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-x";

// Flutterwave: card charges succeed unless chargeFails is set
let chargeFails = false;
const charges = [];
axios.post = async (url, payload) => {
  if (url.includes("tokenized-charges")) {
    charges.push(payload);
    if (chargeFails) throw Object.assign(new Error("declined"), { response: { data: { message: "Card declined" } } });
    return { data: { status: "success", data: { status: "successful", amount: payload.amount, currency: payload.currency, id: 7 } } };
  }
  return { data: { status: "success", data: { link: "https://pay.test" } } };
};

let mongod;
const m = {};
const c = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_issues"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.VendorBooking = await load("../../models/vendor-booking.model.js");
  m.Lead = await load("../../models/lead.model.js");
  m.Invoice = await load("../../models/invoice.model.js");
  m.Subscription = await load("../../models/subscription.model.js");
  m.ApiKey = await load("../../models/api-key.model.js");
  m.Notification = await load("../../models/notification.model.js");
  c.client = await import("../../controllers/client-booking.controller.js");
  c.vendorBookings = await import("../../controllers/vendor-booking.controller.js");
  c.vendor = await import("../../controllers/vendor.controller.js");
  c.apiAccess = await import("../../controllers/api-access.controller.js");
  c.auth = await import("../../middleware/auth.js");
  c.authController = await import("../../controllers/auth.controller.js");
  c.renewal = await import("../../services/subscription-renewal.service.js");
  c.catalogue = await import("../../services/plan-catalogue.service.js");
  c.access = await import("../../services/plan-access.service.js");
});

after(async () => {
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  charges.length = 0;
  chargeFails = false;
  await mongoose.connection.db.dropDatabase();
  await c.catalogue.ensurePlans();
});

let seq = 0;
const mkUser = (role, extra = {}) =>
  m.User.create({
    username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: `First${seq}`,
    lastName: "Last", role, status: "active", isActive: true, isEmailVerified: true, ...extra,
  });
const mkVendor = async (owner) =>
  (await m.Vendor.collection.insertOne({ owner: owner._id, name: `V${seq}`, businessName: `Biz ${seq}`, category: "catering", email: `v${seq}@x.io` })).insertedId;

async function call(fn, user, { params = {}, body = {}, query = {}, headers = {} } = {}) {
  const out = { status: 200 };
  const res = {
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; return this; },
    setHeader() {}, on() {}, once() {}, emit() {}, write() {}, end() {},
  };
  await fn({ user, params, body, query, headers, originalUrl: "/api/v1/x", protocol: "https", get: () => "api.test" }, res, (err) => {
    out.status = err?.statusCode || 500;
    out.error = err;
  });
  return out;
}

test("client books a vendor: booking for the client, linked lead and booking for the vendor", async () => {
  const client = await mkUser("user");
  const vendorUser = await mkUser("vendor");
  const vendorId = await mkVendor(vendorUser);

  let r = await call(c.client.requestBooking, client, {
    body: { vendor: vendorId.toString(), eventType: "Wedding", eventDate: new Date(Date.now() + 30 * 864e5), budget: 500000, serviceRequirements: "Food for 200", guestCount: 200 },
  });
  assert.equal(r.status, 201, r.error?.message);
  const bookingId = r.body.data.booking._id;
  assert.equal(r.body.data.booking.status, "Pending");
  assert.equal(r.body.data.booking.vendor.businessName, `Biz ${seq}`);

  const lead = await m.Lead.findOne({ vendor: vendorId });
  assert.equal(String(lead.customerUser), String(client._id), "vendor can message the client");
  assert.equal(String(lead.booking), bookingId);
  assert.equal(await m.Notification.countDocuments({ recipient: vendorUser._id, category: "booking" }), 1);

  r = await call(c.client.listMyBookings, client);
  assert.equal(r.body.data.bookings.length, 1);
  r = await call(c.client.getMyDashboardStats, client);
  assert.equal(r.body.data.activeBookings, 1);

  // Vendor sees it, confirms, records the deposit
  r = await call(c.vendorBookings.listVendorBookings, vendorUser);
  assert.equal(r.body.data.bookings.length, 1);
  const vb = r.body.data.bookings[0];
  assert.equal(vb.status, "pending");
  assert.equal(vb.client.email, client.email);

  await m.VendorBooking.updateOne({ _id: bookingId }, { totalAmount: 400000, depositAmount: 100000 });
  r = await call(c.vendorBookings.confirmVendorBooking, vendorUser, { params: { id: bookingId } });
  assert.equal(r.body.data.booking.status, "confirmed");
  r = await call(c.vendorBookings.markVendorDepositPaid, vendorUser, { params: { id: bookingId } });
  assert.equal(r.body.data.booking.payment.status, "deposit_paid");
  assert.equal(r.body.data.booking.payment.balance, 300000);
  r = await call(c.vendorBookings.getVendorBookingStats, vendorUser);
  assert.equal(r.body.data.confirmed, 1);

  // Client sees the confirmation; can't cancel a confirmed booking themselves
  r = await call(c.client.getMyBooking, client, { params: { id: bookingId } });
  assert.equal(r.body.data.booking.status, "Confirmed");
  r = await call(c.client.cancelMyBooking, client, { params: { id: bookingId } });
  assert.equal(r.status, 400);

  // Other vendors and clients can't see it
  const other = await mkUser("vendor");
  await mkVendor(other);
  r = await call(c.vendorBookings.getVendorBooking, other, { params: { id: bookingId } });
  assert.equal(r.status, 404);
  const stranger = await mkUser("user");
  r = await call(c.client.getMyBooking, stranger, { params: { id: bookingId } });
  assert.equal(r.status, 404);

  // Vendor cancels → client sees Declined
  r = await call(c.vendorBookings.cancelVendorBooking, vendorUser, { params: { id: bookingId }, body: { reason: "Fully booked" } });
  r = await call(c.client.getMyBooking, client, { params: { id: bookingId } });
  assert.equal(r.body.data.booking.status, "Declined");
});

test("vendor dashboard revenue comes from invoice payments", async () => {
  const vendorUser = await mkUser("vendor");
  const vendorId = await mkVendor(vendorUser);
  await m.Invoice.collection.insertMany([
    { vendor: vendorId, invoiceNumber: "INV-1", status: "paid", total: 300, payments: [{ amount: 100, paidAt: new Date() }, { amount: 200, paidAt: new Date() }] },
    { vendor: vendorId, invoiceNumber: "INV-2", status: "cancelled", total: 999, payments: [{ amount: 999, paidAt: new Date() }] },
  ]);
  await m.Subscription.create({ user: vendorUser._id, planType: "vendor", planName: "Business", status: "active", endDate: new Date(Date.now() + 864e5), paymentProvider: "none", amount: 1 });
  await m.Vendor.updateOne({ _id: vendorId }, { $set: { stats: {}, description: "x" } });
  const r = await call(c.vendor.getDashboardSummary, vendorUser);
  assert.equal(r.status, 200, r.error?.message);
  assert.equal(r.body.data.revenue.total, 300);
  assert.equal(r.body.data.revenue.bookings, 1);
  assert.equal(r.body.data.revenue.trends.at(-1).revenue, 300);
});

test("renewal charges the saved card, applies a scheduled downgrade, and stops after failures", async () => {
  const user = await mkUser("vendor", {
    paymentMethods: [{ type: "card", provider: "flutterwave", last4: "4242", isDefault: true, providerPaymentMethodId: "flw-token-1" }],
  });
  const end = new Date(Date.now() + 2 * 3600e3);
  const sub = await m.Subscription.create({
    user: user._id, planType: "vendor", planName: "Business", status: "active", startDate: new Date(end - 30 * 864e5),
    endDate: end, paymentProvider: "flutterwave", amount: 2000000, currency: "NGN", billingCycle: "monthly", autoRenew: true,
    pendingChange: { planName: "Pro", billingCycle: "monthly", effectiveAt: end },
  });

  let results = await c.renewal.runRenewals();
  assert.equal(results.renewed, 1);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].amount, 7500, "cheaper plan, major units");
  let renewed = await m.Subscription.findById(sub._id);
  assert.equal(renewed.planName, "Pro");
  assert.equal(renewed.startDate.getTime(), end.getTime(), "continues from the old end");
  assert.equal(renewed.pendingChange?.planName, undefined);
  assert.equal(renewed.history.at(-1).changeType, "renewal");

  // Running again does nothing (not due)
  results = await c.renewal.runRenewals();
  assert.equal(charges.length, 1);

  // Failing card: attempts counted, no plan change
  chargeFails = true;
  await m.Subscription.updateOne({ _id: sub._id }, { endDate: new Date(Date.now() + 3600e3), lastRenewalAttemptAt: null });
  results = await c.renewal.runRenewals();
  assert.equal(results.failed, 1);
  renewed = await m.Subscription.findById(sub._id);
  assert.equal(renewed.renewalAttempts, 1);
  // Not retried within 12 hours
  await c.renewal.runRenewals();
  assert.equal((await m.Subscription.findById(sub._id)).renewalAttempts, 1);

  // No card: nothing charged
  const noCard = await mkUser("planner".replace("planner", "event-planner"));
  await m.Subscription.create({
    user: noCard._id, planType: "planner", planName: "Studio", status: "active", startDate: new Date(), endDate: new Date(Date.now() + 3600e3),
    paymentProvider: "flutterwave", amount: 1500000, autoRenew: true,
  });
  chargeFails = false;
  results = await c.renewal.runRenewals();
  assert.equal(results.no_card, 1);
});

test("API keys: created by plans with API access, accepted via x-api-key, revoked with the plan", async () => {
  const planner = await mkUser("event-planner");
  await m.Subscription.create({ user: planner._id, planType: "planner", planName: "Agency", status: "active", endDate: new Date(Date.now() + 864e5), paymentProvider: "none", amount: 1 });
  let r = await call(c.apiAccess.createApiKey, planner, { body: { name: "CRM sync" } });
  assert.equal(r.status, 201, r.error?.message);
  const key = r.body.data.plainKey;

  const viaKey = (headers, url = "/api/v1/events") =>
    new Promise((resolve) => {
      const req = { cookies: {}, headers, originalUrl: url, ip: "1.2.3.4" };
      c.auth.protect(req, {}, (err) => resolve({ err, req }));
    });
  let { err, req } = await viaKey({ "x-api-key": key });
  assert.equal(err, undefined);
  assert.equal(String(req.user._id), String(planner._id));
  ({ err } = await viaKey({ "x-api-key": key }, "/api/v1/subscriptions/cancel"));
  assert.equal(err.statusCode, 403, "account endpoints refuse keys");
  ({ err } = await viaKey({ "x-api-key": key + "x" }));
  assert.equal(err.statusCode, 401);

  // Plan without API access: the key stops working
  await m.Subscription.updateMany({ user: planner._id }, { planName: "Studio" });
  ({ err } = await viaKey({ "x-api-key": key }));
  assert.equal(err.statusCode, 403);

  r = await call(c.apiAccess.getApiKeys, planner);
  assert.equal(r.body.data.apiKeys.length, 1);
});

test("user administration routes are admin-only; client sign-up creates a user account", async () => {
  const restrict = c.auth.restrictTo("admin", "super_admin");
  const someone = await mkUser("event-planner");
  const blocked = await new Promise((resolve) => restrict({ user: someone }, {}, resolve));
  assert.equal(blocked.statusCode, 403);

  const res = await call(c.authController.register, undefined, {
    body: { email: "client@x.io", password: "Str0ng!Passw0rd", userName: "clienty", phone: "080", planType: "client", planName: "Free", amount: 0 },
  });
  assert.equal(res.status, 200, res.error?.message);
  const created = await m.User.findOne({ email: "client@x.io" });
  assert.equal(created.role, "user");
  assert.equal(await m.Subscription.countDocuments({ user: created._id }), 0);
  assert.equal((await c.access.getActivePlan(created)).plan.key, "Free");
});

test("sign-up coupon: Pro free for 3 months without paying", async () => {
  const admin = await mkUser("admin");
  const Coupon = (await import("../../models/Coupon.js")).default;
  await Coupon.create({
    code: "PRO3FREE", name: "Launch", description: "x", type: "free_trial", value: 3, currency: "NGN",
    validFrom: new Date(Date.now() - 864e5), validUntil: new Date(Date.now() + 864e5),
    targeting: { userTypes: ["vendor"] }, applicableTo: { subscriptionPlans: ["Pro"] }, createdBy: admin._id,
  });
  let res = await call(c.authController.register, undefined, {
    body: { email: "bad@x.io", password: "Str0ng!Passw0rd", userName: "bad", phone: "080", planType: "vendor", planName: "Pro", amount: 750000, couponCode: "NOPE" },
  });
  assert.equal(res.status, 400);
  assert.equal(await m.User.countDocuments({ email: "bad@x.io" }), 0, "no account left behind");

  res = await call(c.authController.register, undefined, {
    body: { email: "vee@x.io", password: "Str0ng!Passw0rd", userName: "vee", phone: "080", planType: "vendor", planName: "Pro", amount: 750000, couponCode: "PRO3FREE" },
  });
  assert.equal(res.status, 200, res.error?.message);
  assert.equal(res.body.data.couponApplied, true);
  assert.equal(res.body.data.paymentUrl, undefined);
  const user = await m.User.findOne({ email: "vee@x.io" });
  assert.equal((await c.access.getActivePlan(user)).plan.key, "Pro");
});
