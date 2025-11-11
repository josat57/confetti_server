import CacheService from "../services/cache.service.js";
import { RateLimitError } from "../utils/ai-planner-errors.js";
import { logger } from "../utils/logger.js";

/**
 * Rate limiter middleware using Redis
 * @param {string} prefix - Rate limit key prefix
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Function} Express middleware
 */
export function rateLimiter(prefix, maxRequests, windowSeconds) {
  return async (req, res, next) => {
    try {
      // Get client identifier (IP address)
      const clientId = req.ip || req.connection.remoteAddress || "unknown";
      const key = `rate-limit:${prefix}:${clientId}`;

      // Get current count
      const current = await CacheService.increment(key, windowSeconds);

      // Set headers
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, maxRequests - current)
      );
      res.setHeader("X-RateLimit-Reset", Date.now() + windowSeconds * 1000);

      // Check if limit exceeded
      if (current > maxRequests) {
        logger.warn("Rate limit exceeded", {
          clientId,
          prefix,
          current,
          maxRequests,
        });

        throw new RateLimitError(windowSeconds);
      }

      logger.debug("Rate limit check passed", {
        clientId,
        prefix,
        current,
        maxRequests,
      });

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json(error.toJSON());
      }
      next(error);
    }
  };
}

/**
 * Create rate limiter with custom configuration
 * @param {Object} config - Rate limiter configuration
 * @returns {Function} Express middleware
 */
export function createRateLimiter(config) {
  const {
    prefix = "api",
    maxRequests = 100,
    windowSeconds = 60,
    keyGenerator = (req) => req.ip || req.connection.remoteAddress,
  } = config;

  return async (req, res, next) => {
    try {
      const clientId = keyGenerator(req);
      const key = `rate-limit:${prefix}:${clientId}`;

      const current = await CacheService.increment(key, windowSeconds);

      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, maxRequests - current)
      );
      res.setHeader("X-RateLimit-Reset", Date.now() + windowSeconds * 1000);

      if (current > maxRequests) {
        logger.warn("Rate limit exceeded", {
          clientId,
          prefix,
          current,
          maxRequests,
        });

        throw new RateLimitError(windowSeconds);
      }

      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        return res.status(429).json(error.toJSON());
      }
      next(error);
    }
  };
}

export default rateLimiter;
