import Message from '../models/message.model.js';
import User from '../models/user.model.js';
import { AppError } from '../utils/error.js';
import { logger } from '../utils/logger.js';

class MessageService {
  // Create a new message
  async createMessage(data) {
    try {
      const message = await Message.create(data);
      await this.notifyRecipient(message);
      return message;
    } catch (error) {
      logger.error('Error creating message:', error);
      throw new AppError('Failed to create message', 500);
    }
  }

  // Get messages between two users
  async getConversation(userId1, userId2, options = {}) {
    try {
      const { limit = 50, before, after } = options;
      const query = {
        $or: [
          { sender: userId1, recipient: userId2 },
          { sender: userId2, recipient: userId1 }
        ],
        'metadata.isDeleted': false
      };

      if (before) {
        query.timestamps = { ...query.timestamps, created: { $lt: before } };
      }
      if (after) {
        query.timestamps = { ...query.timestamps, created: { $gt: after } };
      }

      const messages = await Message.find(query)
        .sort({ 'timestamps.created': -1 })
        .limit(limit)
        .populate('sender', 'firstName lastName avatar')
        .populate('recipient', 'firstName lastName avatar');

      return messages;
    } catch (error) {
      logger.error('Error fetching conversation:', error);
      throw new AppError('Failed to fetch conversation', 500);
    }
  }

  // Get messages for an event
  async getEventMessages(eventId, options = {}) {
    try {
      const { limit = 50, before, after } = options;
      const query = { event: eventId, 'metadata.isDeleted': false };

      if (before) {
        query.timestamps = { ...query.timestamps, created: { $lt: before } };
      }
      if (after) {
        query.timestamps = { ...query.timestamps, created: { $gt: after } };
      }

      const messages = await Message.find(query)
        .sort({ 'timestamps.created': -1 })
        .limit(limit)
        .populate('sender', 'firstName lastName avatar')
        .populate('recipient', 'firstName lastName avatar');

      return messages;
    } catch (error) {
      logger.error('Error fetching event messages:', error);
      throw new AppError('Failed to fetch event messages', 500);
    }
  }

  // Get messages for a vendor
  async getVendorMessages(vendorId, options = {}) {
    try {
      const { limit = 50, before, after } = options;
      const query = { vendor: vendorId, 'metadata.isDeleted': false };

      if (before) {
        query.timestamps = { ...query.timestamps, created: { $lt: before } };
      }
      if (after) {
        query.timestamps = { ...query.timestamps, created: { $gt: after } };
      }

      const messages = await Message.find(query)
        .sort({ 'timestamps.created': -1 })
        .limit(limit)
        .populate('sender', 'firstName lastName avatar')
        .populate('recipient', 'firstName lastName avatar');

      return messages;
    } catch (error) {
      logger.error('Error fetching vendor messages:', error);
      throw new AppError('Failed to fetch vendor messages', 500);
    }
  }

  // Get a single message
  async getMessage(messageId) {
    try {
      const message = await Message.findById(messageId)
        .populate('sender', 'firstName lastName avatar')
        .populate('recipient', 'firstName lastName avatar');

      if (!message) {
        throw new AppError('Message not found', 404);
      }

      return message;
    } catch (error) {
      logger.error('Error fetching message:', error);
      throw error;
    }
  }

  // Update message status
  async updateMessageStatus(messageId, status) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new AppError('Message not found', 404);
      }

      switch (status) {
        case 'delivered':
          await message.markAsDelivered();
          break;
        case 'read':
          await message.markAsRead();
          break;
        case 'failed':
          await message.markAsFailed();
          break;
        default:
          throw new AppError('Invalid status', 400);
      }

      return message;
    } catch (error) {
      logger.error('Error updating message status:', error);
      throw error;
    }
  }

  // Edit message
  async editMessage(messageId, userId, newContent) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new AppError('Message not found', 404);
      }

      if (message.sender.toString() !== userId.toString()) {
        throw new AppError('Not authorized to edit this message', 403);
      }

      await message.edit(newContent);
      return message;
    } catch (error) {
      logger.error('Error editing message:', error);
      throw error;
    }
  }

  // Delete message
  async deleteMessage(messageId, userId) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new AppError('Message not found', 404);
      }

      if (message.sender.toString() !== userId.toString()) {
        throw new AppError('Not authorized to delete this message', 403);
      }

      await message.delete();
      return message;
    } catch (error) {
      logger.error('Error deleting message:', error);
      throw error;
    }
  }

  // Forward message
  async forwardMessage(messageId, userId, newRecipientId) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new AppError('Message not found', 404);
      }

      if (message.sender.toString() !== userId.toString()) {
        throw new AppError('Not authorized to forward this message', 403);
      }

      await message.forward(newRecipientId);
      await this.notifyRecipient(message);
      return message;
    } catch (error) {
      logger.error('Error forwarding message:', error);
      throw error;
    }
  }

  // Reply to message
  async replyToMessage(messageId, userId, replyContent) {
    try {
      const originalMessage = await Message.findById(messageId);
      if (!originalMessage) {
        throw new AppError('Original message not found', 404);
      }

      const reply = await Message.create({
        sender: userId,
        recipient: originalMessage.sender,
        type: replyContent.type || 'text',
        content: replyContent,
        metadata: {
          isReply: true,
          replyTo: messageId
        }
      });

      await this.notifyRecipient(reply);
      return reply;
    } catch (error) {
      logger.error('Error replying to message:', error);
      throw error;
    }
  }

  // Add reaction to message
  async addReaction(messageId, userId, emoji) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new AppError('Message not found', 404);
      }

      await message.addReaction(userId, emoji);
      return message;
    } catch (error) {
      logger.error('Error adding reaction:', error);
      throw error;
    }
  }

  // Get unread message count
  async getUnreadCount(userId) {
    try {
      const count = await Message.countDocuments({
        recipient: userId,
        status: { $in: ['sent', 'delivered'] },
        'metadata.isDeleted': false
      });
      return count;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw new AppError('Failed to get unread count', 500);
    }
  }

  // Get message statistics
  async getMessageStats(userId) {
    try {
      const stats = await Message.aggregate([
        {
          $match: {
            $or: [
              { sender: userId },
              { recipient: userId }
            ],
            'metadata.isDeleted': false
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            sent: {
              $sum: {
                $cond: [{ $eq: ['$sender', userId] }, 1, 0]
              }
            },
            received: {
              $sum: {
                $cond: [{ $eq: ['$recipient', userId] }, 1, 0]
              }
            },
            read: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$recipient', userId] },
                    { $eq: ['$status', 'read'] }
                  ]},
                  1,
                  0
                ]
              }
            },
            unread: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$recipient', userId] },
                    { $in: ['$status', ['sent', 'delivered']] }
                  ]},
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      return stats[0] || {
        total: 0,
        sent: 0,
        received: 0,
        read: 0,
        unread: 0
      };
    } catch (error) {
      logger.error('Error getting message stats:', error);
      throw new AppError('Failed to get message statistics', 500);
    }
  }

  // Private method to notify recipient
  async notifyRecipient(message) {
    try {
      const recipient = await User.findById(message.recipient);
      if (!recipient) {
        throw new AppError('Recipient not found', 404);
      }

      // TODO: Implement notification logic (e.g., push notification, email)
      logger.info(`Notification sent to user ${recipient._id} for new message`);
    } catch (error) {
      logger.error('Error notifying recipient:', error);
      // Don't throw error as this is a non-critical operation
    }
  }
}

export default new MessageService(); 