import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import logger from '../logging/advanced.service.js';
import { v4 as uuidv4 } from 'uuid';

class MessageService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.activeConnections = new Map();
    this.chatRooms = new Map();
    
    this.initialize();
  }

  async initialize() {
    try {
      this.wss = new WebSocketServer({ noServer: true });
      this.setupWebSocketHandlers();
      logger.info('Message service initialized successfully');
    } catch (error) {
      logger.error('Message service initialization failed:', error);
      throw error;
    }
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      const userId = this.extractUserId(req);
      if (!userId) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      this.activeConnections.set(userId, ws);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(userId, data, ws);
        } catch (error) {
          logger.error('WebSocket message handling failed:', error);
        }
      });

      ws.on('close', () => {
        this.activeConnections.delete(userId);
        this.handleUserDisconnect(userId);
      });
    });
  }

  async handleWebSocketMessage(userId, data, ws) {
    switch (data.type) {
      case 'direct_message':
        await this.handleDirectMessage(userId, data);
        break;
      case 'join_room':
        await this.joinRoom(userId, data.roomId);
        break;
      case 'leave_room':
        await this.leaveRoom(userId, data.roomId);
        break;
      case 'room_message':
        await this.handleRoomMessage(userId, data);
        break;
      case 'typing':
        await this.broadcastTypingStatus(userId, data);
        break;
    }
  }

  async handleDirectMessage(senderId, data) {
    const { recipientId, content } = data;
    const message = {
      id: uuidv4(),
      senderId,
      recipientId,
      content,
      timestamp: Date.now(),
      type: 'direct',
      status: 'sent'
    };

    // Store the message
    await this.storeMessage(message);

    // Deliver to recipient if online
    const recipientWs = this.activeConnections.get(recipientId);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      recipientWs.send(JSON.stringify(message));
      message.status = 'delivered';
      await this.updateMessageStatus(message.id, 'delivered');
    }

    // Send delivery confirmation to sender
    const senderWs = this.activeConnections.get(senderId);
    if (senderWs && senderWs.readyState === WebSocket.OPEN) {
      senderWs.send(JSON.stringify({ type: 'message_status', messageId: message.id, status: message.status }));
    }

    return message;
  }

  async handleRoomMessage(senderId, data) {
    const { roomId, content } = data;
    const message = {
      id: uuidv4(),
      senderId,
      roomId,
      content,
      timestamp: Date.now(),
      type: 'room',
      status: 'sent'
    };

    // Store the message
    await this.storeMessage(message);

    // Broadcast to all room members
    const room = this.chatRooms.get(roomId);
    if (room) {
      room.members.forEach(memberId => {
        const memberWs = this.activeConnections.get(memberId);
        if (memberWs && memberWs.readyState === WebSocket.OPEN) {
          memberWs.send(JSON.stringify(message));
        }
      });
    }

    return message;
  }

  async storeMessage(message) {
    const key = message.type === 'direct' 
      ? `messages:dm:${message.senderId}:${message.recipientId}`
      : `messages:room:${message.roomId}`;
    
    await this.redis.zadd(key, message.timestamp, JSON.stringify(message));
  }

  async updateMessageStatus(messageId, status) {
    // Implementation for updating message status
  }

  async getDirectMessages(userId1, userId2, options = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;
    const key1 = `messages:dm:${userId1}:${userId2}`;
    const key2 = `messages:dm:${userId2}:${userId1}`;
    
    let messages = [];
    for (const key of [key1, key2]) {
      const msgs = await this.redis.zrange(key, 0, -1);
      messages = [...messages, ...msgs.map(m => JSON.parse(m))];
    }

    return messages
      .filter(m => {
        if (startDate && m.timestamp < startDate) return false;
        if (endDate && m.timestamp > endDate) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);
  }

  async getRoomMessages(roomId, options = {}) {
    const { limit = 50, offset = 0, startDate, endDate } = options;
    const key = `messages:room:${roomId}`;
    
    let messages = await this.redis.zrange(key, 0, -1);
    messages = messages
      .map(m => JSON.parse(m))
      .filter(m => {
        if (startDate && m.timestamp < startDate) return false;
        if (endDate && m.timestamp > endDate) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(offset, offset + limit);

    return messages;
  }

  async createRoom(name, creatorId, isPrivate = false) {
    const roomId = uuidv4();
    const room = {
      id: roomId,
      name,
      creatorId,
      isPrivate,
      members: new Set([creatorId]),
      created: Date.now()
    };

    this.chatRooms.set(roomId, room);
    await this.redis.set(`room:${roomId}`, JSON.stringify(room));
    return room;
  }

  async joinRoom(userId, roomId) {
    const room = this.chatRooms.get(roomId);
    if (room) {
      room.members.add(userId);
      await this.redis.set(`room:${roomId}`, JSON.stringify(room));
      
      // Notify room members
      room.members.forEach(memberId => {
        const memberWs = this.activeConnections.get(memberId);
        if (memberWs && memberWs.readyState === WebSocket.OPEN) {
          memberWs.send(JSON.stringify({
            type: 'room_update',
            roomId,
            action: 'join',
            userId
          }));
        }
      });
    }
  }

  async leaveRoom(userId, roomId) {
    const room = this.chatRooms.get(roomId);
    if (room) {
      room.members.delete(userId);
      await this.redis.set(`room:${roomId}`, JSON.stringify(room));
      
      // Notify remaining members
      room.members.forEach(memberId => {
        const memberWs = this.activeConnections.get(memberId);
        if (memberWs && memberWs.readyState === WebSocket.OPEN) {
          memberWs.send(JSON.stringify({
            type: 'room_update',
            roomId,
            action: 'leave',
            userId
          }));
        }
      });
    }
  }

  async broadcastTypingStatus(userId, data) {
    const { recipientId, roomId, isTyping } = data;
    const statusUpdate = {
      type: 'typing_status',
      userId,
      isTyping
    };

    if (roomId) {
      // Broadcast to room
      const room = this.chatRooms.get(roomId);
      if (room) {
        room.members.forEach(memberId => {
          if (memberId !== userId) {
            const memberWs = this.activeConnections.get(memberId);
            if (memberWs && memberWs.readyState === WebSocket.OPEN) {
              memberWs.send(JSON.stringify(statusUpdate));
            }
          }
        });
      }
    } else if (recipientId) {
      // Send to specific user
      const recipientWs = this.activeConnections.get(recipientId);
      if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
        recipientWs.send(JSON.stringify(statusUpdate));
      }
    }
  }

  handleUserDisconnect(userId) {
    // Update user's status in all rooms
    this.chatRooms.forEach(room => {
      if (room.members.has(userId)) {
        room.members.forEach(memberId => {
          if (memberId !== userId) {
            const memberWs = this.activeConnections.get(memberId);
            if (memberWs && memberWs.readyState === WebSocket.OPEN) {
              memberWs.send(JSON.stringify({
                type: 'user_status',
                userId,
                status: 'offline'
              }));
            }
          }
        });
      }
    });
  }

  extractUserId(req) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        return null;
      }

      // Implement your token verification logic here
      const userId = verifyToken(token);
      return userId;
    } catch (error) {
      logger.error('Failed to extract user ID:', error);
      return null;
    }
  }
}

export default new MessageService(); 