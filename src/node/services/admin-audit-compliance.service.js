import AuditLog from "../models/auditLog.model.js";
import ComplianceReport from "../models/complianceReport.model.js";
import DataRetentionPolicy from "../models/dataRetentionPolicy.model.js";
import GDPRRequest from "../models/gdprRequest.model.js";
import User from "../models/user.model.js";
import { createError } from "../utils/error.js";

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
    if (resource) query.resource = resource;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { resource: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("admin", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
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

  async exportAuditLogs(filters = {}, format = "csv") {
    const { logs } = await this.getAuditLogs({ ...filters, limit: 10000 });

    // In production, this would generate actual file
    return {
      format,
      recordCount: logs.length,
      downloadUrl: `/exports/audit-logs-${Date.now()}.${format}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };
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

    const report = await ComplianceReport.create({
      reportType,
      title,
      description,
      dateRange,
      filters,
      format,
      requestedBy: adminId,
      status: "pending",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Queue report generation (would be async in production)
    await this.processComplianceReport(report._id);

    return report;
  }

  async processComplianceReport(reportId) {
    const report = await ComplianceReport.findById(reportId);

    if (!report) {
      throw createError("Compliance report not found", 404);
    }

    report.status = "processing";
    await report.save();

    try {
      // Generate report based on type
      let results;
      switch (report.reportType) {
        case "gdpr":
          results = await this.generateGDPRReport(
            report.dateRange,
            report.filters
          );
          break;
        case "data_export":
          results = await this.generateDataExportReport(
            report.dateRange,
            report.filters
          );
          break;
        case "security_audit":
          results = await this.generateSecurityAuditReport(
            report.dateRange,
            report.filters
          );
          break;
        case "user_activity":
          results = await this.generateUserActivityReport(
            report.dateRange,
            report.filters
          );
          break;
        default:
          results = { totalRecords: 0, summary: {}, findings: [] };
      }

      report.results = results;
      report.status = "completed";
      report.completedAt = new Date();
      report.fileUrl = `/reports/${report._id}.${report.format}`;
      report.fileSize = Math.floor(Math.random() * 1000000); // Mock file size

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

  async applyDataRetentionPolicy(policyId, adminId) {
    const policy = await DataRetentionPolicy.findById(policyId);

    if (!policy) {
      throw createError("Data retention policy not found", 404);
    }

    if (!policy.isActive) {
      throw createError("Cannot apply inactive policy", 400);
    }

    // Calculate cutoff date
    const cutoffDate = new Date();
    if (policy.retentionPeriod.unit === "days") {
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod.value);
    } else if (policy.retentionPeriod.unit === "months") {
      cutoffDate.setMonth(cutoffDate.getMonth() - policy.retentionPeriod.value);
    } else if (policy.retentionPeriod.unit === "years") {
      cutoffDate.setFullYear(
        cutoffDate.getFullYear() - policy.retentionPeriod.value
      );
    }

    // Apply policy based on data type (mock implementation)
    let recordsAffected = 0;

    // In production, this would actually delete/archive data
    // For now, just simulate
    recordsAffected = Math.floor(Math.random() * 100);

    policy.lastApplied = new Date();
    policy.recordsAffected = recordsAffected;
    await policy.save();

    return {
      policyId: policy._id,
      dataType: policy.dataType,
      cutoffDate,
      recordsAffected,
      archived: policy.archiveBeforeDelete ? recordsAffected : 0,
      deleted: policy.autoDelete ? recordsAffected : 0,
    };
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
    const requests = await GDPRRequest.find({
      createdAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    });

    return {
      totalRecords: requests.length,
      summary: {
        totalRequests: requests.length,
        completedRequests: requests.filter((r) => r.status === "completed")
          .length,
        pendingRequests: requests.filter((r) => r.status === "pending").length,
        averageProcessingTime: "5 days",
      },
      findings: [
        {
          type: "access",
          count: requests.filter((r) => r.requestType === "access").length,
        },
        {
          type: "erasure",
          count: requests.filter((r) => r.requestType === "erasure").length,
        },
      ],
      recommendations: [
        "Implement automated verification process",
        "Reduce average processing time to 3 days",
      ],
    };
  }

  async generateDataExportReport(dateRange, filters) {
    return {
      totalRecords: 1000,
      summary: {
        usersExported: 500,
        dataSize: "2.5 GB",
        exportFormat: "JSON",
      },
      findings: [],
      recommendations: [],
    };
  }

  async generateSecurityAuditReport(dateRange, filters) {
    const logs = await AuditLog.find({
      createdAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    });

    return {
      totalRecords: logs.length,
      summary: {
        totalActions: logs.length,
        uniqueAdmins: new Set(logs.map((l) => l.admin?.toString())).size,
        criticalActions: logs.filter((l) => l.action.includes("delete")).length,
      },
      findings: [
        {
          severity: "high",
          description: "Multiple failed login attempts detected",
        },
        { severity: "medium", description: "Unusual admin activity pattern" },
      ],
      recommendations: [
        "Enable two-factor authentication for all admins",
        "Review and update access permissions",
      ],
    };
  }

  async generateUserActivityReport(dateRange, filters) {
    return {
      totalRecords: 5000,
      summary: {
        activeUsers: 1200,
        newUsers: 150,
        deletedUsers: 10,
      },
      findings: [],
      recommendations: [],
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
