import AnalyticsService from "../services/analytics.service.js";
import Subscription from "../models/subscription.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Check if user has access to analytics (Professional+ tier)
 */
const checkAnalyticsAccess = async (plannerId) => {
  const subscription = await Subscription.findOne({
    user: plannerId,
    planType: "planner",
  });

  if (!subscription || !subscription.isActive()) {
    throw new AppError("Active subscription required", 403);
  }

  const allowedTiers = ["Professional", "Business", "Enterprise"];

  if (!allowedTiers.includes(subscription.planName)) {
    throw new AppError(
      "Analytics and reports are only available for Professional, Business, and Enterprise tiers. Please upgrade your subscription.",
      403
    );
  }

  return subscription;
};

/**
 * Controller for Planner Reports & Analytics (Professional+ tier)
 */
class PlannerReportsController {
  /**
   * Get dashboard analytics
   * GET /api/v1/planner/reports/dashboard
   */
  async getDashboardReport(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { startDate, endDate } = req.query;

      // Check subscription tier
      await checkAnalyticsAccess(plannerId);

      logger.info("Generating dashboard report", { plannerId });

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const summary = await AnalyticsService.generateDashboardSummary(
        plannerId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get events report
   * GET /api/v1/planner/reports/events
   */
  async getEventsReport(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { startDate, endDate } = req.query;

      // Check subscription tier
      await checkAnalyticsAccess(plannerId);

      logger.info("Generating events report", { plannerId });

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const metrics = await AnalyticsService.calculateEventMetrics(
        plannerId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: {
          metrics,
          generatedAt: new Date(),
          dateRange,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get financial report
   * GET /api/v1/planner/reports/financial
   */
  async getFinancialReport(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { startDate, endDate } = req.query;

      // Check subscription tier
      await checkAnalyticsAccess(plannerId);

      logger.info("Generating financial report", { plannerId });

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const metrics = await AnalyticsService.calculateFinancialMetrics(
        plannerId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: {
          metrics,
          generatedAt: new Date(),
          dateRange,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendors report
   * GET /api/v1/planner/reports/vendors
   */
  async getVendorsReport(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { startDate, endDate } = req.query;

      // Check subscription tier
      await checkAnalyticsAccess(plannerId);

      logger.info("Generating vendors report", { plannerId });

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const metrics = await AnalyticsService.calculateVendorMetrics(
        plannerId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: {
          metrics,
          generatedAt: new Date(),
          dateRange,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get clients report
   * GET /api/v1/planner/reports/clients
   */
  async getClientsReport(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { startDate, endDate } = req.query;

      // Check subscription tier
      await checkAnalyticsAccess(plannerId);

      logger.info("Generating clients report", { plannerId });

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const metrics = await AnalyticsService.calculateClientMetrics(
        plannerId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: {
          metrics,
          generatedAt: new Date(),
          dateRange,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tasks report
   * GET /api/v1/planner/reports/tasks
   */
  async getTasksReport(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { startDate, endDate } = req.query;

      // Check subscription tier
      await checkAnalyticsAccess(plannerId);

      logger.info("Generating tasks report", { plannerId });

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      const metrics = await AnalyticsService.calculateTaskMetrics(
        plannerId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: {
          metrics,
          generatedAt: new Date(),
          dateRange,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export report
   * POST /api/v1/planner/reports/export
   */
  async exportReport(req, res, next) {
    try {
      const plannerId = req.user.id;
      const { reportType, format = "pdf", startDate, endDate } = req.body;

      // Check subscription tier
      await checkAnalyticsAccess(plannerId);

      if (!reportType) {
        throw new AppError("Report type is required", 400);
      }

      if (!["pdf", "excel", "csv"].includes(format)) {
        throw new AppError("Invalid format. Use pdf, excel, or csv", 400);
      }

      logger.info("Exporting report", { plannerId, reportType, format });

      const dateRange = {};
      if (startDate) dateRange.startDate = startDate;
      if (endDate) dateRange.endDate = endDate;

      // Get report data based on type
      let data;
      switch (reportType) {
        case "dashboard":
          data = await AnalyticsService.generateDashboardSummary(
            plannerId,
            dateRange
          );
          break;
        case "events":
          data = await AnalyticsService.calculateEventMetrics(
            plannerId,
            dateRange
          );
          break;
        case "financial":
          data = await AnalyticsService.calculateFinancialMetrics(
            plannerId,
            dateRange
          );
          break;
        case "vendors":
          data = await AnalyticsService.calculateVendorMetrics(
            plannerId,
            dateRange
          );
          break;
        case "clients":
          data = await AnalyticsService.calculateClientMetrics(
            plannerId,
            dateRange
          );
          break;
        case "tasks":
          data = await AnalyticsService.calculateTaskMetrics(
            plannerId,
            dateRange
          );
          break;
        default:
          throw new AppError("Invalid report type", 400);
      }

      // TODO: Implement actual PDF/Excel generation
      // For now, return JSON data with export info
      res.status(200).json({
        success: true,
        message: `Report export in ${format} format coming soon`,
        data: {
          reportType,
          format,
          dateRange,
          data,
          exportUrl: `/exports/${reportType}-${Date.now()}.${format}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PlannerReportsController();
