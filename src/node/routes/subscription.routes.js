import express from 'express';
import {
  getPlans,
  startTrial,
  createPaymentIntent,
  verifyPayment,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  getUserSubscriptions,
  checkFeatureAccess,
  updateUsage
} from '../controllers/subscription.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/plans', getPlans);

// Protected routes
router.use(protect);

router.post('/trial', startTrial);
router.post('/payment-intent', createPaymentIntent);
router.post('/verify-payment', verifyPayment);
router.patch('/:subscriptionId/upgrade', upgradeSubscription);
router.patch('/:subscriptionId/downgrade', downgradeSubscription);
router.patch('/:subscriptionId/cancel', cancelSubscription);
router.get('/user', getUserSubscriptions);
router.get('/check-access/:planType/:feature', checkFeatureAccess);
router.patch('/:subscriptionId/usage', updateUsage);

export default router; 