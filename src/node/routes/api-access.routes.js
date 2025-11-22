import express from "express";
import { protect } from "../middleware/auth.js";
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
router.post("/api-keys", createApiKey);
router.delete("/api-keys/:id", deleteApiKey);
router.get("/api-keys/:id/usage", getApiKeyUsage);

// Webhooks
router.get("/webhooks", getWebhooks);
router.post("/webhooks", createWebhook);
router.delete("/webhooks/:id", deleteWebhook);

export default router;
