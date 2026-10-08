/**
 * Subscription plans: catalogue sync, plan limits, feature gates and plan changes
 * (payments stubbed) against an in-memory MongoDB.
 * Run: npm run test:plans
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

// Payment providers: record what would be sent instead of calling them
const providerCalls = [];
axios.post = async (url, payload) => {
  providerCalls.push({ url, payload });
  if (url.includes("flutterwave")) return { data: { status: "success", data: { link: "https://pay.test/flw" } } };
  return { data: { status: true, data: { authorization_url: "https://pay.test/paystack" } } };
};

let mongod;
let m = {}; // models
let svc = {}; // services

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_plans"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.Subscription = await load("../../models/subscription.model.js");
  m.SubscriptionPlan = await load("../../models/subscriptionPlan.model.js");
  m.Payment = await load("../../models/payment.model.js");
  m.Portfolio = await load("../../models/portfolio.model.js");
  m.Event = await load("../../models/event.model.js");
  m.Message = await load("../../models/message.model.js");
  m.Conversation = await load("../../models/conversation.model.js");
  m.Coupon = await load("../../models/Coupon.js");
  m.CouponUsage = await load("../../models/CouponUsage.js");
  m.TeamInvitation = await load("../../models/team-invitation.model.js");
  svc.catalogue = await import("../../services/plan-catalogue.service.js");
  svc.access = await import("../../services/plan-access.service.js");
  svc.subscriptions = await load("../../services/subscription.service.js");
  svc.payments = await load("../../services/payment.service.js");
  svc.middleware = await import("../../middleware/subscription.js");
  svc.portfolio = await import("../../controllers/portfolio.controller.js");
  svc.comms = await import("../../controllers/communication.controller.js");
  svc.ai = await import("../../controllers/universal-ai-planner.controller.js");
  await m.Conversation.syncIndexes();
});

after(async () => {
  // Modules imported here open a Redis client that retries forever without a server
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  providerCalls.length = 0;
  for (const name of ["subscriptionplans", "teaminvitations", "users", "vendors", "subscriptions", "payments", "portfolios", "events", "messages", "conversations", "coupons", "couponusages"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
  await svc.catalogue.ensurePlans();
});

let seq = 0;
const mkUser = (role, extra = {}) =>
  m.User.create({
    username: `u${++seq}`,
    email: `u${seq}@x.io`,
    password: "Passw0rd!x",
    firstName: `User${seq}`,
    role,
    status: "active",
    isActive: true,
    ...extra,
  });
const mkVendor = async (user) =>
  (await m.Vendor.collection.insertOne({ owner: user._id, name: `Vendor ${seq}`, businessName: `Biz ${seq}`, email: `v${seq}@x.io`, photos: [] })).insertedId;
const subscribe = (user, planType, planName, { amount = 0, days = 30, status = "active", billingCycle = "monthly" } = {}) => {
  const start = new Date(Date.now() - 2 * 86400000);
  return m.Subscription.create({
    user: user._id,
    planType,
    planName,
    status,
    startDate: start,
    endDate: new Date(start.getTime() + days * 86400000),
    paymentProvider: amount ? "flutterwave" : "none",
    amount,
    currency: "NGN",
    billingCycle,
  });
};

async function call(fn, user, { params = {}, body = {}, query = {} } = {}) {
  const out = { status: 200 };
  const res = {
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; return this; },
  };
  await fn({ user, params, body, query }, res, (err) => {
    out.status = err?.statusCode || 500;
    out.error = err;
  });
  return out;
}
const run = (mw, user) =>
  new Promise((resolve) => {
    const req = { user };
    mw(req, {}, (err) => resolve({ err, req }));
  });

// ---------------------------------------------------------------------------

test("catalogue sync creates plans, retires old names and keeps admin price edits", async () => {
  await m.SubscriptionPlan.deleteMany({});
  await m.SubscriptionPlan.create([
    { planType: "vendor", planName: "Professional", displayName: "Professional", description: "old", pricing: [{ currency: "NGN", amount: 7900, amountInMinorUnits: 790000 }] },
    { planType: "vendor", planName: "Business", displayName: "Business", description: "old", pricing: [{ currency: "NGN", amount: 14900, amountInMinorUnits: 1490000 }] },
  ]);
  const summary = await svc.catalogue.ensurePlans();
  assert.deepEqual(summary.retired, ["vendor/Professional"]);
  assert.ok(summary.updated.includes("vendor/Business"));

  const active = await m.SubscriptionPlan.find({ isActive: true }).lean();
  assert.deepEqual(active.map((p) => `${p.planType}/${p.planName}`).sort(), [
    "planner/Agency", "planner/Solo", "planner/Studio", "vendor/Business", "vendor/Listing", "vendor/Pro", "vendor/Venue",
  ]);
  const ngn = async (type, name) =>
    (await m.SubscriptionPlan.findOne({ planType: type, planName: name })).getPriceForCurrency("NGN").amount;
  assert.equal(await ngn("vendor", "Business"), 20000);
  assert.equal(await ngn("vendor", "Pro"), 7500);
  assert.equal(await ngn("planner", "Studio"), 15000);
  assert.equal(await ngn("planner", "Agency"), 40000);

  // Admin raises Pro's price: a restart must not undo it
  const pro = await m.SubscriptionPlan.findOne({ planType: "vendor", planName: "Pro" });
  pro.setPricing("NGN", 8000, 800000);
  await pro.save();
  await svc.catalogue.ensurePlans();
  assert.equal(await ngn("vendor", "Pro"), 8000);

  // Old names still find their replacement
  assert.equal((await m.SubscriptionPlan.findByTypeAndName("vendor", "Professional")).planName, "Pro");
  assert.equal((await m.SubscriptionPlan.findByTypeAndName("planner", "Starter")).planName, "Solo");
});

test("plan lookup: old names, expiry and free fallback", async () => {
  const vendorUser = await mkUser("vendor");
  await subscribe(vendorUser, "vendor", "Professional", { amount: 790000 });
  assert.equal((await svc.access.getActivePlan(vendorUser)).plan.key, "Pro");

  const planner = await mkUser("event-planner");
  await subscribe(planner, "planner", "Enterprise", { amount: 1, days: 1, status: "active" });
  await m.Subscription.updateOne({ user: planner._id }, { endDate: new Date(Date.now() - 1000) });
  assert.equal((await svc.access.getActivePlan(planner)).plan.key, "Solo", "expired → free");

  const nobody = await mkUser("event-planner");
  assert.equal((await svc.access.getActivePlan(nobody)).plan.key, "Solo");
  assert.equal(svc.middleware.getPlanLevel("Professional", "vendor"), 2);
  assert.equal(svc.middleware.getPlanLevel("Business", "vendor"), 3);
});

test("Listing vendors: 10 portfolio photos, 5 lead replies a month, no team", async () => {
  const user = await mkUser("vendor");
  await mkVendor(user);
  await subscribe(user, "vendor", "Listing");

  const photos = (n) => Array.from({ length: n }, (_, i) => ({ url: `https://img/${i}.jpg` }));
  let r = await call(svc.portfolio.createPortfolioItem, user, { body: { title: "Wedding", photos: photos(8) } });
  assert.equal(r.status, 201);
  r = await call(svc.portfolio.addPhotos, user, { params: { id: r.body.data.portfolioItem._id }, body: { photos: photos(3) } });
  assert.equal(r.status, 403);
  assert.equal(r.error.code, "PLAN_LIMIT_REACHED");
  assert.deepEqual(
    { resource: r.error.details.resource, limit: r.error.details.limit, used: r.error.details.used, upgradeTo: r.error.details.upgradeTo },
    { resource: "portfolioPhotos", limit: 10, used: 8, upgradeTo: "Pro" }
  );

  // Lead replies: 5 conversations, then blocked; more messages in an answered one are free
  const clients = [];
  for (let i = 0; i < 6; i++) clients.push(await mkUser("event-planner"));
  const convIds = [];
  for (const client of clients) {
    const c = await call(svc.comms.createConversation, client, { body: { participantId: user._id.toString(), initialMessage: "Hi" } });
    convIds.push(c.body.data.conversation._id);
  }
  for (let i = 0; i < 5; i++) {
    r = await call(svc.comms.sendConversationMessage, user, { params: { id: convIds[i] }, body: { content: "Hello!" } });
    assert.equal(r.status, 201, r.error?.message);
  }
  r = await call(svc.comms.sendConversationMessage, user, { params: { id: convIds[5] }, body: { content: "Hello!" } });
  assert.equal(r.status, 403);
  assert.equal(r.error.details.resource, "leadRepliesPerMonth");
  r = await call(svc.comms.sendConversationMessage, user, { params: { id: convIds[0] }, body: { content: "Follow-up" } });
  assert.equal(r.status, 201, "already answered this month");

  await assert.rejects(svc.access.assertWithinLimit({ user }, "teamMembers"), (e) => e.details.limit === 0);

  const usage = await svc.access.getUsageSummary(user);
  assert.equal(usage.plan.key, "Listing");
  assert.equal(usage.usage.portfolioPhotos.used, 8);
  assert.equal(usage.usage.leadRepliesPerMonth.used, 5);
});

test("planners: active event limits count only live events; Studio gets 15 and a team of 3", async () => {
  const planner = await mkUser("event-planner");
  const ev = (status, daysFromNow) =>
    m.Event.create({
      title: "E", description: "d", eventType: "wedding", status, createdBy: planner._id,
      startDate: new Date(Date.now() + daysFromNow * 86400000),
      endDate: new Date(Date.now() + (daysFromNow + 1) * 86400000),
    });
  await ev("published", 10);
  await ev("draft", 20);
  await ev("published", -30); // finished
  await ev("cancelled", 5);
  await assert.rejects(svc.access.assertCanCreateEvent({ user: planner }), (e) => e.details.resource === "activeEvents" && e.details.used === 2);

  await subscribe(planner, "planner", "Studio", { amount: 1500000 });
  await svc.access.assertCanCreateEvent({ user: planner }); // 2 of 15
  await m.TeamInvitation.collection.insertMany(
    [1, 2, 3].map((i) => ({ planner: planner._id, email: `t${i}@x.io`, token: `tok-${seq}-${i}`, status: "pending", expiresAt: new Date(Date.now() + 86400000) }))
  );
  await assert.rejects(svc.access.assertWithinLimit({ user: planner }, "teamMembers"), (e) => e.details.limit === 3 && e.details.used === 3);
});

test("feature gates: vendor AI needs Business, API keys need API access, AI context follows the plan", async () => {
  const pro = await mkUser("vendor");
  await mkVendor(pro);
  await subscribe(pro, "vendor", "Pro", { amount: 750000 });
  let { err } = await run(svc.middleware.requireBusinessPlan, pro);
  assert.equal(err.statusCode, 403);
  assert.equal(err.details.upgradeTo, "Business");
  ({ err } = await run(svc.access.requirePlanFeature("apiAccess"), pro));
  assert.equal(err.code, "PLAN_FEATURE_REQUIRED");

  const biz = await mkUser("vendor");
  await mkVendor(biz);
  await subscribe(biz, "vendor", "Business", { amount: 2000000 });
  const ok = await run(svc.middleware.requireBusinessPlan, biz);
  assert.equal(ok.err, undefined);
  assert.equal(ok.req.vendor.subscription.planName, "Business");

  const listing = await mkUser("vendor");
  let ctx = await svc.ai.getUserContext({ user: listing, headers: {}, body: {} });
  assert.deepEqual([ctx.planName, ctx.planLevel, ctx.aiModels], ["Listing", 2, ["local"]]);
  ctx = await svc.ai.getUserContext({ user: biz, headers: {}, body: {} });
  assert.deepEqual([ctx.planName, ctx.planLevel, ctx.aiModels], ["Business", 3, undefined]);
});

test("upgrade from free: full price, paid once, underpayment rejected", async () => {
  const user = await mkUser("vendor");
  await subscribe(user, "vendor", "Listing");

  const result = await svc.subscriptions.changePlan(user, { planName: "Pro" });
  assert.equal(result.action, "payment_required");
  assert.equal(result.amountDue, 750000);
  assert.equal(providerCalls.at(-1).payload.amount, 7500, "Flutterwave gets major units");
  const payment = await m.Payment.findOne({ reference: result.reference });
  assert.equal(payment.amount, 750000);
  assert.equal(payment.subscriptionDetails.newPeriod, true);
  assert.equal((await svc.access.getActivePlan(user)).plan.key, "Listing", "not upgraded before payment");

  // Underpaid: rejected, stays on Listing
  await assert.rejects(
    svc.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 75, currency: "NGN" } }),
    /doesn't match/
  );
  assert.equal((await m.Payment.findById(payment._id)).status, "failed");

  const retry = await svc.subscriptions.changePlan(user, { planName: "Pro" });
  const payment2 = await m.Payment.findOne({ reference: retry.reference });
  const data = { amount: 7500, currency: "NGN", id: 99 };
  const [a, b] = await Promise.all([
    svc.payments.completeSubscriptionPayment(payment2._id, { provider: "flutterwave", data }),
    svc.payments.completeSubscriptionPayment(payment2._id, { provider: "flutterwave", data }),
  ]);
  assert.equal([a, b].filter((x) => !x.alreadyProcessed).length, 1, "applied exactly once");

  const sub = await m.Subscription.findById(payment2.subscription);
  assert.equal(sub.planName, "Pro");
  assert.equal(sub.status, "active");
  assert.equal(sub.paymentHistory.length, 1);
  const days = (sub.endDate - Date.now()) / 86400000;
  assert.ok(days > 27 && days < 32, `monthly period, got ${days}`);
  assert.equal((await svc.access.getActivePlan(user)).plan.key, "Pro");
});

test("paid upgrade is prorated; cheaper plan waits for the period end; yearly is 10 months", async () => {
  const user = await mkUser("vendor");
  const sub = await subscribe(user, "vendor", "Pro", { amount: 750000, days: 30 }); // 2 of 30 days used

  const up = await svc.subscriptions.changePlan(user, { planName: "Business", paymentProvider: "paystack" });
  const expected = Math.round((2000000 - 750000) * (28 / 30));
  assert.ok(Math.abs(up.amountDue - expected) < 200, `${up.amountDue} vs ${expected}`);
  assert.equal(providerCalls.at(-1).payload.amount, up.amountDue, "Paystack gets kobo, not ×100");
  const payment = await m.Payment.findOne({ reference: up.reference });
  await svc.payments.completeSubscriptionPayment(payment._id, { provider: "paystack", data: { amount: up.amountDue, currency: "NGN" } });
  const upgraded = await m.Subscription.findById(sub._id);
  assert.equal(upgraded.planName, "Business");
  assert.equal(upgraded.endDate.getTime(), sub.endDate.getTime(), "same period");

  const down = await svc.subscriptions.changePlan(user, { planName: "Pro" });
  assert.equal(down.action, "scheduled");
  assert.equal((await svc.access.getActivePlan(user)).plan.key, "Business", "keeps what was paid for");
  assert.equal((await m.Subscription.findById(sub._id)).pendingChange.planName, "Pro");

  // Changing back to the current plan cancels the scheduled change
  const back = await svc.subscriptions.changePlan(user, { planName: "Business" });
  assert.equal(back.action, "changed");
  assert.equal((await m.Subscription.findById(sub._id)).pendingChange?.planName, undefined);

  const fresh = await mkUser("event-planner");
  const yearly = await svc.subscriptions.changePlan(fresh, { planName: "Studio", billingCycle: "yearly" });
  assert.equal(yearly.amountDue, 15000000);
  const yp = await m.Payment.findOne({ reference: yearly.reference });
  assert.equal(yp.subscriptionDetails.billingCycle, "yearly");
  await svc.payments.completeSubscriptionPayment(yp._id, { provider: "flutterwave", data: { amount: 150000, currency: "NGN" } });
  const ys = await m.Subscription.findById(yp.subscription);
  assert.equal(ys.billingCycle, "yearly");
  assert.ok((ys.endDate - Date.now()) / 86400000 > 360);
});

test("coupon: Pro free for 3 months, once per vendor", async () => {
  const admin = await mkUser("admin");
  await m.Coupon.create({
    code: "PRO3FREE", name: "Launch", description: "Pro free for 3 months", type: "free_trial", value: 3,
    currency: "NGN", validFrom: new Date(Date.now() - 86400000), validUntil: new Date(Date.now() + 30 * 86400000),
    targeting: { userTypes: ["vendor"] }, applicableTo: { subscriptionPlans: ["Pro"] }, createdBy: admin._id,
  });
  const user = await mkUser("vendor");
  await subscribe(user, "vendor", "Listing");

  await assert.rejects(svc.subscriptions.changePlan(user, { planName: "Business", couponCode: "pro3free" }), /doesn't apply/);
  const result = await svc.subscriptions.changePlan(user, { planName: "Pro", couponCode: "pro3free" });
  assert.equal(result.action, "changed");
  assert.equal(providerCalls.length, 0, "no payment");
  const months = (result.subscription.endDate - Date.now()) / (30 * 86400000);
  assert.ok(months > 2.9 && months < 3.2);
  assert.equal((await svc.access.getActivePlan(user)).plan.key, "Pro");
  assert.equal(await m.CouponUsage.countDocuments({ couponCode: "PRO3FREE" }), 1);

  // Second use by the same vendor is refused
  await m.Subscription.updateMany({ user: user._id }, { status: "expired", endDate: new Date(Date.now() - 1000) });
  await assert.rejects(svc.subscriptions.changePlan(user, { planName: "Pro", couponCode: "PRO3FREE" }), /already used/);
});

test("cancel keeps the plan until the period ends; reactivate; other users can't touch it", async () => {
  const user = await mkUser("event-planner");
  const sub = await subscribe(user, "planner", "Studio", { amount: 1500000 });
  const stranger = await mkUser("event-planner");

  await assert.rejects(svc.subscriptions.cancelSubscription(sub._id, stranger), (e) => e.statusCode === 404);
  await assert.rejects(svc.subscriptions.upgradeSubscription(sub._id, "Agency", "flutterwave", stranger), (e) => e.statusCode === 404);

  await svc.subscriptions.cancelOwn(user, { reason: "too expensive" });
  assert.equal((await m.Subscription.findById(sub._id)).status, "cancelled");
  assert.equal((await svc.access.getActivePlan(user)).plan.key, "Studio", "paid period honoured");

  await svc.subscriptions.reactivate(user);
  const back = await m.Subscription.findById(sub._id);
  assert.equal(back.status, "active");
  assert.equal(back.cancelAtPeriodEnd, false);
});

test("registration subscription: yearly price must match, free plans don't expire", async () => {
  const user = await mkUser("event-planner", { status: "pending_payment" });
  await assert.rejects(svc.subscriptions.createWithPayment(user._id, "planner", "Studio", 1500000, "NGN", "yearly"), /Invalid plan amount/);
  const res = await svc.subscriptions.createWithPayment(user._id, "planner", "Studio", 15000000, "NGN", "yearly");
  assert.equal(res.paymentRequired, true);
  assert.equal(res.subscription.billingCycle, "yearly");

  const free = await mkUser("vendor");
  const fr = await svc.subscriptions.createWithPayment(free._id, "vendor", "Basic", 0);
  assert.equal(fr.subscription.planName, "Listing", "old name resolves");
  assert.ok(fr.subscription.endDate.getFullYear() > new Date().getFullYear() + 50);
});
