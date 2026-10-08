import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import { assertCanCreateEvent } from "../services/plan-access.service.js";
import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import pwaConfig from "../config/pwa.config.js";
import imageOptimizationService from "../services/image-optimization.service.js";
import PushToken from "../models/pushToken.model.js";
import { uploadToCloudinary, streamStoredFile } from "../utils/cloudinary.js";

/**
 * Mobile API Controller
 * Handles mobile-specific endpoints and optimizations
 */

/**
 * Get PWA manifest
 * GET /api/v1/mobile/manifest
 */
export const getManifest = async (req, res, next) => {
  try {
    res.status(200).json(pwaConfig.manifest);
  } catch (error) {
    logger.error("Error getting PWA manifest:", error);
    next(error);
  }
};

/**
 * Get offline data for caching
 * GET /api/v1/mobile/offline-data
 */
export const getOfflineData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { types = "events,clients,tasks" } = req.query;

    const dataTypes = types.split(",");
    const offlineData = {};

    // Get recent events
    if (dataTypes.includes("events")) {
      const events = await Event.find({ planner: userId })
        .sort({ updatedAt: -1 })
        .limit(pwaConfig.offline.cacheData.events.maxItems)
        .select("title eventType startDate endDate location status budget")
        .lean();

      offlineData.events = events;
    }

    // Get recent clients
    if (dataTypes.includes("clients")) {
      const clients = await Client.find({ planner: userId })
        .sort({ updatedAt: -1 })
        .limit(pwaConfig.offline.cacheData.clients.maxItems)
        .select("firstName lastName email phone company")
        .lean();

      offlineData.clients = clients;
    }

    // Get recent tasks
    if (dataTypes.includes("tasks")) {
      const tasks = await Task.find({ planner: userId })
        .sort({ updatedAt: -1 })
        .limit(pwaConfig.offline.cacheData.tasks.maxItems)
        .select("title description dueDate priority status event")
        .populate("event", "title")
        .lean();

      offlineData.tasks = tasks;
    }

    res.status(200).json({
      success: true,
      data: offlineData,
      cachedAt: new Date(),
      expiresAt: new Date(
        Date.now() + pwaConfig.offline.cacheData.events.maxAge
      ),
    });
  } catch (error) {
    logger.error("Error getting offline data:", error);
    next(error);
  }
};

/**
 * Sync offline changes
 * POST /api/v1/mobile/sync
 */
export const syncOfflineChanges = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { changes = [] } = req.body;

    if (!Array.isArray(changes)) {
      return next(new AppError("Changes must be an array", 400));
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const change of changes) {
      try {
        const { type, action, data, localId } = change;

        let result;

        switch (type) {
          case "event":
            if (action === "create") await assertCanCreateEvent(req);
            result = await syncEventChange(userId, action, data);
            break;
          case "client":
            result = await syncClientChange(userId, action, data);
            break;
          case "task":
            result = await syncTaskChange(userId, action, data);
            break;
          default:
            throw new Error(`Unknown change type: ${type}`);
        }

        results.success.push({
          localId,
          serverId: result._id,
          type,
          action,
        });
      } catch (error) {
        logger.error("Error syncing change:", error);
        results.failed.push({
          localId: change.localId,
          // Plan limits are safe (and useful) to show; other errors only outside production
          error:
            (error.isOperational && typeof error.code === "string") || process.env.NODE_ENV !== "production"
              ? error.message
              : undefined,
          ...(error.isOperational && typeof error.code === "string" ? { code: error.code } : {}),
        });
      }
    }

    res.status(200).json({
      success: true,
      data: results,
      syncedAt: new Date(),
    });
  } catch (error) {
    logger.error("Error syncing offline changes:", error);
    next(error);
  }
};

/**
 * Upload image from mobile camera
 * POST /api/v1/mobile/upload-image
 */
export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError("No image file provided", 400));
    }

    const { optimize = "true", quality = "medium" } = req.body;

    let imageBuffer = req.file.buffer;

    // Validate image
    const isValid = await imageOptimizationService.validateImage(imageBuffer);
    if (!isValid) {
      return next(new AppError("Invalid image file", 400));
    }

    // Optimize for mobile if requested
    if (optimize === "true") {
      imageBuffer = await imageOptimizationService.compressForMobile(
        imageBuffer,
        quality
      );
    }

    // Get metadata
    const metadata = await imageOptimizationService.getMetadata(imageBuffer);

    // Store (Cloudinary when configured, otherwise GridFS served by GET /mobile/images/:fileId)
    const stored = await uploadToCloudinary(imageBuffer, {
      folder: "mobile-uploads",
      resource_type: "image",
      filename: `mobile-${req.user._id}-${Date.now()}.${metadata.format}`,
      mimetype: `image/${metadata.format}`,
      metadata: { owner: String(req.user._id), source: "mobile" },
    });
    const fileId = String(stored.public_id).startsWith("gridfs:") ? String(stored.public_id).slice(7) : null;

    res.status(200).json({
      success: true,
      data: {
        url: stored.secure_url || `/api/v1/mobile/images/${fileId}`,
        fileId: fileId || stored.public_id,
        metadata: {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          size: metadata.size,
        },
      },
    });
  } catch (error) {
    logger.error("Error uploading image:", error);
    next(error);
  }
};

