/**
 * Featured placement (roadmap Phase 6). In-memory MongoDB; payment provider stubbed.
 * Run: npm run test:featured
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import axios from "axios";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.FLUTTERWAVE_SECRET_KEY = "FLWSECK_TEST-x";
process.env.FEATURED_SLOTS_PER_CATEGORY = "2";

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
  await mongoose.connect(mongod.getUri("confetti_featured"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.Subscription = await load("../../models/subscription.model.js");
  m.FeaturedBoost = await load("../../models/featured-boost.model.js");
  m.Payment = await load("../../models/payment.model.js");
  s.featured = await load("../../services/featured.service.js");
  s.payments = await load("../../services/payment.service.js");
  s.search = await import("../../controllers/planner-vendor.controller.js");
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
const mkVendor = async ({ plan, category = "catering", status = "approved", city = "Lagos" } = {}) => {
  const user = await m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: "V", role: "vendor", status: "active", isActive: true });
  if (plan) {
    await m.Subscription.create({ user: user._id, planType: "vendor", planName: plan, status: "active", endDate: new Date(Date.now() + 30 * 864e5), paymentProvider: "none", amount: 1 });
  }
  const id = (await m.Vendor.collection.insertOne({
    owner: user._id, name: `V${seq}`, businessName: `Biz ${seq}`, category, status, isActive: true, email: `v${seq}@x.io`,
    rating: 4, address: { city, state: "Lagos" }, priceRange: { min: 100000, max: 500000 }, photos: [{ url: "https://img/1.jpg" }],
  })).insertedId;
  return { user, vendorId: id };
};
const buy = async (user, weeks = 1) => {
  const r = await s.featured.checkout(user, { weeks });
  const payment = await m.Payment.findOne({ reference: r.reference });
  await s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 5000 * weeks, currency: "NGN" } });
  return r;
};
const search = async (query) => {
  const out = {};
  await s.search.searchVendors({ query }, { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } });
  return out;
};

test("buying a boost: ₦5,000 a week, featured once paid, boosts run back to back", async () => {
  const { user, vendorId } = await mkVendor();
  const r = await s.featured.checkout(user, { weeks: 2 });
  assert.equal(r.amount, 1000000);
  assert.equal(checkouts[0].payload.amount, 10000);
  assert.notEqual((await m.Vendor.findById(vendorId)).isFeatured, true, "not before payment");

  await assert.rejects(s.featured.checkout(user, { weeks: 5 }), /1 to 4/);
  const payment = await m.Payment.findOne({ reference: r.reference });
  await assert.rejects(s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 50, currency: "NGN" } }), /doesn't match/);
  await buy(user, 2);
  let vendor = await m.Vendor.findById(vendorId);
  assert.equal(vendor.isFeatured, true);
  const days = (vendor.featuredUntil - Date.now()) / 864e5;
  assert.ok(days > 13.9 && days < 14.1, `${days}`);

  await buy(user, 1);
  vendor = await m.Vendor.findById(vendorId);
  const days2 = (vendor.featuredUntil - Date.now()) / 864e5;
  assert.ok(days2 > 20.9 && days2 < 21.1, "stacked after the first boost");

  const pending = await setupPending();
  async function setupPending() {
    const { user: u } = await mkVendor({ status: "pending" });
    return s.featured.checkout(u, { weeks: 1 }).catch((e) => e);
  }
  assert.match(pending.message, /approved/);
});

test("category cap: sold out when full, with the next open date; other categories unaffected", async () => {
  const a = await mkVendor();
  const b = await mkVendor();
  await buy(a.user, 1);
  await buy(b.user, 2);
  const c = await mkVendor();
  const err = await s.featured.checkout(c.user, { weeks: 1 }).catch((e) => e);
  assert.equal(err.code, "FEATURED_SOLD_OUT");
  assert.ok(err.details.nextAvailableAt);
  const overview = await s.featured.overview(c.user);
  assert.equal(overview.slots.soldOut, true);

  // The vendor's own running boost doesn't block extending it
  await buy(a.user, 1);
  // Another category has its own slots
  const photo = await mkVendor({ category: "photography" });
  await buy(photo.user, 1);
});

test("credits: Business 1 a month, Venue 2, none on Pro", async () => {
  const pro = await mkVendor({ plan: "Pro" });
  const err = await s.featured.useCredit(pro.user).catch((e) => e);
  assert.equal(err.code, "PLAN_FEATURE_REQUIRED");

  const biz = await mkVendor({ plan: "Business" });
  let credits = await s.featured.credits(biz.user);
  assert.deepEqual([credits.perMonth, credits.remaining], [1, 1]);
  await s.featured.useCredit(biz.user);
  await assert.rejects(s.featured.useCredit(biz.user), /used this month/);
  assert.equal((await m.Vendor.findById(biz.vendorId)).isFeatured, true);

  const venue = await mkVendor({ plan: "Venue", category: "venue" });
  await s.featured.useCredit(venue.user);
  await s.featured.useCredit(venue.user);
  credits = await s.featured.credits(venue.user);
  assert.equal(credits.remaining, 0);
  assert.equal((await s.featured.overview(venue.user)).venueListing, true);
});

test("search: shape the directory reads, featured on top (max 3), filters respected, Venue plan venues featured", async () => {
  const plain = [];
  for (let i = 0; i < 5; i++) plain.push(await mkVendor());
  const boosted = await mkVendor();
  await buy(boosted.user, 1);
  await m.Vendor.updateMany({}, { $set: { rating: 5 } });
  await m.Vendor.updateOne({ _id: boosted.vendorId }, { $set: { rating: 1 } }); // would rank last organically

  let r = await search({ category: "Catering", limit: "3" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(Array.isArray(r.body.vendors));
  assert.equal(r.body.total, 6);
  assert.equal(r.body.totalPages, 2);
  assert.equal(String(r.body.vendors[0]._id), String(boosted.vendorId));
  assert.equal(r.body.vendors[0].featured, true);
  assert.equal(r.body.vendors.filter((v) => String(v._id) === String(boosted.vendorId)).length, 1, "no duplicate");
  assert.equal(r.body.vendors[1].featured, false);
  assert.deepEqual(r.body.vendors[0].location.city, "Lagos");
  assert.equal(r.body.vendors[0].pricing.startingPrice, 100000);
  assert.equal(r.body.vendors[0].portfolio[0].url, "https://img/1.jpg");

  // Page 2: no featured block
  r = await search({ category: "catering", limit: "3", page: "2" });
  assert.ok(r.body.vendors.every((v) => v.featured === false));

  // Filters: a featured vendor that doesn't match isn't shown
  r = await search({ category: "photography" });
  assert.equal(r.body.vendors.length, 0);

  // At most 3 featured on a page
  for (let i = 0; i < 4; i++) {
    const v = await mkVendor({ category: "venue", plan: "Venue" });
    void v;
  }
  r = await search({ category: "Venue" });
  assert.equal(r.body.vendors.filter((v) => v.featured).length, 3);
});
