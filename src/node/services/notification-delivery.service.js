import fs from "fs";
import crypto from "crypto";
import axios from "axios";
import mongoose from "mongoose";
import Notification, { normalizeChannels } from "../models/notification.model.js";
import { logger } from "../utils/logger.js";

/**
 * Delivers stored Notification documents over their channels:
 *  - in-app: the stored document is the inbox entry; pushed live over the
 *    /ws/notifications socket when the user is connected
 *  - email:  SMTP via utils/email.js
 *  - sms:    Twilio (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)
 *  - push:   Firebase Cloud Messaging HTTP v1 (FIREBASE_CREDENTIALS = service
 *            account JSON, or FIREBASE_CREDENTIALS_PATH = path to that file)
 *
 * Each channel result is recorded on the notification (deliveryResults), and
 * the overall status becomes sent/delivered, or failed when every channel failed.
 */

const MAX_ATTEMPTS = 3;
const DISPATCH_BATCH = 100;

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const absoluteUrl = (url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.FRONTEND_URL;
  return base ? `${base.replace(/\/$/, "")}/${String(url).replace(/^\//, "")}` : null;
};

// ─── EMAIL ───────────────────────────────────────────────────────────────────

const sendEmailChannel = async (notification, user) => {
  if (!user?.email || /@deleted\.com$/i.test(user.email)) {
    return { status: "skipped", error: "Recipient has no email address" };
  }
  const { sendEmailDirect } = await import("../utils/email.js");
  const link = absoluteUrl(notification.actionUrl);
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
      <p>Hi ${escapeHtml(user.firstName || "there")},</p>
      <h2 style="font-size:18px;margin:16px 0 8px">${escapeHtml(notification.title)}</h2>
      <p style="line-height:1.5;white-space:pre-line">${escapeHtml(notification.message)}</p>
      ${
        link
          ? `<p style="margin-top:24px"><a href="${escapeHtml(link)}" style="background:#6d28d9;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(
              notification.actionText || "View"
            )}</a></p>`
          : ""
      }
    </div>`;
  const text = `${notification.title}\n\n${notification.message}${link ? `\n\n${link}` : ""}`;
  const info = await sendEmailDirect({ to: user.email, subject: notification.title, html, text });
  return { status: "sent", providerId: info?.messageId };
};

// ─── SMS (Twilio) ────────────────────────────────────────────────────────────

const sendSmsChannel = async (notification, user) => {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_PHONE_NUMBER: from } = process.env;
  if (!sid || !token || !from) return { status: "failed", error: "SMS provider (Twilio) is not configured" };
  if (!user?.phone) return { status: "skipped", error: "Recipient has no phone number" };

  const body = `${notification.title}: ${notification.message}`.slice(0, 1500);
  const res = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({ To: user.phone, From: from, Body: body }).toString(),
    {
      auth: { username: sid, password: token },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    }
  );
  return { status: "sent", providerId: res.data?.sid };
};

// ─── PUSH (FCM HTTP v1) ──────────────────────────────────────────────────────

let serviceAccount;
let cachedAccessToken = null;

const loadServiceAccount = () => {
  if (serviceAccount !== undefined) return serviceAccount;
  try {
    if (process.env.FIREBASE_CREDENTIALS) {
      serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    } else if (process.env.FIREBASE_CREDENTIALS_PATH) {
      serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_CREDENTIALS_PATH, "utf8"));
    } else {
      serviceAccount = null;
    }
  } catch (err) {
    logger.error(`Invalid Firebase credentials: ${err.message}`);
    serviceAccount = null;
  }
  return serviceAccount;
};

const base64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** OAuth2 access token for FCM from a Google service account (JWT bearer grant). */
export const getFcmAccessToken = async (account, { useCache = true } = {}) => {
  if (useCache && cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60000) return cachedAccessToken.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: account.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.private_key)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const res = await axios.post(
    account.token_uri || "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 }
  );
  if (!useCache) return res.data.access_token;
  cachedAccessToken = { token: res.data.access_token, expiresAt: Date.now() + (res.data.expires_in || 3600) * 1000 };
  return cachedAccessToken.token;
};

const sendPushChannel = async (notification, user) => {
  const PushToken = (await import("../models/pushToken.model.js")).default;
  const devices = await PushToken.find({
    user: user._id,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
  })
    .select("token kind subscription")
    .lean();
  if (!devices.length) return { status: "skipped", error: "Recipient has no registered devices" };

  const webDevices = devices.filter((d) => d.kind === "webpush");
  const tokens = devices.filter((d) => d.kind !== "webpush");
  const webResult = webDevices.length ? await sendWebPush(webDevices, PushToken) : null;
  if (!tokens.length) return webResult;

  const account = loadServiceAccount();
  if (!account?.client_email || !account?.private_key || !account?.project_id) {
    if (webResult?.status === "sent") return webResult;
    return {
      status: "failed",
      error: process.env.FCM_SERVER_KEY
        ? "FCM_SERVER_KEY uses Google's retired legacy API; set FIREBASE_CREDENTIALS (service account JSON) instead"
        : "Push provider (Firebase) is not configured",
    };
  }
  const accessToken = await getFcmAccessToken(account);
  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  const data = {
    notificationId: String(notification._id),
    type: String(notification.kind || notification.type || ""),
    actionUrl: String(notification.actionUrl || ""),
  };

  let delivered = 0;
  const invalid = [];
  const errors = [];
  for (const { token } of tokens) {
    try {
      await axios.post(
        url,
        { message: { token, notification: { title: notification.title, body: notification.message }, data } },
        { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
      );
      delivered++;
    } catch (err) {
      const code = err.response?.data?.error?.details?.find?.((d) => d.errorCode)?.errorCode;
      if (err.response?.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT") invalid.push(token);
      else errors.push(err.response?.data?.error?.message || err.message);
    }
  }
  if (invalid.length) {
    await PushToken.updateMany({ token: { $in: invalid } }, { isActive: false });
  }
  if (delivered || webResult?.status === "sent") return { status: "sent" };
  return { status: "failed", error: errors[0] || webResult?.error || "All device tokens were invalid" };
};

// ─── WEB PUSH (VAPID, payload-less) ──────────────────────────────────────────

const b64urlToBuf = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

/**
 * Send a payload-less Web Push (RFC 8030 + VAPID RFC 8292). The service worker
 * wakes on the push event and fetches the latest notifications itself.
 * Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url, as generated by web-push).
 */
const sendWebPush = async (devices, PushToken) => {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return { status: "failed", error: "Web push (VAPID keys) is not configured" };

  let key;
  try {
    const pubBuf = b64urlToBuf(pub);
    key = crypto.createPrivateKey({
      key: {
        kty: "EC",
        crv: "P-256",
        d: priv,
        x: base64url(pubBuf.subarray(1, 33)),
        y: base64url(pubBuf.subarray(33, 65)),
      },
      format: "jwk",
    });
  } catch (error) {
    return { status: "failed", error: `Invalid VAPID keys: ${error.message}` };
  }

  const subject = process.env.VAPID_SUBJECT || `mailto:${process.env.FROM_EMAIL || "admin@example.com"}`;
  let sent = 0;
  const gone = [];
  const errors = [];
  for (const device of devices) {
    const endpoint = device.subscription?.endpoint || device.token;
    try {
      const header = base64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
      const claims = base64url(
        JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })
      );
      const signature = crypto
        .sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" })
        .toString("base64")
        .replace(/=+$/, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
      const res = await axios.post(endpoint, null, {
        headers: { Authorization: `vapid t=${header}.${claims}.${signature}, k=${pub}`, TTL: "86400", Urgency: "normal" },
        timeout: 15000,
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) sent++;
      else if (res.status === 404 || res.status === 410) gone.push(device.token);
      else errors.push(`HTTP ${res.status}`);
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (gone.length) await PushToken.updateMany({ token: { $in: gone } }, { isActive: false });
  if (sent) return { status: "sent" };
  return { status: "failed", error: errors[0] || "All web push subscriptions have expired" };
};

// ─── IN-APP ──────────────────────────────────────────────────────────────────

const sendInAppChannel = async (notification) => {
  // Stored notification = inbox entry. Push it live if the user is connected.
  try {
    const manager = (await import("./notification/manager.service.js")).default;
    const live = await manager.deliverNotification({
      id: String(notification._id),
      userId: String(notification.recipient),
      type: notification.kind || notification.type,
      title: notification.title,
      message: notification.message,
      data: { actionUrl: notification.actionUrl, category: notification.category },
      timestamp: Date.now(),
    });
    return { status: live ? "delivered" : "sent" };
  } catch {
    return { status: "sent" };
  }
};

const CHANNEL_SENDERS = {
  "in-app": sendInAppChannel,
  email: sendEmailChannel,
  sms: sendSmsChannel,
  push: sendPushChannel,
};

/**
 * Deliver a notification on the requested channels (defaults to the
 * notification's own channels). Returns the per-channel results.
 */
export const deliverNotification = async (notificationOrId, { channels } = {}) => {
  const notification =
    notificationOrId instanceof Notification ? notificationOrId : await Notification.findById(notificationOrId);
  if (!notification) throw new Error("Notification not found");

  if (notification.expiresAt && notification.expiresAt < new Date()) {
    await Notification.updateOne(
      { _id: notification._id, status: { $ne: "read" } },
      {
        $set: {
          status: "failed",
          error: "Notification expired before delivery",
          failedAt: new Date(),
          queuedForDelivery: false,
        },
      }
    );
    return [];
  }

  const User = (await import("../models/user.model.js")).default;
  const user = await User.findById(notification.recipient).select("email phone firstName").lean();
  const targets = normalizeChannels(channels || notification.channels);

  const results = [];
  for (const channel of targets) {
    let result;
    if (!user && channel !== "in-app") {
      result = { status: "failed", error: "Recipient not found" };
    } else {
      try {
        result = await CHANNEL_SENDERS[channel](notification, user);
      } catch (err) {
        result = { status: "failed", error: err.response?.data?.message || err.message };
      }
    }
    notification.recordDelivery(channel, result.status, result.error);
    if (result.providerId && channel === "email") notification.set("metadata.emailId", result.providerId);
    if (result.providerId && channel === "sms") notification.set("metadata.smsId", result.providerId);
    results.push({ channel, ...result });
  }

  notification.deliveryAttempts = (notification.deliveryAttempts || 0) + 1;
  const succeeded = results.some((r) => r.status === "sent" || r.status === "delivered");
  const failures = results.filter((r) => r.status === "failed");
  if (succeeded) {
    notification.queuedForDelivery = false;
    notification.error = failures.length ? failures.map((f) => `${f.channel}: ${f.error}`).join("; ") : undefined;
  } else if (results.length && results.every((r) => r.status === "skipped")) {
    notification.status = "failed";
    notification.error = results.map((r) => `${r.channel}: ${r.error}`).join("; ");
    notification.failedAt = new Date();
    notification.queuedForDelivery = false;
  } else {
    notification.error = failures.map((f) => `${f.channel}: ${f.error}`).join("; ");
    if (notification.deliveryAttempts >= MAX_ATTEMPTS) {
      notification.status = "failed";
      notification.failedAt = new Date();
      notification.queuedForDelivery = false;
    } else {
      // Retry later with backoff (5, 10 minutes …)
      notification.queuedForDelivery = true;
      notification.nextAttemptAt = new Date(Date.now() + notification.deliveryAttempts * 5 * 60 * 1000);
    }
  }
  await persistDeliveryState(notification);
  return results;
};

/**
 * Write delivery fields atomically instead of doc.save(): the notification may
 * be read, archived or deleted by the user while delivery is in progress, and a
 * versioned save would then fail. A "read" status is never downgraded.
 */
const persistDeliveryState = async (notification) => {
  const fields = [
    "deliveryResults",
    "deliveryAttempts",
    "queuedForDelivery",
    "nextAttemptAt",
    "error",
    "sentAt",
    "deliveredAt",
    "failedAt",
    "metadata",
  ];
  const $set = {};
  const $unset = {};
  for (const f of fields) {
    const v = notification.get(f);
    if (v === undefined) $unset[f] = 1;
    else $set[f] = v;
  }
  const update = { $set };
  if (Object.keys($unset).length) update.$unset = $unset;
  const res = await Notification.updateOne({ _id: notification._id }, update);
  if (!res.matchedCount) return; // deleted meanwhile
  // Status only moves forward: pending → sent → delivered → read ("failed" only from pending)
  const order = ["pending", "sent", "delivered", "read"];
  const target = notification.status;
  const from =
    target === "failed" ? ["pending"] : order.slice(0, Math.max(0, order.indexOf(target)));
  if (from.length) {
    await Notification.updateOne({ _id: notification._id, status: { $in: from } }, { $set: { status: target } });
  }
};

/** Mark for delivery; sent immediately unless scheduled for later. */
export const queueForDelivery = async (notification) => {
  notification.queuedForDelivery = true;
  notification.status = "pending";
  await Notification.updateOne(
    { _id: notification._id },
    { $set: { queuedForDelivery: true, status: "pending" } }
  );
  if (!notification.scheduledFor || notification.scheduledFor <= new Date()) {
    setImmediate(() => dispatchDueNotifications().catch(() => {}));
  }
  return notification;
};

let currentDispatch = null;
let dispatchTimer = null;

/**
 * Deliver every due, queued notification. Concurrent callers share the
 * in-flight run (and a follow-up run picks up anything queued meanwhile).
 */
export const dispatchDueNotifications = async () => {
  if (mongoose.connection.readyState !== 1) return 0;
  if (currentDispatch) {
    await currentDispatch;
    return dispatchDueNotifications();
  }
  currentDispatch = runDispatch();
  try {
    return await currentDispatch;
  } finally {
    currentDispatch = null;
  }
};

const runDispatch = async () => {
  let processed = 0;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = new Date();
      const due = await Notification.find({
        queuedForDelivery: true,
        status: "pending",
        $and: [
          { $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }] },
          { $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }] },
        ],
      })
        .sort({ createdAt: 1 })
        .limit(DISPATCH_BATCH);
      if (!due.length) break;
      let claimedAny = false;
      for (const n of due) {
        // Claim so parallel instances don't double-send
        const claimed = await Notification.findOneAndUpdate(
          { _id: n._id, queuedForDelivery: true, deliveryAttempts: n.deliveryAttempts },
          { $set: { queuedForDelivery: false } },
          { new: true }
        );
        if (!claimed) continue;
        claimedAny = true;
        try {
          await deliverNotification(claimed);
          processed++;
        } catch (err) {
          logger.error(`Delivery of notification ${claimed._id} failed: ${err.message}`);
        }
      }
      if (!claimedAny || due.length < DISPATCH_BATCH) break;
    }
  } catch (err) {
    logger.error(`Notification dispatch failed: ${err.message}`);
  }
  return processed;
};

export const startNotificationDispatcher = (intervalMs = 30000) => {
  if (dispatchTimer) clearInterval(dispatchTimer);
  dispatchTimer = setInterval(() => dispatchDueNotifications().catch(() => {}), intervalMs);
  dispatchTimer.unref?.();
};

export const stopNotificationDispatcher = () => {
  if (dispatchTimer) clearInterval(dispatchTimer);
  dispatchTimer = null;
};
