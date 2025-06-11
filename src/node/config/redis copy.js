import { createClient } from 'redis';
import { logger } from '../utils/logger.js';

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis connection retries exhausted');
        return new Error('Redis connection retries exhausted');
      }
      logger.info(`Redis reconnection attempt ${retries}`);
      return Math.min(retries * 100, 3000);
    }
  }
};

logger.info('Creating Redis client with config:', { url: redisConfig.url });

const redisClient = createClient(redisConfig);

// Set up event handlers
redisClient.on('connect', () => {
  logger.info('Redis client connected successfully');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error:', err);
});

redisClient.on('reconnecting', () => {
  logger.info('Redis client attempting to reconnect');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready to accept commands');
});

// Initialize Redis connection
let isInitialized = false;

const initializeRedis = async () => {
  if (isInitialized) {
    logger.info('Redis already initialized');
    return;
  }

  try {
    logger.info('Initializing Redis connection...');
    await redisClient.connect();
    isInitialized = true;
    logger.info('Redis client initialized successfully');
  } catch (error) {
    logger.error('Redis connection error:', error);
    throw error;
  }
};

// Initialize Redis immediately
initializeRedis().catch(error => {
  logger.error('Failed to initialize Redis:', error);
  process.exit(1); // Exit if Redis connection fails
});

export const redis = redisClient;

// Helper functions for common Redis operations
export const cacheGet = async (key) => {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis cache get error:', error);
    return null;
  }
};

export const cacheSet = async (key, value, expireSeconds = 3600) => {
  try {
    await redis.set(key, JSON.stringify(value), {
      EX: expireSeconds
    });
    return true;
  } catch (error) {
    logger.error('Redis cache set error:', error);
    return false;
  }
};

export const cacheDelete = async (key) => {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('Redis cache delete error:', error);
    return false;
  }
};

export const cacheFlush = async () => {
  try {
    await redis.flushAll();
    return true;
  } catch (error) {
    logger.error('Redis cache flush error:', error);
    return false;
  }
}; 