import { logger } from "../utils/logger.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Email Queue Service for handling failed email delivery attempts
 * Provides fallback mechanism for email sending with retry capabilities
 */
class EmailQueueService {
  constructor() {
    this.queueFile = path.join(__dirname, "../logs/email-queue.json");
    this.processingInterval = null;
    this.isProcessing = false;
    this.maxRetries = 5;
    this.retryDelays = [60000, 300000, 900000, 3600000, 7200000]; // 1min, 5min, 15min, 1hr, 2hr
  }

  /**
   * Initialize the email queue service
   */
  async initialize() {
    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(this.queueFile);
      await fs.mkdir(logsDir, { recursive: true });

      // Initialize queue file if it doesn't exist
      try {
        await fs.access(this.queueFile);
      } catch (error) {
        await fs.writeFile(this.queueFile, JSON.stringify([]));
        logger.info("Email queue file initialized");
      }

      // Start background processing
      this.startProcessing();

      logger.info("Email queue service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize email queue service:", error);
      throw error;
    }
  }

  /**
   * Add email to queue for retry processing
   */
  async addToQueue(emailData, originalError = null) {
    try {
      const queueItem = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxRetries: this.maxRetries,
        nextRetry: new Date(Date.now() + this.retryDelays[0]).toISOString(),
        status: "pending",
        emailData: {
          ...emailData,
          // Remove sensitive data from queue storage
          auth: undefined,
        },
        originalError: originalError
          ? {
              message: originalError.message,
              code: originalError.code,
              timestamp: new Date().toISOString(),
            }
          : null,
        retryHistory: [],
      };

      const queue = await this.loadQueue();
      queue.push(queueItem);
      await this.saveQueue(queue);

      logger.info("Email added to retry queue:", {
        queueId: queueItem.id,
        recipient: emailData.to,
        subject: emailData.subject,
        nextRetry: queueItem.nextRetry,
      });

      return queueItem.id;
    } catch (error) {
      logger.error("Failed to add email to queue:", error);
      throw error;
    }
  }

  /**
   * Process queued emails for retry
   */
  async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const queue = await this.loadQueue();
      const now = new Date();
      const itemsToProcess = queue.filter(
        (item) =>
          item.status === "pending" &&
          new Date(item.nextRetry) <= now &&
          item.attempts < item.maxRetries
      );

      if (itemsToProcess.length === 0) {
        return;
      }

      logger.info(`Processing ${itemsToProcess.length} queued emails`);

      for (const item of itemsToProcess) {
        await this.processQueueItem(item, queue);
      }

      await this.saveQueue(queue);
    } catch (error) {
      logger.error("Error processing email queue:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual queue item
   */
  async processQueueItem(item, queue) {
    try {
      item.attempts++;
      item.retryHistory.push({
        attempt: item.attempts,
        timestamp: new Date().toISOString(),
        status: "attempting",
      });

      logger.info(
        `Retrying email delivery (attempt ${item.attempts}/${item.maxRetries}):`,
        {
          queueId: item.id,
          recipient: item.emailData.to,
          subject: item.emailData.subject,
        }
      );

      // Import email service dynamically to avoid circular dependency
      const { sendEmailDirect } = await import("../utils/email.js");

      // Attempt to send email
      const result = await sendEmailDirect(item.emailData);

      // Success - mark as completed
      item.status = "completed";
      item.completedAt = new Date().toISOString();
      item.messageId = result.messageId;

      const lastRetry = item.retryHistory[item.retryHistory.length - 1];
      lastRetry.status = "success";
      lastRetry.messageId = result.messageId;

      logger.info("Queued email sent successfully:", {
        queueId: item.id,
        recipient: item.emailData.to,
        messageId: result.messageId,
        attempts: item.attempts,
      });
    } catch (error) {
      // Update retry history
      const lastRetry = item.retryHistory[item.retryHistory.length - 1];
      lastRetry.status = "failed";
      lastRetry.error = {
        message: error.message,
        code: error.code,
      };

      if (item.attempts >= item.maxRetries) {
        // Max retries reached - mark as failed
        item.status = "failed";
        item.failedAt = new Date().toISOString();
        item.finalError = {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
        };

        logger.error("Email delivery failed permanently after max retries:", {
          queueId: item.id,
          recipient: item.emailData.to,
          attempts: item.attempts,
          error: error.message,
        });
      } else {
        // Schedule next retry
        const nextDelay =
          this.retryDelays[
            Math.min(item.attempts - 1, this.retryDelays.length - 1)
          ];
        item.nextRetry = new Date(Date.now() + nextDelay).toISOString();

        logger.warn("Email delivery retry failed, scheduling next attempt:", {
          queueId: item.id,
          recipient: item.emailData.to,
          attempt: item.attempts,
          nextRetry: item.nextRetry,
          error: error.message,
        });
      }
    }
  }

  /**
   * Get queue statistics and status
   */
  async getQueueStatus() {
    try {
      const queue = await this.loadQueue();

      const stats = {
        total: queue.length,
        pending: queue.filter((item) => item.status === "pending").length,
        completed: queue.filter((item) => item.status === "completed").length,
        failed: queue.filter((item) => item.status === "failed").length,
        processing: this.isProcessing,
        nextProcessing: this.processingInterval ? "active" : "stopped",
      };

      const recentItems = queue
        .filter((item) => {
          const itemDate = new Date(item.timestamp);
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return itemDate > dayAgo;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          recipient: item.emailData.to,
          subject: item.emailData.subject,
          status: item.status,
          attempts: item.attempts,
          timestamp: item.timestamp,
          nextRetry: item.nextRetry,
        }));

      return {
        stats,
        recentItems,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Failed to get queue status:", error);
      throw error;
    }
  }

  /**
   * Clean up old completed and failed items
   */
  async cleanupQueue(olderThanDays = 7) {
    try {
      const queue = await this.loadQueue();
      const cutoffDate = new Date(
        Date.now() - olderThanDays * 24 * 60 * 60 * 1000
      );

      const initialCount = queue.length;
      const cleanedQueue = queue.filter((item) => {
        const itemDate = new Date(item.timestamp);
        // Keep pending items and recent completed/failed items
        return item.status === "pending" || itemDate > cutoffDate;
      });

      const removedCount = initialCount - cleanedQueue.length;

      if (removedCount > 0) {
        await this.saveQueue(cleanedQueue);
        logger.info(`Cleaned up ${removedCount} old queue items`);
      }

      return removedCount;
    } catch (error) {
      logger.error("Failed to cleanup queue:", error);
      throw error;
    }
  }

  /**
   * Start background processing
   */
  startProcessing(intervalMs = 60000) {
    // Process every minute
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      try {
        await this.processQueue();
      } catch (error) {
        logger.error("Error in queue processing interval:", error);
      }
    }, intervalMs);

    logger.info("Email queue background processing started");
  }

  /**
   * Stop background processing
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info("Email queue background processing stopped");
    }
  }

  /**
   * Load queue from file
   */
  async loadQueue() {
    try {
      const data = await fs.readFile(this.queueFile, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      logger.warn("Failed to load queue file, returning empty queue:", error);
      return [];
    }
  }

  /**
   * Save queue to file
   */
  async saveQueue(queue) {
    try {
      await fs.writeFile(this.queueFile, JSON.stringify(queue, null, 2));
    } catch (error) {
      logger.error("Failed to save queue file:", error);
      throw error;
    }
  }

  /**
   * Generate unique ID for queue items
   */
  generateId() {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
const emailQueueService = new EmailQueueService();

export default emailQueueService;
