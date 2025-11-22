import express from "express";
import PlannerCalendarController from "../controllers/planner-calendar.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

/**
 * @route   GET /api/v1/planner/calendar
 * @desc    Get calendar data for date range
 * @access  Private (Event Planners only)
 * @query   startDate, endDate, view (month|week|day), includeEvents, includeTasks
 */
router.get("/", PlannerCalendarController.getCalendar);

/**
 * @route   GET /api/v1/planner/calendar/availability
 * @desc    Check availability for scheduling
 * @access  Private (Event Planners only)
 * @query   date, duration (in minutes)
 */
router.get("/availability", PlannerCalendarController.checkAvailability);

/**
 * @route   POST /api/v1/planner/calendar/sync
 * @desc    Sync calendar with external providers (Professional+ tier)
 * @access  Private (Event Planners only)
 * @body    provider (google|outlook), action (sync)
 */
router.post("/sync", PlannerCalendarController.syncCalendar);

/**
 * @route   GET /api/v1/planner/calendar/export
 * @desc    Export calendar to iCal format
 * @access  Private (Event Planners only)
 * @query   startDate, endDate, includeEvents, includeTasks
 */
router.get("/export", PlannerCalendarController.exportCalendar);

export default router;
