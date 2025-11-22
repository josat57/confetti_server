import Notification from "../models/notification.model.js";
import NotificationPreferences from "../models/notification-preferences.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmail } from "../utils/email.js";

/**
 * Controller for Planner Notifications
 */
class PlannerNotificationController {
  /**
   * Get all notifications
   * GET /api/v1/planner/notifications
   */
  async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, isRead, type, priority } = req.query;

      logger.info("Fetching notifications", { userId });

      const query = { user: userId };

      if (isRead !== undefined) {
        query.isRead = isRead === "true";
      }

      if (type) {
        query.type = type;
      }

      if (priority) {
        query.priority = priority;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Notification.countDocuments(query),
        Notification.getUnreadCount(userId),
      ]);

      res.status(200).json({
        success: true,
        data: {
          notifications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit)),
          },
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread count
   * GET /api/v1/planner/notifications/unread-count
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;

      const unreadCount = await Notification.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: {
          unreadCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/v1/planner/notifications/:id/read
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      logger.info("Marking notification as read", {
        userId,
        notificationId: id,
      });

      const notification = await Notification.findOne({
        _id: id,
        user: userId,
      });

      if (!notification) {
        throw new AppError("Notification not found", 404);
      }

      if (!notification.isRead) {
        await notification.markAsRead();
      }

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
        data: {
          notification,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   * PATCH /api/v1/planner/notifications/mark-all-read
   */
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.id;

      logger.info("Marking all notifications as read", { userId });

      const result = await Notification.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
        data: {
          modifiedCount: result.modifiedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete notification
   * DELETE /api/v1/planner/notifications/:id
   */
  async deleteNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      logger.info("Deleting notification", { userId, notificationId: id });

      const notification = await Notification.findOneAndDelete({
        _id: id,
        user: userId,
      });

      if (!notification) {
        throw new AppError("Notification not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get notification preferences
   * GET /api/v1/planner/notifications/preferences
   */
  async getPreferences(req, res, next) {
    try {
      const userId = req.user.id;

      logger.info("Fetching notification preferences", { userId });

      const preferences = await NotificationPreferences.getOrCreate(userId);

      res.status(200).json({
        success: true,
        data: {
          preferences,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update notification preferences
   * PUT /api/v1/planner/notifications/preferences
   */
  async updatePreferences(req, res, next) {
    try {
      const userId = req.user.id;
      const updates = req.body;

      logger.info("Updating notification preferences", { userId });

      let preferences = await NotificationPreferences.findOne({ user: userId });

      if (!preferences) {
        preferences = new NotificationPreferences({ user: userId });
      }

      // Update fields
      if (updates.channels) {
        preferences.channels = { ...preferences.channels, ...updates.channels };
      }

      if (updates.notificationTypes) {
        preferences.notificationTypes = {
          ...preferences.notificationTypes,
          ...updates.notificationTypes,
        };
      }

      if (updates.quietHours) {
        preferences.quietHours = {
          ...preferences.quietHours,
          ...updates.quietHours,
        };
      }

      if (updates.frequency) {
        preferences.frequency = updates.frequency;
      }

      await preferences.save();

      res.status(200).json({
        success: true,
        message: "Notification preferences updated successfully",
        data: {
          preferences,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create notification (internal use)
   * POST /api/v1/planner/notifications
   */
  async createNotification(req, res, next) {
    try {
      const {
        userId,
        type,
        title,
        message,
        priority = "medium",
        actionUrl,
        actionText,
        relatedEntity,
        metadata,
        channels,
      } = req.body;

      if (!userId || !type || !title || !message) {
        throw new AppError("Missing required fields", 400);
      }

      logger.info("Creating notification", { userId, type });

      // Get user preferences
      const preferences = await NotificationPreferences.getOrCreate(userId);

      // Determine which channels to use
      const notificationChannels = {
        inApp:
          channels?.inApp !== false &&
          preferences.shouldSendNotification(type, "inApp"),
        email:
          channels?.email === true &&
          preferences.shouldSendNotification(type, "email"),
        sms:
          channels?.sms === true &&
          preferences.shouldSendNotification(type, "sms"),
        push:
          channels?.push === true &&
          preferences.shouldSendNotification(type, "push"),
      };

      // Create notification
      const notification = await Notification.createNotification({
        user: userId,
        type,
        title,
        message,
        priority,
        actionUrl,
        actionText,
        relatedEntity,
        metadata,
        channels: notificationChannels,
      });

      // Send email if enabled
      if (notificationChannels.email) {
        try {
          await sendEmail({
            to: req.body.userEmail || userId, // Would need to fetch user email
            subject: title,
            template: "notification",
            data: {
              title,
              message,
              actionUrl,
              actionText,
            },
          });
          await notification.markEmailSent();
        } catch (emailError) {
          logger.error("Failed to send notification email", {
            error: emailError,
          });
        }
      }

      // TODO: Send SMS if enabled
      // TODO: Send push notification if enabled

      res.status(201).json({
        success: true,
        message: "Notification created successfully",
        data: {
          notification,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test notification (for development)
   * POST /api/v1/planner/notifications/test
   */
  async testNotification(req, res, next) {
    try {
      const userId = req.user.id;

      logger.info("Creating test notification", { userId });

      const notification = await Notification.createNotification({
        user: userId,
        type: "system",
        title: "Test Notification",
        message:
          "This is a test notification to verify the system is working correctly.",
        priority: "low",
        actionUrl: "/dashboard",
        actionText: "Go to Dashboard",
        channels: {
          inApp: true,
          email: false,
          sms: false,
          push: false,
        },
      });

      res.status(201).json({
        success: true,
        message: "Test notification created successfully",
        data: {
          notification,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PlannerNotificationController();
