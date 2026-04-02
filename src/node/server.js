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

// Debug environment variables
console.log("Environment Variables:", {
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
});

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

    // Attach WebSocket upgrade handler
    // server.js
    server.on("upgrade", (request, socket, head) => {
      // Log the upgrade request for debugging
      console.log("WebSocket upgrade request:", {
        url: request.url,
        headers: request.headers,
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
        console.log("Invalid WebSocket path:", pathname);
        socket.destroy();
      }
    });

    const serverListening = server.listen(PORT, () => {
      console.log(`
                🚀 Server running on port ${PORT}
                🌐 Health check: http://localhost:${PORT}/health
                ⏰ Time: ${new Date().toISOString()}
            `);
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
console.log("Start a sign here...", startServer);
startServer();

export default app;
