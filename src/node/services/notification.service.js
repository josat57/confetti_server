import Notification, { normalizeChannels } from "../models/notification.model.js";
import NotificationPreferences from "../models/notification-preferences.model.js";
import { logger } from "../utils/logger.js";
import { deliverNotification, queueForDelivery } from "./notification-delivery.service.js";

/**
 * Notification Service
 * Handles creation and delivery of notifications
 */
class NotificationService {
  /**
   * Create a notification and deliver it on the channels the user allows.
   * Accepts userId/user/recipient, domain types (e.g. "new_message"),
   * priority "medium", and channels as an object ({ inApp, email, sms, push }) or array.
   */
  async createNotification(input = {}) {
    const userId = input.userId || input.user || input.recipient;
    const { type, title, message } = input;
    if (!userId || !title || !message) {
      throw new Error("userId, title and message are required");
    }
    try {
      const requested = normalizeChannels(input.channels ?? { inApp: true });
      const allowed = await this.filterChannelsByPreferences(userId, type || "info", requested);

      const notification = await Notification.createNotification({
        ...input,
        recipient: userId,
        channels: allowed.length ? allowed : ["in-app"],
      });

      const external = allowed.filter((c) => c !== "in-app");
      if (external.length || allowed.includes("in-app")) {
        await queueForDelivery(notification);
      }

      logger.info("Notification created", {
        notificationId: notification._id,
        userId,
        type,
        channels: notification.channels,
      });

      return notification;
    } catch (error) {
      logger.error("Failed to create notification", { error: error.message, userId, type });
      throw error;
    }
  }

  /** Drop channels the user has disabled (preferences failures fall back to "allow"). */
  async filterChannelsByPreferences(userId, type, channels) {
    try {
      const preferences = await NotificationPreferences.getOrCreate(userId);
      const prefKey = { "in-app": "inApp", email: "email", sms: "sms", push: "push" };
      return channels.filter((c) => preferences.shouldSendNotification(type, prefKey[c]));
    } catch (error) {
      logger.warn("Notification preferences unavailable, using requested channels", {
        error: error.message,
        userId,
      });
      return channels;
    }
  }

  async sendEmailNotification(notification) {
    return deliverNotification(notification, { channels: ["email"] });
  }

  async sendSmsNotification(notification) {
    return deliverNotification(notification, { channels: ["sms"] });
  }

  async sendPushNotification(notification) {
    return deliverNotification(notification, { channels: ["push"] });
  }

  async updateNotification(id, updates = {}) {
    const allowed = ["title", "message", "priority", "actionUrl", "actionText", "data", "isArchived", "scheduledFor", "expiresAt", "category"];
    const $set = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) $set[key] = updates[key];
    }
    if ($set.priority === "medium") $set.priority = "normal";
    const notification = await Notification.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true });
    if (!notification) throw new Error("Notification not found");
    return notification;
  }

  async markAsSent(id, channel = "in-app") {
    const notification = await Notification.findById(id);
    if (!notification) throw new Error("Notification not found");
    notification.recordDelivery(normalizeChannels([channel])[0], "sent");
    return notification.save();
  }

  async markAsDelivered(id, channel = "in-app") {
    const notification = await Notification.findById(id);
    if (!notification) throw new Error("Notification not found");
    notification.recordDelivery(normalizeChannels([channel])[0], "delivered");
    return notification.save();
  }

  async markAsRead(id) {
    const notification = await Notification.findById(id);
    if (!notification) throw new Error("Notification not found");
    return notification.markAsRead();
  }

  async markAsFailed(id, channel, error) {
    const notification = await Notification.findById(id);
    if (!notification) throw new Error("Notification not found");
    if (channel) notification.recordDelivery(normalizeChannels([channel])[0], "failed", error);
    notification.status = "failed";
    notification.error = error || notification.error;
    notification.failedAt = new Date();
    notification.queuedForDelivery = false;
    return notification.save();
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
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      const result = await Notification.deleteMany({ createdAt: { $lt: cutoff }, isRead: true });
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
