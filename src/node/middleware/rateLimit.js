const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');
const AppError = require('../utils/appError');

// Create different rate limiters for different endpoints
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later',
    keyGenerator = (req) => req.ip,
    skip = (req) => false,
    handler = (req, res) => {
      throw new AppError(message, 429);
    }
  } = options;

  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rate-limit:'
    }),
    windowMs,
    max,
    keyGenerator,
    skip,
    handler,
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Device registration limiter
exports.deviceRegistrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 devices per hour
  message: 'Too many device registrations, please try again later'
});

// Push notification limiter
exports.pushNotificationLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 notifications per minute
  message: 'Too many push notifications, please try again later'
});

// Location update limiter
exports.locationUpdateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 updates per minute
  message: 'Too many location updates, please try again later'
});

// General API limiter
exports.apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later'
}); 