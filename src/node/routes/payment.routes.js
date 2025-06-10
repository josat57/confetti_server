import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createPayment,
  getPayment,
  updatePayment,
  listPayments,
  convertToNGN
} from '../controllers/payment.controller.js';

const router = express.Router();

// Public routes
router.get('/', listPayments);
router.get('/:id', getPayment);

// Protected routes (require authentication)
router.use(protect);
router.post('/', createPayment);
router.patch('/:id', updatePayment);
router.post('/:id/convert', convertToNGN);

export default router; 