import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import routes from './routes/index.js';
import cookieParser from 'cookie-parser';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import logger from './services/logging/advanced.service.js';

// Load env vars
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
};


app.use(cors(corsOptions));

// Cookie parser middleware (before routes)
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  logger.info(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api', routes);
// app.use('/api/search', searchRoutes);

// Add Swagger documentation
// swaggerDocs(app);

// 404 handler
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

export default app; 