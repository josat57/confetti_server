import express from "express";
import {
  testEmailConnection,
  sendTestEmail,
  getEmailServiceHealth,
} from "../utils/email.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

/**
 * GET /health/email
 * Get comprehensive email service health status
 */
router.get("/email", async (req, res) => {
  try {
    const healthStatus = await getEmailServiceHealth();

    const statusCode = healthStatus.overall.healthy ? 200 : 503;

    res.status(statusCode).json({
      success: healthStatus.overall.healthy,
      data: healthStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Email health check endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Health check failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/email/connection
 * Test SMTP connection only
 */
router.get("/email/connection", async (req, res) => {
  try {
    const connectionTest = await testEmailConnection();

    const statusCode = connectionTest.success ? 200 : 503;

    res.status(statusCode).json({
      success: connectionTest.success,
      data: connectionTest,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Email connection test endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Connection test failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /health/email/test
 * Send a test email to verify email sending functionality
 * Body: { email: "test@example.com", options?: { subject?, includeTimestamp?, includeConfig? } }
 */
router.post("/email/test", async (req, res) => {
  try {
    const { email, options = {} } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email address is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email address format",
        timestamp: new Date().toISOString(),
      });
    }

    const testResult = await sendTestEmail(email, options);

    const statusCode = testResult.success ? 200 : 503;

    res.status(statusCode).json({
      success: testResult.success,
      data: testResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Test email endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Test email failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health
 * Basic application health check
 */
router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "confetti-api",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
