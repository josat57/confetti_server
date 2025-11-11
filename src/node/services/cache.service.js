import redis from "../config/redis.js";
import { logger } from "../utils/logger.js";

class CacheService {
  constructor() {
    this.redis = redis;
  }

  async get(key) {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      logger.error("Cache get error:", { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);

      logger.info("Cache set successful", { key, ttl });
      return true;
    } catch (error) {
      logger.error("Cache set error:", { key, error: error.message });
      return false;
    }
  }

  async delete(key) {
    try {
      await this.redis.del(key);
      logger.info("Cache delete successful", { key });
      return true;
    } catch (error) {
      logger.error("Cache delete error:", { key, error: error.message });
      return false;
    }
  }

  async increment(key, ttl = 3600) {
    try {
      const value = await this.redis.incr(key);

      // Set expiration on first increment
      if (value === 1) {
        await this.redis.expire(key, ttl);
      }

      return value;
    } catch (error) {
      logger.error("Cache increment error:", { key, error: error.message });
      return 0;
    }
  }

  async exists(key) {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error("Cache exists error:", { key, error: error.message });
      return false;
    }
  }

  async getTTL(key) {
    try {
      const ttl = await this.redis.ttl(key);
      return ttl;
    } catch (error) {
      logger.error("Cache TTL error:", { key, error: error.message });
      return -1;
    }
  }
}

export default new CacheService();
