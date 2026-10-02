import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import SecurityLog from "../models/SecurityLog.model.js";
import BlockedIP from "../models/BlockedIP.model.js";

/**
 * Security Monitoring Service
 * Persists security events (SecurityLog), detects brute-force / suspicious
 * patterns, raises alerts (SystemAlert + email) and maintains the IP blocklist.
 */

const MINUTE = 60 * 1000;

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Internal event names → SecurityLog.event enum
const EVENT_MAP = {
  failed_login: "failed_login",
  successful_login: "login",
  unauthorized_access: "unauthorized_access",
  data_access: "data_access",
  sensitive_operation: "sensitive_operation",
  password_change: "password_change",
  "2fa_event": "two_factor",
  account_lockout: "account_lock",
  rate_limit: "rate_limit",
  suspicious_activity: "suspicious_activity",
  new_device_login: "new_device_login",
  ip_blocked: "ip_blocked",
  ip_unblocked: "ip_unblocked",
};

const SEVERITY = {
  failed_login: "low",
  unauthorized_access: "medium",
  account_lockout: "high",
  suspicious_activity: "high",
  ip_blocked: "high",
  rate_limit: "medium",
  new_device_login: "low",
};

// Loopback / private / link-local addresses (e.g. a reverse proxy) are never auto-blocked
const isPrivateIp = (ip) => {
  const v4 = String(ip || "").replace(/^::ffff:/i, "");
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(v4)) return true;
  const m = v4.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return /^(::1$|fc|fd|fe80:)/i.test(String(ip || ""));
};

const isObjectId = (v) => v && mongoose.isValidObjectId(v) && String(v).length === 24;

class SecurityMonitorService {
  constructor() {
    this.suspiciousActivityThreshold = 5; // unauthorized attempts / window
    this.failedLoginThreshold = 3; // failed logins for one account / window
    this.windowMs = 15 * MINUTE;
    this.alertCooldown = 60 * MINUTE;
    // Auto-block an IP after this many failed logins in the window (0 disables)
    this.autoBlockThreshold = Number(process.env.SECURITY_AUTO_BLOCK_THRESHOLD ?? 50);
    this.autoBlockDurationMs = Number(process.env.SECURITY_AUTO_BLOCK_MINUTES ?? 60) * MINUTE;
    this.recentAlerts = new Map();
    this.blockCache = { ips: new Set(), loadedAt: 0 };
    this.blockCacheTtl = 30 * 1000;
  }

  /**
   * Log a security event (persisted to SecurityLog; never throws).
   */
  logEvent(eventType, details = {}) {
    const event = { type: eventType, timestamp: new Date(), ...details };
    logger.info("Security Event", event);

    const { userId, adminId, ip, userAgent, status, severity, ...rest } = details;
    const doc = {
      event: EVENT_MAP[eventType] || "suspicious_activity",
      user: isObjectId(userId) ? userId : undefined,
      admin: isObjectId(adminId) ? adminId : undefined,
      ipAddress: ip,
      userAgent,
      status: status || (eventType === "failed_login" || eventType === "unauthorized_access" ? "failure" : eventType === "suspicious_activity" || eventType === "rate_limit" ? "warning" : "success"),
      severity: severity || SEVERITY[eventType] || "low",
      details: Object.fromEntries(
        Object.entries({ ...rest, originalType: EVENT_MAP[eventType] ? undefined : eventType }).filter(
          ([, v]) => v !== undefined
        )
      ),
    };
    if (mongoose.connection.readyState === 1) {
      SecurityLog.create(doc).catch((err) => logger.error(`Failed to persist security event: ${err.message}`));
    }
    return event;
  }

