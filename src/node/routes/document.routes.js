import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as documentController from '../controllers/document.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validation.middleware.js';
import Joi from 'joi';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/documents');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Add file type validation if needed
    cb(null, true);
  }
});

// Validation schemas
const updateDocumentSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  metadata: Joi.object(),
  permissions: Joi.object({
    public: Joi.boolean(),
    allowedUsers: Joi.array().items(Joi.string()),
    allowedRoles: Joi.array().items(Joi.string())
  })
});

const updatePermissionsSchema = Joi.object({
  permissions: Joi.object({
    public: Joi.boolean().required(),
    allowedUsers: Joi.array().items(Joi.string()),
    allowedRoles: Joi.array().items(Joi.string())
  }).required()
});

const addVersionSchema = Joi.object({
  changes: Joi.string().required()
});

// Routes
router.use(protect); // Protect all routes

// Document upload
router.post(
  '/',
  upload.single('file'),
  documentController.uploadDocument
);

// Get document by ID
router.get(
  '/:documentId',
  documentController.getDocument
);

// Get documents by owner
router.get(
  '/owner',
  documentController.getDocumentsByOwner
);

// Get documents by event
router.get(
  '/event/:eventId',
  documentController.getDocumentsByEvent
);

// Get documents by vendor
router.get(
  '/vendor/:vendorId',
  documentController.getDocumentsByVendor
);

// Update document
router.patch(
  '/:documentId',
  validate(updateDocumentSchema),
  documentController.updateDocument
);

// Delete document
router.delete(
  '/:documentId',
  documentController.deleteDocument
);

// Archive document
router.post(
  '/:documentId/archive',
  documentController.archiveDocument
);

// Add document version
router.post(
  '/:documentId/version',
  upload.single('file'),
  validate(addVersionSchema),
  documentController.addVersion
);

// Update document permissions
router.patch(
  '/:documentId/permissions',
  validate(updatePermissionsSchema),
  documentController.updatePermissions
);

// Get document statistics
router.get(
  '/stats',
  documentController.getDocumentStats
);

export default router; 