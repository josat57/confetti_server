import ReportTemplate from "../models/reportTemplate.model.js";
import ScheduledReport from "../models/scheduledReport.model.js";
import GeneratedReport from "../models/generatedReport.model.js";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import Payment from "../models/payment.model.js";
import Event from "../models/event.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

class AdminAdvancedReportingService {
  // ==================== Report Templates ====================

  async getReportTemplates(filters = {}) {
    const { reportType, isPublic, createdBy } = filters;

    const query = {};
    if (reportType) query.reportType = reportType;
    if (isPublic !== undefined) query.isPublic = isPublic;
    if (createdBy) query.createdBy = createdBy;

    const templates = await ReportTemplate.find(query)
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();

    return templates;
  }

  async getReportTemplateById(templateId) {
    const template = await ReportTemplate.findById(templateId)
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .lean();

    if (!template) {
      throw createError("Report template not found", 404);
    }

    return template;
  }

  async createReportTemplate(templateData, adminId) {
    const template = await ReportTemplate.create({
      ...templateData,
      createdBy: adminId,
      lastModifiedBy: adminId,
    });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "create_report_template",
      resource: "ReportTemplate",
      resourceId: template._id,
      details: { name: template.name, reportType: template.reportType },
    });

    return template;
  }

  async updateReportTemplate(templateId, updates, adminId) {
    const template = await ReportTemplate.findById(templateId);

    if (!template) {
      throw createError("Report template not found", 404);
    }

    if (template.isSystem && !updates.allowSystemUpdate) {
      throw createError("System templates cannot be modified", 403);
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && key !== "allowSystemUpdate") {
        template[key] = updates[key];
      }
    });

    template.lastModifiedBy = adminId;
    await template.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_report_template",
      resource: "ReportTemplate",
      resourceId: templateId,
      details: { updates },
    });

    return template;
  }

  async deleteReportTemplate(templateId, adminId) {
    const template = await ReportTemplate.findById(templateId);

    if (!template) {
      throw createError("Report template not found", 404);
    }

    if (template.isSystem) {
      throw createError("System templates cannot be deleted", 403);
    }

    await ReportTemplate.findByIdAndDelete(templateId);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_report_template",
      resource: "ReportTemplate",
      resourceId: templateId,
      details: { name: template.name },
    });

    return { message: "Report template deleted successfully" };
  }

  // ==================== Scheduled Reports ====================

  async getScheduledReports(filters = {}) {
    const { isActive, createdBy } = filters;

    const query = {};
    if (isActive !== undefined) query.isActive = isActive;
    if (createdBy) query.createdBy = createdBy;

    const reports = await ScheduledReport.find(query)
      .populate("template", "name reportType")
      .populate("createdBy", "firstName lastName email")
      .populate("recipients", "firstName lastName email")
      .sort({ nextRun: 1 })
      .lean();

    return reports;
  }

  async getScheduledReportById(reportId) {
    const report = await ScheduledReport.findById(reportId)
      .populate("template")
      .populate("createdBy", "firstName lastName email")
      .populate("recipients", "firstName lastName email")
      .lean();

    if (!report) {
      throw createError("Scheduled report not found", 404);
    }

    return report;
  }

  async createScheduledReport(reportData, adminId) {
    const {
      template,
      schedule,
      recipients,
      emailRecipients,
      name,
      description,
    } = reportData;

    // Calculate next run time
    const nextRun = this.calculateNextRun(schedule);

    const scheduledReport = await ScheduledReport.create({
      name,
      description,
      template,
      schedule,
      recipients,
      emailRecipients,
      nextRun,
      createdBy: adminId,
    });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "create_scheduled_report",
      resource: "ScheduledReport",
      resourceId: scheduledReport._id,
      details: { name, frequency: schedule.frequency },
    });

    return scheduledReport;
  }

  async updateScheduledReport(reportId, updates, adminId) {
    const report = await ScheduledReport.findById(reportId);

    if (!report) {
      throw createError("Scheduled report not found", 404);
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        report[key] = updates[key];
      }
    });

    // Recalculate next run if schedule changed
    if (updates.schedule) {
      report.nextRun = this.calculateNextRun(report.schedule);
    }

    await report.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_scheduled_report",
      resource: "ScheduledReport",
      resourceId: reportId,
      details: { updates },
    });

    return report;
  }

  async deleteScheduledReport(reportId, adminId) {
    const report = await ScheduledReport.findById(reportId);

    if (!report) {
      throw createError("Scheduled report not found", 404);
    }

    await ScheduledReport.findByIdAndDelete(reportId);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_scheduled_report",
      resource: "ScheduledReport",
      resourceId: reportId,
      details: { name: report.name },
    });

    return { message: "Scheduled report deleted successfully" };
  }

  async toggleScheduledReport(reportId, adminId) {
    const report = await ScheduledReport.findById(reportId);

    if (!report) {
      throw createError("Scheduled report not found", 404);
    }

    report.isActive = !report.isActive;
    await report.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "toggle_scheduled_report",
      resource: "ScheduledReport",
      resourceId: reportId,
      details: { isActive: report.isActive },
    });

    return report;
  }

  // ==================== Generated Reports ====================

  async getGeneratedReports(filters = {}) {
    const { page = 1, limit = 20, status, generatedBy, reportType } = filters;

    const query = {};
    if (status) query.status = status;
    if (generatedBy) query.generatedBy = generatedBy;
    if (reportType) query.reportType = reportType;

    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      GeneratedReport.find(query)
        .populate("template", "name reportType")
        .populate("generatedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GeneratedReport.countDocuments(query),
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getGeneratedReportById(reportId) {
    const report = await GeneratedReport.findById(reportId)
      .populate("template")
      .populate("generatedBy", "firstName lastName email")
      .lean();

    if (!report) {
      throw createError("Generated report not found", 404);
    }

    return report;
  }

  async generateReport(reportData, adminId) {
    const { templateId, dateRange, format, name } = reportData;

    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      throw createError("Report template not found", 404);
    }

    // Create generated report record
    const generatedReport = await GeneratedReport.create({
      name: name || template.name,
      template: templateId,
      reportType: template.reportType,
      dateRange,
      format: format || template.format,
      status: "pending",
      generatedBy: adminId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Generate report asynchronously
    this.processReportGeneration(generatedReport._id, template, dateRange);

    // Update template usage
    template.usageCount += 1;
    template.lastUsedAt = new Date();
    await template.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "generate_report",
      resource: "GeneratedReport",
      resourceId: generatedReport._id,
      details: { templateName: template.name, reportType: template.reportType },
    });

    return generatedReport;
  }

  async processReportGeneration(reportId, template, dateRange) {
    try {
      const report = await GeneratedReport.findById(reportId);
      if (!report) return;

      report.status = "generating";
      await report.save();

      // Generate report data based on template type
      let data;
      switch (template.reportType) {
        case "user_analytics":
          data = await this.generateUserAnalyticsReport(
            dateRange,
            template.filters
          );
          break;
        case "financial":
          data = await this.generateFinancialReport(
            dateRange,
            template.filters
          );
          break;
        case "vendor_performance":
          data = await this.generateVendorPerformanceReport(
            dateRange,
            template.filters
          );
          break;
        case "event_analytics":
          data = await this.generateEventAnalyticsReport(
            dateRange,
            template.filters
          );
          break;
        case "support_metrics":
          data = await this.generateSupportMetricsReport(
            dateRange,
            template.filters
          );
          break;
        default:
          data = { message: "Report type not implemented" };
      }

      report.data = data;
      report.summary = this.generateSummary(data);
      report.status = "completed";
      report.generatedAt = new Date();
      report.fileUrl = `/reports/${reportId}.${report.format}`;
      report.fileSize = Math.floor(Math.random() * 5000000); // Mock file size

      await report.save();
    } catch (error) {
      const report = await GeneratedReport.findById(reportId);
      if (report) {
        report.status = "failed";
        report.error = error.message;
        await report.save();
      }
    }
  }

  async deleteGeneratedReport(reportId, adminId) {
    const report = await GeneratedReport.findById(reportId);

    if (!report) {
      throw createError("Generated report not found", 404);
    }

    await GeneratedReport.findByIdAndDelete(reportId);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_generated_report",
      resource: "GeneratedReport",
      resourceId: reportId,
    });

    return { message: "Generated report deleted successfully" };
  }

  async downloadReport(reportId, adminId) {
    const report = await GeneratedReport.findById(reportId);

    if (!report) {
      throw createError("Generated report not found", 404);
    }

    if (report.status !== "completed") {
      throw createError("Report is not ready for download", 400);
    }

    // Update download stats
    report.downloadCount += 1;
    report.lastDownloadedAt = new Date();
    await report.save();

    return {
      fileUrl: report.fileUrl,
      fileName: `${report.name}.${report.format}`,
      fileSize: report.fileSize,
      format: report.format,
    };
  }

  // ==================== Helper Methods ====================

  calculateNextRun(schedule) {
    const now = new Date();
    const nextRun = new Date(now);

    switch (schedule.frequency) {
      case "daily":
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case "weekly":
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case "monthly":
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      case "quarterly":
        nextRun.setMonth(nextRun.getMonth() + 3);
        break;
      case "yearly":
        nextRun.setFullYear(nextRun.getFullYear() + 1);
        break;
    }

    // Set time
    if (schedule.time) {
      const [hours, minutes] = schedule.time.split(":");
      nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    return nextRun;
  }

  async generateUserAnalyticsReport(dateRange, filters) {
    const query = {};
    if (dateRange) {
      query.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate),
      };
    }

    const [totalUsers, byRole, byStatus, growth] = await Promise.all([
      User.countDocuments(query),
      User.aggregate([
        { $match: query },
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return { totalUsers, byRole, byStatus, growth };
  }

  async generateFinancialReport(dateRange, filters) {
    const query = { status: "completed" };
    if (dateRange) {
      query.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate),
      };
    }

    const [totalRevenue, transactions, byMethod] = await Promise.all([
      Payment.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments(query),
      Payment.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$paymentMethod",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      totalRevenue: totalRevenue[0]?.total || 0,
      transactions,
      byMethod,
    };
  }

  async generateVendorPerformanceReport(dateRange, filters) {
    const query = {};
    if (dateRange) {
      query.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate),
      };
    }

    const [totalVendors, byStatus, byCategory, topRated] = await Promise.all([
      Vendor.countDocuments(query),
      Vendor.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Vendor.aggregate([
        { $match: query },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      Vendor.find(query).sort({ rating: -1 }).limit(10).lean(),
    ]);

    return { totalVendors, byStatus, byCategory, topRated };
  }

  async generateEventAnalyticsReport(dateRange, filters) {
    const query = {};
    if (dateRange) {
      query.date = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate),
      };
    }

    const [totalEvents, byType, byStatus] = await Promise.all([
      Event.countDocuments(query),
      Event.aggregate([
        { $match: query },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
      ]),
      Event.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    return { totalEvents, byType, byStatus };
  }

  async generateSupportMetricsReport(dateRange, filters) {
    const query = {};
    if (dateRange) {
      query.createdAt = {
        $gte: new Date(dateRange.startDate),
        $lte: new Date(dateRange.endDate),
      };
    }

    const [totalTickets, byStatus, byPriority, byCategory] = await Promise.all([
      SupportTicket.countDocuments(query),
      SupportTicket.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: query },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      SupportTicket.aggregate([
        { $match: query },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    return { totalTickets, byStatus, byPriority, byCategory };
  }

  generateSummary(data) {
    return {
      generatedAt: new Date(),
      recordCount: Object.keys(data).length,
      highlights: [],
    };
  }
}

export default new AdminAdvancedReportingService();
