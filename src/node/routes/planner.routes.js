import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
// Dashboard controller functions are used in planner-dashboard.routes.js
// Client controller functions are used in planner-client.routes.js
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
import {
  bulkEventAction,
  bulkTaskAction,
} from "../controllers/planner-bulk.controller.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

// Dashboard routes are handled by /planner/dashboard (see planner-dashboard.routes.js)

// Client routes are handled by /planner/clients (see planner-client.routes.js)

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

// Bulk operations routes
router.post("/events/bulk-action", bulkEventAction);
router.post("/tasks/bulk-action", bulkTaskAction);

// Communication routes
router.use("/messages", plannerMessageRoutes);

export default router;
