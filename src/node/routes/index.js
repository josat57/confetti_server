import express from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import morgan from 'morgan';
// import cookieParser from 'cookie-parser';
// import dotenv from 'dotenv';
// import { errorHandler } from './middleware/error.js';
// import { logger } from '../utils/logger.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import eventRoutes from './event.routes.js';
import vendorRoutes from './vendor.routes.js';
import paymentRoutes from './payment.routes.js';
import notificationRoutes from './notification.routes.js';
import analyticsRoutes from './analytics.routes.js';

// // Load environment variables
// dotenv.config();

// const app = express();

// // Middleware
// app.use(helmet());
// app.use(cors({
//   origin: process.env.CORS_ORIGIN || 'http://localhost:3500',
//   credentials: true
// }));
// app.use(morgan('dev'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser());

const router = express.Router();

// Routes
router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/events', eventRoutes);
router.use('/api/vendors', vendorRoutes);
router.use('/api/payments', paymentRoutes);
router.use('/api/notifications', notificationRoutes);
router.use('/api/analytics', analyticsRoutes);

// Health check endpoint
router.use('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling
// app.use(errorHandler);

// Default route for API
router.use('/', (req, res) => {
    res.json({ message: 'API is working' });
});
  
// Error handling for undefined routes
router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found'
    });
});

export default router; 