  /**
   * Track failed login attempt: alerts the account owner after repeated
   * failures and auto-blocks IPs that brute-force many attempts.
   */
  async trackFailedLogin(email, ip, reason = "Invalid credentials", { userId, isAdmin = false } = {}) {
    const event = this.logEvent("failed_login", { email, ip, reason, userId: isAdmin ? undefined : userId, adminId: isAdmin ? userId : undefined });

    try {
      const recentFailures = (await this.getRecentFailedLogins(email)) + 1; // include this one
      if (recentFailures >= this.failedLoginThreshold) {
        await this.sendSecurityAlert(email, "multiple_failed_logins", { count: recentFailures, ip, email });
      }

      if (ip && this.autoBlockThreshold > 0 && !isPrivateIp(ip)) {
        const fromIp =
          (await SecurityLog.countDocuments({
            event: "failed_login",
            ipAddress: ip,
            createdAt: { $gte: new Date(Date.now() - this.windowMs) },
          })) + 1;
        if (fromIp >= this.autoBlockThreshold && !(await this.isBlacklisted(ip))) {
          await this.blacklistIP(ip, `${fromIp} failed logins in ${this.windowMs / MINUTE} minutes`, this.autoBlockDurationMs, {
            source: "auto",
          });
        }
      }
    } catch (error) {
      logger.error(`trackFailedLogin error: ${error.message}`);
    }
    return event;
  }

  /**
   * Track successful login and flag sign-ins from a new IP/device.
   */
  async trackSuccessfulLogin(userId, email, ip, userAgent, { isAdmin = false } = {}) {
    const event = this.logEvent("successful_login", {
      userId: isAdmin ? undefined : userId,
      adminId: isAdmin ? userId : undefined,
      email,
      ip,
      userAgent,
    });
    try {
      await this.checkUnusualLogin(userId, ip, { email, userAgent, isAdmin, before: event.timestamp });
    } catch (error) {
      logger.error(`checkUnusualLogin error: ${error.message}`);
    }
    return event;
  }

  async trackUnauthorizedAccess(userId, resource, action, ip) {
    const event = this.logEvent("unauthorized_access", { userId, resource, action, ip });
    try {
      const recentAttempts = (await this.getRecentUnauthorizedAttempts(userId)) + 1;
      if (recentAttempts >= this.suspiciousActivityThreshold) {
        await this.sendSecurityAlert(String(userId), "suspicious_activity", { count: recentAttempts, resource });
      }
    } catch (error) {
      logger.error(`trackUnauthorizedAccess error: ${error.message}`);
    }
    return event;
  }

  trackDataAccess(userId, resourceType, resourceId, action) {
    return this.logEvent("data_access", { userId, resourceType, resourceId: resourceId && String(resourceId), action });
  }

  trackSensitiveOperation(userId, operation, details = {}) {
    return this.logEvent("sensitive_operation", { userId, operation, ...details });
  }

  async trackPasswordChange(userId, email, ip) {
    const event = this.logEvent("password_change", { userId, email, ip });
    await this.notifyUser(
      email,
      "Your password was changed",
      `Your account password was changed on ${new Date().toUTCString()}${ip ? ` from IP ${ip}` : ""}. If this wasn't you, reset your password immediately and contact support.`
    );
    return event;
  }

  track2FAEvent(userId, email, eventType, success = true) {
    return this.logEvent("2fa_event", {
      userId,
      email,
      action: eventType, // enabled, disabled, verified, failed
      status: success ? "success" : "failure",
      severity: eventType === "disabled" ? "medium" : "low",
    });
  }

  async trackAccountLockout(userId, email, reason) {
    const event = this.logEvent("account_lockout", { userId, email, reason });
    await this.notifyUser(
      email,
      "Your account has been temporarily locked",
      `Your account was locked on ${new Date().toUTCString()} because of: ${reason}. It will unlock automatically; if you didn't try to sign in, we recommend changing your password.`
    );
    await this.raiseSystemAlert("warning", "Account locked", `Account ${email} locked: ${reason}`, { email });
    return event;
  }

  trackRateLimitViolation(ip, path, { userId, email, limiter } = {}) {
    return this.logEvent("rate_limit", { ip, path, userId, email, limiter });
  }

