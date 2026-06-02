import os from "os";
import SystemMetric from "../models/systemMetric.model.js";
import ErrorLog from "../models/errorLog.model.js";
import SystemAlert from "../models/systemAlert.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";
import adminRealtimeService from "./admin-realtime.service.js";
import { logger } from "../utils/logger.js";

class AdminSystemMonitoringService {
  constructor() {
    this.monitoringInterval = null;
    this.thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 75, critical: 90 },
      disk: { warning: 80, critical: 95 },
      apiResponseTime: { warning: 1000, critical: 3000 },
    };
  }

  // ==================== System Metrics ====================

  async getSystemMetrics(filters = {}) {
    const { metricType, status, startDate, endDate, limit = 100 } = filters;

    const query = {};
    if (metricType) query.metricType = metricType;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const metrics = await SystemMetric.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return metrics;
  }

  async getCurrentSystemMetrics() {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();
    const networkStats = this.getNetworkStats();

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      network: networkStats,
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }

  async recordSystemMetric(metricType, value, unit, metadata = {}) {
    const threshold = this.thresholds[metricType];
    let status = "normal";

    if (threshold) {
      if (value >= threshold.critical) {
        status = "critical";
      } else if (value >= threshold.warning) {
        status = "warning";
      }
    }

    const metric = await SystemMetric.create({
      metricType,
      value,
      unit,
      metadata,
      threshold,
      status,
    });

    // Create alert if threshold exceeded
    if (status !== "normal") {
      await this.createThresholdAlert(metricType, value, threshold, status);
    }

    return metric;
  }

  async getMetricStatistics(metricType, timeRange = "24h") {
    const startDate = this.calculateStartDate(timeRange);

    const stats = await SystemMetric.aggregate([
      {
        $match: {
          metricType,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          avg: { $avg: "$value" },
          min: { $min: "$value" },
          max: { $max: "$value" },
          count: { $sum: 1 },
        },
      },
    ]);

    const timeSeries = await SystemMetric.aggregate([
      {
        $match: {
          metricType,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d %H:00",
              date: "$timestamp",
            },
          },
          avg: { $avg: "$value" },
          max: { $max: "$value" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      statistics: stats[0] || { avg: 0, min: 0, max: 0, count: 0 },
      timeSeries,
    };
  }

  // ==================== Error Logs ====================

  async getErrorLogs(filters = {}) {
    const {
      page = 1,
      limit = 50,
      errorType,
      severity,
      resolved,
      startDate,
      endDate,
    } = filters;

    const query = {};
    if (errorType) query.errorType = errorType;
    if (severity) query.severity = severity;
    if (resolved !== undefined) query.resolved = resolved;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [errors, total] = await Promise.all([
      ErrorLog.find(query)
        .populate("user", "firstName lastName email")
        .populate("resolvedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ErrorLog.countDocuments(query),
    ]);

    return {
      errors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getErrorLogById(errorId) {
    const error = await ErrorLog.findById(errorId)
      .populate("user", "firstName lastName email")
      .populate("resolvedBy", "firstName lastName email")
      .lean();

    if (!error) {
      throw createError("Error log not found", 404);
    }

    return error;
  }

  async logError(errorData) {
    const {
      errorType,
      severity,
      message,
      stack,
      code,
      endpoint,
      method,
      statusCode,
      user,
      ipAddress,
      userAgent,
      metadata,
    } = errorData;

    // Check for duplicate errors
    const existingError = await ErrorLog.findOne({
      message,
      endpoint,
      resolved: false,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    });

    if (existingError) {
      existingError.occurrenceCount += 1;
      existingError.lastOccurrence = new Date();
      await existingError.save();
      return existingError;
    }

    const errorLog = await ErrorLog.create({
      errorType,
      severity,
      message,
      stack,
      code,
      endpoint,
      method,
      statusCode,
      user,
      ipAddress,
      userAgent,
      metadata,
    });

    // Create alert for critical errors
    if (severity === "critical") {
      await this.createErrorAlert(errorLog);
    }

    // Broadcast to real-time service
    if (adminRealtimeService.io) {
      adminRealtimeService.broadcastSystemAlert({
        type: "error",
        severity,
        message: `New ${severity} error: ${message}`,
        errorId: errorLog._id,
      });
    }

    return errorLog;
  }

  async resolveError(errorId, resolution, adminId) {
    const error = await ErrorLog.findById(errorId);

    if (!error) {
      throw createError("Error log not found", 404);
    }

    error.resolved = true;
    error.resolvedBy = adminId;
    error.resolvedAt = new Date();
    error.resolution = resolution;
    await error.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "resolve_error",
      resource: "ErrorLog",
      resourceId: errorId,
      details: { resolution },
    });

    return error;
  }

  async getErrorStatistics(timeRange = "24h") {
    const startDate = this.calculateStartDate(timeRange);

    const [totalErrors, bySeverity, byType, byEndpoint, resolved, unresolved] =
      await Promise.all([
        ErrorLog.countDocuments({ createdAt: { $gte: startDate } }),
        ErrorLog.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: "$severity", count: { $sum: 1 } } },
        ]),
        ErrorLog.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: "$errorType", count: { $sum: 1 } } },
        ]),
        ErrorLog.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: "$endpoint", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        ErrorLog.countDocuments({
          createdAt: { $gte: startDate },
          resolved: true,
        }),
        ErrorLog.countDocuments({
          createdAt: { $gte: startDate },
          resolved: false,
        }),
      ]);

    return {
      total: totalErrors,
      bySeverity,
      byType,
      byEndpoint,
      resolved,
      unresolved,
      resolutionRate:
        totalErrors > 0 ? ((resolved / totalErrors) * 100).toFixed(2) : 0,
    };
  }

  // ==================== System Alerts ====================

  async getSystemAlerts(filters = {}) {
    const { page = 1, limit = 50, alertType, severity, status } = filters;

    const query = {};
    if (alertType) query.alertType = alertType;
    if (severity) query.severity = severity;
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [alerts, total] = await Promise.all([
      SystemAlert.find(query)
        .populate("acknowledgedBy", "firstName lastName email")
        .populate("resolvedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SystemAlert.countDocuments(query),
    ]);

    return {
      alerts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSystemAlertById(alertId) {
    const alert = await SystemAlert.findById(alertId)
      .populate("acknowledgedBy", "firstName lastName email")
      .populate("resolvedBy", "firstName lastName email")
      .lean();

    if (!alert) {
      throw createError("System alert not found", 404);
    }

    return alert;
  }

  async createAlert(alertData) {
    const alert = await SystemAlert.create(alertData);

    // Broadcast to real-time service
    if (adminRealtimeService.io) {
      adminRealtimeService.broadcastSystemAlert({
        alertId: alert._id,
        type: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
      });
    }

    return alert;
  }

  async acknowledgeAlert(alertId, adminId) {
    const alert = await SystemAlert.findById(alertId);

    if (!alert) {
      throw createError("System alert not found", 404);
    }

    alert.status = "acknowledged";
    alert.acknowledgedBy = adminId;
    alert.acknowledgedAt = new Date();
    await alert.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "acknowledge_alert",
      resource: "SystemAlert",
      resourceId: alertId,
    });

    return alert;
  }

  async resolveAlert(alertId, resolution, adminId) {
    const alert = await SystemAlert.findById(alertId);

    if (!alert) {
      throw createError("System alert not found", 404);
    }

    alert.status = "resolved";
    alert.resolvedBy = adminId;
    alert.resolvedAt = new Date();
    alert.resolution = resolution;
    await alert.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "resolve_alert",
      resource: "SystemAlert",
      resourceId: alertId,
      details: { resolution },
    });

    return alert;
  }

  async getAlertStatistics() {
    const [total, byStatus, bySeverity, byType] = await Promise.all([
      SystemAlert.countDocuments(),
      SystemAlert.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      SystemAlert.aggregate([
        { $group: { _id: "$severity", count: { $sum: 1 } } },
      ]),
      SystemAlert.aggregate([
        { $group: { _id: "$alertType", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total,
      byStatus,
      bySeverity,
      byType,
    };
  }

  // ==================== System Health ====================

  async getSystemHealth() {
    const [cpuUsage, memoryUsage, errorRate, activeAlerts] = await Promise.all([
      this.getCPUUsage(),
      Promise.resolve(this.getMemoryUsage()),
      this.getRecentErrorRate(),
      SystemAlert.countDocuments({ status: "active" }),
    ]);

    const health = {
      status: "healthy",
      components: {
        cpu: {
          status: this.getHealthStatus(cpuUsage.percent, this.thresholds.cpu),
          value: cpuUsage.percent,
        },
        memory: {
          status: this.getHealthStatus(
            memoryUsage.percent,
            this.thresholds.memory
          ),
          value: memoryUsage.percent,
        },
        database: { status: "healthy", responseTime: 0 },
        api: { status: "healthy", errorRate },
      },
      alerts: {
        active: activeAlerts,
        critical: await SystemAlert.countDocuments({
          status: "active",
          severity: "critical",
        }),
      },
      uptime: process.uptime(),
      timestamp: new Date(),
    };

    // Determine overall status
    const componentStatuses = Object.values(health.components).map(
      (c) => c.status
    );
    if (componentStatuses.includes("critical")) {
      health.status = "critical";
    } else if (componentStatuses.includes("warning")) {
      health.status = "degraded";
    }

    return health;
  }

  // ==================== Helper Methods ====================

  async getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return {
      percent: usage,
      cores: cpus.length,
      model: cpus[0].model,
    };
  }

  getMemoryUsage() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percent = (used / total) * 100;

    return {
      total,
      used,
      free,
      percent: Math.round(percent * 100) / 100,
    };
  }

  async getDiskUsage() {
    // Mock implementation - would use actual disk monitoring in production
    return {
      total: 500 * 1024 * 1024 * 1024, // 500GB
      used: 250 * 1024 * 1024 * 1024, // 250GB
      free: 250 * 1024 * 1024 * 1024,
      percent: 50,
    };
  }

  getNetworkStats() {
    const networkInterfaces = os.networkInterfaces();
    return {
      interfaces: Object.keys(networkInterfaces).length,
      details: networkInterfaces,
    };
  }

  async getRecentErrorRate() {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const errorCount = await ErrorLog.countDocuments({
      createdAt: { $gte: last5Minutes },
    });
    return errorCount;
  }

  getHealthStatus(value, threshold) {
    if (value >= threshold.critical) return "critical";
    if (value >= threshold.warning) return "warning";
    return "healthy";
  }

  calculateStartDate(timeRange) {
    const now = new Date();
    const ranges = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    return new Date(now - (ranges[timeRange] || ranges["24h"]));
  }

  async createThresholdAlert(metricType, value, threshold, status) {
    const severity = status === "critical" ? "critical" : "warning";

    await this.createAlert({
      alertType: "performance",
      severity,
      title: `${metricType.toUpperCase()} ${status}`,
      message: `${metricType} usage is ${status}: ${value}%`,
      source: "system_monitor",
      metric: metricType,
      threshold: {
        value: status === "critical" ? threshold.critical : threshold.warning,
        operator: ">=",
      },
      currentValue: value,
    });
  }

  async createErrorAlert(errorLog) {
    await this.createAlert({
      alertType: "error",
      severity: "critical",
      title: "Critical Error Detected",
      message: errorLog.message,
      source: errorLog.endpoint || "application",
      metadata: {
        errorId: errorLog._id,
        errorType: errorLog.errorType,
      },
    });
  }

  // Start monitoring
  startMonitoring(interval = 60000) {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const cpuUsage = await this.getCPUUsage();
        const memoryUsage = this.getMemoryUsage();

        await this.recordSystemMetric("cpu", cpuUsage.percent, "percent");
        await this.recordSystemMetric("memory", memoryUsage.percent, "percent");
      } catch (error) {
        logger.error("Monitoring error:", error);
      }
    }, interval);

    logger.info("System monitoring started");
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("System monitoring stopped");
    }
  }
}

export default new AdminSystemMonitoringService();
