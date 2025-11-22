import express from "express";
import {
  getMonitoringReport,
  getPaymentCompletionRate,
  getSubscriptionMetrics,
  getFailedPayments,
  getStalePayments,
  getWebhookSuccessRate,
  healthCheck,
} from "../controllers/monitoring.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

/**
 * Monitoring Routes
 * All routes require admin authentication
 */

// Health check (public)
router.get("/health", healthCheck);

// Protected monitoring endpoints (admin only)
router.use(protect);
router.use(restrictTo("admin"));

// Get comprehensive monitoring report
router.get("/report", getMonitoringReport);

// Get payment completion rate
router.get("/payment-completion-rate", getPaymentCompletionRate);

// Get subscription metrics
router.get("/subscriptions", getSubscriptionMetrics);

// Get failed payments
router.get("/failed-payments", getFailedPayments);

// Get stale pending payments
router.get("/stale-payments", getStalePayments);

// Get webhook success rate
router.get("/webhook-success-rate", getWebhookSuccessRate);

export default router;
