import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  getDashboardMetrics,
  getDashboardActivity,
  getQuickStats,
} from "../controllers/planner.controller.js";
import {
  listClients,
  createClient,
  getClient,
  updateClient,
  deleteClient,
  getClientEvents,
} from "../controllers/client.controller.js";
import { listAllTasks } from "../controllers/task.controller.js";
import {
  getCalendarData,
  getEventsInRange,
} from "../controllers/calendar.controller.js";
import {
  getEventAnalytics,
  getBusinessAnalytics,
  getTaskAnalytics,
  generateCustomReport,
} from "../controllers/analytics.controller.js";
import { plannerMessageRoutes } from "./communication.routes.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

// Dashboard routes
router.get("/dashboard/metrics", getDashboardMetrics);
router.get("/dashboard/activity", getDashboardActivity);
router.get("/dashboard/quick-stats", getQuickStats);

// Client routes
router.get("/clients", listClients);
router.post("/clients", createClient);
router.get("/clients/:id", getClient);
router.patch("/clients/:id", updateClient);
router.delete("/clients/:id", deleteClient);
router.get("/clients/:id/events", getClientEvents);

// Task routes (all tasks across events)
router.get("/tasks", listAllTasks);

// Calendar routes
router.get("/calendar", getCalendarData);
router.get("/calendar/events", getEventsInRange);

// Analytics routes
router.get("/analytics/events", getEventAnalytics);
router.get("/analytics/business", getBusinessAnalytics);
router.get("/analytics/tasks", getTaskAnalytics);

// Reports routes
router.post("/reports/custom", generateCustomReport);

// Communication routes
router.use("/messages", plannerMessageRoutes);

export default router;
