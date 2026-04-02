import Joi from "joi";
import { AppError } from "../utils/error.js";

// Generic validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      return next(new AppError(errors.join(", "), 400));
    }

    req.validatedData = value;
    next();
  };
};

// Validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(8).required().messages({
      "string.min": "Password must be at least 8 characters long",
      "any.required": "Password is required",
    }),
    confirmPassword: Joi.string().min(8).required().messages({
      "string.min": "Password must be at least 8 characters long",
      "any.required": "Password is required",
    }),
    userName: Joi.string().optional().messages({
      "any.required": "Username is required",
    }),
    username: Joi.string().optional().messages({
      "any.required": "Username is required",
    }),
    phone: Joi.string()
      .pattern(/^\+?[\d\s-]{10,}$/)
      .optional()
      .messages({
        "string.pattern.base": "Please provide a valid phone number",
      }),
    // Subscription plan fields
    planType: Joi.string().valid("vendor", "planner").optional().messages({
      "any.only": "Plan type must be either vendor or planner",
    }),
    planName: Joi.string().optional(),
    planId: Joi.string().optional(),
    amount: Joi.number().min(0).optional().messages({
      "number.min": "Amount must be a positive number",
    }),
    currency: Joi.string()
      .valid("NGN", "USD", "GBP", "EUR")
      .optional()
      .messages({
        "any.only": "Currency must be one of: NGN, USD, GBP, EUR",
      }),
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().required().messages({
      "any.required": "Password is required",
    }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      "any.required": "Reset token is required",
    }),
    otp: Joi.string().length(6).required().messages({
      "string.length": "OTP must be 6 digits",
      "any.required": "OTP is required",
    }),
    password: Joi.string().min(8).required().messages({
      "string.min": "Password must be at least 8 characters long",
      "any.required": "Password is required",
    }),
    confirmPassword: Joi.string()
      .valid(Joi.ref("password"))
      .required()
      .messages({
        "any.only": "Passwords do not match",
        "any.required": "Please confirm your password",
      }),
  }),

  resendOTP: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required",
    }),
  }),

  // Admin schemas
  createAdmin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    role: Joi.string()
      .valid("super_admin", "admin", "moderator")
      .default("admin"),
    permissions: Joi.array().items(
      Joi.string().valid(
        "user_management",
        "content_management",
        "system_configuration",
        "moderation",
        "support_tickets",
        "audit_logs",
        "analytics",
        "vendor_management",
        "communication_management",
        "security_compliance",
        "financial_oversight"
      )
    ),
  }),

  updateAdmin: Joi.object({
    email: Joi.string().email(),
    firstName: Joi.string(),
    lastName: Joi.string(),
    role: Joi.string().valid("super_admin", "admin", "moderator"),
    permissions: Joi.array().items(
      Joi.string().valid(
        "user_management",
        "content_management",
        "system_configuration",
        "moderation",
        "support_tickets",
        "audit_logs",
        "analytics",
        "vendor_management",
        "communication_management",
        "security_compliance",
        "financial_oversight"
      )
    ),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid("active", "inactive", "suspended").required(),
  }),

  updatePermissions: Joi.object({
    permissions: Joi.array()
      .items(
        Joi.string().valid(
          "user_management",
          "content_management",
          "system_configuration",
          "moderation",
          "support_tickets",
          "audit_logs",
          "analytics",
          "vendor_management",
          "communication_management",
          "security_compliance",
          "financial_oversight"
        )
      )
      .required(),
  }),

  updateUserStatus: Joi.object({
    status: Joi.string().valid("active", "suspended", "banned").required(),
  }),

  manageContent: Joi.object({
    action: Joi.string().valid("create", "update", "delete").required(),
    contentId: Joi.string().when("action", {
      is: "update",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    content: Joi.object().when("action", {
      is: Joi.string().valid("create", "update"),
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  updateSystemConfig: Joi.object({
    config: Joi.object().required(),
  }),

  moderateContent: Joi.object({
    action: Joi.string().valid("approve", "reject", "flag").required(),
    reason: Joi.string().when("action", {
      is: "reject",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  updateTicketStatus: Joi.object({
    status: Joi.string()
      .valid("open", "in_progress", "resolved", "closed")
      .required(),
    response: Joi.string().when("status", {
      is: "resolved",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  updateVendorStatus: Joi.object({
    status: Joi.string().valid("active", "suspended", "rejected").required(),
    reason: Joi.string().when("status", {
      is: "rejected",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  }),

  sendAnnouncement: Joi.object({
    title: Joi.string().required(),
    content: Joi.string().required(),
    message: Joi.string().optional(), // Backward compatibility
    type: Joi.string()
      .valid("info", "warning", "success", "error")
      .default("info"),
    targetAudience: Joi.alternatives()
      .try(
        Joi.string().valid(
          "all",
          "users",
          "vendors",
          "admins",
          "event-planners"
        ),
        Joi.array().items(
          Joi.string().valid(
            "all",
            "users",
            "vendors",
            "admins",
            "event-planners"
          )
        )
      )
      .required(),
    priority: Joi.string().valid("low", "medium", "high").default("medium"),
    status: Joi.string()
      .valid("draft", "published", "archived")
      .default("published"),
    isSticky: Joi.boolean().default(false),
    scheduledFor: Joi.date().optional().allow("", null),
    expiresAt: Joi.date().optional().allow("", null),
  }),

  verifyTwoFactor: Joi.object({
    token: Joi.string().required(),
  }),

  // Event schemas
  createEvent: Joi.object({
    title: Joi.string().required().min(3).max(100).messages({
      "string.min": "Title must be at least 3 characters long",
      "string.max": "Title cannot exceed 100 characters",
      "any.required": "Title is required",
    }),
    description: Joi.string().required().min(10).messages({
      "string.min": "Description must be at least 10 characters long",
      "any.required": "Description is required",
    }),
    eventType: Joi.string().required().messages({
      "any.required": "Event type is required",
    }),
    startDate: Joi.date().iso().required().min("now").messages({
      "date.base": "Start date must be a valid date",
      "date.min": "Start date must be in the future",
      "any.required": "Start date is required",
    }),
    endDate: Joi.date().iso().min(Joi.ref("startDate")).required().messages({
      "date.base": "End date must be a valid date",
      "date.min": "End date must be after start date",
      "any.required": "End date is required",
    }),
    location: Joi.object({
      // Accept both string (frontend) and object (backend) for address
      address: Joi.alternatives().try(
        Joi.string(),
        Joi.object({
          street: Joi.string(),
          city: Joi.string(),
          state: Joi.string(),
          country: Joi.string(),
          zipCode: Joi.string(),
        })
      ),
      city: Joi.string(),
      state: Joi.string(),
      country: Joi.string(),
      zipCode: Joi.string(),
      // Accept both object (frontend) and array (backend) for coordinates
      coordinates: Joi.alternatives().try(
        Joi.object({
          latitude: Joi.number().min(-90).max(90),
          longitude: Joi.number().min(-180).max(180),
        }),
        Joi.array().items(Joi.number()).length(2)
      ),
    }),
    budget: Joi.number().min(0).messages({
      "number.min": "Budget must be a positive number",
    }),
    guestCount: Joi.number().integer().min(1).messages({
      "number.min": "Guest count must be at least 1",
    }),
    preferences: Joi.object({
      theme: Joi.string(),
      catering: Joi.boolean(),
      music: Joi.boolean(),
      photography: Joi.boolean(),
    }),
  }),

  updateEvent: Joi.object({
    title: Joi.string().min(3).max(100),
    description: Joi.string().min(10),
    eventType: Joi.string(),
    startDate: Joi.date().iso().min("now"),
    endDate: Joi.date().iso(),
    location: Joi.object({
      // Accept both string (frontend) and object (backend) for address
      address: Joi.alternatives().try(
        Joi.string(),
        Joi.object({
          street: Joi.string(),
          city: Joi.string(),
          state: Joi.string(),
          country: Joi.string(),
          zipCode: Joi.string(),
        })
      ),
      city: Joi.string(),
      state: Joi.string(),
      country: Joi.string(),
      zipCode: Joi.string(),
      // Accept both object (frontend) and array (backend) for coordinates
      coordinates: Joi.alternatives().try(
        Joi.object({
          latitude: Joi.number().min(-90).max(90),
          longitude: Joi.number().min(-180).max(180),
        }),
        Joi.array().items(Joi.number()).length(2)
      ),
    }),
    budget: Joi.number().min(0),
    guestCount: Joi.number().integer().min(1),
    preferences: Joi.object({
      theme: Joi.string(),
      catering: Joi.boolean(),
      music: Joi.boolean(),
      photography: Joi.boolean(),
    }),
  }),

  addVendor: Joi.object({
    vendorId: Joi.string().required(),
    service: Joi.string().required(),
    price: Joi.number().min(0).required(),
  }),

  addGuest: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    phone: Joi.string().optional(),
    rsvpStatus: Joi.string()
      .valid("pending", "confirmed", "declined")
      .default("pending"),
  }),

  updateBudget: Joi.object({
    amount: Joi.number().min(0).required(),
    category: Joi.string().required(),
    description: Joi.string().optional(),
  }),

  updateSchedule: Joi.object({
    items: Joi.array()
      .items(
        Joi.object({
          title: Joi.string().required(),
          startTime: Joi.date().required(),
          endTime: Joi.date().required(),
          description: Joi.string().optional(),
        })
      )
      .required(),
  }),

  addTimelineItem: Joi.object({
    title: Joi.string().required(),
    date: Joi.date().required(),
    description: Joi.string().optional(),
    completed: Joi.boolean().default(false),
  }),

  addChecklistItem: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().optional(),
    dueDate: Joi.date().optional(),
    priority: Joi.string().valid("low", "medium", "high").default("medium"),
  }),

  addDocument: Joi.object({
    name: Joi.string().required(),
    type: Joi.string().required(),
    url: Joi.string().uri().required(),
    description: Joi.string().optional(),
  }),

  addNote: Joi.object({
    title: Joi.string().required(),
    content: Joi.string().required(),
    category: Joi.string().optional(),
  }),

  planEvent: Joi.object({
    eventType: Joi.string().required(),
    budget: Joi.number().min(0).required(),
    guestCount: Joi.number().integer().min(1).required(),
    preferences: Joi.object({
      theme: Joi.string(),
      location: Joi.string(),
      catering: Joi.boolean(),
      music: Joi.boolean(),
      photography: Joi.boolean(),
    }),
  }),

  analyzeEventFeedback: Joi.object({
    eventId: Joi.string().required(),
    feedbackData: Joi.array()
      .items(
        Joi.object({
          rating: Joi.number().min(1).max(5).required(),
          comment: Joi.string().optional(),
          category: Joi.string().required(),
        })
      )
      .required(),
  }),
};

// Validation middleware using schema names
const validateRequest = (schemaName) => {
  return (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw new AppError(`Validation schema '${schemaName}' not found`, 500);
      }

      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors = error.details.map((detail) => detail.message);
        throw new AppError(errors.join(", "), 400);
      }

      req.validatedData = value;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export { validateRequest, schemas, validate };
