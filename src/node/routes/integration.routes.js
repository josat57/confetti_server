const express = require('express');
const integrationController = require('../controllers/integration.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const createIntegrationSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('payment', 'notification', 'analytics', 'storage', 'communication', 'other').required(),
  provider: Joi.string().required(),
  credentials: Joi.object({
    apiKey: Joi.string(),
    secretKey: Joi.string(),
    accessToken: Joi.string(),
    refreshToken: Joi.string(),
    webhookSecret: Joi.string(),
    additionalKeys: Joi.object()
  }),
  config: Joi.object({
    endpoints: Joi.object(),
    webhooks: Joi.array().items(
      Joi.object({
        url: Joi.string().uri().required(),
        events: Joi.array().items(Joi.string()),
        status: Joi.string().valid('active', 'inactive', 'error')
      })
    ),
    settings: Joi.object()
  }),
  metadata: Joi.object({
    version: Joi.string(),
    rateLimit: Joi.object({
      requests: Joi.number().integer().min(1),
      period: Joi.number().integer().min(1)
    }),
    features: Joi.array().items(Joi.string())
  }),
  permissions: Joi.object({
    public: Joi.boolean(),
    allowedUsers: Joi.array().items(Joi.string()),
    allowedRoles: Joi.array().items(Joi.string())
  })
});

const updateIntegrationSchema = Joi.object({
  name: Joi.string(),
  status: Joi.string().valid('active', 'inactive', 'error', 'pending'),
  credentials: Joi.object({
    apiKey: Joi.string(),
    secretKey: Joi.string(),
    accessToken: Joi.string(),
    refreshToken: Joi.string(),
    webhookSecret: Joi.string(),
    additionalKeys: Joi.object()
  }),
  config: Joi.object({
    endpoints: Joi.object(),
    webhooks: Joi.array().items(
      Joi.object({
        url: Joi.string().uri().required(),
        events: Joi.array().items(Joi.string()),
        status: Joi.string().valid('active', 'inactive', 'error')
      })
    ),
    settings: Joi.object()
  }),
  permissions: Joi.object({
    public: Joi.boolean(),
    allowedUsers: Joi.array().items(Joi.string()),
    allowedRoles: Joi.array().items(Joi.string())
  })
});

const webhookSchema = Joi.object({
  event: Joi.string().required(),
  payload: Joi.object().required()
});

// Apply authentication middleware to all routes
router.use(protect);

// Integration management routes
router.post('/', validate(createIntegrationSchema), integrationController.createIntegration);
router.get('/', integrationController.getUserIntegrations);
router.get('/:integrationId', integrationController.getIntegration);
router.patch('/:integrationId', validate(updateIntegrationSchema), integrationController.updateIntegration);
router.delete('/:integrationId', integrationController.deleteIntegration);

// Integration operation routes
router.post('/:integrationId/test', integrationController.testConnection);
router.post('/:integrationId/webhook', validate(webhookSchema), integrationController.handleWebhook);
router.post('/:integrationId/refresh', integrationController.refreshTokens);

// Integration monitoring routes
router.get('/:integrationId/logs', integrationController.getLogs);
router.get('/:integrationId/health', integrationController.getHealth);

module.exports = router; 