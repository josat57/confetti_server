import Redis from "ioredis";
import { logger } from "../utils/logger.js";

const redisOptions = {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  showFriendlyErrorStack: process.env.NODE_ENV === "development",
};

// REDIS_URL (redis://[user:pass@]host:port[/db]) when set — e.g. a Render
// Key Value internal URL; otherwise the separate REDIS_HOST/PORT/... settings
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, redisOptions)
  : new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      ...redisOptions,
    });

// Handle Redis events
redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

redis.on("error", (error) => {
  logger.error("Redis connection error:", error);
});

redis.on("ready", () => {
  logger.info("Redis client ready");
});

redis.on("reconnecting", () => {
  logger.warn("Redis client reconnecting");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  redis.quit();
});

process.on("SIGINT", () => {
  redis.quit();
});

export default redis;
