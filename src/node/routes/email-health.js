import express from "express";
import {
  testEmailConnection,
  sendTestEmail,
  getEmailServiceHealth,
} from "../utils/email.js";
import emailQueueService from "../services/email-queue.service.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

/**
 * GET /api/email-health/status
 * Get comprehensive email service health status
 */
router.get("/status", async (req, res) => {
  try {
    const healthStatus = await getEmailServiceHealth();
    const queueStatus = await emailQueueService.getQueueStatus();

    const response = {
      ...healthStatus,
      queue: queueStatus,
    };

    const statusCode = healthStatus.overall.healthy ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error("Email health check failed:", error);
    res.status(500).json({
      status: "error",
      message: "Health check failed",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/email-health/test-connection
 * Test SMTP connection
 */
router.post("/test-connection", async (req, res) => {
  try {
    const result = await testEmailConnection();
    const statusCode = result.success ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error) {
    logger.error("Connection test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/email-health/test-send
 * Send a test email
 */
router.post("/test-send", async (req, res) => {
  try {
    const { email, includeConfig = false } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email address is required",
        timestamp: new Date().toISOString(),
      });
    }

    const result = await sendTestEmail(email, {
      includeConfig,
      includeTimestamp: true,
    });

    const statusCode = result.success ? 200 : 503;
    res.status(statusCode).json(result);
  } catch (error) {
    logger.error("Test email failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/email-health/queue
 * Get email queue status and statistics
 */
router.get("/queue", async (req, res) => {
  try {
    const queueStatus = await emailQueueService.getQueueStatus();
    res.json(queueStatus);
  } catch (error) {
    logger.error("Queue status check failed:", error);
    res.status(500).json({
      error: "Failed to get queue status",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/email-health/queue/cleanup
 * Clean up old queue items
 */
router.post("/queue/cleanup", async (req, res) => {
  try {
    const { olderThanDays = 7 } = req.body;
    const removedCount = await emailQueueService.cleanupQueue(olderThanDays);

    res.json({
      success: true,
      removedCount,
      message: `Cleaned up ${removedCount} old queue items`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Queue cleanup failed:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup queue",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
