import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createNotification,
  getNotification,
  updateNotification,
  listNotifications,
  markAsSent,
  markAsDelivered,
  markAsRead,
  markAsFailed,
  checkNotificationStatus
} from '../controllers/notification.controller.js';

const router = express.Router();

// Public routes
router.get('/', listNotifications);
router.get('/:id', getNotification);
router.get('/:id/status', checkNotificationStatus);

// Protected routes (require authentication)
router.use(protect);
router.post('/', createNotification);
router.patch('/:id', updateNotification);
router.post('/:id/sent', markAsSent);
router.post('/:id/delivered', markAsDelivered);
router.post('/:id/read', markAsRead);
router.post('/:id/failed', markAsFailed);

export default router; 