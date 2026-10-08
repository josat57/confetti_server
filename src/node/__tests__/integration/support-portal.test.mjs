/**
 * Support tickets and the planner client portal (roadmap Phase 7). In-memory MongoDB.
 * Run: npm run test:support-portal
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
const s = {};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_support"));
  const load = async (p) => (await import(p)).default;
  m.User = await load("../../models/user.model.js");
  m.Event = await load("../../models/event.model.js");
  m.Subscription = await load("../../models/subscription.model.js");
  m.EventPass = await load("../../models/event-pass.model.js");
  m.SupportTicket = await load("../../models/supportTicket.model.js");
  m.Document = await load("../../models/document.model.js");
  m.Budget = await load("../../models/budget.model.js");
  m.Notification = await load("../../models/notification.model.js");
  await load("../../models/vendor.model.js");
  s.support = await import("../../services/support.service.js");
  s.adminTickets = await load("../../services/admin-support-ticket.service.js");
  s.portal = await load("../../services/client-portal.service.js");
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
  await s.catalogue.ensurePlans();
});

let seq = 0;
const mkUser = (role, extra = {}) =>
  m.User.create({ username: `u${++seq}`, email: `u${seq}@x.io`, password: "Passw0rd!x", firstName: `F${seq}`, role, status: "active", isActive: true, ...extra });
const subscribe = (user, planType, planName) =>
  m.Subscription.create({ user: user._id, planType, planName, status: "active", endDate: new Date(Date.now() + 30 * 864e5), paymentProvider: "none", amount: 1 });
const mkEvent = (owner) =>
  m.Event.create({
    title: "Okafor Wedding", description: "Big day in Lagos", eventType: "wedding", createdBy: owner._id, planner: owner._id,
    startDate: new Date(Date.now() + 60 * 864e5), endDate: new Date(Date.now() + 60 * 864e5 + 6 * 3600e3),
    timeline: [{ title: "Ceremony", startTime: new Date(Date.now() + 60 * 864e5) }],
    tasks: [{ title: "Book venue", status: "completed" }],
  });

test("tickets: create, priority from Agency or a Plus pass, owner only, reply reopens, close, rate", async () => {
  const solo = await mkUser("event-planner");
  let t = await s.support.createTicket(solo, { subject: "Can't upload", description: "The upload button does nothing", category: "technical" });
  assert.deepEqual([t.priority, t.isPriority, t.status], ["medium", false, "open"]);
  assert.match(t.ticketNumber, /^T-/);
  await assert.rejects(s.support.createTicket(solo, { subject: " ", description: "x" }), /subject/);

  const agency = await mkUser("event-planner");
  await subscribe(agency, "planner", "Agency");
  const pt = await s.support.createTicket(agency, { subject: "Billing", description: "Invoice question" });
  assert.deepEqual([pt.priority, pt.isPriority], ["high", true]);

  const client = await mkUser("user");
  const event = await mkEvent(client);
  await m.EventPass.create({ event: event._id, user: client._id, tier: "plus", status: "active" });
  const ct = await s.support.createTicket(client, { subject: "Help", description: "Need help with seating" });
  assert.equal(ct.isPriority, true);
  const doc = await m.SupportTicket.findById(ct._id);
  assert.ok(doc.sla.firstResponseDue - Date.now() < 5 * 3600e3, "4-hour first response target");

  // Admin queue: priority first
  const list = await s.adminTickets.getTickets({});
  const tickets = list.tickets || list.data || list;
  assert.equal(tickets[0].isPriority, true);

  // Owner only
  const stranger = await mkUser("vendor");
  await assert.rejects(s.support.getTicket(stranger, t._id), /not found/);

  // Admin replies with an internal note; the user never sees the note
  const adminId = new mongoose.Types.ObjectId();
  await s.adminTickets.respondToTicket(t._id, adminId, "Please try another browser").catch(() => {});
  await m.SupportTicket.updateOne({ _id: t._id }, { $push: { internalNotes: { note: "secret" } }, $set: { status: "resolved" } });
  t = await s.support.getTicket(solo, t._id);
  assert.equal(t.internalNotes, undefined);
  assert.equal(t.messages.at(-1).from, "support");

  t = await s.support.replyToTicket(solo, t._id, "Still broken");
  assert.equal(t.status, "open", "reply reopens a resolved ticket");
  await assert.rejects(s.support.rateTicket(solo, t._id, { rating: 5 }), /once it's resolved/);
  t = await s.support.closeTicket(solo, t._id);
  t = await s.support.rateTicket(solo, t._id, { rating: 4, feedback: "Thanks" });
  assert.equal(t.satisfaction.rating, 4);
  await assert.rejects(s.support.replyToTicket(solo, t._id, "hello"), /closed/);
});

test("client portal: Studio only; invite, private link, approvals, comments, shared documents, revoke", async () => {
  // Gating
  const solo = await mkUser("event-planner");
  const gate = s.access.requirePlanFeature("clientPortal");
  const blocked = await new Promise((r) => gate({ user: solo }, {}, r));
  assert.equal(blocked.code, "PLAN_FEATURE_REQUIRED");
  assert.equal(blocked.details.upgradeTo, "Studio");

  const planner = await mkUser("event-planner", { firstName: "Pat", lastName: "Planner" });
  await subscribe(planner, "planner", "Studio");
  assert.equal(await new Promise((r) => gate({ user: planner }, {}, r)), undefined);

  const event = await mkEvent(planner);
  const other = await mkUser("event-planner");
  await assert.rejects(s.portal.invite(other, event._id, { email: "x@y.io" }), /not found/);

  await assert.rejects(s.portal.invite(planner, event._id, { email: "nope" }), /valid email/);
  let view = await s.portal.invite(planner, event._id, { email: "Ada@Client.io", name: "Ada" });
  assert.equal(view.invites.length, 1);
  const link = view.invites[0].link;
  assert.ok(link.startsWith("https://app.test/portal/"));
  const token = link.split("/portal/")[1];
  view = await s.portal.invite(planner, event._id, { email: "ada@client.io" });
  assert.equal(view.invites.length, 1, "inviting again resends, no duplicate");

  // Documents: only the ones the planner shares
  const shared = await m.Document.create({ name: "Contract.pdf", type: "document", mimeType: "application/pdf", size: 10, url: "https://f/1", owner: planner._id, event: event._id, status: "active" });
  await m.Document.create({ name: "Internal.pdf", type: "document", mimeType: "application/pdf", size: 10, url: "https://f/2", owner: planner._id, event: event._id, status: "active" });
  await s.portal.setDocumentShared(planner, event._id, shared._id, true);
  await m.Budget.create({ event: event._id, planner: planner._id, totalBudget: 5000000, expenses: [{ description: "Hall", amount: 1000000, category: "venue" }] });

  await s.portal.addApproval(planner, event._id, { title: "Menu option B", amount: 1200000 });
  let client = await s.portal.viewByToken(token);
  assert.equal(client.event.title, "Okafor Wedding");
  assert.equal(client.timeline[0].title, "Ceremony");
  assert.equal(client.checklist[0].status, "completed");
  assert.equal(client.budget.total, 5000000);
  assert.equal(client.budget.spent, 1000000);
  assert.deepEqual(client.documents.map((d) => d.name), ["Contract.pdf"]);
  assert.match(client.documents[0].url, /\/shared\/documents\/.+\?token=/);
  const approvalId = client.approvals[0]._id;

  await assert.rejects(s.portal.respondToApproval(token, approvalId, { decision: "changes_requested" }), /what to change/);
  await s.portal.respondToApproval(token, approvalId, { decision: "changes_requested", comment: "Less pepper please" });
  await s.portal.clientComment(token, "Can we meet Friday?");
  await s.portal.plannerComment(planner, event._id, "Friday works");
  const planView = await s.portal.getForPlanner(planner, event._id);
  assert.equal(planView.approvals[0].status, "changes_requested");
  assert.equal(planView.comments.length, 3);
  assert.equal(planView.invites[0].status, "active");
  assert.equal(await m.Notification.countDocuments({ recipient: planner._id }), 2);

  // Revoked links stop working; bad tokens look the same
  await s.portal.revokeInvite(planner, event._id, planView.invites[0]._id);
  await assert.rejects(s.portal.viewByToken(token), /isn't valid/);
  await assert.rejects(s.portal.viewByToken("abc"), /isn't valid/);
});
