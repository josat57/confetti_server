/**
 * Event passes (roadmap Phase 3) against an in-memory MongoDB, providers stubbed.
 * Run: npm run test:passes
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
process.env.FLUTTERWAVE_WEBHOOK_SECRET = "whsec";

const checkouts = [];
axios.post = async (url, payload) => {
  checkouts.push({ url, payload });
  if (url.includes("flutterwave")) return { data: { status: "success", data: { link: "https://pay.test/flw" } } };
  return { data: { status: true, data: { authorization_url: "https://pay.test/ps" } } };
};
// Provider verification returns whatever the test sets
let verifyResult = null;
axios.get = async () => ({ data: { data: verifyResult } });

let mongod;
const m = {};
const s = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_passes"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Event = await load("../../models/event.model.js");
  m.EventPass = await load("../../models/event-pass.model.js");
  m.Payment = await load("../../models/payment.model.js");
  m.Guest = await load("../../models/guest.model.js");
  s.passes = await load("../../services/event-pass.service.js");
  s.payments = await load("../../services/payment.service.js");
  s.access = await import("../../services/plan-access.service.js");
  s.webhook = await import("../../controllers/payment-webhook.controller.js");
  s.passController = await import("../../controllers/event-pass.controller.js");
  s.ai = await import("../../controllers/universal-ai-planner.controller.js");
  await m.EventPass.syncIndexes();
});

after(async () => {
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  checkouts.length = 0;
  verifyResult = null;
  for (const name of ["users", "events", "eventpasses", "payments", "guests"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

let seq = 0;
const mkUser = (role = "user") =>
  m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: "A", role, status: "active", isActive: true });
const mkEvent = (user, extra = {}) =>
  m.Event.create({
    title: "Our wedding", description: "d", eventType: "wedding", createdBy: user._id, status: "draft",
    startDate: new Date(Date.now() + 30 * 864e5), endDate: new Date(Date.now() + 31 * 864e5), ...extra,
  });
const run = (mw, req) => new Promise((resolve) => mw(req, {}, (err) => resolve(err)));
const pay = async (reference, data) => {
  const payment = await m.Payment.findOne({ reference });
  return s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data });
};

test("catalogue: Celebration ₦15,000, Plus ₦45,000, Diaspora $39 / £30 (Phase 10)", () => {
  const byKey = Object.fromEntries(s.passes.catalogue().map((p) => [p.key, p]));
  assert.equal(byKey.celebration.prices.NGN, 15000);
  assert.equal(byKey.plus.prices.NGN, 45000);
  assert.equal(byKey.diaspora.available, true);
  assert.deepEqual(byKey.diaspora.prices, { USD: 39, GBP: 30 });
});

test("checkout: only clients, only their own events, correct amount, paid once", async () => {
  const client = await mkUser("user");
  const event = await mkEvent(client);

  const planner = await mkUser("event-planner");
  await assert.rejects(s.passes.checkout(planner, { eventId: event._id, tier: "celebration" }), /planning their own event/);
  const stranger = await mkUser("user");
  await assert.rejects(s.passes.checkout(stranger, { eventId: event._id, tier: "celebration" }), /not found/);
  await assert.rejects(s.passes.checkout(client, { eventId: event._id, tier: "diaspora" }), /isn't sold in NGN/);

  const result = await s.passes.checkout(client, { eventId: event._id, tier: "celebration" });
  assert.equal(result.amount, 1500000);
  assert.equal(checkouts[0].payload.amount, 15000, "Flutterwave gets naira");
  assert.ok(checkouts[0].payload.redirect_url.endsWith("/api/v1/event-passes/callback"));
  assert.equal(await s.passes.activePassFor(event._id), null, "nothing before payment");

  // Underpaid: rejected
  await assert.rejects(pay(result.reference, { amount: 150, currency: "NGN" }), /doesn't match/);
  const retry = await s.passes.checkout(client, { eventId: event._id, tier: "celebration" });
  const data = { amount: 15000, currency: "NGN" };
  const [a, b] = await Promise.all([pay(retry.reference, data), pay(retry.reference, data)]);
  assert.equal([a, b].filter((x) => !x.alreadyProcessed).length, 1);

  const pass = await s.passes.activePassFor(event._id);
  assert.equal(pass.tier, "celebration");
  assert.equal(pass.amount, 1500000);
  assert.equal(pass.history.length, 1);

  await assert.rejects(s.passes.checkout(client, { eventId: event._id, tier: "celebration" }), /already has/);
});

test("upgrade Celebration → Plus pays the difference; webhook completes it", async () => {
  const client = await mkUser("user");
  const event = await mkEvent(client);
  const first = await s.passes.checkout(client, { eventId: event._id, tier: "celebration" });
  await pay(first.reference, { amount: 15000, currency: "NGN" });

  const up = await s.passes.checkout(client, { eventId: event._id, tier: "plus", paymentProvider: "paystack" });
  assert.equal(up.amount, 3000000, "₦30,000 difference");
  assert.equal(checkouts.at(-1).payload.amount, 3000000, "Paystack gets kobo");
  assert.equal((await s.passes.activePassFor(event._id)).tier, "celebration", "still Celebration until paid");

  // Paystack webhook (signature checked like production)
  const crypto = await import("node:crypto");
  const body = { event: "charge.success", data: { reference: up.reference, status: "success", amount: 3000000, currency: "NGN" } };
  const sig = crypto.createHmac("sha512", process.env.PAYSTACK_SECRET_KEY).update(JSON.stringify(body)).digest("hex");
  const out = {};
  await s.webhook.handlePaystackWebhook(
    { headers: { "x-paystack-signature": sig }, body },
    { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } },
    () => {}
  );
  assert.equal(out.status, 200);
  const pass = await s.passes.activePassFor(event._id);
  assert.equal(pass.tier, "plus");
  assert.equal(pass.amount, 4500000);
});

test("redirect callback verifies with the provider and returns to the event", async () => {
  const client = await mkUser("user");
  const event = await mkEvent(client);
  const r = await s.passes.checkout(client, { eventId: event._id, tier: "celebration" });
  const payment = await m.Payment.findOne({ reference: r.reference });
  verifyResult = { status: "successful", amount: 15000, currency: "NGN", tx_ref: r.reference, meta: { paymentId: payment._id.toString() } };
  let location;
  await s.passController.passPaymentCallback(
    { query: { status: "successful", transaction_id: "123", tx_ref: r.reference } },
    { redirect: (url) => (location = url) }
  );
  assert.ok(location.endsWith(`/user/dashboard/events/${event._id}?pass=success`), location);
  assert.equal((await s.passes.activePassFor(event._id)).tier, "celebration");
});

test("gates: guests, expenses, AI features, free event allowance, full AI with a pass", async () => {
  const client = await mkUser("user");
  const event = await mkEvent(client);
  const req = { user: client, params: { eventId: event._id.toString() } };

  // Free: 100 guests
  await m.Guest.collection.insertMany(Array.from({ length: 100 }, (_, i) => ({ event: event._id, firstName: `g${i}` })));
  await assert.rejects(s.access.assertWithinLimit(req, "guestsPerEvent", { eventId: event._id }), (e) => e.code === "PLAN_LIMIT_REACHED");
  let err = await run(s.access.requireEventPass("budgetTracking"), req);
  assert.equal(err.code, "PASS_REQUIRED");
  assert.equal(err.details.upgradeTo, "celebration");
  err = await run(s.access.requireClientPass("pdfExport"), req);
  assert.equal(err.code, "PASS_REQUIRED");
  // One free event at a time
  await assert.rejects(s.access.assertCanCreateEvent({ user: client }), (e) => e.details.resource === "events");
  let ctx = await s.ai.getUserContext({ user: client, headers: {}, body: {} });
  assert.deepEqual(ctx.aiModels, ["local"]);

  // With a pass
  const r = await s.passes.checkout(client, { eventId: event._id, tier: "celebration" });
  await pay(r.reference, { amount: 15000, currency: "NGN" });
  await s.access.assertWithinLimit(req, "guestsPerEvent", { eventId: event._id, adding: 500 });
  assert.equal(await run(s.access.requireEventPass("budgetTracking"), req), undefined);
  assert.equal(await run(s.access.requireClientPass("pdfExport"), req), undefined);
  assert.equal((await run(s.access.requireEventPass("runSheet"), req)).details.upgradeTo, "plus");
  await s.access.assertCanCreateEvent({ user: client }); // paid event doesn't use the free slot
  ctx = await s.ai.getUserContext({ user: client, headers: {}, body: {} });
  assert.equal(ctx.planLevel, 3);
  assert.equal(ctx.aiModels, undefined);

  // Planners aren't affected by pass gates
  const planner = await mkUser("event-planner");
  assert.equal(await run(s.access.requireEventPass("budgetTracking"), { user: planner, params: { eventId: event._id.toString() } }), undefined);
});
