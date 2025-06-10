import express from 'express';
import * as reportController from '../controllers/report.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const createReportSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('event', 'vendor', 'booking', 'system', 'financial', 'analytics').required(),
  format: Joi.string().valid('pdf', 'excel', 'csv', 'json').required(),
  parameters: Joi.object(),
  filters: Joi.object({
    dateRange: Joi.object({
      start: Joi.date(),
      end: Joi.date()
    }),
    categories: Joi.array().items(Joi.string()),
    status: Joi.array().items(Joi.string()),
    custom: Joi.object()
  })
});

const scheduleReportSchema = Joi.object({
  frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').required(),
  nextRun: Joi.date().when('frequency', {
    is: 'custom',
    then: Joi.required()
  }),
  recipients: Joi.array().items(Joi.string())
});

// Routes
router.use(protect); // Protect all routes

// Create report
router.post(
  '/',
  validate(createReportSchema),
  reportController.createReport
);

// Get report by ID
router.get(
  '/:reportId',
  reportController.getReport
);

// Get user reports
router.get(
  '/',
  reportController.getUserReports
);

// Schedule report
router.post(
  '/:reportId/schedule',
  validate(scheduleReportSchema),
  reportController.scheduleReport
);

// Cancel scheduled report
router.delete(
  '/:reportId/schedule',
  reportController.cancelSchedule
);

// Download report
router.get(
  '/:reportId/download',
  reportController.downloadReport
);

export default router; 