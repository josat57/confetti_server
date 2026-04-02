import redis from "redis";
import { logger } from "../utils/logger.js";

/**
 * Redis Cache Service
 * Provides caching functionality for frequently accessed data
 */

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hour in seconds
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      if (this.isConnected) {
        return this.client;
      }

      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis max reconnection attempts reached");
              return new Error("Max reconnection attempts reached");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on("error", (err) => {
        logger.error("Redis Client Error:", err);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info("Redis Client Connected");
        this.isConnected = true;
      });

      this.client.on("reconnecting", () => {
        logger.info("Redis Client Reconnecting");
      });

      await this.client.connect();

      return this.client;
    } catch (error) {
      logger.error("Failed to connect to Redis:", error);
      this.isConnected = false;
      // Don't throw error - allow app to run without cache
      return null;
    }
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    try {
      if (!this.isConnected || !this.client) {
        return null;
      }

      const value = await this.client.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Success status
   */
  async del(key) {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * @param {string} pattern - Key pattern (e.g., "user:*")
   * @returns {Promise<number>} - Number of keys deleted
   */
  async delPattern(pattern) {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(keys);
      return keys.length;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Existence status
   */
  async exists(key) {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set expiration time for a key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} - Success status
   */
  async expire(key, ttl) {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to execute if cache miss
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<any>} - Cached or fetched value
   */
  async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
    try {
      // Try to get from cache
      const cached = await this.get(key);
      if (cached !== null) {
        logger.debug(`Cache hit for key: ${key}`);
        return cached;
      }

      // Cache miss - fetch data
      logger.debug(`Cache miss for key: ${key}`);
      const data = await fetchFn();

      // Store in cache
      await this.set(key, data, ttl);

      return data;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}:`, error);
      // On error, just execute the fetch function
      return await fetchFn();
    }
  }

  /**
   * Increment a counter
   * @param {string} key - Cache key
   * @param {number} amount - Amount to increment (default: 1)
   * @returns {Promise<number>} - New value
   */
  async incr(key, amount = 1) {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      if (amount === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrBy(key, amount);
      }
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Increment a counter with TTL (for rate limiting)
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<number>} - New value
   */
  async increment(key, ttl) {
    try {
      if (!this.isConnected || !this.client) {
        return 1; // Return 1 to allow request when Redis is down
      }

      const current = await this.client.incr(key);

      // Set expiration only on first increment
      if (current === 1) {
        await this.client.expire(key, ttl);
      }

      return current;
    } catch (error) {
      logger.error(`Cache increment error for key ${key}:`, error);
      return 1; // Return 1 to allow request on error
    }
  }

  /**
   * Decrement a counter
   * @param {string} key - Cache key
   * @param {number} amount - Amount to decrement (default: 1)
   * @returns {Promise<number>} - New value
   */
  async decr(key, amount = 1) {
    try {
      if (!this.isConnected || !this.client) {
        return 0;
      }

      if (amount === 1) {
        return await this.client.decr(key);
      } else {
        return await this.client.decrBy(key, amount);
      }
    } catch (error) {
      logger.error(`Cache decr error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Flush all cache
   * @returns {Promise<boolean>} - Success status
   */
  async flushAll() {
    try {
      if (!this.isConnected || !this.client) {
        return false;
      }

      await this.client.flushAll();
      logger.info("Cache flushed");
      return true;
    } catch (error) {
      logger.error("Cache flush error:", error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.isConnected = false;
        logger.info("Redis connection closed");
      }
    } catch (error) {
      logger.error("Error closing Redis connection:", error);
    }
  }

  /**
   * Generate cache key for planner data
   * @param {string} plannerId - Planner ID
   * @param {string} type - Data type
   * @param {string} id - Optional resource ID
   * @returns {string} - Cache key
   */
  generateKey(plannerId, type, id = null) {
    if (id) {
      return `planner:${plannerId}:${type}:${id}`;
    }
    return `planner:${plannerId}:${type}`;
  }

  /**
   * Invalidate all cache for a planner
   * @param {string} plannerId - Planner ID
   * @returns {Promise<number>} - Number of keys deleted
   */
  async invalidatePlanner(plannerId) {
    return await this.delPattern(`planner:${plannerId}:*`);
  }

  /**
   * Invalidate cache for specific planner resource type
   * @param {string} plannerId - Planner ID
   * @param {string} type - Resource type
   * @returns {Promise<number>} - Number of keys deleted
   */
  async invalidatePlannerType(plannerId, type) {
    return await this.delPattern(`planner:${plannerId}:${type}:*`);
  }
}

// Create singleton instance
const cacheService = new CacheService();

// Initialize connection
cacheService.connect().catch((error) => {
  logger.error("Failed to initialize cache service:", error);
});

export default cacheService;
