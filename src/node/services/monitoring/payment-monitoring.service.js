import { logger } from "../../utils/logger.js";
import Payment from "../../models/payment.model.js";
import Subscription from "../../models/subscription.model.js";

/**
 * Payment and Webhook Monitoring Service
 *
 * Tracks and monitors:
 * - Webhook success/failure rates
 * - Payment completion rates
 * - Failed payment alerts
 * - Subscription metrics
 */
class PaymentMonitoringService {
  constructor() {
    this.metrics = {
      webhooks: {
        total: 0,
        successful: 0,
        failed: 0,
        invalidSignature: 0,
      },
      payments: {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
      },
      subscriptions: {
        active: 0,
        pendingPayment: 0,
        expired: 0,
        cancelled: 0,
      },
    };
  }

  /**
   * Track webhook attempt
   */
  trackWebhookAttempt(provider, success, reason = null) {
    this.metrics.webhooks.total++;

    if (success) {
      this.metrics.webhooks.successful++;
      logger.info(`Webhook processed successfully`, {
        provider,
        timestamp: new Date().toISOString(),
      });
    } else {
      this.metrics.webhooks.failed++;
      logger.error(`Webhook processing failed`, {
        provider,
        reason,
        timestamp: new Date().toISOString(),
      });

      // Alert on webhook failures
      if (reason === "invalid_signature") {
        this.metrics.webhooks.invalidSignature++;
        this.alertInvalidWebhookSignature(provider);
      }
    }
  }

  /**
   * Track payment status change
   */
  trackPaymentStatusChange(payment, oldStatus, newStatus) {
    logger.info(`Payment status changed`, {
      paymentId: payment._id,
      reference: payment.reference,
      oldStatus,
      newStatus,
      amount: payment.amount,
      timestamp: new Date().toISOString(),
    });

    // Alert on failed payments
    if (newStatus === "failed") {
      this.alertFailedPayment(payment);
    }

    // Alert on completed subscription payments
    if (newStatus === "completed" && payment.paymentType === "subscription") {
      this.logSuccessfulSubscriptionPayment(payment);
    }
  }

  /**
   * Get webhook success rate
   */
  getWebhookSuccessRate() {
    if (this.metrics.webhooks.total === 0) return 0;
    return (
      (this.metrics.webhooks.successful / this.metrics.webhooks.total) *
      100
    ).toFixed(2);
  }

