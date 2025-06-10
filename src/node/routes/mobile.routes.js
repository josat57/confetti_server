const express = require("express"); const mobileController = require("../controllers/mobile.controller"); const { protect } = require("../middleware/auth"); const { validate } = require("../middleware/validate"); const {
  checkDeviceSecurity,
  validateDeviceSession,
  checkDevicePermissions,
  deviceRateLimit,
  logDeviceActivity
} = require('../middleware/deviceSecurity');
const {
  deviceRegistrationLimiter,
  pushNotificationLimiter,
  locationUpdateLimiter,
  apiLimiter
} = require('../middleware/rateLimit');
const Joi = require("joi"); const router = express.Router();

// Validation schemas
const registerDeviceSchema = Joi.object({
  deviceId: Joi.string().required(),
  name: Joi.string().required(),
  model: Joi.string().required(),
  platform: Joi.string().valid('ios', 'android').required(),
  osVersion: Joi.string().required(),
  appVersion: Joi.string().required(),
  pushToken: Joi.string(),
  pushType: Joi.string().valid('fcm', 'apns'),
  preferences: Joi.object({
    notifications: Joi.boolean(),
    location: Joi.boolean(),
    theme: Joi.string().valid('light', 'dark', 'system')
  })
});

const updateDeviceSchema = Joi.object({
  name: Joi.string(),
  preferences: Joi.object({
    notifications: Joi.boolean(),
    location: Joi.boolean(),
    theme: Joi.string().valid('light', 'dark', 'system')
  })
});

const updateLocationSchema = Joi.object({
  coordinates: Joi.array().items(Joi.number()).length(2).required()
});

const updatePushTokenSchema = Joi.object({
  token: Joi.string().required(),
  type: Joi.string().valid('fcm', 'apns').required()
});

const pushNotificationSchema = Joi.object({
  title: Joi.string().required(),
  body: Joi.string().required(),
  data: Joi.object(),
  sound: Joi.string(),
  badge: Joi.number().integer().min(0),
  channelId: Joi.string(),
  clickAction: Joi.string()
});

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(protect);

// Device registration route with specific rate limiting
router.post(
  '/devices',
  deviceRegistrationLimiter,
  validate(registerDeviceSchema),
  mobileController.registerDevice
);

// Device management routes with security checks
router.get(
  '/devices',
  checkDeviceSecurity,
  validateDeviceSession,
  mobileController.getUserDevices
);

router.get(
  '/devices/:deviceId',
  checkDeviceSecurity,
  validateDeviceSession,
  mobileController.getDevice
);

router.patch(
  '/devices/:deviceId',
  checkDeviceSecurity,
  validateDeviceSession,
  validate(updateDeviceSchema),
  mobileController.updateDevice
);

router.delete(
  '/devices/:deviceId',
  checkDeviceSecurity,
  validateDeviceSession,
  mobileController.deleteDevice
);

// Location routes with specific rate limiting and permission checks
router.patch(
  '/devices/:deviceId/location',
  checkDeviceSecurity,
  validateDeviceSession,
  checkDevicePermissions(['location']),
  locationUpdateLimiter,
  validate(updateLocationSchema),
  logDeviceActivity,
  mobileController.updateLocation
);

router.patch(
  '/devices/:deviceId/metadata',
  checkDeviceSecurity,
  validateDeviceSession,
  logDeviceActivity,
  mobileController.updateMetadata
);

// Push notification routes with specific rate limiting and permission checks
router.patch(
  '/devices/:deviceId/push-token',
  checkDeviceSecurity,
  validateDeviceSession,
  checkDevicePermissions(['notifications']),
  validate(updatePushTokenSchema),
  mobileController.updatePushToken
);

router.post(
  '/notifications',
  checkDeviceSecurity,
  validateDeviceSession,
  checkDevicePermissions(['notifications']),
  pushNotificationLimiter,
  validate(pushNotificationSchema),
  mobileController.sendPushNotification
);

// Analytics and discovery routes with security checks
router.get(
  '/devices/nearby',
  checkDeviceSecurity,
  validateDeviceSession,
  checkDevicePermissions(['location']),
  deviceRateLimit({ max: 30 }), // Limit nearby device queries
  mobileController.getNearbyDevices
);

router.get(
  '/analytics',
  checkDeviceSecurity,
  validateDeviceSession,
  deviceRateLimit({ max: 10 }), // Limit analytics queries
  mobileController.getDeviceAnalytics
);

module.exports = router;
