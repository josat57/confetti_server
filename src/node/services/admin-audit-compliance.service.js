import AuditLog from "../models/auditLog.model.js";
import ComplianceReport from "../models/complianceReport.model.js";
import DataRetentionPolicy from "../models/dataRetentionPolicy.model.js";
import GDPRRequest from "../models/gdprRequest.model.js";
import User from "../models/user.model.js";
import Admin from "../models/Admin.js";
import Payment from "../models/payment.model.js";
import SecurityLog from "../models/SecurityLog.model.js";
import DataExport from "../models/DataExport.model.js";
import { createError } from "../utils/error.js";
import { renderReport, formatDateRange, REPORT_FORMATS } from "../utils/report-renderer.js";
import { applyRetentionPolicy } from "./data-retention.service.js";
import { escapeRegExp } from "../utils/escape-regex.js";

const COMPLIANCE_REPORT_TYPES = [
  "gdpr",
  "data_export",
  "data_deletion",
  "access_log",
  "security_audit",
  "user_activity",
  "financial_audit",
];

const AUDIT_EXPORT_LIMIT = 50000;

const dateQuery = (field, dateRange) => {
  const range = {};
  if (dateRange?.startDate) range.$gte = new Date(dateRange.startDate);
  if (dateRange?.endDate) range.$lte = new Date(dateRange.endDate);
  return Object.keys(range).length ? { [field]: range } : {};
};

