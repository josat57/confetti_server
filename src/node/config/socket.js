import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { redis } from './redis.js';
import { logger } from '../utils/logger.js';

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}`);

    // Join trip chat rooms
    socket.on('join_trip', async (tripId) => {
      socket.join(`trip:${tripId}`);
      logger.info(`User ${socket.userId} joined trip: ${tripId}`);
    });

    // Leave trip chat rooms
    socket.on('leave_trip', (tripId) => {
      socket.leave(`trip:${tripId}`);
      logger.info(`User ${socket.userId} left trip: ${tripId}`);
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
      try {
        const { tripId, content, type = 'text' } = data;
        
        const message = await Message.create({
          trip: tripId,
          sender: socket.userId,
          content,
          type
        });

        await message.populate('sender', 'firstName lastName profileImage');
        
        io.to(`trip:${tripId}`).emit('new_message', message);
        
        // Store message in Redis for offline users
        await redis.lpush(`trip:${tripId}:messages`, JSON.stringify(message));
        await redis.ltrim(`trip:${tripId}:messages`, 0, 99); // Keep last 100 messages
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (tripId) => {
      socket.to(`trip:${tripId}`).emit('user_typing', {
        userId: socket.userId,
        status: 'started'
      });
    });

    socket.on('typing_end', (tripId) => {
      socket.to(`trip:${tripId}`).emit('user_typing', {
        userId: socket.userId,
        status: 'stopped'
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });
};

export { io }; 