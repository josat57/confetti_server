import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import User from "../models/user.model.js";

/**
 * Security Middleware Collection
 * Implements various security measures for the application
 */

/**
 * Helmet middleware for setting security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

/**
 * Data sanitization against NoSQL injection
 */
export const sanitizeData = mongoSanitize();

/**
 * General rate limiter for all API routes
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later.",
    });
  },
});

/**
 * Strict rate limiter for authentication routes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true,
  message: "Too many authentication attempts, please try again later.",
  handler: (req, res) => {
    logger.warn("Auth rate limit exceeded", {
      ip: req.ip,
      path: req.path,
      email: req.body.email,
    });
    res.status(429).json({
      success: false,
      message:
        "Too many authentication attempts, please try again in 15 minutes.",
    });
  },
});

/**
 * Rate limiter for search endpoints
 */
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Too many search requests, please slow down.",
  handler: (req, res) => {
    logger.warn("Search rate limit exceeded", {
      ip: req.ip,
      userId: req.user?._id,
    });
    res.status(429).json({
      success: false,
      message: "Too many search requests, please try again in a minute.",
    });
  },
});

/**
 * Tier-based rate limiter
 * Adjusts rate limits based on subscription tier
 */
export const tierBasedLimiter = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await User.findById(req.user._id).populate("subscription");

    if (!user || !user.subscription) {
      // Default limits for users without subscription
      req.rateLimit = {
        windowMs: 15 * 60 * 1000,
        max: 50,
      };
      return next();
    }

    // Set limits based on tier
    const tierLimits = {
      Starter: { windowMs: 15 * 60 * 1000, max: 100 },
      Professional: { windowMs: 15 * 60 * 1000, max: 500 },
      Business: { windowMs: 15 * 60 * 1000, max: 1000 },
      Enterprise: { windowMs: 15 * 60 * 1000, max: 5000 },
    };

    req.rateLimit =
      tierLimits[user.subscription.planName] || tierLimits.Starter;

    next();
  } catch (error) {
    logger.error("Tier-based rate limiter error:", error);
    next();
  }
};

/**
 * Verify resource ownership
 * Ensures user can only access their own resources
 */
export const verifyOwnership = (Model, paramName = "id") => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const userId = req.user._id;

      const resource = await Model.findById(resourceId);

      if (!resource) {
        return next(new AppError("Resource not found", 404));
      }

      // Check ownership based on different field names
      const ownerField =
        resource.planner || resource.user || resource.uploadedBy;

      if (!ownerField || ownerField.toString() !== userId.toString()) {
        logger.warn("Unauthorized access attempt", {
          userId,
          resourceId,
          model: Model.modelName,
        });
        return next(
          new AppError(
            "You do not have permission to access this resource",
            403
          )
        );
      }

      // Attach resource to request for use in controller
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Verify role-based permissions
 */
export const verifyRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Unauthorized role access attempt", {
        userId: req.user._id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
};

/**
 * Log security events
 */
export const logSecurityEvent = (eventType, details = {}) => {
  logger.info("Security Event", {
    type: eventType,
    timestamp: new Date(),
    ...details,
  });
};

/**
 * Require re-authentication for sensitive operations
 */
export const requireRecentAuth = (maxAge = 30 * 60 * 1000) => {
  // 30 minutes
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError("Authentication required", 401));
      }

      const user = await User.findById(req.user._id).select("lastLogin");

      if (!user || !user.lastLogin) {
        return next(new AppError("Please log in again", 401));
      }

      const timeSinceLogin = Date.now() - new Date(user.lastLogin).getTime();

      if (timeSinceLogin > maxAge) {
        logger.warn("Re-authentication required", {
          userId: req.user._id,
          timeSinceLogin,
          maxAge,
        });
        return next(
          new AppError(
            "This action requires recent authentication. Please log in again.",
            401
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Track failed authentication attempts
 */
export const trackFailedAuth = async (email, ip) => {
  try {
    logger.warn("Failed authentication attempt", {
      email,
      ip,
      timestamp: new Date(),
    });

    // In production, you might want to:
    // 1. Store in a separate FailedAuth collection
    // 2. Implement IP-based blocking
    // 3. Send alerts after threshold
    // 4. Implement CAPTCHA after multiple failures
  } catch (error) {
    logger.error("Error tracking failed auth:", error);
  }
};

/**
 * Detect suspicious activity
 */
export const detectSuspiciousActivity = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const suspiciousPatterns = [
      // Multiple rapid requests
      {
        check: () => {
          // This would need a more sophisticated implementation
          // with request tracking per user
          return false;
        },
        message: "Unusual request pattern detected",
      },
      // Access from unusual location
      {
        check: () => {
          // Would need geolocation tracking
          return false;
        },
        message: "Access from unusual location",
      },
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.check()) {
        logger.warn("Suspicious activity detected", {
          userId: req.user._id,
          pattern: pattern.message,
          ip: req.ip,
          path: req.path,
        });

        // In production, you might want to:
        // 1. Send email alert to user
        // 2. Require additional verification
        // 3. Temporarily lock account
        // 4. Log to security monitoring system
      }
    }

    next();
  } catch (error) {
    logger.error("Error detecting suspicious activity:", error);
    next();
  }
};

/**
 * Validate session
 */
export const validateSession = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const user = await User.findById(req.user._id).select("lastLogin isActive");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.isActive) {
      return next(new AppError("Account is inactive", 403));
    }

    // Check session timeout (30 minutes)
    const sessionTimeout = 30 * 60 * 1000;
    const timeSinceLogin = Date.now() - new Date(user.lastLogin).getTime();

    if (timeSinceLogin > sessionTimeout) {
      logger.info("Session expired", {
        userId: req.user._id,
        timeSinceLogin,
      });
      return next(new AppError("Session expired. Please log in again.", 401));
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Input validation middleware
 */
export const validateInput = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    next();
  };
};

/**
 * CORS configuration
 */
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000"];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default {
  securityHeaders,
  sanitizeData,
  generalLimiter,
  authLimiter,
  searchLimiter,
  tierBasedLimiter,
  verifyOwnership,
  verifyRole,
  requireRecentAuth,
  trackFailedAuth,
  detectSuspiciousActivity,
  validateSession,
  validateInput,
  corsOptions,
};
