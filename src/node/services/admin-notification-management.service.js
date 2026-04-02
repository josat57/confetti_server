import Notification from "../models/notification.model.js";
import NotificationPreference from "../models/notificationPreference.model.js";
import NotificationTemplate from "../models/notificationTemplate.model.js";
import PushToken from "../models/pushToken.model.js";
import User from "../models/user.model.js";
import { createError } from "../utils/error.js";
import AuditLog from "../models/auditLog.model.js";

class AdminNotificationManagementService {
  // ==================== Notifications ====================

  async getNotifications(filters = {}) {
    const {
      page = 1,
      limit = 20,
      recipient,
      type,
      category,
      status,
      priority,
      isRead,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const query = {};

    if (recipient) query.recipient = recipient;
    if (type) query.type = type;
    if (category) query.category = category;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (isRead !== undefined) query.isRead = isRead;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate("recipient", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getNotificationById(notificationId) {
    const notification = await Notification.findById(notificationId)
      .populate("recipient", "firstName lastName email phone")
      .lean();

    if (!notification) {
      throw createError("Notification not found", 404);
    }

    return notification;
  }

  async sendNotification(notificationData, adminId) {
    const {
      recipients,
      type,
      category,
      title,
      message,
      data,
      priority,
      actionUrl,
      actionLabel,
      actionText,
      expiresIn,
      expiresAt: expiresAtDate,
      scheduledFor,
      status,
      channels,
    } = notificationData;

    // Handle recipients - can be array of IDs or object with type
    let recipientIds = [];

    if (recipients && typeof recipients === "object" && recipients.type) {
      // Frontend sends {type: "all"} or {type: "role", value: "vendor"}
      const userQuery = {};

      if (recipients.type !== "all") {
        if (recipients.type === "role" && recipients.value) {
          userQuery.role = recipients.value;
        } else if (recipients.type === "users") {
          userQuery.role = "user";
        } else if (recipients.type === "vendors") {
          userQuery.role = "vendor";
        } else if (recipients.type === "event-planners") {
          userQuery.role = "event-planner";
        }
      }

      const users = await User.find(userQuery).select("_id").lean();
      recipientIds = users.map((u) => u._id);
    } else if (Array.isArray(recipients)) {
      recipientIds = recipients;
    } else {
      throw createError("Invalid recipients format", 400);
    }

    // Validate recipients
    if (recipientIds.length === 0) {
      throw createError("No valid recipients found", 400);
    }

    const notifications = [];
    const expiresAt = expiresAtDate
      ? new Date(expiresAtDate)
      : expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    for (const userId of recipientIds) {
      // Check user preferences
      const preference = await NotificationPreference.findOne({ user: userId });

      if (
        preference &&
        !this.shouldSendNotification(preference, type, category)
      ) {
        continue;
      }

      const notification = await Notification.create({
        recipient: userId,
        type,
        category,
        title,
        message,
        data,
        priority: priority || "medium",
        actionUrl,
        actionText: actionLabel || actionText,
        expiresAt,
        scheduledFor: scheduledFor || null,
        status: status || "pending",
        channels: channels || ["in-app"],
      });

      notifications.push(notification);

      // Queue for actual sending (would integrate with email/push/sms services)
      await this.queueNotification(notification);
    }

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "notification_sent",
      resourceType: "notification",
      details: {
        recipientCount: notifications.length,
        type,
        category,
        title,
      },
    });

    return {
      sent: notifications.length,
      notifications,
    };
  }

  async sendBulkNotification(bulkData, adminId) {
    const {
      filters,
      type,
      category,
      title,
      message,
      data,
      priority,
      actionUrl,
      actionText,
      expiresIn,
    } = bulkData;

    // Build user query from filters
    const userQuery = {};
    if (filters.role) userQuery.role = filters.role;
    if (filters.status) userQuery.status = filters.status;
    if (filters.tier) userQuery["subscription.tier"] = filters.tier;

    const users = await User.find(userQuery).select("_id").lean();
    const recipientIds = users.map((u) => u._id);

    return await this.sendNotification(
      {
        recipients: recipientIds,
        type,
        category,
        title,
        message,
        data,
        priority,
        actionUrl,
        actionText,
        expiresIn,
      },
      adminId
    );
  }

  async retryFailedNotification(notificationId, adminId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw createError("Notification not found", 404);
    }

    if (notification.status !== "failed") {
      throw createError("Only failed notifications can be retried", 400);
    }

    notification.status = "pending";
    notification.error = null;
    notification.failedAt = null;
    await notification.save();

    // Queue for retry
    await this.queueNotification(notification);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "retry_notification",
      resource: "Notification",
      resourceId: notificationId,
    });

    return notification;
  }

  async deleteNotification(notificationId, adminId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw createError("Notification not found", 404);
    }

    await Notification.findByIdAndDelete(notificationId);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_notification",
      resource: "Notification",
      resourceId: notificationId,
      details: { recipient: notification.recipient, title: notification.title },
    });

    return { message: "Notification deleted successfully" };
  }

  async getNotificationStatistics(filters = {}) {
    const { startDate, endDate } = filters;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    const [
      totalNotifications,
      byStatus,
      byType,
      byCategory,
      byPriority,
      deliveryRate,
      readRate,
    ] = await Promise.all([
      Notification.countDocuments(dateQuery),
      Notification.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Notification.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Notification.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      Notification.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
      this.calculateDeliveryRate(dateQuery),
      this.calculateReadRate(dateQuery),
    ]);

    return {
      total: totalNotifications,
      byStatus,
      byType,
      byCategory,
      byPriority,
      deliveryRate,
      readRate,
    };
  }

  // ==================== Notification Templates ====================

  async getNotificationTemplates(filters = {}) {
    const { type, category, search, isActive } = filters;

    const query = {};
    if (type) query.type = type;
    if (category) query.category = category;
    if (isActive !== undefined) query.isActive = isActive;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { key: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
      ];
    }

    const templates = await NotificationTemplate.find(query)
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ type: 1, category: 1, name: 1 })
      .lean();

    return templates;
  }

  async getNotificationTemplateByKey(key) {
    const template = await NotificationTemplate.findOne({ key })
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .lean();

    if (!template) {
      throw createError("Notification template not found", 404);
    }

    return template;
  }

  async createNotificationTemplate(templateData, adminId) {
    const {
      name,
      key,
      type,
      category,
      title,
      content,
      variables,
      priority,
      actionUrl,
      actionText,
      expiresIn,
      isActive,
    } = templateData;

    // Check if template already exists
    const existingTemplate = await NotificationTemplate.findOne({ key });
    if (existingTemplate) {
      throw createError(
        "Notification template with this key already exists",
        409
      );
    }

    const template = await NotificationTemplate.create({
      name,
      key,
      type,
      category,
      title,
      content,
      variables,
      priority,
      actionUrl,
      actionText,
      expiresIn,
      isActive,
      createdBy: adminId,
      lastModifiedBy: adminId,
    });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "create_notification_template",
      resource: "NotificationTemplate",
      resourceId: template._id,
      details: { key, name, type, category },
    });

    return template;
  }

  async updateNotificationTemplate(key, updates, adminId) {
    const template = await NotificationTemplate.findOne({ key });

    if (!template) {
      throw createError("Notification template not found", 404);
    }

    if (template.isSystem && !updates.allowSystemUpdate) {
      throw createError("System templates cannot be modified", 403);
    }

    // Update fields
    Object.keys(updates).forEach((field) => {
      if (
        updates[field] !== undefined &&
        field !== "key" &&
        field !== "allowSystemUpdate"
      ) {
        template[field] = updates[field];
      }
    });

    template.lastModifiedBy = adminId;
    await template.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_notification_template",
      resource: "NotificationTemplate",
      resourceId: template._id,
      details: { key, updates },
    });

    return template;
  }

  async deleteNotificationTemplate(key, adminId) {
    const template = await NotificationTemplate.findOne({ key });

    if (!template) {
      throw createError("Notification template not found", 404);
    }

    if (template.isSystem) {
      throw createError("System templates cannot be deleted", 403);
    }

    await NotificationTemplate.deleteOne({ key });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_notification_template",
      resource: "NotificationTemplate",
      resourceId: template._id,
      details: { key, name: template.name },
    });

    return { message: "Notification template deleted successfully" };
  }

  async previewNotificationTemplate(key, variables = {}) {
    const template = await NotificationTemplate.findOne({ key });

    if (!template) {
      throw createError("Notification template not found", 404);
    }

    let title = template.title;
    let content = template.content;

    // Replace variables
    Object.keys(variables).forEach((varName) => {
      const regex = new RegExp(`{{${varName}}}`, "g");
      title = title.replace(regex, variables[varName]);
      content = content.replace(regex, variables[varName]);
    });

    return {
      title,
      content,
      type: template.type,
      category: template.category,
      priority: template.priority,
      actionUrl: template.actionUrl,
      actionText: template.actionText,
      variables: template.variables,
    };
  }

  // ==================== Notification Preferences ====================

  async getUserPreferences(userId) {
    let preference = await NotificationPreference.findOne({
      user: userId,
    }).lean();

    if (!preference) {
      // Create default preferences
      preference = await NotificationPreference.create({ user: userId });
    }

    return preference;
  }

  async updateUserPreferences(userId, updates, adminId) {
    let preference = await NotificationPreference.findOne({ user: userId });

    if (!preference) {
      preference = await NotificationPreference.create({
        user: userId,
        ...updates,
      });
    } else {
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) {
          preference[key] = updates[key];
        }
      });
      await preference.save();
    }

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_notification_preferences",
      resource: "NotificationPreference",
      resourceId: preference._id,
      details: { userId, updates },
    });

    return preference;
  }

  // ==================== Push Tokens ====================

  async getPushTokens(filters = {}) {
    const { userId, platform, isActive } = filters;

    const query = {};
    if (userId) query.user = userId;
    if (platform) query.platform = platform;
    if (isActive !== undefined) query.isActive = isActive;

    const tokens = await PushToken.find(query)
      .populate("user", "firstName lastName email")
      .sort({ lastUsedAt: -1 })
      .lean();

    return tokens;
  }

  async deletePushToken(tokenId, adminId) {
    const token = await PushToken.findById(tokenId);

    if (!token) {
      throw createError("Push token not found", 404);
    }

    await PushToken.findByIdAndDelete(tokenId);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_push_token",
      resource: "PushToken",
      resourceId: tokenId,
      details: { userId: token.user, platform: token.platform },
    });

    return { message: "Push token deleted successfully" };
  }

  // ==================== Helper Methods ====================

  shouldSendNotification(preference, type, category) {
    const typeKey = type === "in_app" ? "inApp" : type;

    if (!preference[typeKey] || !preference[typeKey].enabled) {
      return false;
    }

    if (!preference[typeKey].categories[category]) {
      return false;
    }

    // Check quiet hours
    if (preference.quietHours && preference.quietHours.enabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      if (
        currentTime >= preference.quietHours.startTime ||
        currentTime <= preference.quietHours.endTime
      ) {
        return false;
      }
    }

    return true;
  }

  async queueNotification(notification) {
    // This would integrate with actual notification services
    // For now, just mark as sent
    notification.status = "sent";
    notification.sentAt = new Date();
    await notification.save();
  }

  async calculateDeliveryRate(dateQuery) {
    const total = await Notification.countDocuments(dateQuery);
    const delivered = await Notification.countDocuments({
      ...dateQuery,
      status: { $in: ["delivered", "read"] },
    });

    return total > 0 ? ((delivered / total) * 100).toFixed(2) : 0;
  }

  async calculateReadRate(dateQuery) {
    const total = await Notification.countDocuments(dateQuery);
    const read = await Notification.countDocuments({
      ...dateQuery,
      isRead: true,
    });

    return total > 0 ? ((read / total) * 100).toFixed(2) : 0;
  }
}

export default new AdminNotificationManagementService();
