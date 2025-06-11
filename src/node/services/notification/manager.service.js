import WebSocket, { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import logger from '../logging/advanced.service.js';
import queueManager from '../queue/manager.service.js';
import config from '../../config/index.js';

class NotificationManagerService {
  constructor() {
    this.subscribers = new Map();
    this.channels = new Map();
    this.isRedisConnected = false;
    
    this.config = {
      types: {
        SYSTEM: 'system',
        USER: 'user',
        EVENT: 'event',
        CHAT: 'chat',
        TRIP: 'trip',
        BUDDY: 'buddy',
        PASSWORD_RESET: 'password_reset'
      },
      priorities: {
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
        URGENT: 3
      },
      retention: {
        read: 7, // days
        unread: 30 // days
      },
      batch: {
        size: 100,
        interval: 60000 // 1 minute
      },
      acknowledgment: {
        timeout: 30000, // 30 seconds
        retries: 3
      }
    };

    this.stats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      pending: 0
    };

    // Add acknowledgment tracking
    this.pendingAcks = new Map();
    
    // Add batch queue
    this.batchQueue = [];
    
    this.setupRedis();
    this.initialize();
  }

  async setupRedis() {
    try {
      this.redis = new Redis(config.redis.url, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 500, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isRedisConnected = true;
      });

      this.redis.on('error', (error) => {
        logger.error('Redis connection error:', error);
        this.isRedisConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis connection closed');
        this.isRedisConnected = false;
      });

    } catch (error) {
      logger.error('Failed to setup Redis:', error);
      this.isRedisConnected = false;
    }
  }

  async initialize() {
    try {
      // Initialize WebSocket server
      this.wss = new WebSocketServer({ 
        noServer: true,
        handleProtocols: (protocols, req) => {
          // Accept any protocol or return false to reject
          return protocols[0];
        }
      });
      
      this.setupWebSocketHandlers();

      // Initialize notification queue
      queueManager.registerProcessor(
        'notifications',
        this.processNotificationQueue.bind(this)
      );

      // Start cleanup job
      this.startCleanupJob();

      // Start batch processing
      this.startBatchProcessor();

      logger.info('Notification service initialized successfully');
    } catch (error) {
      logger.error('Notification service initialization failed:', error);
      throw error;
    }
  }

  async storeNotification(notification) {
    if (!this.isRedisConnected) {
      logger.error('Redis is not connected. Cannot store notification.');
      return false;
    }

    try {
      const key = `notifications:${notification.userId}`;
      await this.redis.zadd(key, notification.timestamp, JSON.stringify(notification));
      return true;
    } catch (error) {
      logger.error('Failed to store notification:', error);
      return false;
    }
  }

  async sendNotification(notification) {
    try {
      const { userId, type, message, priority = 'LOW', data = {} } = notification;

      const notificationData = {
        id: crypto.randomUUID(),
        userId,
        type,
        message,
        priority: this.config.priorities[priority],
        data,
        timestamp: Date.now(),
        status: 'pending',
        read: false
      };

      // Store notification if Redis is connected
      const stored = await this.storeNotification(notificationData);

      // Send to connected user if online
      const delivered = await this.deliverNotification(notificationData);

      // Queue for delivery if user is offline and storage was successful
      if (!delivered && stored) {
        await queueManager.addJob('notifications', notificationData);
        this.stats.pending++;
      }

      if (delivered || stored) {
        this.stats.sent++;
        return notificationData;
      }

      throw new Error('Failed to process notification');
    } catch (error) {
      logger.error('Notification sending failed:', error);
      this.stats.failed++;
      throw error;
    }
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      try {
        const userId = this.extractUserId(req);
        if (!userId) {
          ws.close(4001, 'Unauthorized');
          return;
        }

        this.subscribers.set(userId, ws);

        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            await this.handleWebSocketMessage(userId, data);
          } catch (error) {
            logger.error('WebSocket message handling failed:', error);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Failed to process message' 
            }));
          }
        });

        ws.on('close', () => {
          this.subscribers.delete(userId);
        });

        ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          this.subscribers.delete(userId);
        });

        // Send connection confirmation
        ws.send(JSON.stringify({ 
          type: 'connection_established',
          userId 
        }));

        // Send pending notifications
        if (this.isRedisConnected) {
          this.sendPendingNotifications(userId);
        }
      } catch (error) {
        logger.error('Error in WebSocket connection handler:', error);
        ws.close(4000, 'Internal Server Error');
      }
    });
  }

  async deliverNotification(notification) {
    const subscriber = this.subscribers.get(notification.userId);
    if (subscriber && subscriber.readyState === WebSocket.OPEN) {
      try {
        subscriber.send(JSON.stringify(notification));
        this.stats.delivered++;
        return true;
      } catch (error) {
        logger.error('Notification delivery failed:', error);
        return false;
      }
    }
    return false;
  }

  async handleWebSocketMessage(userId, data) {
    try {
      switch (data.action) {
        case 'mark_read':
          await this.markNotificationRead(userId, data.notificationId);
          break;
        case 'subscribe':
          await this.subscribeToChannel(userId, data.channel);
          break;
        case 'unsubscribe':
          await this.unsubscribeFromChannel(userId, data.channel);
          break;
        case 'ack':
          this.handleNotificationAck(userId, data.notificationId);
          break;
        case 'mark_all_read':
          await this.markAllNotificationsRead(userId);
          break;
        default:
          throw new Error(`Unknown action: ${data.action}`);
      }

      // Send success response
      const subscriber = this.subscribers.get(userId);
      if (subscriber && subscriber.readyState === WebSocket.OPEN) {
        subscriber.send(JSON.stringify({
          type: 'action_response',
          action: data.action,
          success: true
        }));
      }
    } catch (error) {
      logger.error(`Failed to handle WebSocket message from user ${userId}:`, error);
      
      // Send error response
      const subscriber = this.subscribers.get(userId);
      if (subscriber && subscriber.readyState === WebSocket.OPEN) {
        subscriber.send(JSON.stringify({
          type: 'action_response',
          action: data.action,
          success: false,
          error: error.message
        }));
      }
    }
  }

  async markNotificationRead(userId, notificationId) {
    const key = `notifications:${userId}`;
    const notifications = await this.redis.zrange(key, 0, -1);
    
    for (const notification of notifications) {
      const parsed = JSON.parse(notification);
      if (parsed.id === notificationId) {
        parsed.read = true;
        await this.redis.zrem(key, notification);
        await this.redis.zadd(key, parsed.timestamp, JSON.stringify(parsed));
        break;
      }
    }
  }

  extractUserId(req) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        logger.warn('No token provided in WebSocket request');
        return null;
      }

      // Verify the WebSocket token
      // const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const decoded = jwt.verify(token, config.jwt.secret);
      
      if (!decoded || !decoded.userId || decoded.type !== 'ws') {
        logger.warn('Invalid WebSocket token');
        return null;
      }

      return decoded.userId;
    } catch (error) {
      logger.error('Failed to extract user ID:', error);
      return null;
    }
  }

  generateWSToken(userId) {
    try {
      // Generate a short-lived token specifically for WebSocket connection
      const wsToken = jwt.sign(
        { 
          userId,
          type: 'ws' // Add a type to distinguish WS tokens
        },
        // process.env.JWT_ACCESS_SECRET,
        config.jwt.secret,
        { 
          expiresIn: '1h' // WebSocket tokens expire in 1 hour
        }
      );

      return wsToken;
    } catch (error) {
      logger.error('Failed to generate WebSocket token:', error);
      throw error;
    }
  }

  async markAllNotificationsRead(userId) {
    const key = `notifications:${userId}`;
    await this.redis.zremrangebyscore(key, 0, Date.now());
  }

  async subscribeToChannel(userId, channel) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel).add(userId);
  }

  async unsubscribeFromChannel(userId, channel) {
    if (this.channels.has(channel)) {
      this.channels.get(channel).delete(userId);
    }
  }

  async sendPendingNotifications(userId) {
    const key = `notifications:${userId}`;
    const notifications = await this.redis.zrange(key, 0, -1);
    
    for (const notification of notifications) {
      const parsed = JSON.parse(notification);
      if (!parsed.read) {
        await this.deliverNotification(parsed);
      }
    }
  }

  async processNotificationQueue(job) {
    try {
      const notification = job.data;
      const delivered = await this.deliverNotification(notification);
      
      if (delivered) {
        this.stats.pending--;
      } else {
        // Requeue with backoff if user is still offline
        await queueManager.addJob('notifications', notification, {
          delay: 5 * 60 * 1000 // 5 minutes
        });
      }
    } catch (error) {
      logger.error('Notification queue processing failed:', error);
      throw error;
    }
  }

  startCleanupJob() {
    setInterval(async () => {
      try {
        const now = Date.now();
        const readCutoff = now - (this.config.retention.read * 24 * 60 * 60 * 1000);
        const unreadCutoff = now - (this.config.retention.unread * 24 * 60 * 60 * 1000);

        const keys = await this.redis.keys('notifications:*');
        for (const key of keys) {
          await this.redis.zremrangebyscore(key, 0, readCutoff);
          await this.redis.zremrangebyscore(key, 0, unreadCutoff);
        }
      } catch (error) {
        logger.error('Notification cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  async getNotifications(userId, options = {}) {
    const {
      unreadOnly = false,
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      type,
      priority,
      channel
    } = options;

    if (!this.isRedisConnected) {
      throw new Error('Redis is not connected');
    }

    const key = `notifications:${userId}`;
    let notifications = await this.redis.zrange(key, 0, -1);
    
    notifications = notifications
      .map(n => JSON.parse(n))
      .filter(n => {
        if (unreadOnly && n.read) return false;
        if (startDate && n.timestamp < startDate) return false;
        if (endDate && n.timestamp > endDate) return false;
        if (type && n.type !== type) return false;
        if (priority && n.priority !== this.config.priorities[priority]) return false;
        if (channel && n.channel !== channel) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    const total = notifications.length;
    notifications = notifications.slice(offset, offset + limit);

    return {
      notifications,
      pagination: {
        total,
        offset,
        limit,
        hasMore: total > offset + limit
      }
    };
  }

  async getNotificationStats() {
    return {
      ...this.stats,
      activeSubscribers: this.subscribers.size,
      channels: Array.from(this.channels.entries()).map(([name, subscribers]) => ({
        name,
        subscribers: subscribers.size
      })),
      config: {
        types: this.config.types,
        priorities: this.config.priorities,
        retention: this.config.retention
      }
    };
  }

  async deleteNotification(userId, notificationId) {
    const key = `notifications:${userId}`;
    await this.redis.zrem(key, notificationId);
  }

  async sendBatchNotifications(notifications) {
    try {
      const results = await Promise.allSettled(
        notifications.map(notification => this.sendNotification(notification))
      );

      return results.map((result, index) => ({
        notification: notifications[index],
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason.message : null
      }));
    } catch (error) {
      logger.error('Batch notification sending failed:', error);
      throw error;
    }
  }

  async sendChannelNotification(channel, notification) {
    if (!this.channels.has(channel)) {
      logger.warn(`Channel ${channel} does not exist`);
      return false;
    }

    const subscribers = this.channels.get(channel);
    const results = [];

    for (const userId of subscribers) {
      try {
        const notificationWithUser = {
          ...notification,
          userId,
          channel
        };
        
        const result = await this.sendNotification(notificationWithUser);
        results.push({ userId, success: true, result });
      } catch (error) {
        logger.error(`Failed to send notification to user ${userId} in channel ${channel}:`, error);
        results.push({ userId, success: false, error: error.message });
      }
    }

    return results;
  }

  queueNotification(notification) {
    this.batchQueue.push(notification);
    
    if (this.batchQueue.length >= this.config.batch.size) {
      this.processBatchQueue();
    }
  }

  async processBatchQueue() {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.config.batch.size);
    try {
      await this.sendBatchNotifications(batch);
    } catch (error) {
      logger.error('Failed to process batch queue:', error);
      // Requeue failed notifications
      this.batchQueue.unshift(...batch);
    }
  }

  startBatchProcessor() {
    setInterval(() => {
      this.processBatchQueue();
    }, this.config.batch.interval);
  }

  async sendNotificationWithAck(notification) {
    const notificationId = crypto.randomUUID();
    const ackTimeout = setTimeout(() => {
      this.handleAckTimeout(notificationId, notification);
    }, this.config.acknowledgment.timeout);

    this.pendingAcks.set(notificationId, {
      notification,
      timeout: ackTimeout,
      retries: 0
    });

    try {
      await this.sendNotification({
        ...notification,
        id: notificationId,
        requireAck: true
      });
      
      return notificationId;
    } catch (error) {
      clearTimeout(ackTimeout);
      this.pendingAcks.delete(notificationId);
      throw error;
    }
  }

  handleAckTimeout(notificationId, notification) {
    const pending = this.pendingAcks.get(notificationId);
    if (!pending) return;

    if (pending.retries < this.config.acknowledgment.retries) {
      // Retry sending
      pending.retries++;
      this.sendNotification({
        ...notification,
        id: notificationId,
        requireAck: true
      });
      
      // Set new timeout
      pending.timeout = setTimeout(() => {
        this.handleAckTimeout(notificationId, notification);
      }, this.config.acknowledgment.timeout);
      
      this.pendingAcks.set(notificationId, pending);
    } else {
      // Max retries reached
      this.pendingAcks.delete(notificationId);
      logger.error(`Notification ${notificationId} was not acknowledged after ${this.config.acknowledgment.retries} retries`);
    }
  }

  handleNotificationAck(userId, notificationId) {
    const pending = this.pendingAcks.get(notificationId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingAcks.delete(notificationId);
      logger.info(`Notification ${notificationId} acknowledged by user ${userId}`);
    }
  }
}

export default new NotificationManagerService(); 