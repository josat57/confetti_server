/**
 * Diaspora Pass (roadmap Phase 10): pass in USD/GBP, paying vendors from abroad
 * through escrow (vendor gets naira), escrow required, video calls with invites.
 * In-memory MongoDB; payment provider stubbed. Run: npm run test:diaspora
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
process.env.FX_NGN_PER_USD = "1600";
process.env.FX_NGN_PER_GBP = "2000";
process.env.FX_BUFFER = "0";

const checkouts = [];
axios.post = async (url, payload) => {
  checkouts.push({ url, payload });
  return { data: { status: "success", data: { link: "https://pay.test/flw", authorization_url: "https://pay.test/ps" } } };
};

let mongod;
const m = {};
const s = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_diaspora"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Event = await load("../../models/event.model.js");
  m.EventPass = await load("../../models/event-pass.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.VendorBooking = await load("../../models/vendor-booking.model.js");
  m.Payment = await load("../../models/payment.model.js");
  m.EscrowPayment = await load("../../models/escrow-payment.model.js");
  m.Meeting = await load("../../models/meeting.model.js");
  m.Message = await load("../../models/message.model.js");
  m.Notification = await load("../../models/notification.model.js");
  s.passes = await load("../../services/event-pass.service.js");
  s.payments = await load("../../services/payment.service.js");
  s.escrow = await load("../../services/escrow.service.js");
  s.escrowMod = await import("../../services/escrow.service.js");
  s.meetings = await load("../../services/meeting.service.js");
  s.meetingMod = await import("../../services/meeting.service.js");
  s.conversations = await import("../../services/conversation.service.js");
  s.access = await import("../../services/plan-access.service.js");
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
  m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: `F${seq}`, role, status: "active", isActive: true, ...extra });
const mkEvent = (owner) =>
  m.Event.create({ title: "Wedding in Enugu", description: "From London", eventType: "wedding", createdBy: owner._id, startDate: new Date(Date.now() + 90 * 864e5), endDate: new Date(Date.now() + 91 * 864e5) });
const mkVendor = async () => {
  const owner = await mkUser("vendor");
  const id = (await m.Vendor.collection.insertOne({ owner: owner._id, name: "Caterer", businessName: "Mama Put", category: "catering", status: "approved", isActive: true, email: "v@x.io" })).insertedId;
  return { owner, vendorId: id };
};
const buyPass = async (client, event, currency) => {
  const r = await s.passes.checkout(client, { eventId: event._id, tier: "diaspora", currency });
  const payment = await m.Payment.findOne({ reference: r.reference });
  await s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: payment.amount / 100, currency } });
  return r;
};

test("Diaspora Pass: on sale in USD and GBP only, gives Plus features, escrow and video calls", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  await assert.rejects(s.passes.checkout(client, { eventId: event._id, tier: "diaspora", currency: "NGN" }), /isn't sold in NGN/);
  const r = await buyPass(client, event, "GBP");
  assert.deepEqual([r.amount, r.currency], [3000, "GBP"]);
  assert.equal(checkouts[0].payload.currency, "GBP");
  const pass = await m.EventPass.findOne({ event: event._id });
  assert.deepEqual([pass.tier, pass.status, pass.currency], ["diaspora", "active", "GBP"]);

  const features = await s.passes.featuresFor(event._id);
  for (const f of ["runSheet", "giftTracking", "asoEbi", "curatedShortlist", "escrow", "videoCalls"]) assert.equal(features[f], true, f);
  assert.equal(await new Promise((res) => s.access.requireClientPass("videoCalls")({ user: client }, {}, res)), undefined);

  // Paystack can't take pounds
  const other = await mkEvent(client);
  await assert.rejects(s.passes.checkout(client, { eventId: other._id, tier: "diaspora", currency: "GBP", paymentProvider: "paystack" }), /Paystack can't take payments in GBP/);
});

test("paying a vendor from abroad: charged in USD at the rate, held and paid out in naira; refunds in USD", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  const { owner, vendorId } = await mkVendor();
  const booking = await m.VendorBooking.create({ vendor: vendorId, planner: client._id, event: event._id, status: "confirmed", totalAmount: 800000, depositAmount: 200000 });

  // Before the pass: manual payments are allowed and no escrow requirement
  let view = await s.escrow.listForBooking(client, booking._id);
  assert.equal(view.escrowRequired, false);
  assert.deepEqual(view.fxRates, { USD: 1600, GBP: 2000 });

  await assert.rejects(s.escrow.checkout(client, { bookingId: booking._id, amount: 200000, currency: "USD", paymentProvider: "paystack" }), /Flutterwave/);
  await assert.rejects(s.escrow.checkout(client, { bookingId: booking._id, amount: 200000, currency: "EUR" }), /NGN, USD or GBP/);
  const r = await s.escrow.checkout(client, { bookingId: booking._id, amount: 200000, currency: "USD" });
  assert.deepEqual(r.charged, { amount: 12500, currency: "USD" }, "₦200,000 at ₦1,600 = $125.00");
  assert.equal(checkouts.at(-1).payload.amount, 125);
  assert.equal(checkouts.at(-1).payload.currency, "USD");

  const payment = await m.Payment.findOne({ reference: r.reference });
  assert.deepEqual([payment.amount, payment.currency], [12500, "USD"]);
  await assert.rejects(s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 125, currency: "NGN" } }), /doesn't match/);
  await m.Payment.updateOne({ _id: payment._id }, { status: "pending" });
  await s.payments.completeSubscriptionPayment(payment._id, { provider: "flutterwave", data: { amount: 125, currency: "USD" } });

  const escrow = await m.EscrowPayment.findOne({ reference: r.reference });
  assert.deepEqual([escrow.status, escrow.amount, escrow.currency, escrow.charged.currency, escrow.charged.rate], ["held", 20000000, "NGN", "USD", 1600]);
  const b = await m.VendorBooking.findById(booking._id);
  assert.equal(b.payments[0].amount, 200000, "booking records naira");
  view = await s.escrow.listForBooking(owner, booking._id);
  assert.deepEqual(view.payments[0].charged, { amount: 125, currency: "USD" });

  // A partial refund goes back in dollars, in proportion
  const refunds = [];
  axios.post = async (url, payload) => {
    refunds.push({ url, payload });
    return { data: { status: "success", data: { status: "completed", id: 1 } } };
  };
  await s.escrow.refund(escrow, 5000000, "Menu changed"); // ₦50,000
  assert.equal(refunds[0].payload.amount, 31.25, "$31.25 back");
});

test("escrow required: with a Diaspora Pass, the vendor can't record payments made outside Confetti", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  const { owner, vendorId } = await mkVendor();
  const booking = await m.VendorBooking.create({ vendor: vendorId, planner: client._id, event: event._id, status: "confirmed", totalAmount: 500000, depositAmount: 100000 });
  const call = (fn, body = {}) =>
    new Promise((resolve) => {
      const res = { status() { return this; }, json(b) { resolve({ ok: true, body: b }); } };
      fn({ user: owner, params: { id: String(booking._id) }, body }, res, (err) => resolve({ ok: false, err }));
    });

  let out = await call(s.bookingCtl.recordVendorBookingPayment, { amount: 1000 });
  assert.equal(out.ok, true, "allowed without the pass");

  await m.EventPass.create({ event: event._id, user: client._id, tier: "diaspora", status: "active", currency: "USD" });
  assert.equal(await s.escrowMod.escrowRequiredFor(booking), true);
  out = await call(s.bookingCtl.recordVendorBookingPayment, { amount: 1000 });
  assert.equal(out.err?.code, "ESCROW_REQUIRED");
  out = await call(s.bookingCtl.markVendorDepositPaid);
  assert.equal(out.err?.code, "ESCROW_REQUIRED");
  const view = await s.escrow.listForBooking(client, booking._id);
  assert.deepEqual([view.escrowRequired, view.passCurrency], [true, "USD"]);
});

test("video calls: from a conversation or booking, Jitsi link, message, invites; reschedule and cancel", async () => {
  const client = await mkUser();
  const { owner, vendorId } = await mkVendor();
  const convo = await s.conversations.findOrCreateConversation(client._id, owner._id);

  // Clients need a pass with video calls
  const gate = await new Promise((res) => s.access.requireClientPass("videoCalls")({ user: client }, {}, res));
  assert.equal(gate.code, "PASS_REQUIRED");
  assert.equal(gate.details.upgradeTo, "diaspora");

  const startsAt = new Date(Date.now() + 2 * 864e5);
  await assert.rejects(s.meetings.create(client, { conversationId: convo._id, startsAt: new Date(Date.now() - 3600e3) }), /future/);
  await assert.rejects(s.meetings.create(client, { conversationId: convo._id, startsAt, durationMinutes: 500 }), /10 to 240/);
  const stranger = await mkUser();
  await assert.rejects(s.meetings.create(stranger, { conversationId: convo._id, startsAt }), /not found/);

  const meeting = await s.meetings.create(client, { conversationId: convo._id, startsAt, title: "Menu tasting", durationMinutes: 45 });
  assert.match(meeting.url, /^https:\/\/meet\.jit\.si\/Confetti-[a-f0-9]{24}$/);
  assert.deepEqual(meeting.participants.map(String).sort(), [String(client._id), String(owner._id)].sort());
  const msg = await m.Message.findOne({ conversation: convo._id });
  assert.match(msg.content, /scheduled a video call: Menu tasting/);
  assert.match(msg.content, /meet\.jit\.si/);
  assert.equal(await m.Notification.countDocuments({ recipient: owner._id, category: "message", title: /video call/ }), 1);

  const ics = await s.meetings.ics(owner, meeting._id);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /METHOD:REQUEST/);
  assert.match(ics, /SUMMARY:Menu tasting/);
  assert.ok(ics.split("\r\n").every((l) => l.length <= 75), "lines folded");
  await assert.rejects(s.meetings.ics(stranger, meeting._id), /not found/);

  const moved = await s.meetings.reschedule(owner, meeting._id, { startsAt: new Date(Date.now() + 3 * 864e5) });
  assert.equal(moved.sequence, 1);
  const cancelled = await s.meetings.cancel(client, meeting._id);
  assert.equal(cancelled.status, "cancelled");
  assert.match(await s.meetings.ics(client, meeting._id), /METHOD:CANCEL/);
  assert.equal((await s.meetings.list(client, { upcoming: true })).length, 0);

  // From a vendor's own booking with a walk-in client (email only)
  const walkIn = await m.VendorBooking.create({ vendor: vendorId, status: "confirmed", clientName: "Ife", clientEmail: "IFE@x.io" });
  const m2 = await s.meetings.create(owner, { bookingId: walkIn._id, startsAt });
  assert.deepEqual(m2.guestEmails, ["ife@x.io"]);
  const noEmail = await m.VendorBooking.create({ vendor: vendorId, status: "confirmed", clientName: "Tolu" });
  await assert.rejects(s.meetings.create(owner, { bookingId: noEmail._id, startsAt }), /client's email/);
});

test("video calls on Daily: private room, a personal link per person, room moved and deleted; falls back to Jitsi", async () => {
  const client = await mkUser();
  const { owner } = await mkVendor();
  const convo = await s.conversations.findOrCreateConversation(client._id, owner._id);
  const calls = [];
  const originalRequest = axios.request;
  let failRooms = false;
  axios.request = async (config) => {
    calls.push(config);
    if (config.url.endsWith("/rooms") && failRooms) throw new Error("Daily is down");
    if (config.url.endsWith("/rooms")) return { data: { name: config.data.name, url: `https://confetti.daily.co/${config.data.name}` } };
    if (config.url.endsWith("/meeting-tokens")) return { data: { token: `tok-${config.data.properties.user_name}` } };
    return { data: {} };
  };
  process.env.DAILY_API_KEY = "daily-test";
  try {
    const startsAt = new Date(Date.now() + 864e5);
    const meeting = await s.meetings.create(client, { conversationId: convo._id, startsAt, durationMinutes: 30 });
    const roomCall = calls.find((c) => c.url.endsWith("/rooms"));
    assert.equal(roomCall.data.privacy, "private");
    assert.equal(roomCall.data.properties.nbf, Math.floor((startsAt.getTime() - 30 * 60000) / 1000));
    assert.equal(roomCall.headers.Authorization, "Bearer daily-test");
    assert.equal(meeting.provider, "daily");
    assert.equal(meeting.joinTokens, undefined, "tokens never returned");
    assert.match(meeting.url, /^https:\/\/confetti\.daily\.co\/confetti-[a-f0-9]{20}\?t=tok-/, "creator gets their own link");

    // Each person sees only their own link; the shared message has none
    const [mine] = await s.meetings.list(owner, { upcoming: true });
    assert.notEqual(mine.url, meeting.url);
    assert.match(mine.url, /\?t=tok-F/);
    const msg = await m.Message.findOne({ conversation: convo._id }).sort({ createdAt: -1 });
    assert.doesNotMatch(msg.content, /\?t=/);
    assert.match(await s.meetings.ics(owner, meeting._id), new RegExp(mine.url.replace(/[?]/g, "\\?")));

    // Rescheduling moves the room window and reissues links; cancelling deletes the room
    calls.length = 0;
    await s.meetings.reschedule(owner, meeting._id, { startsAt: new Date(Date.now() + 2 * 864e5) });
    assert.ok(calls.some((c) => c.method === "post" && /\/rooms\/confetti-/.test(c.url)));
    await s.meetings.cancel(client, meeting._id);
    assert.ok(calls.some((c) => c.method === "delete" && /\/rooms\/confetti-/.test(c.url)));

    // Daily down: the call still gets a Jitsi room
    failRooms = true;
    const fallback = await s.meetings.create(client, { conversationId: convo._id, startsAt });
    assert.equal(fallback.provider, "jitsi");
    assert.match(fallback.url, /meet\.jit\.si/);
  } finally {
    delete process.env.DAILY_API_KEY;
    axios.request = originalRequest;
  }
});