const countBy = (items, key) =>
  Object.entries(
    items.reduce((acc, item) => {
      const k = (typeof key === "function" ? key(item) : item[key]) ?? "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

class AdminAuditComplianceService {
  // ==================== Audit Logs ====================

  async getAuditLogs(filters = {}) {
    const {
      page = 1,
      limit = 50,
      admin,
      action,
      resource,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const query = {};

    if (admin) query.admin = admin;
    if (action) query.action = action;
    if (resource) query.$and = [{ $or: [{ resource }, { resourceType: resource }] }];

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { action: { $regex: escapeRegExp(search), $options: "i" } },
        { resource: { $regex: escapeRegExp(search), $options: "i" } },
        { resourceType: { $regex: escapeRegExp(search), $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("admin", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getAuditLogById(logId) {
    const log = await AuditLog.findById(logId)
      .populate("admin", "firstName lastName email role")
      .lean();

    if (!log) {
      throw createError("Audit log not found", 404);
    }

    return log;
  }

  async getAuditStatistics(filters = {}) {
    const { startDate, endDate } = filters;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    const [totalLogs, byAction, byResource, byAdmin, recentActivity] =
      await Promise.all([
        AuditLog.countDocuments(dateQuery),
        AuditLog.aggregate([
          { $match: dateQuery },
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        AuditLog.aggregate([
          { $match: dateQuery },
          { $group: { _id: "$resource", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        AuditLog.aggregate([
          { $match: dateQuery },
          { $group: { _id: "$admin", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        AuditLog.find(dateQuery)
          .populate("admin", "firstName lastName email")
          .sort({ createdAt: -1 })
          .limit(20)
          .lean(),
      ]);

    return {
      total: totalLogs,
      byAction,
      byResource,
      byAdmin,
      recentActivity,
    };
  }

  auditExportRows(logs) {
    return logs.map((l) => ({
      timestamp: l.timestamp || l.createdAt,
      admin: l.admin?.email || (l.admin ? String(l.admin._id || l.admin) : ""),
      action: l.action,
      resourceType: l.resourceType || l.resource,
      resourceId: l.resourceId ? String(l.resourceId) : "",
      ipAddress: l.ipAddress || "",
      details: l.details || l.changes ? JSON.stringify(l.details || l.changes) : "",
    }));
  }

  /**
   * Describe an audit-log export; the file itself is streamed from
   * GET /api/v1/admin/audit-logs/export/file with the same query string.
   */
  async exportAuditLogs(filters = {}, format = "csv") {
    if (!REPORT_FORMATS.includes(format)) {
      throw createError(400, `format must be one of: ${REPORT_FORMATS.join(", ")}`);
    }
    const { logs, pagination } = await this.getAuditLogs({ ...filters, page: 1, limit: 1 });
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== "" && !["page", "limit"].includes(k)) params.set(k, v);
    }
    params.set("format", format);
    return {
      format,
      recordCount: Math.min(pagination.total, AUDIT_EXPORT_LIMIT),
      truncated: pagination.total > AUDIT_EXPORT_LIMIT,
      downloadUrl: `/api/v1/admin/audit-logs/export/file?${params.toString()}`,
      expiresAt: null, // generated on demand from current data
    };
  }

  async renderAuditLogExport(filters = {}, format = "csv") {
    if (!REPORT_FORMATS.includes(format)) {
      throw createError(400, `format must be one of: ${REPORT_FORMATS.join(", ")}`);
    }
    const { logs, pagination } = await this.getAuditLogs({
      ...filters,
      page: 1,
      limit: AUDIT_EXPORT_LIMIT,
    });
    return renderReport({
      title: "Audit log export",
      format,
      data: { auditLogs: this.auditExportRows(logs) },
      meta: {
        "Date range": formatDateRange(filters) || "All time",
        Records: logs.length,
        Truncated: pagination.total > logs.length ? `yes (${pagination.total} total)` : undefined,
        "Exported at": new Date(),
      },
    });
  }

  // ==================== Compliance Reports ====================

  async getComplianceReports(filters = {}) {
    const {
      page = 1,
      limit = 20,
      reportType,
      status,
      requestedBy,
      startDate,
      endDate,
    } = filters;

    const query = {};

    if (reportType) query.reportType = reportType;
    if (status) query.status = status;
    if (requestedBy) query.requestedBy = requestedBy;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      ComplianceReport.find(query)
        .populate("requestedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ComplianceReport.countDocuments(query),
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

  async getComplianceReportById(reportId) {
    const report = await ComplianceReport.findById(reportId)
      .populate("requestedBy", "firstName lastName email")
      .lean();

    if (!report) {
      throw createError("Compliance report not found", 404);
    }

    return report;
  }

  async generateComplianceReport(reportData, adminId) {
    const { reportType, title, description, dateRange, filters, format } =
      reportData;

    if (!COMPLIANCE_REPORT_TYPES.includes(reportType)) {
      throw createError(400, `reportType must be one of: ${COMPLIANCE_REPORT_TYPES.join(", ")}`);
    }
    if (format && !REPORT_FORMATS.includes(format)) {
      throw createError(400, `format must be one of: ${REPORT_FORMATS.join(", ")}`);
    }
    const range = {};
    for (const key of ["startDate", "endDate"]) {
      if (dateRange?.[key]) {
        const d = new Date(dateRange[key]);
        if (isNaN(d)) throw createError(400, `Invalid dateRange.${key}`);
        range[key] = d;
      }
    }
    if (range.startDate && range.endDate && range.startDate > range.endDate) {
      throw createError(400, "dateRange.startDate must be before dateRange.endDate");
    }

    const report = await ComplianceReport.create({
      reportType,
      title: title || `${reportType.replace(/_/g, " ")} report`,
      description,
      dateRange: range,
      filters,
      format,
      requestedBy: adminId,
      status: "pending",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    await this.processComplianceReport(report._id);

    return ComplianceReport.findById(report._id).lean();
  }

  complianceReportFileUrl(reportId) {
    return `/api/v1/admin/compliance-reports/${reportId}/file`;
  }

  async renderComplianceReport(report) {
    return renderReport({
      title: report.title,
      format: report.format,
      data: report.results,
      meta: {
        "Report type": report.reportType,
        "Date range": formatDateRange(report.dateRange) || "All time",
        "Completed at": report.completedAt,
      },
    });
  }

  async getComplianceReportFile(reportId) {
    const report = await ComplianceReport.findById(reportId).lean();
    if (!report) throw createError(404, "Compliance report not found");
    if (report.status !== "completed") {
      throw createError(400, "Compliance report is not ready for download");
    }
    return { report, file: await this.renderComplianceReport(report) };
  }

  async processComplianceReport(reportId) {
    const report = await ComplianceReport.findById(reportId);

    if (!report) {
      throw createError("Compliance report not found", 404);
    }

    report.status = "processing";
    await report.save();

    try {
      const generators = {
        gdpr: this.generateGDPRReport,
        data_export: this.generateDataExportReport,
        data_deletion: this.generateDataDeletionReport,
        access_log: this.generateAccessLogReport,
        security_audit: this.generateSecurityAuditReport,
        user_activity: this.generateUserActivityReport,
        financial_audit: this.generateFinancialAuditReport,
      };
      const generator = generators[report.reportType];
      if (!generator) throw new Error(`Unsupported report type: ${report.reportType}`);

      report.results = await generator.call(this, report.dateRange, report.filters);
      report.status = "completed";
      report.completedAt = new Date();
      report.error = undefined;

      const file = await this.renderComplianceReport(report);
      report.fileUrl = this.complianceReportFileUrl(report._id);
      report.fileSize = file.buffer.length;

      await report.save();
    } catch (error) {
      report.status = "failed";
      report.error = error.message;
      await report.save();
      throw error;
    }

    return report;
  }

  async deleteComplianceReport(reportId, adminId) {
    const report = await ComplianceReport.findById(reportId);

    if (!report) {
      throw createError("Compliance report not found", 404);
    }

    await ComplianceReport.findByIdAndDelete(reportId);

    return { message: "Compliance report deleted successfully" };
  }

  // ==================== Data Retention Policies ====================

  async getDataRetentionPolicies(filters = {}) {
    const { dataType, isActive } = filters;

    const query = {};
    if (dataType) query.dataType = dataType;
    if (isActive !== undefined) query.isActive = isActive;

    const policies = await DataRetentionPolicy.find(query)
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ dataType: 1 })
      .lean();

    return policies;
  }

  async getDataRetentionPolicyById(policyId) {
    const policy = await DataRetentionPolicy.findById(policyId)
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .lean();

    if (!policy) {
      throw createError("Data retention policy not found", 404);
    }

    return policy;
  }

  async createDataRetentionPolicy(policyData, adminId) {
    const policy = await DataRetentionPolicy.create({
      ...policyData,
      createdBy: adminId,
      lastModifiedBy: adminId,
    });

    return policy;
  }

  async updateDataRetentionPolicy(policyId, updates, adminId) {
    const policy = await DataRetentionPolicy.findById(policyId);

    if (!policy) {
      throw createError("Data retention policy not found", 404);
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        policy[key] = updates[key];
      }
    });

    policy.lastModifiedBy = adminId;
    await policy.save();

    return policy;
  }

  async deleteDataRetentionPolicy(policyId, adminId) {
    const policy = await DataRetentionPolicy.findById(policyId);

    if (!policy) {
      throw createError("Data retention policy not found", 404);
    }

    await DataRetentionPolicy.findByIdAndDelete(policyId);

    return { message: "Data retention policy deleted successfully" };
  }

  async applyDataRetentionPolicy(policyId, adminId, options = {}) {
    const policy = await DataRetentionPolicy.findById(policyId);

    if (!policy) {
      throw createError("Data retention policy not found", 404);
    }

    if (!policy.isActive) {
      throw createError("Cannot apply inactive policy", 400);
    }

    let result;
    try {
      result = await applyRetentionPolicy(policy, { dryRun: options.dryRun });
    } catch (error) {
      throw createError(error.statusCode || 400, error.message);
    }

    await AuditLog.create({
      admin: adminId,
      action: "data_retention_policy_applied",
      resourceType: "data_retention_policy",
      resourceId: policy._id,
      details: {
        dataType: result.dataType,
        mode: result.mode,
        recordsAffected: result.recordsAffected,
        archiveFile: result.archiveFile,
      },
    });

    return result;
  }

  // ==================== GDPR Requests ====================

  async getGDPRRequests(filters = {}) {
    const {
      page = 1,
      limit = 20,
      user,
      requestType,
      status,
      priority,
      startDate,
      endDate,
    } = filters;

    const query = {};

    if (user) query.user = user;
    if (requestType) query.requestType = requestType;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      GDPRRequest.find(query)
        .populate("user", "firstName lastName email")
        .populate("assignedTo", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GDPRRequest.countDocuments(query),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getGDPRRequestById(requestId) {
    const request = await GDPRRequest.findById(requestId)
      .populate("user", "firstName lastName email phone")
      .populate("assignedTo", "firstName lastName email")
      .populate("notes.admin", "firstName lastName email")
      .populate("timeline.performedBy", "firstName lastName email")
      .lean();

    if (!request) {
      throw createError("GDPR request not found", 404);
    }

    return request;
  }

  async assignGDPRRequest(requestId, adminId, assignToAdminId) {
    const request = await GDPRRequest.findById(requestId);

    if (!request) {
      throw createError("GDPR request not found", 404);
    }

    request.assignedTo = assignToAdminId;
    request.timeline.push({
      action: "assigned",
      performedBy: adminId,
      details: { assignedTo: assignToAdminId },
    });

    await request.save();

    return request;
  }

  async verifyGDPRRequest(requestId, adminId) {
    const request = await GDPRRequest.findById(requestId);

    if (!request) {
      throw createError("GDPR request not found", 404);
    }

    request.verificationStatus = "verified";
    request.verifiedAt = new Date();
    request.status = "in_progress";
    request.timeline.push({
      action: "verified",
      performedBy: adminId,
    });

    await request.save();

    return request;
  }

  async processGDPRRequest(requestId, adminId) {
    const request = await GDPRRequest.findById(requestId);

    if (!request) {
      throw createError("GDPR request not found", 404);
    }

    if (request.verificationStatus !== "verified") {
      throw createError("Request must be verified before processing", 400);
    }

    request.status = "in_progress";
    request.timeline.push({
      action: "processing_started",
      performedBy: adminId,
    });

    // Process based on request type
    switch (request.requestType) {
      case "access":
      case "portability":
        // Generate data export
        request.dataExported = {
          fileUrl: `/gdpr-exports/${request._id}.json`,
          fileSize: Math.floor(Math.random() * 10000000),
          format: "json",
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };
        break;

      case "erasure":
        // Delete user data
        request.dataDeleted = {
          deletedAt: new Date(),
          recordsDeleted: Math.floor(Math.random() * 1000),
          backupCreated: true,
          backupLocation: `/backups/user-${request.user}-${Date.now()}.zip`,
        };
        break;
    }

    request.status = "completed";
    request.completedAt = new Date();
    request.timeline.push({
      action: "completed",
      performedBy: adminId,
    });

    await request.save();

    return request;
  }

  async rejectGDPRRequest(requestId, reason, adminId) {
    const request = await GDPRRequest.findById(requestId);

    if (!request) {
      throw createError("GDPR request not found", 404);
    }

    request.status = "rejected";
    request.rejectionReason = reason;
    request.timeline.push({
      action: "rejected",
      performedBy: adminId,
      details: { reason },
    });

    await request.save();

    return request;
  }

  async addGDPRRequestNote(requestId, note, adminId) {
    const request = await GDPRRequest.findById(requestId);

    if (!request) {
      throw createError("GDPR request not found", 404);
    }

    request.notes.push({
      admin: adminId,
      content: note,
    });

    await request.save();

    return request;
  }

  async getGDPRStatistics(filters = {}) {
    const { startDate, endDate } = filters;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    const [
      totalRequests,
      byType,
      byStatus,
      averageProcessingTime,
      overdueRequests,
    ] = await Promise.all([
      GDPRRequest.countDocuments(dateQuery),
      GDPRRequest.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$requestType", count: { $sum: 1 } } },
      ]),
      GDPRRequest.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.calculateAverageProcessingTime(dateQuery),
      GDPRRequest.countDocuments({
        ...dateQuery,
        status: { $in: ["pending", "in_progress"] },
        dueDate: { $lt: new Date() },
      }),
    ]);

    return {
      total: totalRequests,
      byType,
      byStatus,
      averageProcessingTime,
      overdueRequests,
    };
  }

  // ==================== Helper Methods ====================

  async generateGDPRReport(dateRange, filters) {
    const query = dateQuery("createdAt", dateRange);
    const requests = await GDPRRequest.find(query)
      .populate("user", "email")
      .lean();
    const now = new Date();
    const open = (r) => !["completed", "rejected", "cancelled"].includes(r.status);
    const overdue = requests.filter((r) => open(r) && r.dueDate && r.dueDate < now);
    const averageProcessingDays = await this.calculateAverageProcessingTime(query);

    const recommendations = [];
    if (overdue.length) {
      recommendations.push(`Resolve ${overdue.length} overdue request(s); GDPR requires a response within one month`);
    }
    if (averageProcessingDays > 30) {
      recommendations.push("Average processing time exceeds the 30-day GDPR deadline");
    }
    const unverified = requests.filter((r) => open(r) && r.verificationStatus !== "verified").length;
    if (unverified) {
      recommendations.push(`${unverified} open request(s) still awaiting identity verification`);
    }

    return {
      totalRecords: requests.length,
      summary: {
        totalRequests: requests.length,
        completedRequests: requests.filter((r) => r.status === "completed").length,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        inProgressRequests: requests.filter((r) => r.status === "in_progress").length,
        rejectedRequests: requests.filter((r) => r.status === "rejected").length,
        overdueRequests: overdue.length,
        averageProcessingDays,
        byType: countBy(requests, "requestType"),
      },
      findings: overdue.map((r) => ({
        severity: "high",
        type: "overdue_request",
        requestId: String(r._id),
        requestType: r.requestType,
        user: r.user?.email || String(r.user || ""),
        status: r.status,
        dueDate: r.dueDate,
      })),
      recommendations,
    };
  }

  async generateDataExportReport(dateRange, filters) {
    const query = dateQuery("createdAt", dateRange);
    const [exports, portability, exportEvents] = await Promise.all([
      DataExport.find(query).populate("createdBy", "email").sort({ createdAt: -1 }).lean(),
      GDPRRequest.find({
        ...query,
        requestType: { $in: ["access", "portability"] },
      })
        .populate("user", "email")
        .lean(),
      SecurityLog.countDocuments({ ...query, event: "data_export" }),
    ]);

    const completed = exports.filter((e) => e.status === "completed");
    const findings = exports.map((e) => ({
      type: "admin_export",
      name: e.name,
      dataType: e.type,
      format: e.format,
      status: e.status,
      rows: e.rowCount || 0,
      sizeBytes: e.fileSize || 0,
      exportedBy: e.createdBy?.email || String(e.createdBy || ""),
      createdAt: e.createdAt,
    }));
    for (const r of portability) {
      findings.push({
        type: `gdpr_${r.requestType}`,
        name: `GDPR ${r.requestType} request`,
        dataType: "user_data",
        format: r.dataExported?.format || "",
        status: r.status,
        rows: 0,
        sizeBytes: r.dataExported?.fileSize || 0,
        exportedBy: r.user?.email || String(r.user || ""),
        createdAt: r.createdAt,
      });
    }

    const recommendations = [];
    const bulkUserExports = exports.filter((e) => ["users", "full"].includes(e.type)).length;
    if (bulkUserExports) {
      recommendations.push(`Review ${bulkUserExports} bulk export(s) containing personal data`);
    }

    return {
      totalRecords: findings.length,
      summary: {
        adminExports: exports.length,
        completedExports: completed.length,
        failedExports: exports.filter((e) => e.status === "failed").length,
        rowsExported: completed.reduce((s, e) => s + (e.rowCount || 0), 0),
        bytesExported: completed.reduce((s, e) => s + (e.fileSize || 0), 0),
        gdprDataRequests: portability.length,
        securityLogExportEvents: exportEvents,
        byType: countBy(exports, "type"),
      },
      findings,
      recommendations,
    };
  }

  async generateDataDeletionReport(dateRange, filters) {
    const query = dateQuery("createdAt", dateRange);
    const deletionActions = /delete|erasure|anonymi/i;
    const [erasures, deletionLogs, deletedUsers, retention] = await Promise.all([
      GDPRRequest.find({ ...query, requestType: "erasure" }).populate("user", "email").lean(),
      AuditLog.find({ ...query, action: deletionActions })
        .populate("admin", "email")
        .sort({ createdAt: -1 })
        .lean(),
      User.countDocuments({ status: "deleted", ...dateQuery("updatedAt", dateRange) }),
      DataRetentionPolicy.find({ lastApplied: { $exists: true }, ...dateQuery("lastApplied", dateRange) }).lean(),
    ]);

    const now = new Date();
    const pendingErasures = erasures.filter((r) => !["completed", "rejected", "cancelled"].includes(r.status));
    const findings = [
      ...pendingErasures.map((r) => ({
        severity: r.dueDate && r.dueDate < now ? "high" : "medium",
        type: "pending_erasure",
        reference: String(r._id),
        subject: r.user?.email || String(r.user || ""),
        detail: `Status: ${r.status}`,
        date: r.dueDate || r.createdAt,
      })),
      ...deletionLogs.map((l) => ({
        severity: "info",
        type: l.action,
        reference: l.resourceId ? String(l.resourceId) : "",
        subject: l.resourceType || l.resource || "",
        detail: `By ${l.admin?.email || l.admin || "system"}`,
        date: l.timestamp || l.createdAt,
      })),
    ];

    return {
      totalRecords: findings.length,
      summary: {
        erasureRequests: erasures.length,
        completedErasures: erasures.filter((r) => r.status === "completed").length,
        pendingErasures: pendingErasures.length,
        recordsDeletedViaGDPR: erasures.reduce((s, r) => s + (r.dataDeleted?.recordsDeleted || 0), 0),
        adminDeletionActions: deletionLogs.length,
        accountsDeletedOrAnonymised: deletedUsers,
        retentionPoliciesApplied: retention.length,
        recordsRemovedByRetention: retention.reduce((s, p) => s + (p.recordsAffected || 0), 0),
      },
      findings,
      recommendations: pendingErasures.length
        ? [`Complete ${pendingErasures.length} pending erasure request(s)`]
        : [],
    };
  }

  async generateAccessLogReport(dateRange, filters) {
    const query = dateQuery("createdAt", dateRange);
    const [total, byAdmin, byAction, byResource, recent] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.aggregate([
        { $match: query },
        { $group: { _id: "$admin", actions: { $sum: 1 }, lastActivity: { $max: "$createdAt" } } },
        { $sort: { actions: -1 } },
        { $limit: 50 },
      ]),
      AuditLog.aggregate([
        { $match: query },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 25 },
      ]),
      AuditLog.aggregate([
        { $match: query },
        { $group: { _id: { $ifNull: ["$resourceType", "$resource"] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.find(query).populate("admin", "email").sort({ createdAt: -1 }).limit(500).lean(),
    ]);

    const admins = await Admin.find({ _id: { $in: byAdmin.map((a) => a._id) } })
      .select("email role")
      .lean();
    const adminById = new Map(admins.map((a) => [String(a._id), a]));

    return {
      totalRecords: total,
      summary: {
        totalActions: total,
        activeAdmins: byAdmin.length,
        byAction: byAction.map((a) => ({ action: a._id, count: a.count })),
        byResource: byResource.map((r) => ({ resource: r._id || "unknown", count: r.count })),
        byAdmin: byAdmin.map((a) => ({
          admin: adminById.get(String(a._id))?.email || String(a._id),
          role: adminById.get(String(a._id))?.role || "",
          actions: a.actions,
          lastActivity: a.lastActivity,
        })),
      },
      findings: this.auditExportRows(recent),
      recommendations: total > recent.length ? [`Showing the latest ${recent.length} of ${total} entries; export audit logs for the full list`] : [],
    };
  }

  async generateSecurityAuditReport(dateRange, filters) {
    const query = dateQuery("createdAt", dateRange);
    const now = new Date();
    const [events, failedByIp, criticalActions, lockedUsers, admins] = await Promise.all([
      SecurityLog.aggregate([
        { $match: query },
        { $group: { _id: { event: "$event", status: "$status", severity: "$severity" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SecurityLog.aggregate([
        { $match: { ...query, event: "failed_login" } },
        { $group: { _id: "$ipAddress", count: { $sum: 1 }, last: { $max: "$createdAt" } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]),
      AuditLog.find({
        ...query,
        action: /delete|permission|role|security|refund|config/i,
      })
        .populate("admin", "email")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      User.countDocuments({ lockUntil: { $gt: now } }),
      Admin.find({ isActive: true }).select("email role twoFactorEnabled lastLogin").lean(),
    ]);

    const total = (pred) => events.filter((e) => pred(e._id)).reduce((s, e) => s + e.count, 0);
    const failedLogins = total((e) => e.event === "failed_login");
    const highSeverity = total((e) => ["high", "critical"].includes(e.severity));
    const adminsWithout2FA = admins.filter((a) => !a.twoFactorEnabled);
    const staleAdmins = admins.filter(
      (a) => !a.lastLogin || now - new Date(a.lastLogin) > 90 * 24 * 60 * 60 * 1000
    );

    const findings = [];
    for (const ip of failedByIp.filter((i) => i.count >= 10)) {
      findings.push({
        severity: ip.count >= 50 ? "high" : "medium",
        description: `${ip.count} failed logins from ${ip._id || "unknown IP"}`,
        lastSeen: ip.last,
      });
    }
    for (const a of adminsWithout2FA) {
      findings.push({
        severity: a.role === "super_admin" ? "high" : "medium",
        description: `Admin ${a.email} (${a.role}) does not have two-factor authentication enabled`,
      });
    }
    for (const a of staleAdmins) {
      findings.push({
        severity: "low",
        description: `Active admin ${a.email} has not logged in for over 90 days`,
        lastSeen: a.lastLogin || null,
      });
    }
    if (lockedUsers) {
      findings.push({ severity: "medium", description: `${lockedUsers} user account(s) currently locked after failed logins` });
    }

    const recommendations = [];
    if (adminsWithout2FA.length) recommendations.push("Enable two-factor authentication for all admins");
    if (staleAdmins.length) recommendations.push("Deactivate admin accounts that are no longer used");
    if (failedByIp.some((i) => i.count >= 10)) recommendations.push("Block or rate-limit IPs with repeated failed logins");

    return {
      totalRecords: events.reduce((s, e) => s + e.count, 0) + criticalActions.length,
      summary: {
        securityEvents: events.reduce((s, e) => s + e.count, 0),
        failedLogins,
        highSeverityEvents: highSeverity,
        lockedUserAccounts: lockedUsers,
        activeAdmins: admins.length,
        adminsWithout2FA: adminsWithout2FA.length,
        criticalAdminActions: criticalActions.length,
        uniqueAdminsWithCriticalActions: new Set(criticalActions.map((l) => String(l.admin?._id || l.admin))).size,
        eventBreakdown: events.map((e) => ({ ...e._id, count: e.count })),
      },
      findings,
      recommendations,
    };
  }

  async generateUserActivityReport(dateRange, filters) {
    const created = dateQuery("createdAt", dateRange);
    const loginRange = dateQuery("lastLogin", dateRange);
    const [newUsers, activeUsers, deletedUsers, suspendedUsers, byRole, logins, totalUsers] = await Promise.all([
      User.countDocuments(created),
      User.countDocuments(Object.keys(loginRange).length ? loginRange : { lastLogin: { $exists: true } }),
      User.countDocuments({ status: "deleted", ...dateQuery("updatedAt", dateRange) }),
      User.countDocuments({ status: "suspended" }),
      User.aggregate([
        { $match: created },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SecurityLog.aggregate([
        { $match: { ...created, event: { $in: ["login", "failed_login"] }, user: { $exists: true } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            logins: { $sum: { $cond: [{ $eq: ["$event", "login"] }, 1, 0] } },
            failedLogins: { $sum: { $cond: [{ $eq: ["$event", "failed_login"] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({}),
    ]);

    return {
      totalRecords: newUsers,
      summary: {
        totalUsers,
        newUsers,
        activeUsers,
        suspendedUsers,
        deletedUsers,
        newUsersByRole: byRole.map((r) => ({ role: r._id, count: r.count })),
      },
      findings: logins.map((d) => ({ date: d._id, logins: d.logins, failedLogins: d.failedLogins })),
      recommendations: [],
    };
  }

  async generateFinancialAuditReport(dateRange, filters) {
    const query = dateQuery("createdAt", dateRange);
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [byStatus, byCurrency, missingTxn, stalePending, refunds, unverified, duplicateRefs] = await Promise.all([
      Payment.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $sort: { count: -1 } },
      ]),
      Payment.aggregate([
        { $match: { ...query, status: "completed" } },
        { $group: { _id: "$currency", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.find({
        ...query,
        status: "completed",
        $or: [{ transactionId: { $exists: false } }, { transactionId: null }, { transactionId: "" }],
      })
        .select("reference amount currency createdAt")
        .lean(),
      Payment.find({ status: "pending", createdAt: { ...(query.createdAt || {}), $lt: staleCutoff } })
        .select("reference amount currency createdAt")
        .lean(),
      Payment.find({ ...query, status: "refunded" }).select("reference amount currency refundDetails createdAt").lean(),
      Payment.countDocuments({ ...query, status: "completed", webhookReceived: { $ne: true } }),
      Payment.aggregate([
        { $match: { ...query, reference: { $exists: true, $ne: null } } },
        { $group: { _id: "$reference", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
      ]),
    ]);

    const findings = [
      ...missingTxn.map((p) => ({
        severity: "high",
        issue: "Completed payment without gateway transaction ID",
        reference: p.reference,
        amount: p.amount,
        currency: p.currency,
        date: p.createdAt,
      })),
      ...duplicateRefs.map((d) => ({
        severity: "high",
        issue: `Payment reference used ${d.count} times`,
        reference: d._id,
        amount: "",
        currency: "",
        date: "",
      })),
      ...stalePending.map((p) => ({
        severity: "medium",
        issue: "Payment pending for more than 24 hours",
        reference: p.reference,
        amount: p.amount,
        currency: p.currency,
        date: p.createdAt,
      })),
      ...refunds.map((p) => ({
        severity: "info",
        issue: `Refunded${p.refundDetails?.refundReason ? `: ${p.refundDetails.refundReason}` : ""}`,
        reference: p.reference,
        amount: p.refundDetails?.refundAmount ?? p.amount,
        currency: p.currency,
        date: p.refundDetails?.refundedAt || p.createdAt,
      })),
    ];

    const recommendations = [];
    if (missingTxn.length) recommendations.push("Reconcile completed payments that have no gateway transaction ID");
    if (stalePending.length) recommendations.push("Re-query or expire payments stuck in pending");
    if (duplicateRefs.length) recommendations.push("Investigate duplicated payment references");
    if (unverified) recommendations.push(`${unverified} completed payment(s) were not confirmed by a gateway webhook`);

    return {
      totalRecords: byStatus.reduce((s, b) => s + b.count, 0),
      summary: {
        byStatus: byStatus.map((b) => ({ status: b._id, count: b.count, amount: b.amount })),
        completedByCurrency: byCurrency.map((c) => ({ currency: c._id, total: c.total, count: c.count })),
        completedWithoutTransactionId: missingTxn.length,
        completedWithoutWebhook: unverified,
        stalePending: stalePending.length,
        refunds: refunds.length,
        duplicateReferences: duplicateRefs.length,
      },
      findings,
      recommendations,
    };
  }

  async calculateAverageProcessingTime(dateQuery) {
    const completedRequests = await GDPRRequest.find({
      ...dateQuery,
      status: "completed",
      completedAt: { $exists: true },
    });

    if (completedRequests.length === 0) return 0;

    const totalTime = completedRequests.reduce((sum, req) => {
      const time = req.completedAt - req.createdAt;
      return sum + time;
    }, 0);

    const avgMilliseconds = totalTime / completedRequests.length;
    const avgDays = avgMilliseconds / (1000 * 60 * 60 * 24);

    return Math.round(avgDays * 10) / 10; // Round to 1 decimal place
  }
}

export default new AdminAuditComplianceService();
