import mongoose from "mongoose";
import ApiKey from "../models/api-key.model.js";
import Webhook from "../models/webhook.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import crypto from "crypto";

/**
 * API keys and webhooks for vendors (/vendors/…) and planners (/planner/api-access/…).
 * Creating them needs a plan with API access (checked in the routes); keys are
 * accepted by `protect` through the x-api-key header.
 */

/** Keys the user owns, including older keys stored against their vendor profile */
const keyScope = async (user) => {
  const vendor = user.role === "vendor" ? await Vendor.findOne({ owner: user._id }).select("_id").lean() : null;
  return vendor ? { $or: [{ owner: user._id }, { vendor: vendor._id }] } : { owner: user._id };
};

const validId = (id) => mongoose.isValidObjectId(id);

/**
 * Get all API keys
 * GET /api/v1/vendors/api-keys
 */
export const getApiKeys = async (req, res, next) => {
  try {
    const apiKeys = await ApiKey.find(await keyScope(req.user))
      .select("-key")
      .populate("createdBy", "firstName lastName email")
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
 * Create API key (shown once)
 * POST /api/v1/vendors/api-keys
 */
export const createApiKey = async (req, res, next) => {
  try {
    const { name, permissions, expiresAt, rateLimit, ipWhitelist } = req.body || {};
    if (!name || typeof name !== "string") return next(new AppError("A name for the key is required", 400));

    const vendor = req.user.role === "vendor" ? await Vendor.findOne({ owner: req.user._id }).select("_id") : null;
    const { key, prefix } = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      owner: req.user._id,
      vendor: vendor?._id,
      name: name.trim(),
      key, // Hashed in pre-save
      prefix,
      permissions: Array.isArray(permissions) ? permissions : [],
      expiresAt,
      rateLimit,
      ipWhitelist: Array.isArray(ipWhitelist) ? ipWhitelist : [],
      createdBy: req.user._id,
    });

    res.status(201).json({
      status: "success",
      message: "API key created successfully. Save this key securely - it will not be shown again.",
      data: {
        apiKey: { ...apiKey.toObject(), key: undefined },
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
    if (!validId(req.params.id)) return next(new AppError("API key not found", 404));
    const apiKey = await ApiKey.findOneAndDelete({ _id: req.params.id, ...(await keyScope(req.user)) });
    if (!apiKey) return next(new AppError("API key not found", 404));

    res.status(200).json({ status: "success", message: "API key deleted successfully" });
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
    if (!validId(req.params.id)) return next(new AppError("API key not found", 404));
    const apiKey = await ApiKey.findOne({ _id: req.params.id, ...(await keyScope(req.user)) }).select("-key");
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
    const webhooks = await Webhook.find({ user: req.user._id }).select("-secret").sort({ createdAt: -1 });
    res.status(200).json({ status: "success", results: webhooks.length, data: { webhooks } });
  } catch (error) {
    next(error);
  }
};

/**
 * Create webhook (secret shown once)
 * POST /api/v1/vendors/webhooks
 */
export const createWebhook = async (req, res, next) => {
  try {
    const { url, events, name } = req.body || {};
    if (!url || !/^https:\/\//.test(url)) return next(new AppError("Webhook URL must start with https://", 400));

    const secret = crypto.randomBytes(32).toString("hex");
    const webhook = await Webhook.create({
      user: req.user._id,
      name: (typeof name === "string" && name.trim()) || new URL(url).hostname,
      url,
      events: Array.isArray(events) ? events : [],
      secret,
    });

    res.status(201).json({
      status: "success",
      message: "Webhook created successfully",
      data: {
        webhook: { ...webhook.toObject(), secret: undefined },
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
    if (!validId(req.params.id)) return next(new AppError("Webhook not found", 404));
    const webhook = await Webhook.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!webhook) return next(new AppError("Webhook not found", 404));
    res.status(200).json({ status: "success", message: "Webhook deleted successfully" });
  } catch (error) {
    next(error);
  }
};
