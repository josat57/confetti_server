import mongoose from "mongoose";
import Redis from "ioredis";
import os from "os";

/**
 * Health Check Controller
 * Provides endpoints for monitoring system health
 */

/**
 * Basic health check
 */
export const healthCheck = async (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
};

/**
 * Detailed health check with dependencies
 */
export const detailedHealthCheck = async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.API_VERSION || "1.0.0",
    checks: {},
  };

  // Check MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStates = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    health.checks.mongodb = {
      status: mongoState === 1 ? "ok" : "error",
      state: mongoStates[mongoState],
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };

    if (mongoState !== 1) {
      health.status = "degraded";
    }
  } catch (error) {
    health.checks.mongodb = {
      status: "error",
      error: error.message,
    };
    health.status = "degraded";
  }

  // Check Redis
  try {
    const redis = new Redis(process.env.REDIS_URL);
    await redis.ping();
    health.checks.redis = {
      status: "ok",
      connected: true,
    };
    await redis.quit();
  } catch (error) {
    health.checks.redis = {
      status: "error",
      error: error.message,
    };
    health.status = "degraded";
  }

  // System metrics
  health.system = {
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: {
      total: Math.round(os.totalmem() / 1024 / 1024) + " MB",
      free: Math.round(os.freemem() / 1024 / 1024) + " MB",
      used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024) + " MB",
      usagePercent:
        Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100) +
        "%",
    },
    loadAverage: os.loadavg(),
  };

  // Process metrics
  const memUsage = process.memoryUsage();
  health.process = {
    pid: process.pid,
    uptime: Math.round(process.uptime()) + "s",
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + " MB",
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
      external: Math.round(memUsage.external / 1024 / 1024) + " MB",
    },
    cpu: process.cpuUsage(),
  };

  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
};

/**
 * Readiness check (for Kubernetes/Docker)
 */
export const readinessCheck = async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: "not ready",
        reason: "MongoDB not connected",
      });
    }

    // Check if Redis is connected
    const redis = new Redis(process.env.REDIS_URL);
    await redis.ping();
    await redis.quit();

    res.status(200).json({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      reason: error.message,
    });
  }
};

/**
 * Liveness check (for Kubernetes/Docker)
 */
export const livenessCheck = async (req, res) => {
  res.status(200).json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

/**
 * Database statistics
 */
export const databaseStats = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();

    res.status(200).json({
      success: true,
      data: {
        database: stats.db,
        collections: stats.collections,
        views: stats.views,
        objects: stats.objects,
        avgObjSize: Math.round(stats.avgObjSize) + " bytes",
        dataSize: Math.round(stats.dataSize / 1024 / 1024) + " MB",
        storageSize: Math.round(stats.storageSize / 1024 / 1024) + " MB",
        indexes: stats.indexes,
        indexSize: Math.round(stats.indexSize / 1024 / 1024) + " MB",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get database stats",
      error: error.message,
    });
  }
};

/**
 * API metrics
 */
export const apiMetrics = async (req, res) => {
  try {
    // Get collection counts
    const User = mongoose.model("User");
    const Event = mongoose.model("Event");
    const Client = mongoose.model("Client");
    const Task = mongoose.model("Task");
    const Guest = mongoose.model("Guest");

    const [userCount, eventCount, clientCount, taskCount, guestCount] =
      await Promise.all([
        User.countDocuments(),
        Event.countDocuments(),
        Client.countDocuments(),
        Task.countDocuments(),
        Guest.countDocuments(),
      ]);

    res.status(200).json({
      success: true,
      data: {
        collections: {
          users: userCount,
          events: eventCount,
          clients: clientCount,
          tasks: taskCount,
          guests: guestCount,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get API metrics",
      error: error.message,
    });
  }
};
