import express from "express";
import PlannerReportsController from "../controllers/planner-reports.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

/**
 * @route   GET /api/v1/planner/reports/dashboard
 * @desc    Get dashboard analytics summary (Professional+ tier)
 * @access  Private (Event Planners only, Professional+ tier)
 * @query   startDate, endDate
 */
router.get("/dashboard", PlannerReportsController.getDashboardReport);

/**
 * @route   GET /api/v1/planner/reports/events
 * @desc    Get events report (Professional+ tier)
 * @access  Private (Event Planners only, Professional+ tier)
 * @query   startDate, endDate
 */
router.get("/events", PlannerReportsController.getEventsReport);

/**
 * @route   GET /api/v1/planner/reports/financial
 * @desc    Get financial report (Professional+ tier)
 * @access  Private (Event Planners only, Professional+ tier)
 * @query   startDate, endDate
 */
router.get("/financial", PlannerReportsController.getFinancialReport);

/**
 * @route   GET /api/v1/planner/reports/vendors
 * @desc    Get vendors report (Professional+ tier)
 * @access  Private (Event Planners only, Professional+ tier)
 * @query   startDate, endDate
 */
router.get("/vendors", PlannerReportsController.getVendorsReport);

/**
 * @route   GET /api/v1/planner/reports/clients
 * @desc    Get clients report (Professional+ tier)
 * @access  Private (Event Planners only, Professional+ tier)
 * @query   startDate, endDate
 */
router.get("/clients", PlannerReportsController.getClientsReport);

/**
 * @route   GET /api/v1/planner/reports/tasks
 * @desc    Get tasks report (Professional+ tier)
 * @access  Private (Event Planners only, Professional+ tier)
 * @query   startDate, endDate
 */
router.get("/tasks", PlannerReportsController.getTasksReport);

/**
 * @route   POST /api/v1/planner/reports/export
 * @desc    Export report in PDF/Excel format (Professional+ tier)
 * @access  Private (Event Planners only, Professional+ tier)
 * @body    reportType, format (pdf|excel|csv), startDate, endDate
 */
router.post("/export", PlannerReportsController.exportReport);

export default router;
