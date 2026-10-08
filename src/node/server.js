import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/database.js";
import http from "http";
import NotificationManagerService from "./services/notification/manager.service.js";
import MessageService from "./services/messaging/message.service.js";
import config from "./config/index.js";
import logger from "./services/logging/advanced.service.js";
import { validateEmailConfig } from "./utils/validateEmailConfig.js";
import { initializeGridFS } from "./services/file-storage.service.js";

// Validate critical environment variables at startup
const REQUIRED_ENV_VARS = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(", ")}`);
  process.exit(1);
}

const PORT = config.port;

// Start server
const startServer = async () => {
  try {
    // Validate email configuration before starting services
    try {
      validateEmailConfig();
      logger.info("Email configuration validation completed successfully");
    } catch (error) {
      logger.error("Email configuration validation failed:", error.message);
      logger.warn(
        "Server will continue startup, but email functionality may not work properly"
      );
      // Don't exit - allow server to start even if email config is invalid
      // This allows for graceful degradation of email functionality
    }

    // Initialize email queue service
    try {
      const emailQueueService = (
        await import("./services/email-queue.service.js")
      ).default;
      await emailQueueService.initialize();
      logger.info("Email queue service initialized successfully");
    } catch (error) {
      logger.error("Email queue service initialization failed:", error.message);
      logger.warn(
        "Server will continue startup, but email queue functionality may not work properly"
      );
    }

    // Connect to database
    await connectDB();
    logger.info("Database connected successfully");

    // Initialize Super Admin
    try {
      const initializeSuperAdmin = (await import("./utils/initSuperAdmin.js"))
        .default;
      await initializeSuperAdmin();
      logger.info("Super admin initialization completed successfully");
    } catch (error) {
      logger.error("Super admin initialization failed:", error.message);
      logger.warn(
        "Server will continue startup, but super admin may not be available"
      );
    }

    // Subscription plans: create missing ones and retire old names (keeps admin price edits)
    try {
      const { ensurePlans } = await import("./services/plan-catalogue.service.js");
      await ensurePlans();
    } catch (error) {
      logger.error("Subscription plan sync failed:", error.message);
    }

    // Escrow: release booking payments after the event, hourly
    try {
      const { startEscrowJobs } = await import("./services/escrow.service.js");
      startEscrowJobs();
    } catch (error) {
      logger.error("Escrow jobs failed to start:", error.message);
    }

    // Subscription renewals (saved cards) and expiry reminders, hourly
    try {
      const { startSubscriptionJobs } = await import("./services/subscription-renewal.service.js");
      startSubscriptionJobs();
    } catch (error) {
      logger.error("Subscription jobs failed to start:", error.message);
    }

    // Initialize GridFS for file storage
    try {
      initializeGridFS();
      logger.info("GridFS file storage initialized successfully");
    } catch (error) {
      logger.error("GridFS initialization failed:", error.message);
      logger.warn(
        "Server will continue startup, but file upload functionality may not work properly"
      );
    }

    // Start server
    const server = http.createServer(app);

    // Initialize Admin Real-time Service
    try {
      const adminRealtimeService = (
        await import("./services/admin-realtime.service.js")
      ).default;
      adminRealtimeService.initialize(server);
      logger.info("Admin real-time service initialized successfully");
    } catch (error) {
      logger.error(
        "Admin real-time service initialization failed:",
        error.message
      );
      logger.warn(
        "Server will continue startup, but real-time features may not work properly"
      );
    }

    // Initialize System Monitoring Service
    try {
      const adminSystemMonitoringService = (
        await import("./services/admin-system-monitoring.service.js")
      ).default;
      adminSystemMonitoringService.startMonitoring(60000); // Monitor every minute
      logger.info("System monitoring service initialized successfully");
    } catch (error) {
      logger.error(
        "System monitoring service initialization failed:",
        error.message
      );
      logger.warn(
        "Server will continue startup, but monitoring features may not work properly"
      );
    }

    // Initialize Backup Scheduler (runs due backup schedules, recovers interrupted jobs)
    try {
      const { startBackupScheduler } = await import(
        "./services/backup.service.js"
      );
      await startBackupScheduler(60000);
      logger.info("Backup scheduler initialized successfully");
    } catch (error) {
      logger.error("Backup scheduler initialization failed:", error.message);
      logger.warn(
        "Server will continue startup, but scheduled backups will not run"
      );
    }

    // Initialize Scheduled Reports runner
    try {
      const adminAdvancedReportingService = (
        await import("./services/admin-advanced-reporting.service.js")
      ).default;
      adminAdvancedReportingService.startReportScheduler(60000);
      logger.info("Scheduled report runner initialized successfully");
    } catch (error) {
      logger.error("Scheduled report runner initialization failed:", error.message);
      logger.warn("Server will continue startup, but scheduled reports will not run");
    }

    // Initialize Notification dispatcher (email / SMS / push / in-app, scheduled + retries)
    try {
      const { startNotificationDispatcher, dispatchDueNotifications } = await import(
        "./services/notification-delivery.service.js"
      );
      startNotificationDispatcher(30000);
      dispatchDueNotifications().catch(() => {});
      logger.info("Notification dispatcher initialized successfully");
    } catch (error) {
      logger.error("Notification dispatcher initialization failed:", error.message);
      logger.warn("Server will continue startup, but queued notifications will not be delivered");
    }

    // Initialize Data Retention enforcement (hourly check, each policy at most daily)
    try {
      const { startRetentionScheduler } = await import(
        "./services/data-retention.service.js"
      );
      startRetentionScheduler(60 * 60 * 1000);
      logger.info("Data retention scheduler initialized successfully");
    } catch (error) {
      logger.error("Data retention scheduler initialization failed:", error.message);
      logger.warn("Server will continue startup, but retention policies will not auto-apply");
    }

    // Attach WebSocket upgrade handler
    // server.js
    server.on("upgrade", (request, socket, head) => {
      // Log the upgrade request
      logger.debug("WebSocket upgrade request", {
        url: request.url,
        pathname: new URL(request.url, `http://${request.headers.host}`)
          .pathname,
      });

      const pathname = new URL(request.url, `http://${request.headers.host}`)
        .pathname;

      if (pathname === "/ws/notifications") {
        NotificationManagerService.wss.handleUpgrade(
          request,
          socket,
          head,
          (ws) => {
            NotificationManagerService.wss.emit("connection", ws, request);
          }
        );
      } else if (pathname === "/ws/messages") {
        MessageService.wss.handleUpgrade(request, socket, head, (ws) => {
          MessageService.wss.emit("connection", ws, request);
        });
      } else {
        logger.warn(`Invalid WebSocket path: ${pathname}`);
        socket.destroy();
      }
    });

    const serverListening = server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
    });

    // Handle unhandled rejections
    process.on("unhandledRejection", (error) => {
      logger.error("Unhandled Rejection:", error);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
    });

    return serverListening;
  } catch (error) {
    logger.error("Server startup error:", error);
    process.exit(1);
  }
};
startServer();

export default app;