  /**
   * A login from an IP or device not seen in the user's last 50 successful
   * logins is recorded and the user is emailed (first-ever login excluded).
   */
  async checkUnusualLogin(userId, ip, { email, userAgent, isAdmin = false, before = new Date() } = {}) {
    if (!userId || !ip) return { unusual: false };
    const who = isAdmin ? { admin: userId } : { user: userId };
    // Logins strictly before this one (the current login is persisted asynchronously)
    const previous = await SecurityLog.find({ ...who, event: "login", createdAt: { $lt: before } })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("ipAddress userAgent")
      .lean();
    if (!previous.length) return { unusual: false, reason: "first_login" };

    const knownIp = previous.some((p) => p.ipAddress === ip);
    const knownDevice = !userAgent || previous.some((p) => p.userAgent === userAgent);
    if (knownIp && knownDevice) return { unusual: false };

    const reason = !knownIp && !knownDevice ? "new IP and device" : !knownIp ? "new IP address" : "new device";
    this.logEvent("new_device_login", { userId: isAdmin ? undefined : userId, adminId: isAdmin ? userId : undefined, email, ip, userAgent, reason });
    if (email) {
      await this.notifyUser(
        email,
        "New sign-in to your account",
        `We noticed a sign-in to your account from a ${reason} (IP ${ip}${userAgent ? `, ${userAgent}` : ""}) on ${new Date().toUTCString()}. If this was you, no action is needed. Otherwise, change your password right away.`
      );
    }
    return { unusual: true, reason };
  }

  async getRecentFailedLogins(email, windowMs = this.windowMs) {
    if (!email || mongoose.connection.readyState !== 1) return 0;
    return SecurityLog.countDocuments({
      event: "failed_login",
      "details.email": email,
      createdAt: { $gte: new Date(Date.now() - windowMs) },
    });
  }

  async getRecentUnauthorizedAttempts(userId, windowMs = this.windowMs) {
    if (!isObjectId(userId) || mongoose.connection.readyState !== 1) return 0;
    return SecurityLog.countDocuments({
      event: "unauthorized_access",
      user: userId,
      createdAt: { $gte: new Date(Date.now() - windowMs) },
    });
  }

