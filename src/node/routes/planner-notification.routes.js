import express from "express";
import PlannerNotificationController from "../controllers/planner-notification.controller.js";
import { protect, restrictTo } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

/**
 * @route   GET /api/v1/planner/notifications
 * @desc    Get all notifications
 * @access  Private (Event Planners only)
 * @query   page, limit, isRead, type, priority
 */
router.get("/", PlannerNotificationController.getNotifications);

/**
 * @route   GET /api/v1/planner/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private (Event Planners only)
 */
router.get("/unread-count", PlannerNotificationController.getUnreadCount);

/**
 * @route   GET /api/v1/planner/notifications/preferences
 * @desc    Get notification preferences
 * @access  Private (Event Planners only)
 */
router.get("/preferences", PlannerNotificationController.getPreferences);

/**
 * @route   PUT /api/v1/planner/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private (Event Planners only)
 * @body    channels, notificationTypes, quietHours, frequency
 */
router.put("/preferences", PlannerNotificationController.updatePreferences);

/**
 * @route   PATCH /api/v1/planner/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private (Event Planners only)
 */
router.patch("/mark-all-read", PlannerNotificationController.markAllAsRead);

/**
 * @route   POST /api/v1/planner/notifications/test
 * @desc    Create test notification (development)
 * @access  Private (Event Planners only)
 */
router.post("/test", PlannerNotificationController.testNotification);

/**
 * @route   POST /api/v1/planner/notifications
 * @desc    Create notification (internal use)
 * @access  Private (Event Planners only)
 * @body    userId, type, title, message, priority, actionUrl, actionText, relatedEntity, metadata, channels
 */
router.post("/", PlannerNotificationController.createNotification);

/**
 * @route   PATCH /api/v1/planner/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private (Event Planners only)
 */
router.patch("/:id/read", PlannerNotificationController.markAsRead);

/**
 * @route   DELETE /api/v1/planner/notifications/:id
 * @desc    Delete notification
 * @access  Private (Event Planners only)
 */
router.delete("/:id", PlannerNotificationController.deleteNotification);

export default router;
