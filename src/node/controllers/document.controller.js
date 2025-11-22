import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";
import {
  uploadToGridFS,
  deleteFromGridFS,
  fileToBase64,
} from "../utils/gridfs.js";

/**
 * List documents for an event
 * GET /api/v1/events/:eventId/documents
 */
export const listEventDocuments = async (req, res, next) => {
  try {
    const { type, search } = req.query;

    const event = await Event.findById(req.params.eventId).select("documents");

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    let documents = event.documents || [];

    // Filter by type
    if (type) {
      documents = documents.filter((doc) => doc.type === type);
    }

    // Search by name
    if (search) {
      documents = documents.filter((doc) =>
        doc.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort by upload date (newest first)
    documents.sort((a, b) => b.uploadedAt - a.uploadedAt);

    res.status(200).json({
      status: "success",
      data: {
        documents,
        total: documents.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload document to event
 * POST /api/v1/events/:eventId/documents
 */
export const uploadDocument = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check access
    if (event.planner.toString() !== req.user._id.toString()) {
      return next(new AppError("Access denied", 403));
    }

    // Check if file was uploaded
    if (!req.file) {
      return next(new AppError("File is required", 400));
    }

    const { type, description } = req.body;

    // Upload to GridFS
    const uploadResult = await uploadToGridFS(
      req.file.buffer,
      `event-doc-${event._id}-${Date.now()}-${req.file.originalname}`,
      req.file.mimetype,
      {
        eventId: event._id,
        type: type || "other",
        uploadedBy: req.user._id,
      }
    );

    // Add document to event
    const document = {
      name: req.file.originalname,
      type: type || "other",
      fileId: uploadResult.fileId,
      size: req.file.size,
      mimeType: req.file.mimetype,
      description: description || "",
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    };

    event.documents = event.documents || [];
    event.documents.push(document);
    await event.save();

    res.status(201).json({
      status: "success",
      message: "Document uploaded successfully",
      data: { document },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download document
 * GET /api/v1/documents/:eventId/:documentId
 */
export const downloadDocument = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    const document = event.documents.id(req.params.documentId);

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Get file as base64
    const fileData = await fileToBase64(document.fileId);

    res.status(200).json({
      status: "success",
      data: {
        name: document.name,
        type: document.type,
        mimeType: document.mimeType,
        data: fileData,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete document
 * DELETE /api/v1/documents/:eventId/:documentId
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check access
    if (event.planner.toString() !== req.user._id.toString()) {
      return next(new AppError("Access denied", 403));
    }

    const document = event.documents.id(req.params.documentId);

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Delete from GridFS
    try {
      await deleteFromGridFS(document.fileId);
    } catch (error) {
      console.error("Error deleting document from GridFS:", error);
    }

    // Remove from event
    document.remove();
    await event.save();

    res.status(200).json({
      status: "success",
      message: "Document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update document metadata
 * PATCH /api/v1/documents/:eventId/:documentId
 */
export const updateDocument = async (req, res, next) => {
  try {
    const { name, type, description } = req.body;

    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    const document = event.documents.id(req.params.documentId);

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Update fields
    if (name) document.name = name;
    if (type) document.type = type;
    if (description !== undefined) document.description = description;

    await event.save();

    res.status(200).json({
      status: "success",
      data: { document },
    });
  } catch (error) {
    next(error);
  }
};
