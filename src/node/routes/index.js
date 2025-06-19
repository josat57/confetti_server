import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import eventRoutes from './event.routes.js';
import vendorRoutes from './vendor.routes.js';
import paymentRoutes from './payment.routes.js';
import notificationRoutes from './notification.routes.js';
import analyticsRoutes from './analytics.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import adminRoutes from './admin.routes.js';

const router = express.Router();

// Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/vendors', vendorRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/admin', adminRoutes);

// Health check endpoint
router.use('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Default route for API
router.use('/', (req, res) => {
    res.json({ message: 'Bad request' });
});
  
// Error handling for undefined routes
router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
});

export default router; 