import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import logger from '../logger.service.js';
import cacheService from '../cache.service.js';

class WebSocketSecurityService {
  constructor() {
    this.connections = new Map();
    this.blacklist = new Set();
    this.rateLimits = new Map();
    
    this.thresholds = {
      maxConnectionsPerIp: 5,
      messageRateLimit: 50, // messages per minute
      maxPayloadSize: 1024 * 100, // 100KB
      tokenExpiry: 3600 // 1 hour
    };
  }

  async authenticateConnection(token, ip) {
    try {
      // Check IP blacklist
      if (this.blacklist.has(ip)) {
        return { authenticated: false, reason: 'IP_BLACKLISTED' };
      }

      // Check connection limit
      if (!this.checkConnectionLimit(ip)) {
        return { authenticated: false, reason: 'CONNECTION_LIMIT_EXCEEDED' };
      }

      // Verify token
      const decoded = await this.verifyToken(token);
      if (!decoded) {
        return { authenticated: false, reason: 'INVALID_TOKEN' };
      }

      // Generate connection ID
      const connectionId = crypto.randomUUID();
      
      // Store connection details
      this.connections.set(connectionId, {
        userId: decoded.userId,
        ip,
        connectedAt: Date.now(),
        messageCount: 0,
        lastMessageTime: Date.now()
      });

      return {
        authenticated: true,
        connectionId,
        userId: decoded.userId
      };
    } catch (error) {
      logger.error('WebSocket authentication error:', error);
      return { authenticated: false, reason: 'AUTHENTICATION_ERROR' };
    }
  }

  async validateMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { valid: false, reason: 'INVALID_CONNECTION' };
    }

    try {
      // Check rate limit
      if (!this.checkMessageRateLimit(connectionId)) {
        return { valid: false, reason: 'RATE_LIMIT_EXCEEDED' };
      }

      // Check payload size
      if (Buffer.byteLength(JSON.stringify(message)) > this.thresholds.maxPayloadSize) {
        return { valid: false, reason: 'PAYLOAD_TOO_LARGE' };
      }

      // Validate message structure
      if (!this.validateMessageStructure(message)) {
        return { valid: false, reason: 'INVALID_MESSAGE_STRUCTURE' };
      }

      // Update connection stats
      connection.messageCount++;
      connection.lastMessageTime = Date.now();

      return { valid: true };
    } catch (error) {
      logger.error('Message validation error:', error);
      return { valid: false, reason: 'VALIDATION_ERROR' };
    }
  }

  private async verifyToken(token) {
    try {
      // Check token blacklist
      const isBlacklisted = await cacheService.get(`ws:blacklisted:${token}`);
      if (isBlacklisted) {
        return null;
      }

      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  private checkConnectionLimit(ip) {
    let connections = 0;
    for (const conn of this.connections.values()) {
      if (conn.ip === ip) connections++;
    }
    return connections < this.thresholds.maxConnectionsPerIp;
  }

  private checkMessageRateLimit(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    // Reset counter if time window has passed
    if (now - connection.lastMessageTime > timeWindow) {
      connection.messageCount = 0;
      return true;
    }

    return connection.messageCount < this.thresholds.messageRateLimit;
  }

  private validateMessageStructure(message) {
    // Basic structure validation
    if (!message || typeof message !== 'object') return false;
    if (!message.type || typeof message.type !== 'string') return false;
    if (!message.data) return false;

    // Additional type-specific validation
    switch (message.type) {
      case 'subscribe':
        return Array.isArray(message.data.channels);
      case 'message':
        return typeof message.data.content === 'string' &&
               message.data.content.length <= 1000;
      case 'action':
        return typeof message.data.action === 'string' &&
               typeof message.data.payload === 'object';
      default:
        return false;
    }
  }

  disconnectClient(connectionId, reason) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Add to blacklist if necessary
      if (reason === 'MALICIOUS_ACTIVITY') {
        this.blacklist.add(connection.ip);
      }

      this.connections.delete(connectionId);
      logger.warn(`Client disconnected: ${connectionId}, reason: ${reason}`);
    }
  }

  getSecurityStats() {
    return {
      activeConnections: this.connections.size,
      blacklistedIps: this.blacklist.size,
      connectionsByIp: Array.from(this.connections.values()).reduce((acc, conn) => {
        acc[conn.ip] = (acc[conn.ip] || 0) + 1;
        return acc;
      }, {}),
      messageStats: Array.from(this.connections.values()).reduce((acc, conn) => ({
        total: acc.total + conn.messageCount,
        avgPerConnection: acc.total / this.connections.size
      }), { total: 0, avgPerConnection: 0 })
    };
  }
}

export default new WebSocketSecurityService(); 