  async notifyUser(email, subject, text) {
    if (!email || /@deleted\.com$/i.test(email)) return;
    try {
      const { sendEmailDirect } = await import("../utils/email.js");
      await sendEmailDirect({
        to: email,
        subject,
        text,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937"><h2 style="font-size:18px">${escapeHtml(
          subject
        )}</h2><p style="line-height:1.5">${escapeHtml(text)}</p></div>`,
      });
    } catch (error) {
      logger.error(`Security email to ${email} failed: ${error.message}`);
    }
  }

  async raiseSystemAlert(severity, title, message, metadata = {}) {
    try {
      const SystemAlert = (await import("../models/systemAlert.model.js")).default;
      // Collapse repeats of the same active alert into one with a counter
      const existing = await SystemAlert.findOneAndUpdate(
        { alertType: "security", title, status: "active" },
        { $inc: { occurrenceCount: 1 }, $set: { lastOccurrence: new Date(), message, metadata } },
        { new: true }
      );
      if (!existing) {
        await SystemAlert.create({
          alertType: "security",
          severity,
          title,
          message,
          source: "security-monitor",
          metadata,
          lastOccurrence: new Date(),
        });
      }
    } catch (error) {
      logger.error(`Failed to raise security alert: ${error.message}`);
    }
  }

  /**
   * Send security alert (per identifier+type cooldown): dashboard alert, and an
   * email to the account owner for account-level alerts.
   */
  async sendSecurityAlert(identifier, alertType, details = {}) {
    try {
      const alertKey = `${identifier}-${alertType}`;
      const lastAlert = this.recentAlerts.get(alertKey);
      if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
        logger.debug("Alert cooldown active", { alertKey });
        return false;
      }
      this.recentAlerts.set(alertKey, Date.now());
      // Keep the cooldown map bounded
      if (this.recentAlerts.size > 10000) {
        const cutoff = Date.now() - this.alertCooldown;
        for (const [k, t] of this.recentAlerts) if (t < cutoff) this.recentAlerts.delete(k);
      }

      logger.warn("Security Alert", { identifier, alertType, ...details });

      if (alertType === "multiple_failed_logins") {
        await this.raiseSystemAlert(
          details.count >= 10 ? "critical" : "warning",
          "Repeated failed logins",
          `${details.count} failed login attempts for ${identifier} in the last ${this.windowMs / MINUTE} minutes${details.ip ? ` (latest from ${details.ip})` : ""}`,
          { identifier, ...details }
        );
        await this.notifyUser(
          details.email,
          "Unsuccessful sign-in attempts on your account",
          `There were ${details.count} unsuccessful attempts to sign in to your account in the last ${this.windowMs / MINUTE} minutes${details.ip ? ` (latest from IP ${details.ip})` : ""}. If this wasn't you, consider changing your password.`
        );
      } else {
        await this.raiseSystemAlert(
          "warning",
          alertType === "suspicious_activity" ? "Suspicious activity" : alertType,
          `${alertType} for ${identifier}: ${JSON.stringify(details)}`,
          { identifier, ...details }
        );
      }
      return true;
    } catch (error) {
      logger.error("Failed to send security alert:", error);
      return false;
    }
  }

  async generateSecurityReport(startDate, endDate) {
    const createdAt = {};
    if (startDate) createdAt.$gte = new Date(startDate);
    if (endDate) createdAt.$lte = new Date(endDate);
    const match = Object.keys(createdAt).length ? { createdAt } : {};

    const [byEvent, topIps, bySeverity] = await Promise.all([
      SecurityLog.aggregate([{ $match: match }, { $group: { _id: "$event", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      SecurityLog.aggregate([
        { $match: { ...match, event: { $in: ["failed_login", "unauthorized_access", "rate_limit"] }, ipAddress: { $ne: null } } },
        { $group: { _id: "$ipAddress", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      SecurityLog.aggregate([{ $match: match }, { $group: { _id: "$severity", count: { $sum: 1 } } }]),
    ]);
    const count = (e) => byEvent.find((b) => b._id === e)?.count || 0;
    const summary = {
      totalEvents: byEvent.reduce((s, b) => s + b.count, 0),
      failedLogins: count("failed_login"),
      successfulLogins: count("login"),
      unauthorizedAccess: count("unauthorized_access"),
      suspiciousActivity: count("suspicious_activity") + count("new_device_login"),
      accountLockouts: count("account_lock"),
      rateLimitViolations: count("rate_limit"),
      ipsBlocked: count("ip_blocked"),
    };

    const recommendations = [];
    if (summary.successfulLogins && summary.failedLogins > summary.successfulLogins) {
      recommendations.push("Failed logins exceed successful logins — review for credential-stuffing activity");
    }
    if (topIps[0]?.count >= 20) recommendations.push(`Consider blocking ${topIps[0]._id} (${topIps[0].count} hostile events)`);
    if (summary.accountLockouts) recommendations.push("Review locked accounts and contact affected users");

    return {
      period: { start: startDate || null, end: endDate || null },
      summary,
      bySeverity: bySeverity.map((b) => ({ severity: b._id, count: b.count })),
      topEvents: byEvent.map((b) => ({ event: b._id, count: b.count })),
      topSourceIps: topIps.map((i) => ({ ip: i._id, count: i.count })),
      recommendations,
    };
  }

  // ─── IP blocklist ──────────────────────────────────────────────────────────

  async refreshBlockCache(force = false) {
    if (!force && Date.now() - this.blockCache.loadedAt < this.blockCacheTtl) return this.blockCache.ips;
    if (mongoose.connection.readyState !== 1) return this.blockCache.ips;
    const now = new Date();
    const rows = await BlockedIP.find({ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] })
      .select("ip")
      .lean();
    this.blockCache = { ips: new Set(rows.map((r) => r.ip)), loadedAt: Date.now() };
    return this.blockCache.ips;
  }

  /** Cached check, cheap enough to run on every request. */
  async isBlacklisted(ip) {
    if (!ip) return false;
    try {
      const ips = await this.refreshBlockCache();
      return ips.has(ip);
    } catch (error) {
      logger.error(`Blocklist check failed: ${error.message}`);
      return false; // fail open: never lock everyone out because of a DB hiccup
    }
  }

  async recordBlockedHit(ip) {
    await BlockedIP.updateOne({ ip }, { $inc: { hits: 1 }, $set: { lastHitAt: new Date() } }).catch(() => {});
  }

  /**
   * Add IP to blacklist. duration (ms) null/0 = permanent.
   */
  async blacklistIP(ip, reason, duration = 24 * 60 * MINUTE, { source = "manual", adminId } = {}) {
    if (!ip) throw new Error("IP address is required");
    const expiresAt = duration ? new Date(Date.now() + duration) : null;
    const record = await BlockedIP.findOneAndUpdate(
      { ip },
      { $set: { reason, source, blockedBy: adminId, expiresAt } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    this.logEvent("ip_blocked", { ip, reason, source, adminId, expiresAt });
    await this.refreshBlockCache(true);
    if (source === "auto") {
      await this.raiseSystemAlert("critical", "IP automatically blocked", `${ip} was blocked: ${reason}`, { ip, expiresAt });
    }
    logger.warn("IP blacklisted", { ip, reason, expiresAt });
    return record;
  }

  async unblockIP(ip, adminId) {
    const res = await BlockedIP.deleteOne({ ip });
    if (res.deletedCount) this.logEvent("ip_unblocked", { ip, adminId });
    await this.refreshBlockCache(true);
    return res.deletedCount > 0;
  }

  async getBlockedIPs() {
    const now = new Date();
    return BlockedIP.find({ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] })
      .sort({ createdAt: -1 })
      .lean();
  }

  async checkRateLimitViolations(identifier, windowMs = 24 * 60 * MINUTE) {
    const since = new Date(Date.now() - windowMs);
    const query = { event: "rate_limit", createdAt: { $gte: since } };
    if (isObjectId(identifier)) query.user = identifier;
    else query.ipAddress = identifier;
    const [violations, last] = await Promise.all([
      SecurityLog.countDocuments(query),
      SecurityLog.findOne(query).sort({ createdAt: -1 }).select("createdAt").lean(),
    ]);
    return { violations, lastViolation: last?.createdAt || null };
  }

  /**
   * Compare the last 24h with the 7 days before it, per event type; spikes of
   * more than 3x the daily average (and >= 10 events) are anomalies.
   */
  async analyzeSecurityTrends() {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * MINUTE);
    const weekAgo = new Date(now - 8 * 24 * 60 * MINUTE);
    const rows = await SecurityLog.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: "$event",
          last24h: { $sum: { $cond: [{ $gte: ["$createdAt", dayAgo] }, 1, 0] } },
          previous7d: { $sum: { $cond: [{ $lt: ["$createdAt", dayAgo] }, 1, 0] } },
        },
      },
    ]);
    const trends = rows.map((r) => {
      const dailyAvg = r.previous7d / 7;
      const change = dailyAvg ? ((r.last24h - dailyAvg) / dailyAvg) * 100 : r.last24h ? 100 : 0;
      return { event: r._id, last24h: r.last24h, dailyAverage: Math.round(dailyAvg * 10) / 10, changePercent: Math.round(change) };
    });
    const hostile = new Set(["failed_login", "unauthorized_access", "rate_limit", "suspicious_activity", "account_lock"]);
    const anomalies = trends.filter(
      (t) => hostile.has(t.event) && t.last24h >= 10 && t.last24h > 3 * Math.max(t.dailyAverage, 1)
    );
    const recommendations = anomalies.map(
      (a) => `${a.event} is ${a.last24h} in the last 24h vs a daily average of ${a.dailyAverage} — investigate`
    );
    return { trends, anomalies, recommendations };
  }
}

// Create singleton instance
const securityMonitorService = new SecurityMonitorService();

export default securityMonitorService;
