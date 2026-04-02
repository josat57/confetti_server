import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { upload } from "../utils/cloudinary.js";
import {
  getDocuments,
  uploadDocument,
  getDocumentById,
  deleteDocument,
  downloadDocument,
  shareDocument,
  getStorageInfo,
} from "../controllers/planner-document.controller.js";

const router = express.Router();

// All routes require authentication and planner role
router.use(protect);
router.use(restrictTo("event-planner"));

/**
 * @swagger
 * /planner/documents/storage:
 *   get:
 *     summary: Get storage information
 *     description: Get storage usage statistics and limits for the planner
 *     tags: [Planner Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Storage information retrieved successfully
 */
router.get(
  "/storage",
  rateLimiter("planner-documents-storage", 50, 60 * 60), // 50 requests per hour
  getStorageInfo
);

/**
 * @swagger
 * /planner/documents:
 *   get:
 *     summary: List documents with filters
 *     description: Get all documents for the planner with filtering, searching, and pagination
 *     tags: [Planner Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in document name and description
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *         description: Filter by event ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by document type
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *   post:
 *     summary: Upload document
 *     description: Upload a new document for the planner
 *     tags: [Planner Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               eventId:
 *                 type: string
 *                 description: Optional event ID to associate with document
 *               description:
 *                 type: string
 *                 description: Document description
 *               type:
 *                 type: string
 *                 enum: [contract, invoice, proposal, other]
 *                 default: other
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *       400:
 *         description: No file uploaded or invalid file
 */
router
  .route("/")
  .get(
    rateLimiter("planner-documents-list", 100, 60 * 60), // 100 requests per hour
    getDocuments
  )
  .post(
    rateLimiter("planner-documents-upload", 20, 60 * 60), // 20 uploads per hour
    upload.single("file"),
    uploadDocument
  );

/**
 * @swagger
 * /planner/documents/{id}:
 *   get:
 *     summary: Get document details
 *     description: Get detailed information about a specific document
 *     tags: [Planner Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document details retrieved successfully
 *       404:
 *         description: Document not found
 *   delete:
 *     summary: Delete document
 *     description: Delete a document and remove it from storage
 *     tags: [Planner Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted successfully
 *       404:
 *         description: Document not found
 */
router
  .route("/:id")
  .get(
    rateLimiter("planner-documents-get", 200, 60 * 60), // 200 requests per hour
    getDocumentById
  )
  .delete(
    rateLimiter("planner-documents-delete", 50, 60 * 60), // 50 deletes per hour
    deleteDocument
  );

/**
 * @swagger
 * /planner/documents/{id}/download:
 *   get:
 *     summary: Download document
 *     description: Download a document file
 *     tags: [Planner Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       302:
 *         description: Redirect to document download URL
 *       404:
 *         description: Document not found
 */
router.get(
  "/:id/download",
  rateLimiter("planner-documents-download", 100, 60 * 60), // 100 downloads per hour
  downloadDocument
);

/**
 * @swagger
 * /planner/documents/{id}/share:
 *   post:
 *     summary: Share document
 *     description: Share a document with specified email addresses
 *     tags: [Planner Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emails
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: email
 *                 description: List of email addresses to share with
 *               message:
 *                 type: string
 *                 description: Optional message to include in share notification
 *     responses:
 *       200:
 *         description: Document shared successfully
 *       404:
 *         description: Document not found
 */
router.post(
  "/:id/share",
  rateLimiter("planner-documents-share", 30, 60 * 60), // 30 shares per hour
  shareDocument
);

export default router;
