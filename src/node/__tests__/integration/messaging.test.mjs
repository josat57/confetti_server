/**
 * Conversation messaging (client/planner ↔ vendor) against an in-memory MongoDB.
 * Run: npm run test:messaging   (Node's test runner; jest can't load these ESM modules)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";

let mongod;
let User, Vendor, Message, Conversation, Notification, c;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("confetti_messaging"));
  User = (await import("../../models/user.model.js")).default;
  Vendor = (await import("../../models/vendor.model.js")).default;
  Message = (await import("../../models/message.model.js")).default;
  Conversation = (await import("../../models/conversation.model.js")).default;
  Notification = (await import("../../models/notification.model.js")).default;
  c = await import("../../controllers/communication.controller.js");
  await Conversation.syncIndexes();
  await Message.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
});

/** Call a controller with a fake req/res; returns { status, body, error } */
async function call(fn, user, { params = {}, body = {}, query = {} } = {}) {
  const out = { status: 200 };
  const res = {
    status(s) { out.status = s; return this; },
    json(b) { out.body = b; return this; },
  };
  await fn({ user, params, body, query }, res, (err) => {
    out.status = err?.statusCode || err?.status || 500;
    out.error = err?.message;
  });
  return out;
}

test("client, vendor and planner can message each other through conversations", async () => {
  const mk = (u) => User.create({ password: "Passw0rd!x", status: "active", ...u });
  const client = await mk({ username: "ada", email: "ada@x.io", firstName: "Ada", lastName: "Obi", role: "event-planner" });
  const vendUser = await mk({ username: "vee", email: "vee@x.io", firstName: "Vee", role: "vendor" });
  const planner = await mk({ username: "pat", email: "pat@x.io", firstName: "Pat", role: "event-planner" });
  const outsider = await mk({ username: "zed", email: "zed@x.io", firstName: "Zed", role: "event-planner" });
  // Raw insert: only the fields messaging reads (the full Vendor schema needs many more)
  const vid = (await Vendor.collection.insertOne({ owner: vendUser._id, name: "Vee Foods", businessName: "Vee Catering" })).insertedId;
  const vendor = { _id: vid };

  // A message from before conversations existed
  await Message.collection.insertOne({
    sender: planner._id, recipient: vendUser._id, content: "old hello", type: "direct", status: "sent",
    createdAt: new Date(Date.now() - 86400000), updatedAt: new Date(),
  });

  // 1. Client starts a conversation using the VENDOR id from the directory
  let r = await call(c.createConversation, client, { body: { participantId: vendor._id.toString(), subject: "Wedding catering", initialMessage: "  Hi, are you free on 12 Dec?  " } });
  assert.equal(r.status, 201, r.error);
  const conv = r.body.data.conversation;
  assert.equal(conv.participants.length, 2);
  const vp = conv.participants.find(p => p.userId === vendUser._id.toString());
  assert.equal(vp.name, "Vee Catering"); assert.equal(vp.role, "vendor");
  assert.equal(conv.lastMessage.content, "Hi, are you free on 12 Dec?"); assert.equal(conv.lastMessage.senderName, "You");
  assert.equal(conv.unreadCount, 0);

  // Same pair again reuses the thread
  r = await call(c.createConversation, client, { body: { participantId: vendUser._id.toString() } });
  assert.equal(r.body.data.conversation._id, conv._id);
  assert.equal(await Conversation.countDocuments(), 1);

  // 2. Vendor sees it with unread count + notification
  r = await call(c.getUnreadMessageCount, vendUser);
  assert.equal(r.body.data.count, 2, "vendor unread = client msg + backfilled legacy msg"); // legacy planner msg backfilled
  r = await call(c.listConversations, vendUser);
  const vconvs = r.body.data.conversations;
  assert.equal(vconvs.length, 2, "client thread + backfilled planner thread");
  const vc = vconvs.find(x => x._id === conv._id);
  assert.equal(vc.unreadCount, 1);
  assert.equal(vc.participants.find(p => p.userId === client._id.toString()).name, "Ada Obi");
  const legacy = vconvs.find(x => x._id !== conv._id);
  assert.equal(legacy.lastMessage.content, "old hello");
  const notes = await Notification.find({ recipient: vendUser._id });
  assert.equal(notes.length, 1); assert.equal(notes[0].category, "message");
  assert.equal(notes[0].actionUrl, `/vendor/dashboard/messages?c=${conv._id}`);

  // 3. Vendor reads + replies
  r = await call(c.getConversationMessages, vendUser, { params: { id: conv._id } });
  assert.equal(r.body.data.messages.length, 1); assert.equal(r.body.data.messages[0].senderName, "Ada Obi");
  assert.equal(r.body.data.messages[0].read, false);
  r = await call(c.markConversationAsRead, vendUser, { params: { id: conv._id } });
  assert.equal(r.body.data.updated, 1);
  r = await call(c.sendConversationMessage, vendUser, { params: { id: conv._id }, body: { content: "Yes we are! Send guest count." } });
  assert.equal(r.status, 201, r.error);
  assert.equal(r.body.data.message.senderName, "Vee Catering"); assert.equal(r.body.data.message.senderRole, "vendor");

  // 4. Client receives reply; sender sees read receipt
  r = await call(c.getConversationMessages, client, { params: { id: conv._id } });
  const msgs = r.body.data.messages;
  assert.deepEqual(msgs.map(m => m.content), ["Hi, are you free on 12 Dec?", "Yes we are! Send guest count."]);
  assert.equal(msgs[0].read, true, "client sees own message read");
  r = await call(c.getUnreadMessageCount, client); assert.equal(r.body.data.count, 1);
  const cn = await Notification.find({ recipient: client._id });
  assert.equal(cn[0].actionUrl, `/planner/dashboard/messages?c=${conv._id}`);

  // Burst: second unread message doesn't create a second notification
  await call(c.sendConversationMessage, vendUser, { params: { id: conv._id }, body: { content: "Also, budget?" } });
  assert.equal(await Notification.countDocuments({ recipient: client._id }), 1);

  // 5. Access control and validation
  r = await call(c.getConversationMessages, outsider, { params: { id: conv._id } }); assert.equal(r.status, 404);
  r = await call(c.sendConversationMessage, outsider, { params: { id: conv._id }, body: { content: "x" } }); assert.equal(r.status, 404);
  r = await call(c.markConversationAsRead, outsider, { params: { id: "not-an-id" } }); assert.equal(r.status, 404);
  r = await call(c.sendConversationMessage, client, { params: { id: conv._id }, body: { content: "   " } }); assert.equal(r.status, 400);
  r = await call(c.sendConversationMessage, client, { params: { id: conv._id }, body: { content: "a".repeat(5001) } }); assert.equal(r.status, 400);
  r = await call(c.createConversation, client, { body: { participantId: client._id.toString(), initialMessage: "me" } }); assert.equal(r.status, 400);
  r = await call(c.createConversation, client, { body: { participantId: new mongoose.Types.ObjectId().toString() } }); assert.equal(r.status, 404);
  r = await call(c.createConversation, client, { body: { participantId: "junk" } }); assert.equal(r.status, 400);
  await User.updateOne({ _id: outsider._id }, { status: "suspended" });
  r = await call(c.createConversation, client, { body: { participantId: outsider._id.toString() } }); assert.equal(r.status, 404);

  // 6. Planner legacy endpoints still work and land in the same thread
  r = await call(c.sendMessage, planner, { body: { recipient: vendUser._id.toString(), content: "new via planner api" } });
  assert.equal(r.status, 201, r.error); assert.equal(r.body.data.message.content, "new via planner api");
  assert.equal(await Conversation.countDocuments({ participants: planner._id }), 1);
  r = await call(c.listMessages, planner); assert.equal(r.status, 200); assert.equal(r.body.data.messages.length, 2);
  r = await call(c.getConversation, planner, { params: { userId: vendUser._id.toString() } }); assert.equal(r.body.data.messages.length, 2);
  const pm = r.body.data.messages[1]._id;
  r = await call(c.getMessage, vendUser, { params: { id: pm } }); assert.equal(r.status, 200, "populated access check fixed");
  r = await call(c.getMessage, client, { params: { id: pm } }); assert.equal(r.status, 403);
  // delete refreshes preview
  r = await call(c.deleteMessage, planner, { params: { id: pm } }); assert.equal(r.status, 200);
  const pc = await Conversation.findOne({ participants: planner._id });
  assert.equal(pc.lastMessage.content, "old hello");

  // getConversationById
  r = await call(c.getConversationById, client, { params: { id: conv._id } }); assert.equal(r.body.data.conversation.unreadCount, 2);
  r = await call(c.getConversationById, planner, { params: { id: conv._id } }); assert.equal(r.status, 404);

  // Concurrent create doesn't duplicate
  const [a, b] = await Promise.all([
    call(c.createConversation, planner, { body: { participantId: client._id.toString() } }),
    call(c.createConversation, client, { body: { participantId: planner._id.toString() } }),
  ]);
  assert.equal(a.body.data.conversation._id, b.body.data.conversation._id);

});
