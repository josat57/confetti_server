import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createAnalytics,
  getAnalytics,
  listAnalytics
} from '../controllers/analytics.controller.js';

const router = express.Router();

// Public routes
router.get('/', listAnalytics);
router.get('/:id', getAnalytics);

// Protected routes (require authentication)
router.use(protect);
router.post('/', createAnalytics);

export default router; 