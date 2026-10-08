import AnalyticsService from "../services/analytics.service.js";
import { getActivePlan } from "../services/plan-access.service.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Check if user has access to analytics (Studio plan and above)
 */
const checkAnalyticsAccess = async (plannerId) => {
  // Reports are included from the Studio plan up
  const { plan, subscription } = await getActivePlan({ _id: plannerId, role: "event-planner" });
  if (!plan || plan.level < 2) {
    throw new AppError(
      "Analytics and reports are available on the Studio plan and above. Please upgrade your subscription.",
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

      const fileName = `${reportType}-report-${Date.now()}`;

      if (format === "json") {
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}.json"`);
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json({ reportType, dateRange, data });
      }

      if (format === "csv") {
        const { Parser } = await import("json2csv");
        const rows = Array.isArray(data) ? data : [data];
        const parser = new Parser();
        const csv = parser.parse(rows);
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}.csv"`);
        res.setHeader("Content-Type", "text/csv");
        return res.status(200).send(csv);
      }

      if (format === "excel") {
        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(reportType);
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length > 0) {
          worksheet.columns = Object.keys(rows[0]).map((key) => ({
            header: key,
            key,
            width: 20,
          }));
          rows.forEach((row) => worksheet.addRow(row));
        }
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}.xlsx"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        await workbook.xlsx.write(res);
        return res.end();
      }

      if (format === "pdf") {
        const PDFDocument = (await import("pdfkit")).default;
        const doc = new PDFDocument({ margin: 40 });
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}.pdf"`);
        res.setHeader("Content-Type", "application/pdf");
        doc.pipe(res);

        doc.fontSize(18).text(`${reportType.toUpperCase()} REPORT`, { align: "center" });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
        doc.moveDown(2);

        const rows = Array.isArray(data) ? data : [data];
        rows.forEach((row, i) => {
          if (i > 0) doc.moveDown();
          Object.entries(row).forEach(([key, value]) => {
            doc.fontSize(10).text(`${key}: ${value ?? ""}`, { continued: false });
          });
        });

        doc.end();
        return;
      }

      // Fallback for unsupported formats
      res.status(400).json({ success: false, message: `Unsupported format: ${format}` });
    } catch (error) {
      next(error);
    }
  }
}

export default new PlannerReportsController();
