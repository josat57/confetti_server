import ReportTemplate from "../models/reportTemplate.model.js";
import ScheduledReport from "../models/scheduledReport.model.js";
import GeneratedReport from "../models/generatedReport.model.js";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import Payment from "../models/payment.model.js";
import Event from "../models/event.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import AuditLog from "../models/auditLog.model.js";
import mongoose from "mongoose";
import { createError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
import {
  renderReport,
  reportFileName,
  formatDateRange,
  REPORT_FORMATS,
} from "../utils/report-renderer.js";

const CUSTOM_SECTION_TYPES = [
  "user_analytics",
  "financial",
  "vendor_performance",
  "event_analytics",
  "support_metrics",
];

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isValidTimeZone = (tz) => {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const daysInMonth = (year, monthIndex) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/** Calendar parts of `date` as seen in `tz` (month is 0-based, weekday 0=Sunday). */
const zonedParts = (date, tz) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month) - 1,
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
  };
};

const tzOffsetMs = (date, tz) => {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
};

/** UTC instant of a wall-clock time in `tz` (day may overflow; Date.UTC normalises it). */
const zonedTimeToUtc = (year, month, day, hour, minute, tz) => {
  const guess = Date.UTC(year, month, day, hour, minute, 0);
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  // Second pass corrects for DST transitions between guess and result
  ts = guess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
};

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
    if (report.isActive) {
      // Don't fire immediately for runs missed while paused
      report.nextRun = this.calculateNextRun(report.schedule);
    }
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

    if (!templateId) {
      throw createError(400, "templateId is required");
    }
    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      throw createError("Report template not found", 404);
    }
    if (format && !REPORT_FORMATS.includes(format)) {
      throw createError(400, `format must be one of: ${REPORT_FORMATS.join(", ")}`);
    }
    const normalizedRange = this.normalizeDateRange(dateRange);

    // Create generated report record
    const generatedReport = await GeneratedReport.create({
      name: name || template.name,
      template: templateId,
      reportType: template.reportType,
      dateRange: normalizedRange,
      format: format || template.format,
      status: "pending",
      generatedBy: adminId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Generate report asynchronously (errors are recorded on the report)
    this.processReportGeneration(generatedReport._id, template, normalizedRange).catch(() => {});

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

  /**
   * Accepts { startDate, endDate } with either bound optional. Throws on
   * unparseable dates or an inverted range. Returns undefined when empty.
   */
  normalizeDateRange(dateRange) {
    if (!dateRange || (!dateRange.startDate && !dateRange.endDate)) return undefined;
    const out = {};
    for (const key of ["startDate", "endDate"]) {
      if (dateRange[key]) {
        const d = new Date(dateRange[key]);
        if (isNaN(d)) throw createError(400, `Invalid dateRange.${key}`);
        out[key] = d;
      }
    }
    if (out.startDate && out.endDate && out.startDate > out.endDate) {
      throw createError(400, "dateRange.startDate must be before dateRange.endDate");
    }
    return out;
  }

  /** Mongo filter for a date field, using only the bounds that are present. */
  buildDateQuery(field, dateRange) {
    const range = {};
    if (dateRange?.startDate) range.$gte = new Date(dateRange.startDate);
    if (dateRange?.endDate) range.$lte = new Date(dateRange.endDate);
    return Object.keys(range).length ? { [field]: range } : {};
  }

  async buildReportData(reportType, dateRange, template) {
    const filters = template?.filters;
    switch (reportType) {
      case "user_analytics":
        return this.generateUserAnalyticsReport(dateRange, filters);
      case "financial":
        return this.generateFinancialReport(dateRange, filters);
      case "vendor_performance":
        return this.generateVendorPerformanceReport(dateRange, filters);
      case "event_analytics":
        return this.generateEventAnalyticsReport(dateRange, filters);
      case "support_metrics":
        return this.generateSupportMetricsReport(dateRange, filters);
      case "custom":
        return this.generateCustomReport(dateRange, template);
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * Custom reports combine sections of the built-in reports. Each template
   * metric selects a section by `type` (one of the built-in report types) and
   * optionally a single value from it by `name` (e.g. { type: "financial",
   * name: "totalRevenue", label: "Revenue" }).
   */
  async generateCustomReport(dateRange, template) {
    const metrics = template?.metrics || [];
    if (!metrics.length) {
      throw new Error("Custom report template has no metrics configured");
    }
    const sections = {};
    const cache = {};
    for (const metric of metrics) {
      const type = metric.type;
      if (!CUSTOM_SECTION_TYPES.includes(type)) {
        throw new Error(
          `Invalid metric type "${type}" (expected one of: ${CUSTOM_SECTION_TYPES.join(", ")})`
        );
      }
      cache[type] ??= await this.buildReportData(type, dateRange, template);
      const sectionData = cache[type];
      if (metric.name) {
        if (!(metric.name in sectionData)) {
          throw new Error(`Metric "${metric.name}" is not available in ${type} reports`);
        }
        sections[metric.label || metric.name] = sectionData[metric.name];
      } else {
        sections[metric.label || type] = sectionData;
      }
    }
    return sections;
  }

  generatedReportFileUrl(reportId) {
    return `/api/v1/admin/generated-reports/${reportId}/file`;
  }

  async renderGeneratedReport(report) {
    return renderReport({
      title: report.name,
      format: report.format,
      data: report.data,
      meta: {
        "Report type": report.reportType,
        "Date range": formatDateRange(report.dateRange) || "All time",
        "Generated at": report.generatedAt,
      },
    });
  }

  async processReportGeneration(reportId, template, dateRange) {
    try {
      const report = await GeneratedReport.findById(reportId);
      if (!report) return null;

      report.status = "generating";
      await report.save();

      const data = await this.buildReportData(template.reportType, dateRange, template);

      report.data = data;
      report.summary = this.generateSummary(data);
      report.status = "completed";
      report.generatedAt = new Date();
      report.error = undefined;

      const file = await this.renderGeneratedReport(report);
      report.fileUrl = this.generatedReportFileUrl(reportId);
      report.fileSize = file.buffer.length;

      await report.save();
      return { report, file };
    } catch (error) {
      await GeneratedReport.findByIdAndUpdate(reportId, {
        status: "failed",
        error: error.message,
      }).catch(() => {});
      throw error;
    }
  }

  async getGeneratedReportFile(reportId) {
    const report = await GeneratedReport.findById(reportId);
    if (!report) {
      throw createError("Generated report not found", 404);
    }
    if (report.status !== "completed") {
      throw createError("Report is not ready for download", 400);
    }
    const file = await this.renderGeneratedReport(report);
    return { report, file };
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

  /**
   * Next occurrence strictly after `from`, honouring schedule.time ("HH:MM"),
   * dayOfWeek (weekly), dayOfMonth (monthly/quarterly/yearly) and timezone.
   */
  calculateNextRun(schedule, from = new Date()) {
    const tz = isValidTimeZone(schedule?.timezone) ? schedule.timezone : "UTC";
    const [hh, mm] = String(schedule?.time || "09:00")
      .split(":")
      .map((n) => parseInt(n, 10));
    const hours = Number.isInteger(hh) && hh >= 0 && hh < 24 ? hh : 9;
    const minutes = Number.isInteger(mm) && mm >= 0 && mm < 60 ? mm : 0;

    const now = zonedParts(from, tz);
    const at = (y, m, d) => {
      const dim = daysInMonth(y, m);
      return zonedTimeToUtc(y, m, Math.min(d, dim), hours, minutes, tz);
    };

    switch (schedule?.frequency) {
      case "weekly": {
        const target = Number.isInteger(schedule.dayOfWeek) ? schedule.dayOfWeek : now.weekday;
        let ahead = (target - now.weekday + 7) % 7;
        let c = zonedTimeToUtc(now.year, now.month, now.day + ahead, hours, minutes, tz);
        if (c <= from) c = zonedTimeToUtc(now.year, now.month, now.day + ahead + 7, hours, minutes, tz);
        return c;
      }
      case "monthly":
      case "quarterly":
      case "yearly": {
        const step = { monthly: 1, quarterly: 3, yearly: 12 }[schedule.frequency];
        const day = schedule.dayOfMonth || now.day;
        let c = at(now.year, now.month, day);
        for (let i = 1; c <= from; i++) {
          const total = now.month + step * i;
          c = at(now.year + Math.floor(total / 12), total % 12, day);
        }
        return c;
      }
      case "daily":
      default: {
        let c = zonedTimeToUtc(now.year, now.month, now.day, hours, minutes, tz);
        if (c <= from) c = zonedTimeToUtc(now.year, now.month, now.day + 1, hours, minutes, tz);
        return c;
      }
    }
  }

  /** Reporting period covered by a scheduled run ending at `end`. */
  scheduledPeriod(frequency, end = new Date()) {
    const start = new Date(end);
    switch (frequency) {
      case "weekly":
        start.setUTCDate(start.getUTCDate() - 7);
        break;
      case "monthly":
        start.setUTCMonth(start.getUTCMonth() - 1);
        break;
      case "quarterly":
        start.setUTCMonth(start.getUTCMonth() - 3);
        break;
      case "yearly":
        start.setUTCFullYear(start.getUTCFullYear() - 1);
        break;
      default:
        start.setUTCDate(start.getUTCDate() - 1);
    }
    return { startDate: start, endDate: end };
  }

  /**
   * Execute one scheduled report: generate it for the period since the last
   * run and email the file to the recipients.
   */
  async runScheduledReport(scheduled) {
    const now = new Date();
    try {
      const template = await ReportTemplate.findById(scheduled.template);
      if (!template) throw new Error("Report template no longer exists");

      const dateRange = this.scheduledPeriod(scheduled.schedule?.frequency, now);
      const generated = await GeneratedReport.create({
        name: `${scheduled.name} (${now.toISOString().slice(0, 10)})`,
        template: template._id,
        scheduledReport: scheduled._id,
        reportType: template.reportType,
        dateRange,
        format: template.format,
        status: "pending",
        generatedBy: scheduled.createdBy,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const { report, file } = await this.processReportGeneration(generated._id, template, dateRange);
      template.usageCount += 1;
      template.lastUsedAt = now;
      await template.save();

      const recipientEmails = new Set(
        (scheduled.emailRecipients || []).map((e) => String(e).trim()).filter(Boolean)
      );
      if (scheduled.recipients?.length) {
        const users = await User.find({ _id: { $in: scheduled.recipients } }).select("email").lean();
        users.forEach((u) => u.email && recipientEmails.add(u.email));
      }

      let emailError;
      if (recipientEmails.size) {
        try {
          const { sendEmailDirect } = await import("../utils/email.js");
          await sendEmailDirect({
            to: [...recipientEmails].join(", "),
            subject: `Scheduled report: ${report.name}`,
            text: `Your scheduled report "${scheduled.name}" covering ${formatDateRange(dateRange)} is attached.`,
            html: `<p>Your scheduled report <strong>${escapeHtml(scheduled.name)}</strong> covering ${escapeHtml(
              formatDateRange(dateRange)
            )} is attached.</p>`,
            attachments: [
              {
                filename: reportFileName(report.name, file.extension),
                content: file.buffer,
                contentType: file.contentType,
              },
            ],
          });
        } catch (err) {
          emailError = `Report generated but email delivery failed: ${err.message}`;
        }
      }

      await ScheduledReport.findByIdAndUpdate(scheduled._id, {
        lastRun: now,
        $inc: { runCount: 1 },
        lastStatus: emailError ? "failed" : "success",
        lastError: emailError || null,
      });
      return { ok: !emailError, reportId: generated._id, error: emailError };
    } catch (err) {
      await ScheduledReport.findByIdAndUpdate(scheduled._id, {
        lastRun: now,
        $inc: { runCount: 1 },
        lastStatus: "failed",
        lastError: err.message,
      }).catch(() => {});
      return { ok: false, error: err.message };
    }
  }

  async processDueScheduledReports() {
    if (this._schedulerBusy || mongoose.connection.readyState !== 1) return;
    this._schedulerBusy = true;
    try {
      const due = await ScheduledReport.find({ isActive: true, nextRun: { $lte: new Date() } });
      for (const scheduled of due) {
        // Atomic claim so several server instances never run the same report twice
        const claimed = await ScheduledReport.findOneAndUpdate(
          { _id: scheduled._id, isActive: true, nextRun: scheduled.nextRun },
          { nextRun: this.calculateNextRun(scheduled.schedule) },
          { new: true }
        );
        if (claimed) await this.runScheduledReport(claimed);
      }
    } catch (err) {
      logger.error(`Scheduled report processing failed: ${err.message}`);
    } finally {
      this._schedulerBusy = false;
    }
  }

  startReportScheduler(intervalMs = 60000) {
    if (this._schedulerTimer) clearInterval(this._schedulerTimer);
    this._schedulerTimer = setInterval(() => this.processDueScheduledReports(), intervalMs);
    this._schedulerTimer.unref?.();
    setTimeout(() => this.processDueScheduledReports(), 10000).unref?.();
  }

  stopReportScheduler() {
    if (this._schedulerTimer) clearInterval(this._schedulerTimer);
    this._schedulerTimer = null;
  }

  async generateUserAnalyticsReport(dateRange, filters) {
    const query = this.buildDateQuery("createdAt", dateRange);

    const [totalUsers, byRole, byStatus, growth] = await Promise.all([
      User.countDocuments(query),
      User.aggregate([
        { $match: query },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      User.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
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
    const query = { status: "completed", ...this.buildDateQuery("createdAt", dateRange) };

    const [totals, transactions, byMethod, byType, refunds] = await Promise.all([
      Payment.aggregate([
        { $match: query },
        { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
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
        { $sort: { total: -1 } },
      ]),
      Payment.aggregate([
        { $match: query },
        { $group: { _id: "$paymentType", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Payment.aggregate([
        { $match: { status: "refunded", ...this.buildDateQuery("createdAt", dateRange) } },
        { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalRevenue: totals.reduce((sum, t) => sum + t.total, 0),
      transactions,
      revenueByCurrency: totals,
      byMethod,
      byType,
      refunds,
    };
  }

  async generateVendorPerformanceReport(dateRange, filters) {
    const query = this.buildDateQuery("createdAt", dateRange);

    const [totalVendors, byStatus, byCategory, topRated] = await Promise.all([
      Vendor.countDocuments(query),
      Vendor.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Vendor.aggregate([
        { $match: query },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Only report-safe fields (no contact / financial details)
      Vendor.find(query)
        .sort({ rating: -1, reviewCount: -1 })
        .limit(10)
        .select("businessName category rating reviewCount status")
        .lean(),
    ]);

    return { totalVendors, byStatus, byCategory, topRated };
  }

  async generateEventAnalyticsReport(dateRange, filters) {
    const query = this.buildDateQuery("startDate", dateRange);

    const [totalEvents, byType, byStatus] = await Promise.all([
      Event.countDocuments(query),
      Event.aggregate([
        { $match: query },
        { $group: { _id: "$eventType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Event.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return { totalEvents, byType, byStatus };
  }

  async generateSupportMetricsReport(dateRange, filters) {
    const query = this.buildDateQuery("createdAt", dateRange);

    const [totalTickets, byStatus, byPriority, byCategory] = await Promise.all([
      SupportTicket.countDocuments(query),
      SupportTicket.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SupportTicket.aggregate([
        { $match: query },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SupportTicket.aggregate([
        { $match: query },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return { totalTickets, byStatus, byPriority, byCategory };
  }

  generateSummary(data) {
    const highlights = [];
    for (const [key, value] of Object.entries(data || {})) {
      if (typeof value === "number") highlights.push({ metric: key, value });
    }
    return {
      generatedAt: new Date(),
      recordCount: Object.keys(data || {}).length,
      highlights,
    };
  }
}

export default new AdminAdvancedReportingService();
