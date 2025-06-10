const MobileDevice = require('../models/mobile-device.model');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

// Check device security
exports.checkDeviceSecurity = async (req, res, next) => {
  try {
    const deviceId = req.headers['x-device-id'];
    if (!deviceId) {
      throw new AppError('Device ID is required', 400);
    }

    const device = await MobileDevice.findOne({ deviceId });
    if (!device) {
      throw new AppError('Device not found', 404);
    }

    // Check if device is blocked
    if (device.isBlocked()) {
      throw new AppError('Device is blocked', 403);
    }

    // Check security score
    if (device.security.securityScore < 30) {
      throw new AppError('Device security score is too low', 403);
    }

    // Check for security issues
    if (device.security.isJailbroken || device.security.isEmulator || device.security.isDebuggerAttached) {
      logger.warn(`Security issues detected for device ${deviceId}`, {
        isJailbroken: device.security.isJailbroken,
        isEmulator: device.security.isEmulator,
        isDebuggerAttached: device.security.isDebuggerAttached
      });
    }

    // Attach device to request
    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
};

// Validate device session
exports.validateDeviceSession = async (req, res, next) => {
  try {
    const token = req.headers['x-device-token'];
    if (!token) {
      throw new AppError('Device token is required', 400);
    }

    const device = await MobileDevice.findByToken(token);
    if (!device) {
      throw new AppError('Invalid device token', 401);
    }

    // Validate session
    if (!device.validateSession(token)) {
      throw new AppError('Device session expired', 401);
    }

    // Attach device to request
    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
};

// Check device permissions
exports.checkDevicePermissions = (requiredPermissions = []) => {
  return async (req, res, next) => {
    try {
      const device = req.device;
      if (!device) {
        throw new AppError('Device not found', 404);
      }

      // Check if device has required permissions
      const hasPermissions = requiredPermissions.every(permission => {
        switch (permission) {
          case 'location':
            return device.preferences.location;
          case 'notifications':
            return device.preferences.notifications;
          default:
            return false;
        }
      });

      if (!hasPermissions) {
        throw new AppError('Device does not have required permissions', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Rate limit by device
exports.deviceRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100 // limit each device to 100 requests per windowMs
  } = options;

  const deviceRequests = new Map();

  return (req, res, next) => {
    const device = req.device;
    if (!device) {
      return next(new AppError('Device not found', 404));
    }

    const now = Date.now();
    const deviceKey = device.deviceId;

    if (!deviceRequests.has(deviceKey)) {
      deviceRequests.set(deviceKey, {
        count: 0,
        resetTime: now + windowMs
      });
    }

    const deviceData = deviceRequests.get(deviceKey);

    if (now > deviceData.resetTime) {
      deviceData.count = 0;
      deviceData.resetTime = now + windowMs;
    }

    deviceData.count += 1;

    if (deviceData.count > max) {
      return next(new AppError('Too many requests from this device', 429));
    }

    next();
  };
};

// Log device activity
exports.logDeviceActivity = async (req, res, next) => {
  try {
    const device = req.device;
    if (!device) {
      return next();
    }

    // Update device metadata
    device.metadata = {
      ...device.metadata,
      appState: req.headers['x-app-state'] || 'foreground',
      networkType: req.headers['x-network-type'],
      batteryLevel: parseFloat(req.headers['x-battery-level']),
      isCharging: req.headers['x-is-charging'] === 'true',
      memoryUsage: parseFloat(req.headers['x-memory-usage'])
    };

    // Update security score
    device.updateSecurityScore();

    await device.save();
    next();
  } catch (error) {
    next(error);
  }
}; 