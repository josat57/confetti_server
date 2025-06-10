import express from 'express';
import messageController from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createMessageSchema = Joi.object({
  recipient: Joi.string().required(),
  type: Joi.string().valid('text', 'image', 'video', 'file', 'location', 'system').default('text'),
  content: Joi.object({
    text: Joi.string(),
    media: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('image', 'video', 'file').required(),
        url: Joi.string().required(),
        name: Joi.string(),
        size: Joi.number(),
        mimeType: Joi.string(),
        thumbnail: Joi.string()
      })
    ),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string()
    })
  }).required(),
  event: Joi.string(),
  vendor: Joi.string(),
  booking: Joi.string()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('delivered', 'read', 'failed').required()
});

const editMessageSchema = Joi.object({
  content: Joi.object({
    text: Joi.string(),
    media: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('image', 'video', 'file').required(),
        url: Joi.string().required(),
        name: Joi.string(),
        size: Joi.number(),
        mimeType: Joi.string(),
        thumbnail: Joi.string()
      })
    ),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string()
    })
  }).required()
});

const forwardMessageSchema = Joi.object({
  recipientId: Joi.string().required()
});

const replyMessageSchema = Joi.object({
  content: Joi.object({
    text: Joi.string(),
    media: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('image', 'video', 'file').required(),
        url: Joi.string().required(),
        name: Joi.string(),
        size: Joi.number(),
        mimeType: Joi.string(),
        thumbnail: Joi.string()
      })
    ),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string()
    })
  }).required()
});

const reactionSchema = Joi.object({
  emoji: Joi.string().required()
});

// Apply authentication middleware to all routes
router.use(protect);

// Message creation and retrieval routes
router.post('/', validate(createMessageSchema), messageController.createMessage);
router.get('/conversation/:userId', messageController.getConversation);
router.get('/event/:eventId', messageController.getEventMessages);
router.get('/vendor/:vendorId', messageController.getVendorMessages);
router.get('/:messageId', messageController.getMessage);

// Message management routes
router.patch('/:messageId/status', validate(updateStatusSchema), messageController.updateMessageStatus);
router.patch('/:messageId', validate(editMessageSchema), messageController.editMessage);
router.delete('/:messageId', messageController.deleteMessage);
router.post('/:messageId/forward', validate(forwardMessageSchema), messageController.forwardMessage);
router.post('/:messageId/reply', validate(replyMessageSchema), messageController.replyToMessage);

// Message interaction routes
router.post('/:messageId/reaction', validate(reactionSchema), messageController.addReaction);
router.get('/unread/count', messageController.getUnreadCount);
router.get('/stats', messageController.getMessageStats);

export default router; 