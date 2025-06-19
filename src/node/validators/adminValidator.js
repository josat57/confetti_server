// src/node/middleware/validation.js

import Joi from 'joi';
import { createError } from '../utils/error.js';

const adminSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  role: Joi.string().valid('super_admin', 'admin', 'moderator').default('admin'),
  permissions: Joi.array().items(
    Joi.string().valid(
      'user_management',
      'content_management',
      'system_configuration',
      'moderation',
      'support_tickets',
      'audit_logs',
      'analytics',
      'vendor_management',
      'communication_management',
      'security_compliance',
      'financial_oversight'
    )
  )
});

const updateAdminSchema = adminSchema.keys({
  password: Joi.string().min(8).optional(),
  email: Joi.string().email().optional()
});

const verifyTwoFactorSchema = Joi.object({
  token: Joi.string().required()
});

const updatePermissionsSchema = Joi.object({
  permissions: Joi.array().items(
    Joi.string().valid(
      'user_management',
      'content_management',
      'system_configuration',
      'moderation',
      'support_tickets',
      'audit_logs',
      'analytics',
      'vendor_management',
      'communication_management',
      'security_compliance',
      'financial_oversight'
    )
  ).required()
});

const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'suspended', 'banned').required()
});

const manageContentSchema = Joi.object({
  type: Joi.string().valid('announcement', 'feature', 'promotion').required(),
  title: Joi.string().required(),
  content: Joi.string().required(),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft')
});

const updateSystemConfigSchema = Joi.object({
  key: Joi.string().required(),
  value: Joi.any().required(),
  description: Joi.string()
});

const moderateContentSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'flag').required(),
  reason: Joi.string().when('action', {
    is: 'reject',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  })
});

const updateTicketStatusSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').required(),
  response: Joi.string().when('status', {
    is: 'resolved',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  })
});

const updateVendorStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'suspended', 'rejected').required(),
  reason: Joi.string().when('status', {
    is: 'rejected',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  })
});

const sendAnnouncementSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().required(),
  targetAudience: Joi.array().items(
    Joi.string().valid('all', 'users', 'vendors', 'planners')
  ).required(),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium')
});

const schemas = {
  createAdmin: adminSchema,
  updateAdmin: updateAdminSchema,
  verifyTwoFactor: verifyTwoFactorSchema,
  updatePermissions: updatePermissionsSchema,
  updateUserStatus: updateUserStatusSchema,
  manageContent: manageContentSchema,
  updateSystemConfig: updateSystemConfigSchema,
  moderateContent: moderateContentSchema,
  updateTicketStatus: updateTicketStatusSchema,
  updateVendorStatus: updateVendorStatusSchema,
  sendAnnouncement: sendAnnouncementSchema
};

const validateAdmin = (schemaName) => {
  return (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw createError(500, `Validation schema '${schemaName}' not found`);
      }

      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => detail.message);
        throw createError(400, errors);
      }

      req.validatedData = value;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export { validateAdmin, schemas };