/**
 * Get mobile app configuration
 * GET /api/v1/mobile/config
 */
export const getMobileConfig = async (req, res, next) => {
  try {
    const config = {
      offline: {
        enabled: pwaConfig.offline.enabled,
        syncInterval: pwaConfig.offline.sync.syncInterval,
      },
      pushNotifications: {
        enabled: pwaConfig.pushNotifications.enabled,
        vapidPublicKey: pwaConfig.pushNotifications.vapidPublicKey,
      },
      imageOptimization: {
        enabled: true,
        maxSize: 10 * 1024 * 1024, // 10MB
        supportedFormats: ["jpeg", "jpg", "png", "webp"],
      },
      features: {
        camera: true,
        geolocation: true,
        notifications: true,
        backgroundSync: pwaConfig.backgroundSync.enabled,
      },
    };

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error("Error getting mobile config:", error);
    next(error);
  }
};

/**
 * Register push notification subscription
 * POST /api/v1/mobile/push-subscribe
 */
export const subscribePush = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { subscription } = req.body;

    if (!subscription) {
      return next(new AppError("Subscription data required", 400));
    }

    let endpoint;
    try {
      endpoint = new URL(subscription.endpoint);
    } catch {
      return next(new AppError("subscription.endpoint must be a valid URL", 400));
    }
    if (endpoint.protocol !== "https:") {
      return next(new AppError("subscription.endpoint must use https", 400));
    }

    // One record per browser subscription; re-subscribing moves it to this user
    await PushToken.findOneAndUpdate(
      { token: subscription.endpoint },
      {
        $set: {
          user: userId,
          platform: "web",
          kind: "webpush",
          subscription: { endpoint: subscription.endpoint, keys: subscription.keys || {} },
          deviceName: req.headers["user-agent"]?.slice(0, 200),
          isActive: true,
          lastUsedAt: new Date(),
          expiresAt: subscription.expirationTime ? new Date(subscription.expirationTime) : null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info("Push subscription registered", {
      userId,
      endpoint: endpoint.origin,
    });

    res.status(200).json({
      success: true,
      message: "Push notification subscription registered",
    });
  } catch (error) {
    logger.error("Error subscribing to push notifications:", error);
    next(error);
  }
};

/**
 * Check mobile device capabilities
 * POST /api/v1/mobile/capabilities
 */
export const checkCapabilities = async (req, res, next) => {
  try {
    const { userAgent, features = {} } = req.body;

    const capabilities = {
      mobile: /Mobile|Android|iPhone|iPad/i.test(userAgent),
      ios: /iPhone|iPad|iPod/i.test(userAgent),
      android: /Android/i.test(userAgent),
      pwa: features.serviceWorker || false,
      camera: features.camera || false,
      geolocation: features.geolocation || false,
      notifications: features.notifications || false,
      touchScreen: features.touchScreen || false,
    };

    res.status(200).json({
      success: true,
      data: capabilities,
    });
  } catch (error) {
    logger.error("Error checking capabilities:", error);
    next(error);
  }
};

// Helper functions for syncing

async function syncEventChange(userId, action, data) {
  switch (action) {
    case "create":
      return await Event.create({ ...data, planner: userId });
    case "update":
      return await Event.findOneAndUpdate(
        { _id: data._id, planner: userId },
        data,
        { new: true }
      );
    case "delete":
      return await Event.findOneAndDelete({ _id: data._id, planner: userId });
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function syncClientChange(userId, action, data) {
  switch (action) {
    case "create":
      return await Client.create({ ...data, planner: userId });
    case "update":
      return await Client.findOneAndUpdate(
        { _id: data._id, planner: userId },
        data,
        { new: true }
      );
    case "delete":
      return await Client.findOneAndDelete({ _id: data._id, planner: userId });
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function syncTaskChange(userId, action, data) {
  switch (action) {
    case "create":
      return await Task.create({ ...data, planner: userId });
    case "update":
      return await Task.findOneAndUpdate(
        { _id: data._id, planner: userId },
        data,
        { new: true }
      );
    case "delete":
      return await Task.findOneAndDelete({ _id: data._id, planner: userId });
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export default {
  getManifest,
  getOfflineData,
  syncOfflineChanges,
  uploadImage,
  getMobileConfig,
  subscribePush,
  checkCapabilities,
};

/**
 * Serve a GridFS-stored mobile upload (owner only)
 * GET /api/v1/mobile/images/:fileId
 */
export const getUploadedImage = async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { getFileMetadata } = await import("../services/file-storage.service.js");
    const meta = await getFileMetadata(fileId).catch(() => null);
    if (!meta || meta.metadata?.source !== "mobile") return next(new AppError("Image not found", 404));
    if (String(meta.metadata?.owner) !== String(req.user._id)) return next(new AppError("Image not found", 404));
    await streamStoredFile(`gridfs:${fileId}`, res, { filename: meta.filename, mimeType: meta.contentType, inline: true });
  } catch (error) {
    next(error);
  }
};
