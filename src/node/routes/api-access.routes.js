import express from "express";
import { protect } from "../middleware/auth.js";
import { requirePlanFeature } from "../services/plan-access.service.js";
import {
  getApiKeys,
  createApiKey,
  deleteApiKey,
  getApiKeyUsage,
  getWebhooks,
  createWebhook,
  deleteWebhook,
} from "../controllers/api-access.controller.js";

const router = express.Router();

// All API access routes require authentication
router.use(protect);

// API Keys
router.get("/api-keys", getApiKeys);
// Creating keys and webhooks needs a plan with API access; existing ones can still be listed and revoked
const apiAccess = requirePlanFeature("apiAccess", { label: "API access" });
router.post("/api-keys", apiAccess, createApiKey);
router.delete("/api-keys/:id", deleteApiKey);
router.get("/api-keys/:id/usage", getApiKeyUsage);

// Webhooks
router.get("/webhooks", getWebhooks);
router.post("/webhooks", apiAccess, createWebhook);
router.delete("/webhooks/:id", deleteWebhook);

export default router;
