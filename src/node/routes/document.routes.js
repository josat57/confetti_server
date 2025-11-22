import express from "express";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  listEventDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
  updateDocument,
} from "../controllers/document.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Event-specific document routes (mounted under /api/v1/events/:eventId/documents)
export const eventDocumentRoutes = express.Router({ mergeParams: true });
eventDocumentRoutes.get("/", listEventDocuments);
eventDocumentRoutes.post("/", upload.single("file"), uploadDocument);

// General document routes (mounted under /api/v1/documents)
router.get("/:eventId/:documentId", downloadDocument);
router.patch("/:eventId/:documentId", updateDocument);
router.delete("/:eventId/:documentId", deleteDocument);

export default router;