  /**
   * Get payment completion rate
   */
  async getPaymentCompletionRate(timeframe = "24h") {
    try {
      const hours = timeframe === "24h" ? 24 : timeframe === "7d" ? 168 : 24;
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const payments = await Payment.find({
        createdAt: { $gte: startDate },
        paymentType: "subscription",
      });

      const total = payments.length;
      const completed = payments.filter((p) => p.status === "completed").length;

      const rate = total > 0 ? ((completed / total) * 100).toFixed(2) : 0;

      logger.info(`Payment completion rate (${timeframe})`, {
        total,
        completed,
        rate: `${rate}%`,
        timestamp: new Date().toISOString(),
      });

      return {
        total,
        completed,
        failed: payments.filter((p) => p.status === "failed").length,
        pending: payments.filter((p) => p.status === "pending").length,
        rate,
      };
    } catch (error) {
      logger.error("Error calculating payment completion rate", {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get subscription metrics
   */
  async getSubscriptionMetrics() {
    try {
      const metrics = await Subscription.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {
        active: 0,
        pending_payment: 0,
        expired: 0,
        cancelled: 0,
        trial: 0,
      };

      metrics.forEach((metric) => {
        result[metric._id] = metric.count;
      });

      logger.info("Subscription metrics", {
        ...result,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      logger.error("Error fetching subscription metrics", {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get failed payments in last 24 hours
   */
  async getRecentFailedPayments(hours = 24) {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const failedPayments = await Payment.find({
        status: "failed",
        updatedAt: { $gte: startDate },
        paymentType: "subscription",
      })
        .populate("user", "email userName")
        .populate("subscription", "planName planType")
        .sort({ updatedAt: -1 })
        .limit(50);

      logger.info(
        `Found ${failedPayments.length} failed payments in last ${hours}h`,
        {
          count: failedPayments.length,
          timestamp: new Date().toISOString(),
        }
      );

      return failedPayments;
    } catch (error) {
      logger.error("Error fetching failed payments", {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Get pending payments older than threshold
   */
  async getStalePendingPayments(hours = 24) {
    try {
      const thresholdDate = new Date();
      thresholdDate.setHours(thresholdDate.getHours() - hours);

      const stalePayments = await Payment.find({
        status: "pending",
        createdAt: { $lte: thresholdDate },
        paymentType: "subscription",
      })
        .populate("user", "email userName")
        .populate("subscription", "planName planType")
        .sort({ createdAt: 1 })
        .limit(50);

      if (stalePayments.length > 0) {
        logger.warn(`Found ${stalePayments.length} stale pending payments`, {
          count: stalePayments.length,
          oldestPayment: stalePayments[0]?.createdAt,
          timestamp: new Date().toISOString(),
        });
      }

      return stalePayments;
    } catch (error) {
      logger.error("Error fetching stale pending payments", {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Alert on failed payment
   */
  alertFailedPayment(payment) {
    logger.error("ALERT: Payment Failed", {
      paymentId: payment._id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      userId: payment.user,
      subscriptionId: payment.subscription,
      paymentMethod: payment.paymentMethod,
      timestamp: new Date().toISOString(),
      severity: "high",
    });

    // In production, this would trigger:
    // - Email to admin
    // - Slack notification
    // - PagerDuty alert (if critical)
  }

  /**
   * Alert on invalid webhook signature
   */
  alertInvalidWebhookSignature(provider) {
    logger.error("ALERT: Invalid Webhook Signature", {
      provider,
      timestamp: new Date().toISOString(),
      severity: "critical",
      message: "Potential security issue - invalid webhook signature detected",
    });

    // In production, this would trigger:
    // - Immediate security alert
    // - Email to security team
    // - Slack notification to dev team
  }

  /**
   * Log successful subscription payment
   */
  logSuccessfulSubscriptionPayment(payment) {
    logger.info("Subscription payment completed successfully", {
      paymentId: payment._id,
      reference: payment.reference,
      amount: payment.amount,
      planName: payment.subscriptionDetails?.planName,
      planType: payment.subscriptionDetails?.planType,
      isUpgrade: payment.subscriptionDetails?.isUpgrade,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Generate monitoring report
   */
  async generateMonitoringReport(timeframe = "24h") {
    try {
      const paymentStats = await this.getPaymentCompletionRate(timeframe);
      const subscriptionStats = await this.getSubscriptionMetrics();
      const failedPayments = await this.getRecentFailedPayments(24);
      const stalePayments = await this.getStalePendingPayments(24);

      const report = {
        timestamp: new Date().toISOString(),
        timeframe,
        webhooks: {
          total: this.metrics.webhooks.total,
          successful: this.metrics.webhooks.successful,
          failed: this.metrics.webhooks.failed,
          invalidSignature: this.metrics.webhooks.invalidSignature,
          successRate: this.getWebhookSuccessRate(),
        },
        payments: paymentStats,
        subscriptions: subscriptionStats,
        alerts: {
          failedPayments: failedPayments.length,
          stalePayments: stalePayments.length,
        },
      };

      logger.info("Monitoring Report Generated", report);

      return report;
    } catch (error) {
      logger.error("Error generating monitoring report", {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Reset metrics (for testing or periodic resets)
   */
  resetMetrics() {
    this.metrics = {
      webhooks: {
        total: 0,
        successful: 0,
        failed: 0,
        invalidSignature: 0,
      },
      payments: {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
      },
      subscriptions: {
        active: 0,
        pendingPayment: 0,
        expired: 0,
        cancelled: 0,
      },
    };
    logger.info("Monitoring metrics reset");
  }
}

export default new PaymentMonitoringService();
