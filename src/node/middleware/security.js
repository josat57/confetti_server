const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');

// Security headers middleware
exports.securityHeaders = helmet(securityConfig.api.helmet);

// CORS middleware
exports.corsMiddleware = cors(securityConfig.api.cors);

// Rate limiting middleware
exports.rateLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate-limit:'
  }),
  ...securityConfig.rateLimit
});

// Request validation middleware
exports.validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const { error } = schema.validate(req.body);
      if (error) {
        throw new Error(error.details[0].message);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Input sanitization middleware
exports.sanitizeInput = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Remove potentially dangerous characters
          req.body[key] = req.body[key]
            .replace(/[<>]/g, '') // Remove < and >
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
        }
      });
    }

    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = req.query[key]
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Security logging middleware
exports.securityLogging = (req, res, next) => {
  const startTime = Date.now();
  const requestId = crypto.randomBytes(16).toString('hex');

  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    deviceId: req.get('x-device-id')
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      requestId,
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    });
  });

  next();
};

// Error handling middleware
exports.errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log error
  logger.error('Error occurred', {
    requestId: req.id,
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code
    },
    request: {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent')
    }
  });

  // Send error response
  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Security monitoring middleware
exports.securityMonitoring = (req, res, next) => {
  if (!securityConfig.monitoring.enabled) {
    return next();
  }

  const metrics = {
    timestamp: Date.now(),
    path: req.path,
    method: req.method,
    statusCode: res.statusCode,
    responseTime: Date.now() - req._startTime,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };

  // Store metrics in Redis for monitoring
  redis.lpush('security:metrics', JSON.stringify(metrics));
  redis.ltrim('security:metrics', 0, 999); // Keep last 1000 metrics

  // Check for security alerts
  if (metrics.responseTime > 1000) { // Response time > 1s
    logger.warn('High response time detected', metrics);
  }

  next();
};

// Backup middleware
exports.backupMiddleware = async (req, res, next) => {
  if (!securityConfig.backup.enabled) {
    return next();
  }

  try {
    // Create backup of sensitive data
    const backup = {
      timestamp: Date.now(),
      path: req.path,
      method: req.method,
      userId: req.user?._id,
      deviceId: req.get('x-device-id'),
      ip: req.ip
    };

    // Store backup in Redis
    await redis.lpush('security:backups', JSON.stringify(backup));
    await redis.ltrim('security:backups', 0, securityConfig.backup.retention - 1);

    next();
  } catch (error) {
    logger.error('Backup failed', { error });
    next();
  }
};

// Security check middleware
exports.securityCheck = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /<script>/i, // XSS attempts
    /javascript:/i, // JavaScript protocol
    /on\w+=/i, // Event handlers
    /union\s+select/i, // SQL injection
    /exec\s+xp_/i, // SQL injection
    /eval\s*\(/i, // Code execution
    /document\.cookie/i, // Cookie theft
    /document\.write/i, // DOM manipulation
    /window\.location/i // Redirect attempts
  ];

  const checkString = JSON.stringify(req.body) + JSON.stringify(req.query) + req.path;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      logger.warn('Suspicious pattern detected', {
        pattern: pattern.toString(),
        request: {
          method: req.method,
          path: req.path,
          body: req.body,
          query: req.query
        }
      });
      return res.status(403).json({
        status: 'error',
        message: 'Suspicious request detected'
      });
    }
  }

  next();
}; 