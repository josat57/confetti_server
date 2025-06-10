import Joi from 'joi';
import { AppError } from './error.js';

// Generic validation middleware
export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      return next(new AppError(errorMessage, 400));
    }

    next();
  };
};

// Validation schemas
export const schemas = {
  // Auth schemas
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required'
    }),
    firstName: Joi.string().required().messages({
      'any.required': 'First name is required'
    }),
    lastName: Joi.string().required().messages({
      'any.required': 'Last name is required'
    }),
    role: Joi.string().valid('user', 'vendor', 'admin').default('user'),
    phone: Joi.string().pattern(/^\+?[\d\s-]{10,}$/).messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
    address: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      country: Joi.string(),
      zipCode: Joi.string()
    })
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  // User schemas
  updateProfile: Joi.object({
    firstName: Joi.string(),
    lastName: Joi.string(),
    phone: Joi.string().pattern(/^\+?[\d\s-]{10,}$/),
    address: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      country: Joi.string(),
      zipCode: Joi.string()
    }),
    preferences: Joi.object({
      notifications: Joi.object({
        email: Joi.boolean(),
        push: Joi.boolean(),
        sms: Joi.boolean()
      }),
      theme: Joi.string().valid('light', 'dark'),
      language: Joi.string()
    })
  }),

  // Event schemas
  createEvent: Joi.object({
    title: Joi.string().required().min(3).max(100).messages({
      'string.min': 'Title must be at least 3 characters long',
      'string.max': 'Title cannot exceed 100 characters',
      'any.required': 'Title is required'
    }),
    description: Joi.string().required().min(10).messages({
      'string.min': 'Description must be at least 10 characters long',
      'any.required': 'Description is required'
    }),
    eventType: Joi.string().required().messages({
      'any.required': 'Event type is required'
    }),
    startDate: Joi.date().iso().required().min('now').messages({
      'date.base': 'Start date must be a valid date',
      'date.min': 'Start date must be in the future',
      'any.required': 'Start date is required'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
    location: Joi.object({
      address: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
      coordinates: Joi.object({
        latitude: Joi.number().min(-90).max(90),
        longitude: Joi.number().min(-180).max(180)
      })
    }).required(),
    budget: Joi.number().min(0).required().messages({
      'number.min': 'Budget must be a positive number',
      'any.required': 'Budget is required'
    }),
    guestCount: Joi.number().integer().min(1).required().messages({
      'number.min': 'Guest count must be at least 1',
      'any.required': 'Guest count is required'
    }),
    preferences: Joi.object({
      theme: Joi.string(),
      catering: Joi.boolean(),
      music: Joi.boolean(),
      photography: Joi.boolean()
    })
  }),

  // Vendor schemas
  createVendor: Joi.object({
    name: Joi.string().required().min(2).max(100).messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
    description: Joi.string().required().min(10).messages({
      'string.min': 'Description must be at least 10 characters long',
      'any.required': 'Description is required'
    }),
    businessType: Joi.string().required().messages({
      'any.required': 'Business type is required'
    }),
    categories: Joi.array().items(Joi.string()).min(1).required().messages({
      'array.min': 'At least one category is required',
      'any.required': 'Categories are required'
    }),
    location: Joi.object({
      address: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required()
    }).required(),
    contactInfo: Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^\+?[\d\s-]{10,}$/).required(),
      website: Joi.string().uri()
    }).required(),
    availability: Joi.object({
      startDate: Joi.date().iso(),
      endDate: Joi.date().iso().min(Joi.ref('startDate')),
      blockedDates: Joi.array().items(Joi.date().iso())
    }),
    pricing: Joi.object({
      basePrice: Joi.number().min(0).required(),
      currency: Joi.string().default('NGN'),
      additionalFees: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          amount: Joi.number().min(0).required()
        })
      )
    }).required()
  }),

  // Payment schemas
  createPayment: Joi.object({
    amount: Joi.number().min(0).required().messages({
      'number.min': 'Amount must be a positive number',
      'any.required': 'Amount is required'
    }),
    currency: Joi.string().required().messages({
      'any.required': 'Currency is required'
    }),
    paymentType: Joi.string().valid('TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'REFUND').required(),
    paymentMethod: Joi.string().valid('BANK_TRANSFER', 'CARD', 'CASH', 'WALLET').required(),
    recipientId: Joi.string().required(),
    description: Joi.string().required(),
    metadata: Joi.object()
  }),

  // Notification schemas
  createNotification: Joi.object({
    type: Joi.string().required(),
    title: Joi.string().required(),
    message: Joi.string().required(),
    priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').default('MEDIUM'),
    data: Joi.object()
  })
};

// Pre-defined validation middleware for common routes
export const validateRegistration = validate(schemas.register);
export const validateLogin = validate(schemas.login);
export const validateUpdateProfile = validate(schemas.updateProfile);
export const validateCreateEvent = validate(schemas.createEvent);
export const validateCreateVendor = validate(schemas.createVendor);
export const validateCreatePayment = validate(schemas.createPayment);
export const validateCreateNotification = validate(schemas.createNotification); 