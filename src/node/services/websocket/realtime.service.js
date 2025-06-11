import WebSocket from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import logger from '../logging/advanced.service.js';
import configManager from '../config/manager.service.js';
import errorHandler from '../error/handler.service.js';

class WebSocketRealtimeService extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
    this.redis = null;
    this.pubsub = null;
    this.clients = new Map();
    this.channels = new Map();
    this.heartbeats = new Map();
    
    this.config = {
      server: {
        port: process.env.WS_PORT || 8080,
        path: '/ws',
        maxPayloadSize: 1024 * 1024 // 1MB
      },
      auth: {
        required: true,
        secret: process.env.JWT_SECRET,
        algorithms: ['HS256'],
        timeout: 5000
      },
      redis: {
        enabled: true,
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
        db: process.env.REDIS_DB || 0
      },
      scaling: {
        enabled: true,
        sticky: true,
        adapter: 'redis'
      },
      heartbeat: {
        enabled: true,
        interval: 30000,
        timeout: 60000
      },
      rateLimit: {
        enabled: true,
        windowMs: 60000,
        max: 100,
        message: 'Too many messages, please try again later'
      },
      compression: {
        enabled: true,
        threshold: 1024 // 1KB
      }
    };

    this.stats = {
      connections: {
        total: 0,
        active: 0,
        peak: 0
      },
      messages: {
        sent: 0,
        received: 0,
        dropped: 0
      },
      channels: {
        total: 0,
        active: new Map()
      },
      errors: {
        auth: 0,
        protocol: 0,
        application: 0
      }
    };

    this.initialize();
  }

  async initialize() {
    try {
      // Initialize Redis if enabled
      if (this.config.redis.enabled) {
        await this.initializeRedis();
      }

      // Create WebSocket server
      await this.createServer();

      // Set up event handlers
      this.setupEventHandlers();

      // Start heartbeat if enabled
      if (this.config.heartbeat.enabled) {
        this.startHeartbeat();
      }

      logger.info('WebSocket service initialized successfully');
    } catch (error) {
      logger.error('WebSocket service initialization failed:', error);
      throw error;
    }
  }

  private async initializeRedis() {
    this.redis = new Redis(this.config.redis);
    this.pubsub = new Redis(this.config.redis);

    // Subscribe to Redis channels
    await this.pubsub.subscribe('websocket:broadcast');
    
    this.pubsub.on('message', (channel, message) => {
      try {
        const { event, data, excludeClient } = JSON.parse(message);
        this.broadcast(event, data, excludeClient);
      } catch (error) {
        logger.error('Failed to process Redis message:', error);
      }
    });
  }

  private createServer() {
    const server = http.createServer();
    
    this.wss = new WebSocket.Server({
      server,
      path: this.config.server.path,
      maxPayload: this.config.maxPayloadSize,
      clientTracking: true
    });

    server.listen(this.config.server.port);
    return server;
  }

  private setupEventHandlers() {
    this.wss.on('connection', async (ws, req) => {
      try {
        // Authenticate client
        const client = await this.authenticateClient(req);
        
        // Set up client
        await this.setupClient(ws, client);

        // Handle incoming messages
        this.handleClientMessages(ws, client);

        // Update stats
        this.updateConnectionStats('connect');
      } catch (error) {
        logger.error('Client connection failed:', error);
        ws.close(1008, 'Authentication failed');
        this.stats.errors.auth++;
      }
    });
  }

  private async authenticateClient(req) {
    if (!this.config.auth.required) {
      return { id: req.headers['x-client-id'] || crypto.randomUUID() };
    }

    const token = this.extractToken(req);
    if (!token) {
      throw new Error('Authentication token required');
    }

    try {
      const decoded = await this.verifyToken(token);
      return {
        id: decoded.sub,
        ...decoded
      };
    } catch (error) {
      throw new Error('Invalid authentication token');
    }
  }

  private async setupClient(ws, client) {
    // Store client information
    this.clients.set(ws, {
      id: client.id,
      info: client,
      channels: new Set(),
      connected: Date.now(),
      lastActivity: Date.now()
    });

    // Set up client-specific handlers
    ws.on('close', () => this.handleClientDisconnect(ws));
    ws.on('error', (error) => this.handleClientError(ws, error));
    ws.on('pong', () => this.updateClientHeartbeat(ws));

    // Send welcome message
    this.sendToClient(ws, 'welcome', {
      id: client.id,
      timestamp: Date.now()
    });
  }

  private handleClientMessages(ws, client) {
    ws.on('message', async (data) => {
      try {
        // Rate limiting check
        if (this.isRateLimited(ws)) {
          this.stats.messages.dropped++;
          return;
        }

        // Parse message
        const message = this.parseMessage(data);
        if (!message) return;

        // Update activity timestamp
        this.updateClientActivity(ws);

        // Handle message based on type
        await this.routeMessage(ws, message);

        // Update stats
        this.stats.messages.received++;
      } catch (error) {
        logger.error('Message handling failed:', error);
        this.handleMessageError(ws, error);
      }
    });
  }

  private async routeMessage(ws, message) {
    const { type, event, data, target } = message;

    switch (type) {
      case 'subscribe':
        await this.handleSubscribe(ws, event);
        break;
      case 'unsubscribe':
        await this.handleUnsubscribe(ws, event);
        break;
      case 'publish':
        await this.handlePublish(ws, event, data);
        break;
      case 'direct':
        await this.handleDirectMessage(ws, target, data);
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  async broadcast(event, data, excludeClient = null) {
    try {
      const message = this.formatMessage(event, data);
      
      this.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN &&
            (!excludeClient || this.clients.get(client).id !== excludeClient)) {
          client.send(message);
          this.stats.messages.sent++;
        }
      });

      // Notify other nodes if scaling is enabled
      if (this.config.scaling.enabled && this.redis) {
        await this.redis.publish('websocket:broadcast', JSON.stringify({
          event,
          data,
          excludeClient
        }));
      }
    } catch (error) {
      logger.error('Broadcast failed:', error);
      throw error;
    }
  }

  async sendToClient(ws, event, data) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        const message = this.formatMessage(event, data);
        ws.send(message);
        this.stats.messages.sent++;
      }
    } catch (error) {
      logger.error('Send to client failed:', error);
      throw error;
    }
  }

  private async handleSubscribe(ws, channel) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Add client to channel
    client.channels.add(channel);
    
    // Update channel stats
    let channelStats = this.stats.channels.active.get(channel) || 0;
    this.stats.channels.active.set(channel, channelStats + 1);

    // Notify client
    this.sendToClient(ws, 'subscribed', { channel });
  }

  private async handleUnsubscribe(ws, channel) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Remove client from channel
    client.channels.delete(channel);
    
    // Update channel stats
    let channelStats = this.stats.channels.active.get(channel);
    if (channelStats > 1) {
      this.stats.channels.active.set(channel, channelStats - 1);
    } else {
      this.stats.channels.active.delete(channel);
    }

    // Notify client
    this.sendToClient(ws, 'unsubscribed', { channel });
  }

  private startHeartbeat() {
    setInterval(() => {
      const now = Date.now();
      
      this.wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          const client = this.clients.get(ws);
          if (!client) return;

          // Check last activity
          if (now - client.lastActivity > this.config.heartbeat.timeout) {
            ws.terminate();
            return;
          }

          // Send ping
          ws.ping();
        }
      });
    }, this.config.heartbeat.interval);
  }

  private updateClientHeartbeat(ws) {
    const client = this.clients.get(ws);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  private updateClientActivity(ws) {
    const client = this.clients.get(ws);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  private handleClientDisconnect(ws) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Clean up client channels
    client.channels.forEach(channel => {
      let channelStats = this.stats.channels.active.get(channel);
      if (channelStats > 1) {
        this.stats.channels.active.set(channel, channelStats - 1);
      } else {
        this.stats.channels.active.delete(channel);
      }
    });

    // Remove client
    this.clients.delete(ws);
    this.updateConnectionStats('disconnect');
  }

  private handleClientError(ws, error) {
    logger.error('Client error:', error);
    this.stats.errors.protocol++;
    ws.terminate();
  }

  private updateConnectionStats(type) {
    if (type === 'connect') {
      this.stats.connections.total++;
      this.stats.connections.active++;
      this.stats.connections.peak = Math.max(
        this.stats.connections.peak,
        this.stats.connections.active
      );
    } else if (type === 'disconnect') {
      this.stats.connections.active--;
    }
  }

  private formatMessage(event, data) {
    return JSON.stringify({
      event,
      data,
      timestamp: Date.now()
    });
  }

  private parseMessage(data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      this.stats.errors.protocol++;
      return null;
    }
  }

  private isRateLimited(ws) {
    if (!this.config.rateLimit.enabled) return false;

    const client = this.clients.get(ws);
    if (!client) return true;

    const now = Date.now();
    const messages = client.messages || [];
    
    // Remove old messages
    while (messages.length && messages[0] < now - this.config.rateLimit.windowMs) {
      messages.shift();
    }

    // Check rate limit
    if (messages.length >= this.config.rateLimit.max) {
      return true;
    }

    // Add new message timestamp
    messages.push(now);
    client.messages = messages;
    return false;
  }

  private extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private verifyToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.config.auth.secret, {
        algorithms: this.config.auth.algorithms
      }, (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      });
    });
  }

  getWebSocketStats() {
    return {
      ...this.stats,
      channels: {
        total: this.stats.channels.total,
        active: Array.from(this.stats.channels.active.entries()).map(([name, count]) => ({
          name,
          subscribers: count
        }))
      },
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        channels: Array.from(client.channels),
        connected: client.connected,
        lastActivity: client.lastActivity
      })),
      config: {
        server: {
          port: this.config.server.port,
          path: this.config.server.path
        },
        scaling: {
          enabled: this.config.scaling.enabled,
          adapter: this.config.scaling.adapter
        },
        heartbeat: {
          enabled: this.config.heartbeat.enabled,
          interval: this.config.heartbeat.interval
        },
        rateLimit: {
          enabled: this.config.rateLimit.enabled,
          max: this.config.rateLimit.max,
          windowMs: this.config.rateLimit.windowMs
        }
      }
    };
  }
}

export default new WebSocketRealtimeService(); 