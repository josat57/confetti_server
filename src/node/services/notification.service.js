import Notification from "../models/notification.model.js";
import NotificationPreferences from "../models/notification-preferences.model.js";
import { logger } from "../utils/logger.js";
import { sendEmail } from "../utils/email.js";

/**
 * Notification Service
 * Handles creation and delivery of notifications
 */
class NotificationService {
  /**
   * Create and send notification
   */
  async createNotification({
    userId,
    type,
    title,
    message,
    priority = "medium",
    actionUrl,
    actionText,
    relatedEntity,
    metadata,
    channels = {},
  }) {
    try {
      // Get user preferences
      const preferences = await NotificationPreferences.getOrCreate(userId);

      // Determine which channels to use based on preferences
      const notificationChannels = {
        inApp:
          channels.inApp !== false &&
          preferences.shouldSendNotification(type, "inApp"),
        email:
          channels.email === true &&
          preferences.shouldSendNotification(type, "email"),
        sms:
          channels.sms === true &&
          preferences.shouldSendNotification(type, "sms"),
        push:
          channels.push === true &&
          preferences.shouldSendNotification(type, "push"),
      };

      // Create notification
      const notification = await Notification.create({
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

      // Send via enabled channels
      if (notificationChannels.email) {
        await this.sendEmailNotification(notification);
      }

      if (notificationChannels.sms) {
        await this.sendSmsNotification(notification);
      }

      if (notificationChannels.push) {
        await this.sendPushNotification(notification);
      }

      logger.info("Notification created", {
        notificationId: notification._id,
        userId,
        type,
      });

      return notification;
    } catch (error) {
      logger.error("Failed to create notification", { error, userId, type });
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(notification) {
    try {
      const User = (await import("../models/user.model.js")).default;
      const user = await User.findById(notification.user).select(
        "email firstName"
      );

      if (!user || !user.email) {
        logger.warn("User email not found for notification", {
          notificationId: notification._id,
        });
        return;
      }

      await sendEmail({
        to: user.email,
        subject: notification.title,
        template: "notification",
        data: {
          firstName: user.firstName,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
          priority: notification.priority,
        },
      });

      await notification.markEmailSent();
      logger.info("Email notification sent", {
        notificationId: notification._id,
      });
    } catch (error) {
      logger.error("Failed to send email notification", {
        error,
        notificationId: notification._id,
      });
    }
  }

  /**
   * Send SMS notification (Professional+ tier)
   */
  async sendSmsNotification(notification) {
    try {
      // TODO: Implement SMS sending via Twilio or similar
      // Check user subscription tier (Professional+ required)

      logger.info("SMS notification placeholder", {
        notificationId: notification._id,
        message: "SMS integration coming soon",
      });

      // await notification.markSmsSent();
    } catch (error) {
      logger.error("Failed to send SMS notification", {
        error,
        notificationId: notification._id,
      });
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(notification) {
    try {
      // TODO: Implement push notification via Firebase Cloud Messaging or similar

      logger.info("Push notification placeholder", {
        notificationId: notification._id,
        message: "Push notification integration coming soon",
      });

      // await notification.markPushSent();
    } catch (error) {
      logger.error("Failed to send push notification", {
        error,
        notificationId: notification._id,
      });
    }
  }

  /**
   * Notification triggers for specific events
   */

  async notifyVendorResponse(userId, vendorName, eventTitle) {
    return this.createNotification({
      userId,
      type: "vendor_response",
      title: "Vendor Response Received",
      message: `${vendorName} has responded to your inquiry for ${eventTitle}`,
      priority: "high",
      actionUrl: `/events/${eventTitle}/vendors`,
      actionText: "View Response",
      channels: { inApp: true, email: true, push: true },
    });
  }

  async notifyClientApproval(userId, clientName, itemName) {
    return this.createNotification({
      userId,
      type: "client_approval",
      title: "Client Approval Needed",
      message: `${clientName} needs your approval for ${itemName}`,
      priority: "high",
      actionUrl: `/clients/${clientName}`,
      actionText: "Review Request",
      channels: { inApp: true, email: true, push: true },
    });
  }

  async notifyTaskDeadline(userId, taskTitle, dueDate) {
    return this.createNotification({
      userId,
      type: "task_deadline",
      title: "Task Deadline Approaching",
      message: `Task "${taskTitle}" is due on ${new Date(
        dueDate
      ).toLocaleDateString()}`,
      priority: "medium",
      actionUrl: `/tasks`,
      actionText: "View Task",
      channels: { inApp: true, email: true, push: true },
    });
  }

  async notifyPaymentDue(userId, vendorName, amount, dueDate) {
    return this.createNotification({
      userId,
      type: "payment_due",
      title: "Payment Due",
      message: `Payment of ${amount} to ${vendorName} is due on ${new Date(
        dueDate
      ).toLocaleDateString()}`,
      priority: "urgent",
      actionUrl: `/payments`,
      actionText: "Make Payment",
      channels: { inApp: true, email: true, sms: true, push: true },
    });
  }

  async notifyNewMessage(userId, senderName, preview) {
    return this.createNotification({
      userId,
      type: "new_message",
      title: "New Message",
      message: `${senderName}: ${preview}`,
      priority: "medium",
      actionUrl: `/messages`,
      actionText: "View Message",
      channels: { inApp: true, push: true },
    });
  }

  async notifyTeamInvitation(userId, plannerName) {
    return this.createNotification({
      userId,
      type: "team_invitation",
      title: "Team Invitation",
      message: `${plannerName} has invited you to join their team`,
      priority: "high",
      actionUrl: `/team/invitations`,
      actionText: "View Invitation",
      channels: { inApp: true, email: true, push: true },
    });
  }

  async notifyEventUpdate(userId, eventTitle, updateType) {
    return this.createNotification({
      userId,
      type: "event_update",
      title: "Event Updated",
      message: `${eventTitle} has been updated: ${updateType}`,
      priority: "low",
      actionUrl: `/events/${eventTitle}`,
      actionText: "View Event",
      channels: { inApp: true },
    });
  }

  async notifyBudgetAlert(userId, eventTitle, category, percentage) {
    return this.createNotification({
      userId,
      type: "budget_alert",
      title: "Budget Alert",
      message: `${eventTitle}: ${category} budget is at ${percentage}% of allocation`,
      priority: "high",
      actionUrl: `/events/${eventTitle}/budget`,
      actionText: "View Budget",
      channels: { inApp: true, email: true, push: true },
    });
  }

  async notifyGuestRsvp(userId, guestName, eventTitle, response) {
    return this.createNotification({
      userId,
      type: "guest_rsvp",
      title: "Guest RSVP",
      message: `${guestName} has ${response} the invitation to ${eventTitle}`,
      priority: "low",
      actionUrl: `/events/${eventTitle}/guests`,
      actionText: "View Guests",
      channels: { inApp: true },
    });
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const result = await Notification.deleteOldNotifications(daysOld);
      logger.info("Old notifications cleaned up", {
        deletedCount: result.deletedCount,
        daysOld,
      });
      return result;
    } catch (error) {
      logger.error("Failed to cleanup old notifications", { error });
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
        status: { $in: ["pending", "sent", "delivered"] },
      });
      return count;
    } catch (error) {
      logger.error("Failed to get unread count", { error, userId });
      throw error;
    }
  }

  async listNotifications(query = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        userId,
        type,
        status,
        isRead,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = query;

      const filter = {};
      if (userId) filter.recipient = userId;
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (isRead !== undefined)
        filter.isRead = isRead === "true" || isRead === true;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

      const [notifications, total] = await Promise.all([
        Notification.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Notification.countDocuments(filter),
      ]);

      return {
        status: "success",
        data: {
          notifications,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      logger.error("Failed to list notifications", { error, query });
      throw error;
    }
  }

  async getNotificationById(notificationId) {
    try {
      const notification = await Notification.findById(notificationId).lean();
      if (!notification) {
        throw new Error("Notification not found");
      }
      return {
        status: "success",
        data: { notification },
      };
    } catch (error) {
      logger.error("Failed to get notification", { error, notificationId });
      throw error;
    }
  }
}

export default new NotificationService();
