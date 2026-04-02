import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import {
  getDashboardMetrics,
  getDashboardActivity,
  getQuickStats,
} from "../controllers/planner-dashboard.controller.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

/**
 * @swagger
 * /planner/dashboard/metrics:
 *   get:
 *     summary: Get dashboard overview metrics
 *     description: Get comprehensive dashboard metrics including events, clients, tasks, revenue, and growth statistics
 *     tags: [Planner Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalEvents:
 *                           type: number
 *                         activeEvents:
 *                           type: number
 *                         completedEvents:
 *                           type: number
 *                         totalClients:
 *                           type: number
 *                         activeTasks:
 *                           type: number
 *                         overdueTasks:
 *                           type: number
 *                         totalRevenue:
 *                           type: number
 *                         pendingBookings:
 *                           type: number
 *                     growth:
 *                       type: object
 *                       properties:
 *                         events:
 *                           type: string
 *                           example: "15.5%"
 *                         revenue:
 *                           type: string
 *                           example: "8.2%"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Planner role required
 */
router.get(
  "/metrics",
  rateLimiter("planner-dashboard-metrics", 100, 60 * 60), // 100 requests per hour
  getDashboardMetrics
);

/**
 * @swagger
 * /planner/dashboard/activity:
 *   get:
 *     summary: Get dashboard activity feed
 *     description: Get recent activity feed including events, tasks, and bookings updates
 *     tags: [Planner Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of activities to return
 *     responses:
 *       200:
 *         description: Activity feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [event, task, booking]
 *                           title:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           metadata:
 *                             type: object
 *                     total:
 *                       type: number
 */
router.get(
  "/activity",
  rateLimiter("planner-dashboard-activity", 200, 60 * 60), // 200 requests per hour
  getDashboardActivity
);

/**
 * @swagger
 * /planner/dashboard/quick-stats:
 *   get:
 *     summary: Get quick dashboard statistics
 *     description: Get upcoming deadlines, tasks this week, and other quick stats for dashboard widgets
 *     tags: [Planner Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quick stats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     upcomingEvents:
 *                       type: array
 *                       items:
 *                         type: object
 *                     tasksThisWeek:
 *                       type: array
 *                       items:
 *                         type: object
 *                     overdueItems:
 *                       type: number
 *                     recentClients:
 *                       type: array
 *                       items:
 *                         type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         eventsThisWeek:
 *                           type: number
 *                         tasksThisWeek:
 *                           type: number
 *                         overdueItems:
 *                           type: number
 *                         totalClients:
 *                           type: number
 */
router.get(
  "/quick-stats",
  rateLimiter("planner-dashboard-stats", 200, 60 * 60), // 200 requests per hour
  getQuickStats
);

export default router;
