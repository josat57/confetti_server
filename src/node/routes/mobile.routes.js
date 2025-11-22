import express from "express";
import { protect } from "../middleware/auth.js";
import multer from "multer";
import {
  getManifest,
  getOfflineData,
  syncOfflineChanges,
  uploadImage,
  getMobileConfig,
  subscribePush,
  checkCapabilities,
} from "../controllers/mobile.controller.js";

const router = express.Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  },
});

/**
 * @swagger
 * /api/v1/mobile/manifest:
 *   get:
 *     summary: Get PWA manifest
 *     tags: [Mobile]
 *     responses:
 *       200:
 *         description: PWA manifest retrieved successfully
 */
router.get("/manifest", getManifest);

/**
 * @swagger
 * /api/v1/mobile/config:
 *   get:
 *     summary: Get mobile app configuration
 *     tags: [Mobile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mobile configuration retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/config", protect, getMobileConfig);

/**
 * @swagger
 * /api/v1/mobile/offline-data:
 *   get:
 *     summary: Get data for offline caching
 *     tags: [Mobile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: types
 *         schema:
 *           type: string
 *           default: events,clients,tasks
 *         description: Comma-separated list of data types to cache
 *     responses:
 *       200:
 *         description: Offline data retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/offline-data", protect, getOfflineData);

/**
 * @swagger
 * /api/v1/mobile/sync:
 *   post:
 *     summary: Sync offline changes
 *     tags: [Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               changes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [event, client, task]
 *                     action:
 *                       type: string
 *                       enum: [create, update, delete]
 *                     data:
 *                       type: object
 *                     localId:
 *                       type: string
 *     responses:
 *       200:
 *         description: Changes synced successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post("/sync", protect, syncOfflineChanges);

/**
 * @swagger
 * /api/v1/mobile/upload-image:
 *   post:
 *     summary: Upload image from mobile camera
 *     tags: [Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               optimize:
 *                 type: string
 *                 enum: [true, false]
 *                 default: true
 *               quality:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *       400:
 *         description: Invalid image file
 *       401:
 *         description: Unauthorized
 */
router.post("/upload-image", protect, upload.single("image"), uploadImage);

/**
 * @swagger
 * /api/v1/mobile/push-subscribe:
 *   post:
 *     summary: Register push notification subscription
 *     tags: [Mobile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: object
 *                 description: Push subscription object
 *     responses:
 *       200:
 *         description: Subscription registered successfully
 *       400:
 *         description: Invalid subscription data
 *       401:
 *         description: Unauthorized
 */
router.post("/push-subscribe", protect, subscribePush);

/**
 * @swagger
 * /api/v1/mobile/capabilities:
 *   post:
 *     summary: Check mobile device capabilities
 *     tags: [Mobile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userAgent:
 *                 type: string
 *               features:
 *                 type: object
 *     responses:
 *       200:
 *         description: Capabilities checked successfully
 */
router.post("/capabilities", checkCapabilities);

export default router;
