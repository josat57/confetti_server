import notificationService from "../services/notification.service.js";
import { AppError } from "../utils/AppError.js";

export const createNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.createNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const getNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.getNotificationById(
      req.params.id
    );
    res.status(200).json(notification);
  } catch (error) {
    next(new AppError(error.message, 404));
  }
};

export const updateNotification = async (req, res, next) => {
  try {
    const notification = await notificationService.updateNotification(
      req.params.id,
      req.body
    );
    res.status(200).json(notification);
  } catch (error) {
    next(new AppError(error.message, 404));
  }
};

export const listNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationService.listNotifications(
      req.query
    );
    res.status(200).json(notifications);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return next(new AppError("User not authenticated", 401));
    }

    const count = await notificationService.getUnreadCount(userId);
    res.status(200).json({
      status: "success",
      data: { unreadCount: count },
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const markAsSent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { channel } = req.body;
    const notification = await notificationService.markAsSent(id, channel);
    res.status(200).json(notification);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const markAsDelivered = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { channel } = req.body;
    const notification = await notificationService.markAsDelivered(id, channel);
    res.status(200).json(notification);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id);
    res.status(200).json(notification);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const markAsFailed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { channel, error } = req.body;
    const notification = await notificationService.markAsFailed(
      id,
      channel,
      error
    );
    res.status(200).json(notification);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const checkNotificationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      data: { notification },
    } = await notificationService.getNotificationById(id);
    const status = {
      isRead: notification.isRead === true || notification.status === "read",
      isDelivered: ["delivered", "read"].includes(notification.status),
      isSent: ["sent", "delivered", "read"].includes(notification.status),
      isFailed: notification.status === "failed",
      isPending: notification.status === "pending",
      isUrgent: notification.priority === "urgent",
      isHighPriority: notification.priority === "high",
      isMediumPriority: notification.priority === "normal",
      isLowPriority: notification.priority === "low",
    };
    res.status(200).json(status);
  } catch (error) {
    next(new AppError(error.message, 404));
  }
};
