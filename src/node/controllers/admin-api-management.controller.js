import crypto from "crypto";
import https from "https";
import http from "http";
import { URL } from "url";
import AdminAPIKey from "../models/AdminAPIKey.model.js";
import AdminWebhook, { ADMIN_WEBHOOK_EVENTS } from "../models/AdminWebhook.model.js";
import AdminIntegration, { INTEGRATION_PROVIDERS } from "../models/AdminIntegration.model.js";
import AdminAPILog from "../models/AdminAPILog.model.js";
import { createError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
import { testIntegrationConnection } from "../services/integration-test.service.js";
import { escapeRegExp } from "../utils/escape-regex.js";

// ─── API KEYS ────────────────────────────────────────────────────────────────

export const getAPIKeys = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isActive, environment, search } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (environment) filter.environment = environment;
    if (search) filter.name = { $regex: escapeRegExp(search), $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);
    const [keys, total] = await Promise.all([
      AdminAPIKey.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AdminAPIKey.countDocuments(filter),
    ]);

    res.json({
      status: "success",
      data: {
        apiKeys: keys,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAPIKeyById = async (req, res, next) => {
  try {
    const key = await AdminAPIKey.findById(req.params.keyId).lean();
    if (!key) return next(createError(404, "API key not found"));
    res.json({ status: "success", data: { apiKey: key } });
  } catch (error) {
    next(error);
  }
};

export const createAPIKey = async (req, res, next) => {
  try {
    const { name, description, permissions, environment, expiresAt, rateLimit, ipWhitelist } = req.body;
    if (!name) return next(createError(400, "Name is required"));

    const { raw, prefix, hash } = AdminAPIKey.generateKey();

    const apiKey = await AdminAPIKey.create({
      name,
      description,
      permissions: permissions || [],
      environment: environment || "production",
      expiresAt,
      rateLimit,
      ipWhitelist,
      prefix,
      keyHash: hash,
      createdBy: req.admin._id,
    });

    logger.info(`Admin API key created: ${apiKey.name} by ${req.admin.email}`);

    // Return the raw key ONCE — it won't be retrievable again
    res.status(201).json({
      status: "success",
      message: "API key created. Store the key securely — it will not be shown again.",
      data: {
        apiKey: { ...apiKey.toObject(), key: raw },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAPIKey = async (req, res, next) => {
  try {
    const { name, description, permissions, environment, expiresAt, ipWhitelist } = req.body;
    const apiKey = await AdminAPIKey.findById(req.params.keyId);
    if (!apiKey) return next(createError(404, "API key not found"));

    if (name !== undefined) apiKey.name = name;
    if (description !== undefined) apiKey.description = description;
    if (permissions !== undefined) apiKey.permissions = permissions;
    if (environment !== undefined) apiKey.environment = environment;
    if (expiresAt !== undefined) apiKey.expiresAt = expiresAt;
    if (ipWhitelist !== undefined) apiKey.ipWhitelist = ipWhitelist;

    await apiKey.save();
    res.json({ status: "success", message: "API key updated", data: { apiKey } });
  } catch (error) {
    next(error);
  }
};

export const revokeAPIKey = async (req, res, next) => {
  try {
    const apiKey = await AdminAPIKey.findById(req.params.keyId);
    if (!apiKey) return next(createError(404, "API key not found"));
    await apiKey.revoke();
    logger.info(`Admin API key revoked: ${apiKey.name}`);
    res.json({ status: "success", message: "API key revoked successfully" });
  } catch (error) {
    next(error);
  }
};

export const deleteAPIKey = async (req, res, next) => {
  try {
    const apiKey = await AdminAPIKey.findByIdAndDelete(req.params.keyId);
    if (!apiKey) return next(createError(404, "API key not found"));
    await AdminAPILog.deleteMany({ apiKey: req.params.keyId });
    logger.info(`Admin API key deleted: ${apiKey.name}`);
    res.json({ status: "success", message: "API key deleted" });
  } catch (error) {
    next(error);
  }
};

export const regenerateAPIKey = async (req, res, next) => {
  try {
    const apiKey = await AdminAPIKey.findById(req.params.keyId);
    if (!apiKey) return next(createError(404, "API key not found"));

    const { raw, prefix, hash } = AdminAPIKey.generateKey();
    apiKey.keyHash = hash;
    apiKey.prefix = prefix;
    apiKey.usageCount = 0;
    apiKey.lastUsedAt = undefined;
    await apiKey.save();

    logger.info(`Admin API key regenerated: ${apiKey.name}`);
    res.json({
      status: "success",
      message: "API key regenerated. Store the new key securely.",
      data: { apiKey: { ...apiKey.toObject(), key: raw } },
    });
  } catch (error) {
    next(error);
  }
};

export const updateRateLimit = async (req, res, next) => {
  try {
    const { requestsPerHour, requestsPerDay } = req.body;
    const apiKey = await AdminAPIKey.findById(req.params.keyId);
    if (!apiKey) return next(createError(404, "API key not found"));

    if (requestsPerHour !== undefined) apiKey.rateLimit.requestsPerHour = requestsPerHour;
    if (requestsPerDay !== undefined) apiKey.rateLimit.requestsPerDay = requestsPerDay;
    await apiKey.save();

    res.json({ status: "success", message: "Rate limit updated", data: { apiKey } });
  } catch (error) {
    next(error);
  }
};

// ─── API LOGS ────────────────────────────────────────────────────────────────

export const getAPILogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, keyId, endpoint, statusCode, startDate, endDate } = req.query;
    const filter = {};
    if (keyId) filter.apiKey = keyId;
    if (endpoint) filter.endpoint = { $regex: escapeRegExp(endpoint), $options: "i" };
    if (statusCode) filter.statusCode = Number(statusCode);
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [logs, total] = await Promise.all([
      AdminAPILog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("apiKey", "name prefix")
        .lean(),
      AdminAPILog.countDocuments(filter),
    ]);

    res.json({
      status: "success",
      data: {
        logs,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAPILogById = async (req, res, next) => {
  try {
    const log = await AdminAPILog.findById(req.params.logId)
      .populate("apiKey", "name prefix")
      .lean();
    if (!log) return next(createError(404, "Log not found"));
    res.json({ status: "success", data: { log } });
  } catch (error) {
    next(error);
  }
};

export const exportAPILogs = async (req, res, next) => {
  try {
    const { filters = {}, format = "csv" } = req.body;
    const query = {};
    if (filters.keyId) query.apiKey = filters.keyId;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const logs = await AdminAPILog.find(query)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    const timestamp = Date.now();
    const filename = `api-logs-${timestamp}.${format}`;

    if (format === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(JSON.stringify(logs, null, 2));
    }

    // CSV export
    const headers = ["id", "endpoint", "method", "statusCode", "responseTimeMs", "ipAddress", "createdAt"];
    const rows = logs.map((l) =>
      headers.map((h) => {
        const v = l[h];
        return v instanceof Date ? v.toISOString() : String(v ?? "");
      })
    );
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const getAPIUsageStats = async (req, res, next) => {
  try {
    const { keyId, startDate, endDate } = req.query;
    const match = {};
    if (keyId) match.apiKey = new (await import("mongoose")).default.Types.ObjectId(keyId);
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const [totals, byStatus, byEndpoint, dailyTrend] = await Promise.all([
      AdminAPILog.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            avgResponseTime: { $avg: "$responseTimeMs" },
            errorCount: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
          },
        },
      ]),
      AdminAPILog.aggregate([
        { $match: match },
        { $group: { _id: "$statusCode", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AdminAPILog.aggregate([
        { $match: match },
        { $group: { _id: "$endpoint", count: { $sum: 1 }, avgTime: { $avg: "$responseTimeMs" } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      AdminAPILog.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            requests: { $sum: 1 },
            errors: { $sum: { $cond: [{ $gte: ["$statusCode", 400] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
    ]);

    const summary = totals[0] || { totalRequests: 0, avgResponseTime: 0, errorCount: 0 };

    res.json({
      status: "success",
      data: {
        stats: {
          totalRequests: summary.totalRequests,
          avgResponseTimeMs: Math.round(summary.avgResponseTime || 0),
          errorCount: summary.errorCount,
          errorRate: summary.totalRequests > 0
            ? ((summary.errorCount / summary.totalRequests) * 100).toFixed(2)
            : "0.00",
          byStatus,
          topEndpoints: byEndpoint,
          dailyTrend,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── WEBHOOKS ────────────────────────────────────────────────────────────────

export const getWebhooks = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isActive, event } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (event) filter.events = event;

    const skip = (Number(page) - 1) * Number(limit);
    const [webhooks, total] = await Promise.all([
      AdminWebhook.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      AdminWebhook.countDocuments(filter),
    ]);

    res.json({
      status: "success",
      data: {
        webhooks,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getWebhookById = async (req, res, next) => {
  try {
    const webhook = await AdminWebhook.findById(req.params.webhookId).lean();
    if (!webhook) return next(createError(404, "Webhook not found"));
    res.json({ status: "success", data: { webhook } });
  } catch (error) {
    next(error);
  }
};

export const createWebhook = async (req, res, next) => {
  try {
    const { name, url, description, events } = req.body;
    if (!name || !url) return next(createError(400, "Name and URL are required"));
    if (!events || events.length === 0) return next(createError(400, "At least one event is required"));

    const webhook = await AdminWebhook.create({
      name,
      url,
      description,
      events,
      createdBy: req.admin._id,
    });

    logger.info(`Admin webhook created: ${webhook.name}`);
    res.status(201).json({ status: "success", message: "Webhook created", data: { webhook } });
  } catch (error) {
    next(error);
  }
};

export const updateWebhook = async (req, res, next) => {
  try {
    const { name, url, description, events } = req.body;
    const webhook = await AdminWebhook.findById(req.params.webhookId);
    if (!webhook) return next(createError(404, "Webhook not found"));

    if (name !== undefined) webhook.name = name;
    if (url !== undefined) webhook.url = url;
    if (description !== undefined) webhook.description = description;
    if (events !== undefined) webhook.events = events;

    await webhook.save();
    res.json({ status: "success", message: "Webhook updated", data: { webhook } });
  } catch (error) {
    next(error);
  }
};

export const deleteWebhook = async (req, res, next) => {
  try {
    const webhook = await AdminWebhook.findByIdAndDelete(req.params.webhookId);
    if (!webhook) return next(createError(404, "Webhook not found"));
    res.json({ status: "success", message: "Webhook deleted" });
  } catch (error) {
    next(error);
  }
};

export const testWebhook = async (req, res, next) => {
  try {
    const webhook = await AdminWebhook.findById(req.params.webhookId).select("+secret");
    if (!webhook) return next(createError(404, "Webhook not found"));

    const payload = {
      event: "webhook.test",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook delivery from Confetti admin" },
    };

    const signature = webhook.generateSignature(payload);
    const body = JSON.stringify(payload);

    await new Promise((resolve, reject) => {
      const target = new URL(webhook.url);
      const mod = target.protocol === "https:" ? https : http;
      const options = {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Confetti-Signature": `sha256=${signature}`,
          "X-Confetti-Event": "webhook.test",
        },
      };

      const reqHttp = mod.request(options, (r) => {
        r.on("data", () => {});
        r.on("end", resolve);
      });
      reqHttp.on("error", reject);
      reqHttp.setTimeout(5000, () => { reqHttp.destroy(); reject(new Error("Timeout")); });
      reqHttp.write(body);
      reqHttp.end();
    });

    await webhook.recordSuccess();
    res.json({ status: "success", success: true, message: "Test delivery sent successfully" });
  } catch (error) {
    const webhook = await AdminWebhook.findById(req.params.webhookId);
    if (webhook) await webhook.recordFailure(error);
    res.json({ status: "success", success: false, message: `Test failed: ${error.message}` });
  }
};

export const toggleWebhook = async (req, res, next) => {
  try {
    const { active } = req.body;
    const webhook = await AdminWebhook.findById(req.params.webhookId);
    if (!webhook) return next(createError(404, "Webhook not found"));
    webhook.isActive = active;
    await webhook.save();
    res.json({ status: "success", message: `Webhook ${active ? "activated" : "deactivated"}` });
  } catch (error) {
    next(error);
  }
};

export const getAvailableEvents = async (_req, res) => {
  res.json({ status: "success", data: { events: ADMIN_WEBHOOK_EVENTS } });
};

// ─── INTEGRATIONS ────────────────────────────────────────────────────────────

export const getIntegrations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, isEnabled } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (isEnabled !== undefined) filter.isEnabled = isEnabled === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const [integrations, total] = await Promise.all([
      AdminIntegration.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      AdminIntegration.countDocuments(filter),
    ]);

    res.json({
      status: "success",
      data: {
        integrations,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getIntegrationById = async (req, res, next) => {
  try {
    const integration = await AdminIntegration.findById(req.params.integrationId).lean();
    if (!integration) return next(createError(404, "Integration not found"));
    res.json({ status: "success", data: { integration } });
  } catch (error) {
    next(error);
  }
};

export const createIntegration = async (req, res, next) => {
  try {
    const { name, type, provider, description, credentials, config } = req.body;
    if (!name || !type || !provider) return next(createError(400, "Name, type and provider are required"));

    const integration = await AdminIntegration.create({
      name,
      type,
      provider,
      description,
      credentials,
      config,
      createdBy: req.admin._id,
    });

    logger.info(`Admin integration created: ${integration.name}`);
    res.status(201).json({ status: "success", message: "Integration created", data: { integration } });
  } catch (error) {
    next(error);
  }
};

export const updateIntegration = async (req, res, next) => {
  try {
    const { name, description, credentials, config } = req.body;
    const integration = await AdminIntegration.findById(req.params.integrationId);
    if (!integration) return next(createError(404, "Integration not found"));

    if (name !== undefined) integration.name = name;
    if (description !== undefined) integration.description = description;
    if (credentials !== undefined) Object.assign(integration.credentials, credentials);
    if (config !== undefined) Object.assign(integration.config, config);

    await integration.save();
    res.json({ status: "success", message: "Integration updated", data: { integration } });
  } catch (error) {
    next(error);
  }
};

export const deleteIntegration = async (req, res, next) => {
  try {
    const integration = await AdminIntegration.findByIdAndDelete(req.params.integrationId);
    if (!integration) return next(createError(404, "Integration not found"));
    res.json({ status: "success", message: "Integration deleted" });
  } catch (error) {
    next(error);
  }
};

export const toggleIntegration = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    const integration = await AdminIntegration.findById(req.params.integrationId);
    if (!integration) return next(createError(404, "Integration not found"));
    integration.isEnabled = enabled;
    await integration.save();
    res.json({ status: "success", message: `Integration ${enabled ? "enabled" : "disabled"}` });
  } catch (error) {
    next(error);
  }
};

export const testIntegration = async (req, res, next) => {
  try {
    const integration = await AdminIntegration.findById(req.params.integrationId).select(
      "+credentials.apiKey +credentials.secretKey +credentials.accessToken +credentials.extra"
    );
    if (!integration) return next(createError(404, "Integration not found"));

    const start = Date.now();
    const result = await testIntegrationConnection(integration);
    const latencyMs = Date.now() - start;

    integration.health = {
      lastCheck: new Date(),
      status: result.status,
      latencyMs,
      errorRate: result.success ? 0 : 1,
    };
    await integration.save();

    res.json({
      status: "success",
      success: result.success,
      message: result.message,
      data: { latencyMs, httpStatus: result.httpStatus, health: result.status },
    });
  } catch (error) {
    next(error);
  }
};

export const syncIntegration = async (req, res, next) => {
  try {
    const integration = await AdminIntegration.findById(req.params.integrationId);
    if (!integration) return next(createError(404, "Integration not found"));
    if (!integration.isEnabled) return next(createError(400, "Integration is disabled"));

    integration.syncedAt = new Date();
    await integration.save();

    logger.info(`Admin integration synced: ${integration.name}`);
    res.json({ status: "success", message: "Integration sync initiated", data: { syncedAt: integration.syncedAt } });
  } catch (error) {
    next(error);
  }
};

export const getAvailableProviders = async (_req, res) => {
  res.json({ status: "success", data: { providers: INTEGRATION_PROVIDERS } });
};
