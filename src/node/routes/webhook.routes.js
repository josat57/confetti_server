import express from "express";
import {
  getWebhooks,
  getWebhook,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookLogs,
  getWebhookEvents,
} from "../controllers/webhook.controller.js";
import { protect } from "../middleware/auth.js";
import { restrictTo } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Webhook events (public info)
router.get("/events", getWebhookEvents);

// Webhook CRUD
router.get("/", getWebhooks);
router.post("/", restrictTo("event-planner"), createWebhook);
router.get("/:id", getWebhook);
router.put("/:id", updateWebhook);
router.delete("/:id", deleteWebhook);

// Webhook testing and logs
router.post("/:id/test", testWebhook);
router.get("/:id/logs", getWebhookLogs);

export default router;
