import ApiKey from "../models/api-key.model.js";
import Webhook from "../models/webhook.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import crypto from "crypto";

/**
 * Get all API keys
 * GET /api/v1/vendors/api-keys
 */
export const getApiKeys = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const apiKeys = await ApiKey.find({ vendor: vendor._id })
      .select("-key")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: apiKeys.length,
      data: { apiKeys },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create API key
 * POST /api/v1/vendors/api-keys
 */
export const createApiKey = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    // Check subscription tier (Enterprise only)
    if (!vendor.canAccessFeature("api_access")) {
      return next(new AppError("API access requires Enterprise plan", 403));
    }

    const { name, permissions, expiresAt, rateLimit } = req.body;

    const { key, prefix } = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      vendor: vendor._id,
      name,
      key, // Will be hashed in pre-save
      prefix,
      permissions: permissions || [],
      expiresAt,
      rateLimit,
      createdBy: req.user._id,
    });

    // Return the plain key only once
    res.status(201).json({
      status: "success",
      message:
        "API key created successfully. Save this key securely - it will not be shown again.",
      data: {
        apiKey: {
          ...apiKey.toObject(),
          key: undefined, // Remove hashed key
        },
        plainKey: key, // Show plain key only once
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete API key
 * DELETE /api/v1/vendors/api-keys/:id
 */
export const deleteApiKey = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const apiKey = await ApiKey.findOneAndDelete({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!apiKey) return next(new AppError("API key not found", 404));

    res.status(200).json({
      status: "success",
      message: "API key deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get API key usage
 * GET /api/v1/vendors/api-keys/:id/usage
 */
export const getApiKeyUsage = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const apiKey = await ApiKey.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    }).select("-key");

    if (!apiKey) return next(new AppError("API key not found", 404));

    res.status(200).json({
      status: "success",
      data: {
        usage: {
          totalRequests: apiKey.usageCount,
          lastUsed: apiKey.lastUsedAt,
          rateLimit: apiKey.rateLimit,
          isActive: apiKey.isActive,
          isExpired: apiKey.isExpired,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all webhooks
 * GET /api/v1/vendors/webhooks
 */
export const getWebhooks = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const webhooks = await Webhook.find({ vendor: vendor._id })
      .select("-secret")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: webhooks.length,
      data: { webhooks },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create webhook
 * POST /api/v1/vendors/webhooks
 */
export const createWebhook = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    // Check subscription tier
    if (!vendor.canAccessFeature("webhooks")) {
      return next(new AppError("Webhooks require Enterprise plan", 403));
    }

    const { url, events } = req.body;

    const secret = crypto.randomBytes(32).toString("hex");

    const webhook = await Webhook.create({
      vendor: vendor._id,
      url,
      events: events || [],
      secret,
      createdBy: req.user._id,
    });

    res.status(201).json({
      status: "success",
      message: "Webhook created successfully",
      data: {
        webhook: {
          ...webhook.toObject(),
          secret: undefined,
        },
        secret, // Show secret only once
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete webhook
 * DELETE /api/v1/vendors/webhooks/:id
 */
export const deleteWebhook = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const webhook = await Webhook.findOneAndDelete({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!webhook) return next(new AppError("Webhook not found", 404));

    res.status(200).json({
      status: "success",
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
