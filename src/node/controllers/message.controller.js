import messageService from '../services/message.service.js';
import { AppError } from '../utils/error.js';
import { logger } from '../utils/logger.js';

class MessageController {
  // Create a new message
  async createMessage(req, res, next) {
    try {
      const message = await messageService.createMessage({
        ...req.body,
        sender: req.user._id
      });
      res.status(201).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Get conversation between two users
  async getConversation(req, res, next) {
    try {
      const { userId } = req.params;
      const { limit, before, after } = req.query;
      const messages = await messageService.getConversation(
        req.user._id,
        userId,
        { limit: parseInt(limit), before, after }
      );
      res.status(200).json({
        status: 'success',
        data: messages
      });
    } catch (error) {
      next(error);
    }
  }

  // Get messages for an event
  async getEventMessages(req, res, next) {
    try {
      const { eventId } = req.params;
      const { limit, before, after } = req.query;
      const messages = await messageService.getEventMessages(
        eventId,
        { limit: parseInt(limit), before, after }
      );
      res.status(200).json({
        status: 'success',
        data: messages
      });
    } catch (error) {
      next(error);
    }
  }

  // Get messages for a vendor
  async getVendorMessages(req, res, next) {
    try {
      const { vendorId } = req.params;
      const { limit, before, after } = req.query;
      const messages = await messageService.getVendorMessages(
        vendorId,
        { limit: parseInt(limit), before, after }
      );
      res.status(200).json({
        status: 'success',
        data: messages
      });
    } catch (error) {
      next(error);
    }
  }

  // Get a single message
  async getMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const message = await messageService.getMessage(messageId);
      res.status(200).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Update message status
  async updateMessageStatus(req, res, next) {
    try {
      const { messageId } = req.params;
      const { status } = req.body;
      const message = await messageService.updateMessageStatus(messageId, status);
      res.status(200).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Edit message
  async editMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const message = await messageService.editMessage(
        messageId,
        req.user._id,
        content
      );
      res.status(200).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete message
  async deleteMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const message = await messageService.deleteMessage(messageId, req.user._id);
      res.status(200).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Forward message
  async forwardMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const { recipientId } = req.body;
      const message = await messageService.forwardMessage(
        messageId,
        req.user._id,
        recipientId
      );
      res.status(200).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Reply to message
  async replyToMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const message = await messageService.replyToMessage(
        messageId,
        req.user._id,
        content
      );
      res.status(201).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Add reaction to message
  async addReaction(req, res, next) {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const message = await messageService.addReaction(
        messageId,
        req.user._id,
        emoji
      );
      res.status(200).json({
        status: 'success',
        data: message
      });
    } catch (error) {
      next(error);
    }
  }

  // Get unread message count
  async getUnreadCount(req, res, next) {
    try {
      const count = await messageService.getUnreadCount(req.user._id);
      res.status(200).json({
        status: 'success',
        data: { count }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get message statistics
  async getMessageStats(req, res, next) {
    try {
      const stats = await messageService.getMessageStats(req.user._id);
      res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new MessageController(); 