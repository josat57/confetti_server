import paymentMonitoringService from "../services/monitoring/payment-monitoring.service.js";
import { logger } from "../utils/logger.js";

/**
 * Monitoring Controller
 * Provides endpoints for monitoring payment and subscription metrics
 */

/**
 * Get monitoring report
 * GET /api/v1/monitoring/report
 */
export const getMonitoringReport = async (req, res, next) => {
  try {
    const { timeframe = "24h" } = req.query;

    const report = await paymentMonitoringService.generateMonitoringReport(
      timeframe
    );

    if (!report) {
      return res.status(500).json({
        status: "error",
        message: "Failed to generate monitoring report",
      });
    }

    res.status(200).json({
      status: "success",
      data: report,
    });
  } catch (error) {
    logger.error("Error fetching monitoring report", {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get payment completion rate
 * GET /api/v1/monitoring/payment-completion-rate
 */
export const getPaymentCompletionRate = async (req, res, next) => {
  try {
    const { timeframe = "24h" } = req.query;

    const stats = await paymentMonitoringService.getPaymentCompletionRate(
      timeframe
    );

    if (!stats) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch payment completion rate",
      });
    }

    res.status(200).json({
      status: "success",
      data: stats,
    });
  } catch (error) {
    logger.error("Error fetching payment completion rate", {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get subscription metrics
 * GET /api/v1/monitoring/subscriptions
 */
export const getSubscriptionMetrics = async (req, res, next) => {
  try {
    const metrics = await paymentMonitoringService.getSubscriptionMetrics();

    if (!metrics) {
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch subscription metrics",
      });
    }

    res.status(200).json({
      status: "success",
      data: metrics,
    });
  } catch (error) {
    logger.error("Error fetching subscription metrics", {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get recent failed payments
 * GET /api/v1/monitoring/failed-payments
 */
export const getFailedPayments = async (req, res, next) => {
  try {
    const { hours = 24 } = req.query;

    const failedPayments =
      await paymentMonitoringService.getRecentFailedPayments(parseInt(hours));

    res.status(200).json({
      status: "success",
      data: {
        count: failedPayments.length,
        payments: failedPayments,
      },
    });
  } catch (error) {
    logger.error("Error fetching failed payments", {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get stale pending payments
 * GET /api/v1/monitoring/stale-payments
 */
export const getStalePayments = async (req, res, next) => {
  try {
    const { hours = 24 } = req.query;

    const stalePayments =
      await paymentMonitoringService.getStalePendingPayments(parseInt(hours));

    res.status(200).json({
      status: "success",
      data: {
        count: stalePayments.length,
        payments: stalePayments,
      },
    });
  } catch (error) {
    logger.error("Error fetching stale payments", {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Get webhook success rate
 * GET /api/v1/monitoring/webhook-success-rate
 */
export const getWebhookSuccessRate = async (req, res, next) => {
  try {
    const successRate = paymentMonitoringService.getWebhookSuccessRate();

    res.status(200).json({
      status: "success",
      data: {
        successRate: parseFloat(successRate),
        metrics: paymentMonitoringService.metrics.webhooks,
      },
    });
  } catch (error) {
    logger.error("Error fetching webhook success rate", {
      error: error.message,
    });
    next(error);
  }
};

/**
 * Health check endpoint
 * GET /api/v1/monitoring/health
 */
export const healthCheck = async (req, res, next) => {
  try {
    // Check critical metrics
    const paymentStats =
      await paymentMonitoringService.getPaymentCompletionRate("24h");
    const subscriptionStats =
      await paymentMonitoringService.getSubscriptionMetrics();
    const webhookSuccessRate = parseFloat(
      paymentMonitoringService.getWebhookSuccessRate()
    );

    // Determine health status
    const isHealthy =
      (!paymentStats || parseFloat(paymentStats.rate) >= 80) &&
      webhookSuccessRate >= 90;

    const status = isHealthy ? "healthy" : "degraded";

    res.status(isHealthy ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        paymentCompletionRate: {
          status:
            !paymentStats || parseFloat(paymentStats.rate) >= 80
              ? "pass"
              : "fail",
          value: paymentStats?.rate || "N/A",
          threshold: "80%",
        },
        webhookSuccessRate: {
          status: webhookSuccessRate >= 90 ? "pass" : "fail",
          value: `${webhookSuccessRate}%`,
          threshold: "90%",
        },
        subscriptions: {
          status: "pass",
          active: subscriptionStats?.active || 0,
          total: subscriptionStats
            ? Object.values(subscriptionStats).reduce(
                (sum, val) => sum + val,
                0
              )
            : 0,
        },
      },
    });
  } catch (error) {
    logger.error("Error performing health check", {
      error: error.message,
    });
    res.status(503).json({
      status: "error",
      message: "Health check failed",
      error: error.message,
    });
  }
};
