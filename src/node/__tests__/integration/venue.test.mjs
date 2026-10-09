/**
 * Venue plan (roadmap Phase 9): spaces, double-booking prevention, timed holds,
 * deposit schedules and reminders. In-memory MongoDB.
 * Run: npm run test:venue
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";

let mongod;
const m = {};
const s = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_venue"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.Subscription = await load("../../models/subscription.model.js");
  m.VendorBooking = await load("../../models/vendor-booking.model.js");
  m.Notification = await load("../../models/notification.model.js");
  m.venue = await import("../../models/venue.model.js");
  s.venue = await load("../../services/venue.service.js");
  s.schedule = await import("../../services/payment-schedule.service.js");
  s.scheduleUtil = await import("../../utils/payment-schedule.js");
  s.access = await import("../../services/plan-access.service.js");
  s.catalogue = await import("../../services/plan-catalogue.service.js");
});

after(async () => {
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await m.venue.VenueSlotLock.syncIndexes();
  await s.catalogue.ensurePlans();
});

let seq = 0;
const mkVenue = async (plan = "Venue") => {
  const user = await m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: "V", role: "vendor", status: "active", isActive: true });
  if (plan) await m.Subscription.create({ user: user._id, planType: "vendor", planName: plan, status: "active", endDate: new Date(Date.now() + 30 * 864e5), paymentProvider: "none", amount: 1 });
  const vendorId = (await m.Vendor.collection.insertOne({ owner: user._id, name: `V${seq}`, businessName: `Hall ${seq}`, category: "venue", status: "approved", isActive: true, email: `v${seq}@x.io` })).insertedId;
  return { user, vendorId };
};
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test("gating: venue tools need the Venue plan", async () => {
  const { user } = await mkVenue("Business");
  const err = await new Promise((r) => s.access.requirePlanFeature("venueTools")({ user }, {}, r));
  assert.equal(err.code, "PLAN_FEATURE_REQUIRED");
  const venue = await mkVenue();
  assert.equal(await new Promise((r) => s.access.requirePlanFeature("venueTools")({ user: venue.user }, {}, r)), undefined);
});

test("spaces and double booking: sessions, multi-day, races, moving, releasing", async () => {
  const { user } = await mkVenue();
  const hall = await s.venue.createSpace(user, { name: "Main hall", capacity: { seated: 500 }, pricePerDay: 1500000 });
  const garden = await s.venue.createSpace(user, { name: "Garden" });
  await assert.rejects(s.venue.createSpace(user, { name: " " }), /Name the space/);

  const d = day(30);
  const morning = await s.venue.createReservation(user, { space: hall._id, status: "blocked", dateFrom: d, session: "morning", title: "Maintenance" });
  // Evening on the same day is free; full day isn't
  const evening = await s.venue.createReservation(user, { space: hall._id, status: "held", dateFrom: d, session: "evening", clientName: "Ada" });
  const err = await s.venue.createReservation(user, { space: hall._id, status: "held", dateFrom: d, clientName: "Bola" }).catch((e) => e);
  assert.equal(err.code, "VENUE_DATE_TAKEN");
  assert.equal(err.details.conflicts.length, 2);
  // Another space is independent
  await s.venue.createReservation(user, { space: garden._id, status: "held", dateFrom: d, clientName: "Bola" });

  // Racing requests for the same slot: exactly one wins
  const d2 = day(40);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) => s.venue.createReservation(user, { space: hall._id, status: "held", dateFrom: d2, dateTo: day(41), clientName: `R${i}` }))
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await m.venue.VenueSlotLock.countDocuments({ date: { $in: [d2, day(41)] } }), 4, "no stray locks");

  // Availability check
  let av = await s.venue.availability(user, { space: hall._id, dateFrom: day(41), session: "evening" });
  assert.equal(av.available, false);
  av = await s.venue.availability(user, { space: hall._id, dateFrom: day(42) });
  assert.equal(av.available, true);

  // Moving a hold onto taken dates fails and keeps the original slots
  await assert.rejects(s.venue.updateReservation(user, evening._id, { session: "full" }), /already taken/);
  assert.equal(await m.venue.VenueSlotLock.countDocuments({ reservation: evening._id }), 1);
  // Moving to free dates works and frees the old ones
  await s.venue.updateReservation(user, evening._id, { dateFrom: day(50), dateTo: day(51) });
  assert.equal(await m.venue.VenueSlotLock.countDocuments({ reservation: evening._id }), 2, "two evenings");
  assert.equal((await s.venue.availability(user, { space: hall._id, dateFrom: d, session: "evening" })).available, true);

  await assert.rejects(s.venue.createReservation(user, { space: hall._id, dateFrom: day(60), dateTo: day(59) }), /before the start/);
  await assert.rejects(s.venue.createReservation(user, { space: hall._id, dateFrom: day(60), dateTo: day(80) }), /14 days/);

  // Releasing frees the slots
  await s.venue.release(user, morning._id);
  assert.equal((await s.venue.availability(user, { space: hall._id, dateFrom: d, session: "morning" })).available, true);
  const cal = await s.venue.calendar(user, { from: day(0), to: day(60) });
  assert.ok(cal.reservations.every((r) => ["held", "booked", "blocked"].includes(r.status)));

  // Another vendor can't see or touch these
  const other = await mkVenue();
  await assert.rejects(s.venue.release(other.user, evening._id), /not found/);
  await assert.rejects(s.venue.createReservation(other.user, { space: hall._id, dateFrom: day(70) }), /Space not found/);
  // A space with upcoming reservations can't be deleted
  await assert.rejects(s.venue.deleteSpace(user, hall._id), /upcoming/);
});

test("holds: expire on their own, warn a day before, extend, convert to a booking", async () => {
  const { user, vendorId } = await mkVenue();
  const hall = await s.venue.createSpace(user, { name: "Hall" });
  await assert.rejects(s.venue.createReservation(user, { space: hall._id, dateFrom: day(20), holdExpiresAt: new Date(Date.now() - 1000) }), /future/);

  const h1 = await s.venue.createReservation(user, { space: hall._id, dateFrom: day(20), clientName: "Ada", holdExpiresAt: new Date(Date.now() + 12 * 3600e3) });
  const h2 = await s.venue.createReservation(user, { space: hall._id, dateFrom: day(21), clientName: "Bola", holdExpiresAt: new Date(Date.now() + 5 * 864e5) });
  assert.ok(h2.holdExpiresAt > new Date());

  let run = await s.venue.runHoldJobs();
  assert.deepEqual(run, { expired: 0, reminded: 1 });
  assert.equal((await s.venue.runHoldJobs()).reminded, 0, "warned once");

  run = await s.venue.runHoldJobs(new Date(Date.now() + 13 * 3600e3));
  assert.equal(run.expired, 1);
  assert.equal((await m.venue.VenueReservation.findById(h1._id)).status, "expired");
  assert.equal((await s.venue.availability(user, { space: hall._id, dateFrom: day(20) })).available, true, "date free again");
  assert.equal(await m.Notification.countDocuments({ recipient: user._id }), 2);

  await s.venue.extendHold(user, h2._id, { holdExpiresAt: new Date(Date.now() + 10 * 864e5) });
  await assert.rejects(s.venue.extendHold(user, h1._id, {}), /Only holds/);

  const booked = await s.venue.convertHold(user, h2._id, { totalAmount: 2000000, depositAmount: 500000, depositDueDate: new Date(Date.now() + 2 * 864e5), clientEmail: "bola@x.io" });
  assert.equal(booked.status, "booked");
  const vb = await m.VendorBooking.findById(booked.booking);
  assert.deepEqual([vb.status, String(vb.vendor), vb.totalAmount, vb.depositAmount, vb.clientName], ["confirmed", String(vendorId), 2000000, 500000, "Bola"]);
  assert.equal(vb.eventDate.toISOString().slice(0, 10), day(21));

  // Moving the booking moves the booking's date too
  await s.venue.updateReservation(user, booked._id, { dateFrom: day(25) });
  assert.equal((await m.VendorBooking.findById(vb._id)).eventDate.toISOString().slice(0, 10), day(25));

  // Cancelling the booking (vendor bookings page) frees the space
  assert.equal(await s.venue.releaseForBooking(vb._id), 1);
  assert.equal((await s.venue.availability(user, { space: hall._id, dateFrom: day(25) })).available, true);

  // Booking straight away (no hold) creates the VendorBooking; linking an existing one confirms it
  await assert.rejects(s.venue.createReservation(user, { space: hall._id, status: "booked", dateFrom: day(30) }), /Who is the booking/);
  const existing = await m.VendorBooking.create({ vendor: vendorId, status: "quoted", clientName: "Chidi", eventDate: new Date(`${day(31)}T00:00:00Z`) });
  const linked = await s.venue.createReservation(user, { space: hall._id, status: "booked", booking: existing._id });
  assert.equal(linked.dateFrom, day(31));
  assert.equal((await m.VendorBooking.findById(existing._id)).status, "confirmed");
  await assert.rejects(s.venue.createReservation(user, { space: hall._id, status: "booked", booking: existing._id, dateFrom: day(33) }), /already has a space/);
});

test("deposit schedule: instalments track payments, must add up, reminders once per stage", async () => {
  const { user, vendorId } = await mkVenue();
  const client = await m.User.create({ username: `c${++seq}`, email: `c${seq}@x.io`, password: "Passw0rd!x", firstName: "Ngozi", role: "user", status: "active", isActive: true });
  const b = await m.VendorBooking.create({ vendor: vendorId, planner: client._id, status: "confirmed", clientName: "Ngozi", totalAmount: 1000000, eventDate: new Date(Date.now() + 60 * 864e5) });

  await assert.rejects(
    s.schedule.setPaymentSchedule(user, b._id, { items: [{ amount: 300000, dueDate: new Date(Date.now() + 864e5) }, { amount: 500000, dueDate: new Date(Date.now() + 30 * 864e5) }] }),
    /add up/
  );
  let booking = await s.schedule.setPaymentSchedule(user, b._id, {
    items: [
      { label: "Deposit", amount: 300000, dueDate: new Date(Date.now() + 864e5) },
      { label: "Second", amount: 300000, dueDate: new Date(Date.now() - 2 * 864e5) },
      { label: "Balance", amount: 400000, dueDate: new Date(Date.now() + 30 * 864e5) },
    ],
  });
  assert.equal(booking.depositAmount, 300000, "first instalment is the deposit");

  // Payments are applied in due-date order
  booking.payments.push({ amount: 450000 });
  await booking.save();
  let view = s.scheduleUtil.scheduleView(booking);
  assert.deepEqual(view.items.map((i) => [i.label, i.paid, i.status]), [
    ["Second", 300000, "paid"],
    ["Deposit", 150000, "due_soon"],
    ["Balance", 0, "upcoming"],
  ]);
  assert.equal(view.balance, 550000);
  assert.equal(view.nextDue.amount, 150000);

  let r = await s.schedule.runPaymentReminders();
  assert.equal(r.sent, 1);
  assert.equal((await s.schedule.runPaymentReminders()).sent, 0, "once per stage");
  assert.equal(await m.Notification.countDocuments({ recipient: client._id }), 1);
  // Later the deposit is overdue: one more reminder
  r = await s.schedule.runPaymentReminders(new Date(Date.now() + 2 * 864e5));
  assert.equal(r.sent, 1);

  // Without a schedule: deposit + balance derived from the booking
  const plain = await m.VendorBooking.create({ vendor: vendorId, status: "confirmed", totalAmount: 800000, depositAmount: 200000, depositDueDate: new Date(Date.now() + 864e5), eventDate: new Date(Date.now() + 20 * 864e5) });
  view = s.scheduleUtil.scheduleView(plain);
  assert.deepEqual(view.items.map((i) => [i.label, i.amount]), [["Deposit", 200000], ["Balance", 600000]]);
  r = await s.schedule.runPaymentReminders();
  assert.equal(r.sent, 1);
  assert.equal((await s.schedule.runPaymentReminders()).sent, 0);

  // Another vendor can't set it; an empty list goes back to deposit + balance
  const other = await mkVenue();
  await assert.rejects(s.schedule.setPaymentSchedule(other.user, b._id, { items: [] }), /not found/);
  booking = await s.schedule.setPaymentSchedule(user, b._id, { items: [] });
  assert.equal(booking.paymentSchedule.length, 0);
});
