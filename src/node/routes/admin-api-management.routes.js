import express from "express";
import { authenticateAdmin, authorizeAdmin } from "../middleware/auth.js";
import {
  getAPIKeys,
  getAPIKeyById,
  createAPIKey,
  updateAPIKey,
  revokeAPIKey,
  deleteAPIKey,
  regenerateAPIKey,
  updateRateLimit,
  getAPILogs,
  getAPILogById,
  exportAPILogs,
  getAPIUsageStats,
  getWebhooks,
  getWebhookById,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  toggleWebhook,
  getAvailableEvents,
  getIntegrations,
  getIntegrationById,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  toggleIntegration,
  testIntegration,
  syncIntegration,
  getAvailableProviders,
} from "../controllers/admin-api-management.controller.js";

const router = express.Router();

// All routes require admin auth + system_configuration permission
router.use(authenticateAdmin);

// ─── API KEYS ────────────────────────────────────────────────────────────────
router.get(
  "/keys",
  authorizeAdmin(["system_configuration"]),
  getAPIKeys
);
router.get(
  "/keys/:keyId",
  authorizeAdmin(["system_configuration"]),
  getAPIKeyById
);
router.post(
  "/keys",
  authorizeAdmin(["system_configuration"]),
  createAPIKey
);
router.put(
  "/keys/:keyId",
  authorizeAdmin(["system_configuration"]),
  updateAPIKey
);
router.post(
  "/keys/:keyId/revoke",
  authorizeAdmin(["system_configuration"]),
  revokeAPIKey
);
router.delete(
  "/keys/:keyId",
  authorizeAdmin(["system_configuration"]),
  deleteAPIKey
);
router.post(
  "/keys/:keyId/regenerate",
  authorizeAdmin(["system_configuration"]),
  regenerateAPIKey
);
router.put(
  "/keys/:keyId/rate-limit",
  authorizeAdmin(["system_configuration"]),
  updateRateLimit
);

// ─── API LOGS ────────────────────────────────────────────────────────────────
router.get(
  "/logs",
  authorizeAdmin(["analytics", "audit_logs"]),
  getAPILogs
);
router.get(
  "/logs/:logId",
  authorizeAdmin(["analytics", "audit_logs"]),
  getAPILogById
);
router.post(
  "/logs/export",
  authorizeAdmin(["analytics", "audit_logs"]),
  exportAPILogs
);

// ─── API STATS ───────────────────────────────────────────────────────────────
router.get(
  "/stats",
  authorizeAdmin(["analytics"]),
  getAPIUsageStats
);

// ─── WEBHOOKS — static routes BEFORE parameterised ───────────────────────────
router.get(
  "/webhooks/events",
  authorizeAdmin(["system_configuration"]),
  getAvailableEvents
);
router.get(
  "/webhooks",
  authorizeAdmin(["system_configuration"]),
  getWebhooks
);
router.post(
  "/webhooks",
  authorizeAdmin(["system_configuration"]),
  createWebhook
);
router.get(
  "/webhooks/:webhookId",
  authorizeAdmin(["system_configuration"]),
  getWebhookById
);
router.put(
  "/webhooks/:webhookId",
  authorizeAdmin(["system_configuration"]),
  updateWebhook
);
router.delete(
  "/webhooks/:webhookId",
  authorizeAdmin(["system_configuration"]),
  deleteWebhook
);
router.post(
  "/webhooks/:webhookId/test",
  authorizeAdmin(["system_configuration"]),
  testWebhook
);
router.patch(
  "/webhooks/:webhookId/toggle",
  authorizeAdmin(["system_configuration"]),
  toggleWebhook
);

// ─── INTEGRATIONS — static routes BEFORE parameterised ───────────────────────
router.get(
  "/integrations/providers",
  authorizeAdmin(["system_configuration"]),
  getAvailableProviders
);
router.get(
  "/integrations",
  authorizeAdmin(["system_configuration"]),
  getIntegrations
);
router.post(
  "/integrations",
  authorizeAdmin(["system_configuration"]),
  createIntegration
);
router.get(
  "/integrations/:integrationId",
  authorizeAdmin(["system_configuration"]),
  getIntegrationById
);
router.put(
  "/integrations/:integrationId",
  authorizeAdmin(["system_configuration"]),
  updateIntegration
);
router.delete(
  "/integrations/:integrationId",
  authorizeAdmin(["system_configuration"]),
  deleteIntegration
);
router.patch(
  "/integrations/:integrationId/toggle",
  authorizeAdmin(["system_configuration"]),
  toggleIntegration
);
router.post(
  "/integrations/:integrationId/test",
  authorizeAdmin(["system_configuration"]),
  testIntegration
);
router.post(
  "/integrations/:integrationId/sync",
  authorizeAdmin(["system_configuration"]),
  syncIntegration
);

export default router;
