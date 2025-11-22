import axios from "axios";
import Webhook from "../models/webhook.model.js";
import WebhookLog from "../models/webhook-log.model.js";

/**
 * Webhook Service
 * Handles sending webhook notifications to registered endpoints
 */

class WebhookService {
  /**
   * Trigger webhooks for a specific event
   * @param {string} eventType - The event type (e.g., 'event.created')
   * @param {object} payload - The event payload
   * @param {string} userId - The user ID who owns the resource
   */
  async trigger(eventType, payload, userId) {
    try {
      // Find all active webhooks for this user and event type
      const webhooks = await Webhook.find({
        user: userId,
        active: true,
        events: eventType,
      });

      if (webhooks.length === 0) {
        return;
      }

      // Send webhooks in parallel
      const promises = webhooks.map((webhook) =>
        this.sendWebhook(webhook, eventType, payload)
      );

      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Error triggering webhooks:", error);
    }
  }

  /**
   * Send a webhook to a specific endpoint
   * @param {object} webhook - The webhook configuration
   * @param {string} eventType - The event type
   * @param {object} payload - The event payload
   */
  async sendWebhook(webhook, eventType, payload, retryCount = 0) {
    const startTime = Date.now();

    try {
      // Prepare webhook payload
      const webhookPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      };

      // Generate signature
      const signature = webhook.generateSignature(webhookPayload);

      // Send webhook
      const response = await axios.post(webhook.url, webhookPayload, {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": eventType,
          "User-Agent": "Confetti-Webhooks/1.0",
        },
        timeout: 10000, // 10 seconds
      });

      const duration = Date.now() - startTime;

      // Log success
      await WebhookLog.create({
        webhook: webhook._id,
        event: eventType,
        payload: webhookPayload,
        response: {
          status: response.status,
          body: response.data,
          headers: response.headers,
        },
        success: true,
        duration,
        retryCount,
      });

      // Update webhook success count
      await webhook.recordSuccess();

      return { success: true };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failure
      await WebhookLog.create({
        webhook: webhook._id,
        event: eventType,
        payload: {
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload,
        },
        response: error.response
          ? {
              status: error.response.status,
              body: error.response.data,
              headers: error.response.headers,
            }
          : null,
        success: false,
        error: error.message,
        duration,
        retryCount,
      });

      // Update webhook failure count
      await webhook.recordFailure(error);

      // Retry logic (max 3 retries with exponential backoff)
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWebhook(webhook, eventType, payload, retryCount + 1);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Test a webhook endpoint
   * @param {string} url - The webhook URL
   * @param {string} secret - The webhook secret
   */
  async testWebhook(url, secret) {
    try {
      const testPayload = {
        event: "webhook.test",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test webhook from Confetti Event Planner",
        },
      };

      const signature = require("crypto")
        .createHmac("sha256", secret)
        .update(JSON.stringify(testPayload))
        .digest("hex");

      const response = await axios.post(url, testPayload, {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": "webhook.test",
          "User-Agent": "Confetti-Webhooks/1.0",
        },
        timeout: 10000,
      });

      return {
        success: true,
        status: response.status,
        message: "Webhook test successful",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
      };
    }
  }
}

export default new WebhookService();
