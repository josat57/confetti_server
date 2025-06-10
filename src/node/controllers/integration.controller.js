const integrationService = require('../services/integration.service');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

// Create a new integration
exports.createIntegration = async (req, res, next) => {
  try {
    const integration = await integrationService.createIntegration({
      ...req.body,
      owner: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: integration
    });
  } catch (error) {
    next(error);
  }
};

// Get integration by ID
exports.getIntegration = async (req, res, next) => {
  try {
    const integration = await integrationService.getIntegration(
      req.params.integrationId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: integration
    });
  } catch (error) {
    next(error);
  }
};

// Get all integrations for user
exports.getUserIntegrations = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.status) filters.status = req.query.status;

    const integrations = await integrationService.getUserIntegrations(
      req.user._id,
      filters
    );

    res.status(200).json({
      status: 'success',
      data: integrations
    });
  } catch (error) {
    next(error);
  }
};

// Update integration
exports.updateIntegration = async (req, res, next) => {
  try {
    const integration = await integrationService.updateIntegration(
      req.params.integrationId,
      req.user._id,
      req.body
    );

    res.status(200).json({
      status: 'success',
      data: integration
    });
  } catch (error) {
    next(error);
  }
};

// Delete integration
exports.deleteIntegration = async (req, res, next) => {
  try {
    await integrationService.deleteIntegration(
      req.params.integrationId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Test integration connection
exports.testConnection = async (req, res, next) => {
  try {
    const result = await integrationService.testConnection(
      req.params.integrationId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Handle webhook
exports.handleWebhook = async (req, res, next) => {
  try {
    const result = await integrationService.handleWebhook(
      req.params.integrationId,
      req.body.event,
      req.body
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Refresh integration tokens
exports.refreshTokens = async (req, res, next) => {
  try {
    const result = await integrationService.refreshTokens(
      req.params.integrationId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get integration logs
exports.getLogs = async (req, res, next) => {
  try {
    const logs = await integrationService.getLogs(
      req.params.integrationId,
      req.user._id,
      {
        level: req.query.level,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        limit: parseInt(req.query.limit, 10)
      }
    );

    res.status(200).json({
      status: 'success',
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// Get integration health
exports.getHealth = async (req, res, next) => {
  try {
    const health = await integrationService.getHealth(
      req.params.integrationId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: health
    });
  } catch (error) {
    next(error);
  }
}; 