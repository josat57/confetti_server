const mobileService = require('../services/mobile.service');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

// Register a new device
exports.registerDevice = async (req, res, next) => {
  try {
    const device = await mobileService.registerDevice(req.user._id, req.body);
    res.status(201).json({
      status: 'success',
      data: device
    });
  } catch (error) {
    next(error);
  }
};

// Get device by ID
exports.getDevice = async (req, res, next) => {
  try {
    const device = await mobileService.getDevice(req.params.deviceId, req.user._id);
    res.status(200).json({
      status: 'success',
      data: device
    });
  } catch (error) {
    next(error);
  }
};

// Get all user devices
exports.getUserDevices = async (req, res, next) => {
  try {
    const devices = await mobileService.getUserDevices(req.user._id);
    res.status(200).json({
      status: 'success',
      data: devices
    });
  } catch (error) {
    next(error);
  }
};

// Update device
exports.updateDevice = async (req, res, next) => {
  try {
    const device = await mobileService.updateDevice(
      req.params.deviceId,
      req.user._id,
      req.body
    );
    res.status(200).json({
      status: 'success',
      data: device
    });
  } catch (error) {
    next(error);
  }
};

// Delete device
exports.deleteDevice = async (req, res, next) => {
  try {
    await mobileService.deleteDevice(req.params.deviceId, req.user._id);
    res.status(200).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Update device location
exports.updateLocation = async (req, res, next) => {
  try {
    const { coordinates } = req.body;
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      throw new AppError('Invalid coordinates format', 400);
    }

    const device = await mobileService.updateLocation(
      req.params.deviceId,
      req.user._id,
      coordinates
    );
    res.status(200).json({
      status: 'success',
      data: device
    });
  } catch (error) {
    next(error);
  }
};

// Update device metadata
exports.updateMetadata = async (req, res, next) => {
  try {
    const device = await mobileService.updateMetadata(
      req.params.deviceId,
      req.user._id,
      req.body
    );
    res.status(200).json({
      status: 'success',
      data: device
    });
  } catch (error) {
    next(error);
  }
};

// Update push token
exports.updatePushToken = async (req, res, next) => {
  try {
    const { token, type } = req.body;
    if (!token || !type) {
      throw new AppError('Token and type are required', 400);
    }

    const device = await mobileService.updatePushToken(
      req.params.deviceId,
      req.user._id,
      token,
      type
    );
    res.status(200).json({
      status: 'success',
      data: device
    });
  } catch (error) {
    next(error);
  }
};

// Send push notification
exports.sendPushNotification = async (req, res, next) => {
  try {
    const { title, body, data, sound, badge, channelId, clickAction } = req.body;
    if (!title || !body) {
      throw new AppError('Title and body are required', 400);
    }

    const results = await mobileService.sendPushNotification(req.user._id, {
      title,
      body,
      data,
      sound,
      badge,
      channelId,
      clickAction
    });
    res.status(200).json({
      status: 'success',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

// Get nearby devices
exports.getNearbyDevices = async (req, res, next) => {
  try {
    const { coordinates, maxDistance } = req.query;
    if (!coordinates) {
      throw new AppError('Coordinates are required', 400);
    }

    const [longitude, latitude] = coordinates.split(',').map(Number);
    if (isNaN(longitude) || isNaN(latitude)) {
      throw new AppError('Invalid coordinates format', 400);
    }

    const devices = await mobileService.getNearbyDevices(
      req.user._id,
      [longitude, latitude],
      maxDistance ? parseInt(maxDistance, 10) : undefined
    );
    res.status(200).json({
      status: 'success',
      data: devices
    });
  } catch (error) {
    next(error);
  }
};

// Get device analytics
exports.getDeviceAnalytics = async (req, res, next) => {
  try {
    const analytics = await mobileService.getDeviceAnalytics(req.user._id);
    res.status(200).json({
      status: 'success',
      data: analytics
    });
  } catch (error) {
    next(error);
  }
}; 