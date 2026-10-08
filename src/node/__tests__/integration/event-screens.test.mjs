/**
 * Client event screens (roadmap Phase 4): guests, seating, checklist, budget,
 * RSVP links and invitations. In-memory MongoDB; email stubbed.
 * Run: npm run test:event-screens
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.FRONTEND_URL = "https://app.test";

let mongod;
const m = {};
const c = {};
const sentEmails = [];

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_screens"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Event = await load("../../models/event.model.js");
  m.Guest = await load("../../models/guest.model.js");
  m.EventPass = await load("../../models/event-pass.model.js");
  m.Budget = await load("../../models/budget.model.js");
  await load("../../models/vendor.model.js"); // budget populates expenses.vendor
  c.guests = await import("../../controllers/guest.controller.js");
  c.checklist = await import("../../controllers/checklist.controller.js");
  c.budget = await import("../../controllers/budget.controller.js");
  c.invite = await import("../../controllers/invitation.controller.js");
  c.rsvp = await import("../../controllers/rsvp.controller.js");
  c.access = await import("../../services/plan-access.service.js");
  // Email: record instead of sending
  const email = await import("../../utils/email.js");
  c.emailModule = email;
  await m.Guest.syncIndexes();
});

after(async () => {
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  sentEmails.length = 0;
  await mongoose.connection.db.dropDatabase();
  await m.Guest.syncIndexes();
});

let seq = 0;
const mkUser = (role = "user") =>
  m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: "A", role, status: "active", isActive: true });
const mkEvent = (user, extra = {}) =>
  m.Event.create({
    title: "Ada & Tunde", description: "Our wedding day", eventType: "wedding", createdBy: user._id,
    startDate: new Date(Date.now() + 90 * 864e5), endDate: new Date(Date.now() + 90 * 864e5 + 6 * 3600e3),
    location: { address: { city: "Lagos", state: "Lagos" } }, ...extra,
  });
const givePass = (user, event, tier = "celebration") =>
  m.EventPass.create({ event: event._id, user: user._id, tier, status: "active", activatedAt: new Date() });

async function call(fn, user, { params = {}, body = {}, query = {} } = {}) {
  const out = { status: 200 };
  const res = {
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; return this; },
    set() { return this; },
    end(b) { out.ended = b; return this; },
  };
  await fn({ user, params, body, query, headers: {} }, res, (err) => {
    out.status = err?.statusCode || err?.status || 500;
    out.error = err;
  });
  return out;
}

test("guests: owner only; add, import with de-duplication, stats, free limit, seating", async () => {
  const owner = await mkUser();
  const event = await mkEvent(owner);
  const stranger = await mkUser();
  const p = { eventId: event._id.toString() };

  let r = await call(c.guests.addGuest, stranger, { params: p, body: { name: "X" } });
  assert.equal(r.status, 404);
  r = await call(c.guests.listEventGuests, stranger, { params: p });
  assert.equal(r.status, 404);

  r = await call(c.guests.addGuest, owner, { params: p, body: { name: "Chidi", email: "chidi@x.io", plusOne: true, event: new mongoose.Types.ObjectId() } });
  assert.equal(r.status, 201, r.error?.message);
  assert.equal(String(r.body.data.guest.event), String(event._id), "event can't be overridden");
  const chidiId = r.body.data.guest._id;

  r = await call(c.guests.importGuests, owner, {
    params: p,
    body: { guests: [{ name: "Bisi", email: "BISI@x.io", dietaryRestrictions: "vegan; halal" }, { name: "Dup", email: "chidi@x.io" }, { email: "noname@x.io" }] },
  });
  assert.equal(r.status, 201, r.error?.message);
  assert.deepEqual([r.body.data.imported, r.body.data.skipped], [1, 2]);

  await call(c.guests.updateRSVP, owner, { params: { id: chidiId }, body: { status: "accepted" } });
  r = await call(c.guests.listEventGuests, owner, { params: p });
  assert.equal(r.body.data.stats.total, 2);
  assert.equal(r.body.data.stats.byStatus.accepted, 1);
  assert.equal(r.body.data.stats.attending, 2, "accepted + plus-one");
  assert.deepEqual(r.body.data.limit, { max: 100, used: 2 });
  const bisi = r.body.data.guests.find((g) => g.name === "Bisi");
  assert.deepEqual(bisi.dietaryRestrictions, ["vegan", "halal"]);

  // Strangers can't touch a guest
  r = await call(c.guests.updateGuest, stranger, { params: { id: chidiId }, body: { name: "Hacked" } });
  assert.equal(r.status, 404);
  r = await call(c.guests.deleteGuest, stranger, { params: { id: chidiId } });
  assert.equal(r.status, 404);

  // Free limit (100); a pass lifts it
  await m.Guest.insertMany(Array.from({ length: 98 }, (_, i) => ({ event: event._id, planner: owner._id, name: `g${i}` })));
  r = await call(c.guests.addGuest, owner, { params: p, body: { name: "One too many" } });
  assert.equal(r.error?.code, "PLAN_LIMIT_REACHED");
  await givePass(owner, event);
  r = await call(c.guests.addGuest, owner, { params: p, body: { name: "Now fine" } });
  assert.equal(r.status, 201);
  r = await call(c.guests.listEventGuests, owner, { params: p });
  assert.equal(r.body.data.limit.max, null);

  // Seating: tables, assignments only within this event, removing a table unassigns
  r = await call(c.guests.updateSeatingTables, owner, { params: p, body: { tables: [{ name: "Table 1", capacity: 8 }, { name: "table 1" }, { name: "Family", capacity: 12 }] } });
  assert.equal(r.body.data.tables.length, 2);
  const otherEvent = await mkEvent(stranger);
  const foreign = await m.Guest.create({ event: otherEvent._id, planner: stranger._id, name: "Foreign" });
  r = await call(c.guests.updateSeating, owner, {
    params: p,
    body: { assignments: [{ guestId: chidiId, table: "Family", seat: 1 }, { guestId: foreign._id.toString(), table: "Family" }] },
  });
  assert.equal(r.body.data.updated, 1);
  assert.equal((await m.Guest.findById(foreign._id)).tableAssignment, undefined);
  r = await call(c.guests.getSeatingChart, owner, { params: p });
  assert.equal(r.body.data.seatingChart.Family.length, 1);
  await call(c.guests.updateSeatingTables, owner, { params: p, body: { tables: [{ name: "Table 1", capacity: 8 }] } });
  assert.equal((await m.Guest.findById(chidiId)).tableAssignment, undefined);
});

test("checklist: add, complete, starter template without duplicates, owner only", async () => {
  const owner = await mkUser();
  const event = await mkEvent(owner);
  const p = { eventId: event._id.toString() };

  let r = await call(c.checklist.addChecklistItem, owner, { params: p, body: { title: "Book the venue", priority: "high" } });
  assert.equal(r.status, 201, r.error?.message);
  const id = r.body.data.item._id;
  r = await call(c.checklist.updateChecklistItem, owner, { params: { ...p, taskId: id }, body: { status: "completed" } });
  assert.ok(r.body.data.item.completedAt);

  r = await call(c.checklist.generateChecklist, owner, { params: p });
  assert.ok(r.body.data.added > 10);
  const added = r.body.data.added;
  assert.equal(r.body.data.items.filter((i) => i.title === "Book the venue").length, 1, "no duplicate");
  r = await call(c.checklist.generateChecklist, owner, { params: p });
  assert.equal(r.body.data.added, 0);

  r = await call(c.checklist.getChecklist, owner, { params: p });
  assert.equal(r.body.data.summary.total, added + 1);
  assert.equal(r.body.data.summary.completed, 1);
  const rings = r.body.data.items.find((i) => i.title === "Buy the rings");
  assert.ok(rings, "wedding items included");
  assert.equal(new Date(rings.dueDate).toDateString(), new Date(event.startDate.getTime() - 45 * 864e5).toDateString());

  const stranger = await mkUser();
  r = await call(c.checklist.getChecklist, stranger, { params: p });
  assert.equal(r.status, 404);
  r = await call(c.checklist.deleteChecklistItem, owner, { params: { ...p, taskId: id } });
  assert.equal(r.status, 200);
});

test("budget works for client-owned events; expense tracking needs a pass", async () => {
  const owner = await mkUser();
  const event = await mkEvent(owner);
  const p = { eventId: event._id.toString() };
  let r = await call(c.budget.createOrUpdateBudget, owner, { params: p, body: { totalBudget: 2000000, currency: "NGN" } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  r = await call(c.budget.getBudget, owner, { params: p });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.data.totalBudget, 2000000);

  const gate = c.access.requireEventPass("budgetTracking");
  const blocked = await new Promise((resolve) => gate({ user: owner, params: p }, {}, resolve));
  assert.equal(blocked.code, "PASS_REQUIRED");

  r = await call(c.budget.addExpense, owner, { params: p, body: { description: "Hall deposit", amount: 500000, category: "nonsense" } });
  assert.equal(r.status, 400, "invalid category is a 400");
  r = await call(c.budget.addExpense, owner, { params: p, body: { description: "Hall deposit", amount: 500000, category: "venue", paymentStatus: "paid" } });
  assert.equal(r.status, 201);
});

test("invitations and RSVP: design, email with link, open tracking, answer, deadline, WhatsApp", async () => {
  const owner = await mkUser();
  const event = await mkEvent(owner);
  const p = { eventId: event._id.toString() };
  const ada = await m.Guest.create({ event: event._id, planner: owner._id, name: "Ada", email: "ada@x.io", phone: "08031234567" });
  await m.Guest.create({ event: event._id, planner: owner._id, name: "NoEmail" });

  // Clients need a pass
  const invites = c.access.requireEventPass("invites");
  assert.equal((await new Promise((r) => invites({ user: owner, params: p }, {}, r))).code, "PASS_REQUIRED");
  await givePass(owner, event);

  let r = await call(c.invite.saveInvitation, owner, { params: p, body: { hosts: "The Okafors", theme: "floral", accentColor: "#be185d", message: "Join us!" } });
  assert.equal(r.status, 200, r.error?.message);
  assert.equal(r.body.data.invitation.theme, "floral");
  r = await call(c.invite.saveInvitation, owner, { params: p, body: { theme: "neon" } });
  assert.equal(r.status, 400);

  // Send: email failure is recorded per guest (no SMTP in tests)
  r = await call(c.invite.sendInvitations, owner, { params: p });
  assert.equal(r.status, 200, r.error?.message);
  assert.equal(r.body.data.sent + r.body.data.failed.length, 1, "only the guest with an email");

  // RSVP link and WhatsApp
  r = await call(c.invite.getGuestRsvpLink, owner, { params: { ...p, guestId: ada._id.toString() } });
  const token = r.body.data.url.split("/rsvp/")[1];
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.ok(r.body.data.url.startsWith("https://app.test/rsvp/"));
  assert.ok(r.body.data.whatsappUrl.startsWith("https://wa.me/2348031234567?text="));
  r = await call(c.invite.markInvitationShared, owner, { params: { ...p, guestId: ada._id.toString() } });
  assert.equal(r.body.data.invitation.channel, "whatsapp");

  // Public RSVP
  r = await call(c.rsvp.getRsvp, undefined, { params: { token: "f".repeat(64) } });
  assert.equal(r.status, 404);
  r = await call(c.rsvp.getRsvp, undefined, { params: { token } });
  assert.equal(r.body.data.invitation.hosts, "The Okafors");
  assert.equal(r.body.data.guest.name, "Ada");
  assert.equal(r.body.data.canRespond, true);
  assert.equal((await m.Guest.findById(ada._id)).invitation.status, "opened");

  r = await call(c.rsvp.submitRsvp, undefined, { params: { token }, body: { status: "maybe" } });
  assert.equal(r.status, 400);
  r = await call(c.rsvp.submitRsvp, undefined, { params: { token }, body: { status: "accepted", plusOneName: "Femi", message: "Can't wait", dietaryRestrictions: ["halal"] } });
  assert.equal(r.status, 200, r.error?.message);
  const answered = await m.Guest.findById(ada._id);
  assert.deepEqual([answered.rsvpStatus, answered.plusOne, answered.plusOneName, answered.respondedVia], ["accepted", true, "Femi", "link"]);

  // Pixel never fails
  r = await call(c.rsvp.openPixel, undefined, { params: { token: "bad" } });
  assert.ok(Buffer.isBuffer(r.ended));

  // Deadline passed: no more answers
  await m.Event.updateOne({ _id: event._id }, { "invitation.rsvpDeadline": new Date(Date.now() - 864e5) });
  r = await call(c.rsvp.submitRsvp, undefined, { params: { token }, body: { status: "declined" } });
  assert.equal(r.status, 400);
  r = await call(c.invite.getInvitation, owner, { params: p });
  assert.equal(r.body.data.stats.responded, 1);
});
