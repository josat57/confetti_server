const MobileDevice = require('../models/mobile-device.model');
const admin = require('firebase-admin');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const apn = require('apn');

class MobileService {
  constructor() {
    // Initialize Firebase Admin SDK
    if (process.env.FIREBASE_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIALS))
      });
    }

    // Initialize Apple Push Notification service
    if (process.env.APN_KEY_PATH) {
      this.apnProvider = new apn.Provider({
        token: {
          key: process.env.APN_KEY_PATH,
          keyId: process.env.APN_KEY_ID,
          teamId: process.env.APN_TEAM_ID
        },
        production: process.env.NODE_ENV === 'production'
      });
    }
  }

  // Register a new mobile device
  async registerDevice(userId, deviceData) {
    try {
      const device = await MobileDevice.create({
        user: userId,
        ...deviceData
      });

      logger.info(`New device registered: ${device.deviceId}`);
      return device;
    } catch (error) {
      logger.error('Error registering device:', error);
      throw new AppError('Failed to register device', 500);
    }
  }

  // Get device by ID
  async getDevice(deviceId, userId) {
    try {
      const device = await MobileDevice.findOne({
        deviceId,
        user: userId
      });

      if (!device) {
        throw new AppError('Device not found', 404);
      }

      return device;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting device:', error);
      throw new AppError('Failed to get device', 500);
    }
  }

  // Get all devices for a user
  async getUserDevices(userId) {
    try {
      return await MobileDevice.find({ user: userId });
    } catch (error) {
      logger.error('Error getting user devices:', error);
      throw new AppError('Failed to get user devices', 500);
    }
  }

  // Update device
  async updateDevice(deviceId, userId, updates) {
    try {
      const device = await this.getDevice(deviceId, userId);
      Object.assign(device, updates);
      await device.save();
      return device;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating device:', error);
      throw new AppError('Failed to update device', 500);
    }
  }

  // Delete device
  async deleteDevice(deviceId, userId) {
    try {
      const device = await this.getDevice(deviceId, userId);
      await device.remove();
      return { message: 'Device deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting device:', error);
      throw new AppError('Failed to delete device', 500);
    }
  }

  // Update device location
  async updateLocation(deviceId, userId, coordinates) {
    try {
      const device = await this.getDevice(deviceId, userId);
      await device.updateLocation(coordinates);
      return device;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating device location:', error);
      throw new AppError('Failed to update device location', 500);
    }
  }

  // Update device metadata
  async updateMetadata(deviceId, userId, metadata) {
    try {
      const device = await this.getDevice(deviceId, userId);
      await device.updateMetadata(metadata);
      return device;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating device metadata:', error);
      throw new AppError('Failed to update device metadata', 500);
    }
  }

  // Update push token
  async updatePushToken(deviceId, userId, token, type) {
    try {
      const device = await this.getDevice(deviceId, userId);
      await device.updatePushToken(token, type);
      return device;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating push token:', error);
      throw new AppError('Failed to update push token', 500);
    }
  }

  // Send push notification
  async sendPushNotification(userId, notification) {
    try {
      const devices = await this.getUserDevices(userId);
      const results = [];

      for (const device of devices) {
        if (!device.preferences.notifications.enabled) continue;

        let result;
        switch (device.deviceType) {
          case 'android':
            result = await this.sendFCMNotification(device, notification);
            break;
          case 'ios':
            result = await this.sendAPNSNotification(device, notification);
            break;
          default:
            result = await this.sendGenericPushNotification(device, notification);
        }

        results.push({
          deviceId: device.deviceId,
          success: result.success,
          error: result.error
        });
      }

      return results;
    } catch (error) {
      logger.error('Error sending push notification:', error);
      throw new AppError('Failed to send push notification', 500);
    }
  }

  // Send FCM notification
  async sendFCMNotification(device, notification) {
    try {
      if (!device.fcmToken) {
        return { success: false, error: 'No FCM token' };
      }

      const message = {
        token: device.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: notification.channelId || 'default',
            sound: notification.sound || 'default',
            clickAction: notification.clickAction
          }
        }
      };

      const response = await admin.messaging().send(message);
      return { success: true, response };
    } catch (error) {
      logger.error('Error sending FCM notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send APNS notification
  async sendAPNSNotification(device, notification) {
    try {
      if (!device.apnsToken) {
        return { success: false, error: 'No APNS token' };
      }

      const apnNotification = new apn.Notification();
      apnNotification.expiry = Math.floor(Date.now() / 1000) + 3600;
      apnNotification.badge = notification.badge || 1;
      apnNotification.sound = notification.sound || 'default';
      apnNotification.alert = {
        title: notification.title,
        body: notification.body
      };
      apnNotification.topic = process.env.APN_BUNDLE_ID;
      apnNotification.payload = notification.data || {};

      const response = await this.apnProvider.send(apnNotification, device.apnsToken);
      return { success: true, response };
    } catch (error) {
      logger.error('Error sending APNS notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send generic push notification
  async sendGenericPushNotification(device, notification) {
    try {
      if (!device.pushToken) {
        return { success: false, error: 'No push token' };
      }

      // Implement generic push notification logic here
      return { success: true };
    } catch (error) {
      logger.error('Error sending generic push notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Get nearby devices
  async getNearbyDevices(userId, coordinates, maxDistance = 1000) {
    try {
      return await MobileDevice.find({
        user: { $ne: userId },
        'location.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates
            },
            $maxDistance: maxDistance
          }
        }
      });
    } catch (error) {
      logger.error('Error getting nearby devices:', error);
      throw new AppError('Failed to get nearby devices', 500);
    }
  }

  // Get device analytics
  async getDeviceAnalytics(userId) {
    try {
      const devices = await this.getUserDevices(userId);
      const analytics = {
        totalDevices: devices.length,
        activeDevices: devices.filter(d => d.isOnline).length,
        deviceTypes: {
          ios: devices.filter(d => d.deviceType === 'ios').length,
          android: devices.filter(d => d.deviceType === 'android').length,
          other: devices.filter(d => d.deviceType === 'other').length
        },
        averageSessionDuration: 0,
        notificationStats: {
          enabled: devices.filter(d => d.preferences.notifications.enabled).length,
          disabled: devices.filter(d => !d.preferences.notifications.enabled).length
        }
      };

      // Calculate average session duration
      const sessions = devices.flatMap(d => d.sessions);
      const completedSessions = sessions.filter(s => s.duration);
      if (completedSessions.length > 0) {
        analytics.averageSessionDuration = completedSessions.reduce((acc, s) => acc + s.duration, 0) / completedSessions.length;
      }

      return analytics;
    } catch (error) {
      logger.error('Error getting device analytics:', error);
      throw new AppError('Failed to get device analytics', 500);
    }
  }
}

module.exports = new MobileService(); 