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
 * @swagger
 * /email-health/status:
 *   get:
 *     summary: Get comprehensive email service health status
 *     description: Returns detailed health information about the email service including SMTP connection, configuration validation, and email queue status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Email service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overall:
 *                   type: object
 *                   properties:
 *                     healthy:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Email service is healthy"
 *                 smtp:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                 config:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: string
 *                 queue:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                       example: 10
 *                     pending:
 *                       type: number
 *                       example: 2
 *                     sent:
 *                       type: number
 *                       example: 7
 *                     failed:
 *                       type: number
 *                       example: 1
 *       503:
 *         description: Email service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overall:
 *                   type: object
 *                   properties:
 *                     healthy:
 *                       type: boolean
 *                       example: false
 *                     message:
 *                       type: string
 *       500:
 *         description: Health check failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "error"
 *                 message:
 *                   type: string
 *                   example: "Health check failed"
 *                 error:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
 * @swagger
 * /email-health/test-connection:
 *   post:
 *     summary: Test SMTP connection
 *     description: Tests the SMTP server connection without sending any emails
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: SMTP connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "SMTP connection successful"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: SMTP connection failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Connection test failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
 * @swagger
 * /email-health/test-send:
 *   post:
 *     summary: Send a test email
 *     description: Sends a test email to verify email sending functionality
 *     tags: [Health]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to send test email to
 *                 example: "test@example.com"
 *               includeConfig:
 *                 type: boolean
 *                 description: Include configuration details in email
 *                 example: false
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Test email sent successfully"
 *                 messageId:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request - email address missing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Email address is required"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Email service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Test email failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
 * @swagger
 * /email-health/queue:
 *   get:
 *     summary: Get email queue status and statistics
 *     description: Returns statistics about the email queue including total, pending, sent, and failed emails
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Queue status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   description: Total number of emails in queue
 *                   example: 100
 *                 pending:
 *                   type: number
 *                   description: Number of pending emails
 *                   example: 5
 *                 sent:
 *                   type: number
 *                   description: Number of successfully sent emails
 *                   example: 90
 *                 failed:
 *                   type: number
 *                   description: Number of failed emails
 *                   example: 5
 *                 oldestPending:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp of oldest pending email
 *                 recentFailures:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       error:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Failed to get queue status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to get queue status"
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
 * @swagger
 * /email-health/queue/cleanup:
 *   post:
 *     summary: Clean up old queue items
 *     description: Removes old email queue items that are older than the specified number of days
 *     tags: [Health]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanDays:
 *                 type: number
 *                 description: Remove queue items older than this many days
 *                 default: 7
 *                 example: 7
 *     responses:
 *       200:
 *         description: Queue cleanup completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 removedCount:
 *                   type: number
 *                   description: Number of queue items removed
 *                   example: 25
 *                 message:
 *                   type: string
 *                   example: "Cleaned up 25 old queue items"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Queue cleanup failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to cleanup queue"
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
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
