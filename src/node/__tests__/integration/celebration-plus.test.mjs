/**
 * Celebration Plus features (roadmap Phase 8): run sheet, gifts, aso-ebi, curated shortlist.
 * In-memory MongoDB. Run: npm run test:celebration-plus
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
process.env.FRONTEND_URL = "https://app.test";

let mongod;
const m = {};
const s = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_plus"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Event = await load("../../models/event.model.js");
  m.EventPass = await load("../../models/event-pass.model.js");
  m.Guest = await load("../../models/guest.model.js");
  m.Vendor = await load("../../models/vendor.model.js");
  m.VendorBooking = await load("../../models/vendor-booking.model.js");
  m.Notification = await load("../../models/notification.model.js");
  m.Gift = await load("../../models/gift.model.js");
  s.runSheet = await load("../../services/run-sheet.service.js");
  s.gifts = await load("../../services/gift.service.js");
  s.asoEbi = await load("../../services/aso-ebi.service.js");
  s.shortlist = await load("../../services/curated-shortlist.service.js");
  s.access = await import("../../services/plan-access.service.js");
});

after(async () => {
  const redis = (await import("../../config/redis.js")).default;
  redis.disconnect();
  await mongoose.disconnect();
  await mongod?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

let seq = 0;
const mkUser = (role = "user") =>
  m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: `F${seq}`, role, status: "active", isActive: true });
const mkEvent = (owner) =>
  m.Event.create({
    title: "Ada & Tunde", description: "Wedding in Lagos", eventType: "wedding", createdBy: owner._id,
    startDate: new Date(Date.now() + 60 * 864e5), endDate: new Date(Date.now() + 60 * 864e5 + 8 * 3600e3),
    location: { address: { city: "Lagos", state: "Lagos" } },
  });
const mkVendor = async (extra = {}) => {
  const owner = await mkUser("vendor");
  const id = (await m.Vendor.collection.insertOne({
    owner: owner._id, name: `V${seq}`, businessName: `Biz ${seq}`, category: "catering", status: "approved", isActive: true,
    email: `v${seq}@x.io`, phone: "0800000000", rating: 4.5, address: { city: "Lagos" }, ...extra,
  })).insertedId;
  return id;
};
const gate = (feature, user, eventId) =>
  new Promise((r) => s.access.requireEventPass(feature)({ user, params: { eventId: String(eventId) } }, {}, r));
const pdfOf = async (fn) => {
  const chunks = [];
  const res = new Writable({ write(c, _e, cb) { chunks.push(c); cb(); } });
  res.headers = {};
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  const done = new Promise((r) => res.on("finish", r));
  await fn(res);
  await done;
  return { headers: res.headers, body: Buffer.concat(chunks) };
};

test("gating: Plus pass features; Celebration Pass and free events are refused; planners use their plan", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  for (const f of ["runSheet", "giftTracking", "asoEbi", "curatedShortlist"]) {
    const err = await gate(f, client, event._id);
    assert.equal(err.code, "PASS_REQUIRED");
    assert.equal(err.details.upgradeTo, "plus");
  }
  await m.EventPass.create({ event: event._id, user: client._id, tier: "celebration", status: "active" });
  assert.equal((await gate("runSheet", client, event._id)).code, "PASS_REQUIRED");
  await m.EventPass.updateOne({ event: event._id }, { tier: "plus" });
  assert.equal(await gate("runSheet", client, event._id), undefined);
  assert.equal(await gate("asoEbi", await mkUser("event-planner"), event._id), undefined);
});

test("run sheet: vendors, timeline, vendor links show only their slots, PDF, revoke", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  const stranger = await mkUser();
  await assert.rejects(s.runSheet.get(stranger, event._id), /not found/);

  let view = await s.runSheet.get(client, event._id);
  assert.deepEqual([view.vendors.length, view.items.length], [0, 0]);

  await s.runSheet.updateSettings(client, event._id, { dayOfContact: { name: "Kemi", phone: "0803" }, notes: "Park at the back" });
  view = await s.runSheet.addVendor(client, event._id, { name: "Mama's Kitchen", role: "Caterer", contactPhone: "0801", contactEmail: "MAMA@k.io", arrivalTime: "10:00" });
  const caterer = view.vendors[0]._id;
  view = await s.runSheet.addVendor(client, event._id, { name: "DJ Spinall", role: "DJ" });
  const dj = view.vendors[1]._id;
  await assert.rejects(s.runSheet.addVendor(client, event._id, { name: "X", contactEmail: "bad" }), /valid email/);

  // Booked through Confetti: imported once
  const vendorId = await mkVendor();
  await m.VendorBooking.create({ vendor: vendorId, event: event._id, status: "confirmed" });
  await m.VendorBooking.create({ vendor: await mkVendor(), event: event._id, status: "pending" });
  view = await s.runSheet.importBookedVendors(client, event._id);
  assert.equal(view.added, 1);
  assert.equal((await s.runSheet.importBookedVendors(client, event._id)).added, 0);

  await s.runSheet.addItem(client, event._id, { start: "14:00", end: "15:30", title: "Lunch service", vendorKey: caterer });
  await s.runSheet.addItem(client, event._id, { start: "12:00", title: "Couple arrives", forAllVendors: true });
  view = await s.runSheet.addItem(client, event._id, { start: "16:00", title: "First dance", vendorKey: dj });
  assert.deepEqual(view.items.map((i) => i.title), ["Couple arrives", "Lunch service", "First dance"], "sorted by time");
  assert.equal(view.items[1].vendorName, "Mama's Kitchen");
  await assert.rejects(s.runSheet.addItem(client, event._id, { start: "25:00", title: "x" }), /14:30/);
  await assert.rejects(s.runSheet.addItem(client, event._id, { start: "15:00", end: "14:00", title: "x" }), /before the start/);
  await assert.rejects(s.runSheet.addItem(client, event._id, { start: "15:00", title: "x", vendorKey: new mongoose.Types.ObjectId() }), /first/);
  const lunch = view.items.find((i) => i.title === "Lunch service");
  view = await s.runSheet.updateItem(client, event._id, lunch._id, { end: "" });
  assert.equal(view.items.find((i) => i._id.equals(lunch._id)).end, undefined);

  // Share with the caterer
  view = await s.runSheet.shareWithVendor(client, event._id, caterer);
  const link = view.vendors.find((v) => v._id.equals(caterer)).shareLink;
  assert.ok(link.startsWith("https://app.test/run-sheet/"));
  const token = link.split("/run-sheet/")[1];
  const shared = await s.runSheet.viewShared(token);
  assert.deepEqual(shared.items.map((i) => i.title), ["Couple arrives", "Lunch service"], "own slots and moments for everyone");
  assert.equal(shared.dayOfContact.phone, "0803");
  assert.equal(shared.vendor.arrivalTime, "10:00");
  assert.ok(shared.otherVendors.every((v) => v.contactPhone === undefined), "no other vendors' phone numbers");
  assert.equal((await s.runSheet.get(client, event._id)).vendors[0].lastViewedAt instanceof Date, true);

  const pdf = await pdfOf((res) => s.runSheet.sharedPdf(token, res));
  assert.equal(pdf.headers["content-type"], "application/pdf");
  assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
  const full = await pdfOf((res) => s.runSheet.ownerPdf(client, event._id, res));
  assert.ok(full.body.length > 500);

  // Removing a vendor keeps their slot; revoking kills the link
  view = await s.runSheet.removeVendor(client, event._id, dj);
  assert.equal(view.items.find((i) => i.title === "First dance").vendorKey, null);
  await s.runSheet.revokeShare(client, event._id, caterer);
  await assert.rejects(s.runSheet.viewShared(token), /isn't valid/);
  await assert.rejects(s.runSheet.viewShared("nope"), /isn't valid/);
});

test("gifts: registry, received against an item, thank-yous, summary", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  const guest = await m.Guest.create({ event: event._id, planner: client._id, name: "Aunty Bisi", email: "b@x.io" });

  const blender = await s.gifts.create(client, event._id, { kind: "registry", title: "Blender", amount: 45000, quantityWanted: 2, link: "https://shop.ng/blender" });
  await assert.rejects(s.gifts.create(client, event._id, { kind: "registry", title: "x", link: "javascript:alert(1)" }), /http/);
  await assert.rejects(s.gifts.create(client, event._id, { kind: "received", title: "Card" }), /from/);

  const g1 = await s.gifts.create(client, event._id, { kind: "received", title: "Blender", guest: guest._id, registryItem: blender._id });
  assert.equal(g1.fromName, "Aunty Bisi");
  await s.gifts.create(client, event._id, { kind: "received", title: "Envelope", category: "cash", amount: 50000, fromName: "Uncle Femi" });
  let list = await s.gifts.list(client, event._id);
  assert.equal(list.gifts.find((g) => g._id.equals(blender._id)).quantityReceived, 1);
  assert.deepEqual(list.summary.received, { count: 2, cashTotal: 50000, thankYouSent: 0, thankYouPending: 2 });

  const r = await s.gifts.setThankYou(client, event._id, { giftIds: [g1._id, blender._id], method: "card" });
  assert.equal(r.updated, 1, "registry items aren't thanked");
  list = await s.gifts.list(client, event._id, { thankYou: "pending" });
  assert.deepEqual(list.gifts.map((g) => g.title), ["Envelope"]);

  // Another event's gift can't be touched
  const other = await mkEvent(await mkUser());
  await assert.rejects(s.gifts.update(client, other._id, g1._id, { title: "x" }), /not found/);
  await assert.rejects(s.gifts.update(client, event._id, g1._id, { guest: (await m.Guest.create({ event: other._id, planner: client._id, name: "Z" }))._id }), /Guest not found/);

  await s.gifts.remove(client, event._id, g1._id);
  list = await s.gifts.list(client, event._id, { kind: "registry" });
  assert.equal(list.gifts[0].quantityReceived, 0);
});

test("aso-ebi: fabrics, orders priced from the fabric, stock, payments, collection, CSV", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  const lace = await s.asoEbi.addFabric(client, event._id, { name: "Gold lace", price: 25000, unit: "yard", stock: 10 });
  const gele = await s.asoEbi.addFabric(client, event._id, { name: "Gele", price: 8000 });
  await assert.rejects(s.asoEbi.addFabric(client, event._id, { name: "x", price: -1 }), /valid price/);

  const guest = await m.Guest.create({ event: event._id, planner: client._id, name: "Chioma", phone: "0809" });
  let o1 = await s.asoEbi.addOrder(client, event._id, { fabric: lace._id, guest: guest._id, quantity: 4, size: "M" });
  assert.deepEqual([o1.name, o1.phone, o1.amountDue, o1.paymentStatus], ["Chioma", "0809", 100000, "unpaid"]);
  const o2 = await s.asoEbi.addOrder(client, event._id, { fabric: gele._id, name: "=HYPERLINK(\"x\")", quantity: 1, amountPaid: 8000 });
  assert.equal(o2.paymentStatus, "paid");
  await assert.rejects(s.asoEbi.addOrder(client, event._id, { fabric: lace._id, name: "Ngozi", quantity: 7 }), /Only 6/);
  await assert.rejects(s.asoEbi.addOrder(client, event._id, { fabric: lace._id, name: "Ngozi", size: "huge" }), /Unknown size/);
  await assert.rejects(s.asoEbi.updateFabric(client, event._id, lace._id, { stock: 3 }), /already ordered/);

  o1 = await s.asoEbi.recordPayment(client, event._id, o1._id, { amount: 40000, method: "cash" });
  assert.deepEqual([o1.paymentStatus, o1.balance], ["partial", 60000]);
  await assert.rejects(s.asoEbi.recordPayment(client, event._id, o1._id, { amount: 70000 }), /60,000/);
  o1 = await s.asoEbi.updateOrder(client, event._id, o1._id, { quantity: 2 });
  assert.equal(o1.amountDue, 50000, "re-priced");
  await assert.rejects(s.asoEbi.updateOrder(client, event._id, o1._id, { quantity: 1 }), /already paid/);
  o1 = await s.asoEbi.removePayment(client, event._id, o1._id, o1.payments[0]._id);
  assert.equal(o1.amountPaid, 0);

  await s.asoEbi.setCollection(client, event._id, { orderIds: [o1._id, o2._id], status: "collected", collectedBy: "Sister" });
  const overview = await s.asoEbi.overview(client, event._id);
  assert.equal(overview.summary.collection.collected, 2);
  assert.equal(overview.summary.outstanding, 50000);
  const laceRow = overview.fabrics.find((f) => f.name === "Gold lace");
  assert.deepEqual([laceRow.ordered, laceRow.remaining], [2, 8]);
  assert.equal((await s.asoEbi.overview(client, event._id, { payment: "paid" })).orders.length, 1);

  await assert.rejects(s.asoEbi.removeFabric(client, event._id, lace._id), /ordered/);
  const csv = await s.asoEbi.ordersCsv(client, event._id);
  assert.match(csv, /^Name,Phone,Fabric/);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/, "formulas neutralised");

  await assert.rejects(s.asoEbi.overview(await mkUser(), event._id), /not found/);
});

test("curated shortlist: brief, admin queue and picks, ready notifies, client marks interest", async () => {
  const client = await mkUser();
  const event = await mkEvent(client);
  const plainEvent = await mkEvent(client);
  await m.EventPass.create({ event: event._id, user: client._id, tier: "plus", status: "active" });
  await m.EventPass.create({ event: plainEvent._id, user: client._id, tier: "celebration", status: "active" });

  let queue = await s.shortlist.adminQueue();
  assert.deepEqual(queue.events.map((e) => String(e.eventId)), [String(event._id)], "only Plus events");
  assert.equal(queue.events[0].status, "new");
  await assert.rejects(s.shortlist.adminEvent(plainEvent._id), /Celebration Plus/);

  await assert.rejects(s.shortlist.submitBrief(client, event._id, {}), /which vendors/);
  let list = await s.shortlist.submitBrief(client, event._id, { categories: ["catering", "photography"], budget: 2000000, notes: "Yoruba food" });
  assert.equal(list.status, "requested");
  queue = await s.shortlist.adminQueue({ status: "requested" });
  assert.equal(queue.events[0].brief.notes, "Yoruba food");

  const v1 = await mkVendor();
  const v2 = await mkVendor({ category: "photography" });
  const pending = await mkVendor({ status: "pending" });
  const found = await s.shortlist.adminSearchVendors({ q: "Biz" });
  assert.ok(!found.some((v) => String(v._id) === String(pending)), "only approved vendors");
  await assert.rejects(s.shortlist.adminAdd({ _id: new mongoose.Types.ObjectId() }, event._id, { vendorId: pending }), /not approved/);
  await assert.rejects(s.shortlist.adminMarkReady(event._id), /at least one/);
  await s.shortlist.adminAdd({ _id: new mongoose.Types.ObjectId() }, event._id, { vendorId: v1, note: "Great jollof" });
  await assert.rejects(s.shortlist.adminAdd(null, event._id, { vendorId: v1 }), /Already/);
  list = await s.shortlist.adminAdd(null, event._id, { vendorId: v2 });
  assert.equal(list.status, "in_progress");
  list = await s.shortlist.adminMarkReady(event._id);
  assert.equal(list.status, "ready");
  assert.equal(await m.Notification.countDocuments({ recipient: client._id }), 1);

  list = await s.shortlist.get(client, event._id);
  assert.equal(list.items.length, 2);
  assert.equal(list.items[0].vendor.businessName.startsWith("Biz"), true);
  assert.equal(list.items[0].note, "Great jollof");
  list = await s.shortlist.setItemStatus(client, event._id, list.items[0]._id, "interested");
  assert.equal(list.items[0].clientStatus, "interested");
  await assert.rejects(s.shortlist.setItemStatus(client, event._id, list.items[0]._id, "maybe"), /Unknown/);

  // A vendor that leaves drops off the client's list (the admin still sees it)
  await m.Vendor.collection.updateOne({ _id: v2 }, { $set: { status: "suspended" } });
  assert.equal((await s.shortlist.get(client, event._id)).items.length, 1);
  assert.equal((await s.shortlist.adminEvent(event._id)).shortlist.items.length, 2);

  await assert.rejects(s.shortlist.get(await mkUser(), event._id), /not found/);
});
