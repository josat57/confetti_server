import Notification from '../models/notification.model.js';
import AppError from '../utils/AppError.js';

class NotificationService {
  async createNotification(notificationData) {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  }

  async getNotificationById(id) {
    const notification = await Notification.findById(id);
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }
    return notification;
  }

  async updateNotification(id, updateData) {
    const notification = await Notification.findByIdAndUpdate(id, updateData, { new: true });
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }
    return notification;
  }

  async listNotifications(filter = {}) {
    return await Notification.find(filter);
  }
}

export default new NotificationService(); 