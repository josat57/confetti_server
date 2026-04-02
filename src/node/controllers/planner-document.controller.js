import Document from "../models/document.model.js";
import Event from "../models/event.model.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import path from "path";

/**
 * Get all documents for planner with filters
 * GET /api/v1/planner/documents
 */
export const getDocuments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      search,
      eventId,
      type,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { uploadedBy: userId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (eventId) {
      query.event = eventId;
    }

    if (type) {
      query.type = type;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate("event", "title eventDate")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Document.countDocuments(query),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error("Get documents error:", error);
    next(new AppError("Failed to fetch documents", 500));
  }
};

/**
 * Upload document
 * POST /api/v1/planner/documents
 */
export const uploadDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { eventId, description, type = "other" } = req.body;

    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    // Verify event ownership if eventId provided
    if (eventId) {
      const event = await Event.findOne({
        _id: eventId,
        owner: userId,
        ownerType: "event-planner",
      });

      if (!event) {
        return next(new AppError("Event not found or access denied", 404));
      }
    }

    // Upload to cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      folder: "planner-documents",
      resource_type: "auto",
      public_id: `${userId}_${Date.now()}_${req.file.originalname}`,
    });

    // Create document record
    const document = new Document({
      name: req.file.originalname,
      description,
      type,
      url: uploadResult.secure_url,
      cloudinaryId: uploadResult.public_id,
      size: req.file.size,
      mimeType: req.file.mimetype,
      event: eventId || null,
      uploadedBy: userId,
      uploadedByType: "event-planner",
    });

    await document.save();

    // Populate event info
    await document.populate("event", "title eventDate");

    res.status(201).json({
      status: "success",
      message: "Document uploaded successfully",
      data: { document },
    });
  } catch (error) {
    logger.error("Upload document error:", error);
    next(new AppError("Failed to upload document", 500));
  }
};

/**
 * Get document details
 * GET /api/v1/planner/documents/:id
 */
export const getDocumentById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId,
    }).populate("event", "title eventDate");

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { document },
    });
  } catch (error) {
    logger.error("Get document error:", error);
    next(new AppError("Failed to fetch document", 500));
  }
};

/**
 * Delete document
 * DELETE /api/v1/planner/documents/:id
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId,
    });

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Delete from cloudinary
    if (document.cloudinaryId) {
      await deleteFromCloudinary(document.cloudinaryId);
    }

    // Delete from database
    await Document.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Document deleted successfully",
    });
  } catch (error) {
    logger.error("Delete document error:", error);
    next(new AppError("Failed to delete document", 500));
  }
};

/**
 * Download document
 * GET /api/v1/planner/documents/:id/download
 */
export const downloadDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId,
    });

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Redirect to cloudinary URL for download
    res.redirect(document.url);
  } catch (error) {
    logger.error("Download document error:", error);
    next(new AppError("Failed to download document", 500));
  }
};

/**
 * Share document
 * POST /api/v1/planner/documents/:id/share
 */
export const shareDocument = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { emails, message } = req.body;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId,
    }).populate("event", "title");

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Generate shareable link (in production, you might want to create temporary tokens)
    const shareableLink = `${process.env.FRONTEND_URL}/shared/documents/${document._id}`;

    // Here you would typically send emails to the recipients
    // For now, we'll just return the shareable link

    res.status(200).json({
      status: "success",
      message: "Document shared successfully",
      data: {
        shareableLink,
        sharedWith: emails,
        document: {
          id: document._id,
          name: document.name,
          event: document.event?.title,
        },
      },
    });
  } catch (error) {
    logger.error("Share document error:", error);
    next(new AppError("Failed to share document", 500));
  }
};

/**
 * Get storage information
 * GET /api/v1/planner/documents/storage
 */
export const getStorageInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Calculate storage usage
    const storageStats = await Document.aggregate([
      { $match: { uploadedBy: userId } },
      {
        $group: {
          _id: null,
          totalSize: { $sum: "$size" },
          totalDocuments: { $sum: 1 },
          byType: {
            $push: {
              type: "$type",
              size: "$size",
            },
          },
        },
      },
    ]);

    const stats = storageStats[0] || {
      totalSize: 0,
      totalDocuments: 0,
      byType: [],
    };

    // Calculate type breakdown
    const typeBreakdown = {};
    stats.byType.forEach((item) => {
      if (!typeBreakdown[item.type]) {
        typeBreakdown[item.type] = { count: 0, size: 0 };
      }
      typeBreakdown[item.type].count++;
      typeBreakdown[item.type].size += item.size;
    });

    // Storage limits based on subscription (you can adjust these)
    const storageLimit = 5 * 1024 * 1024 * 1024; // 5GB default
    const usagePercentage = ((stats.totalSize / storageLimit) * 100).toFixed(2);

    res.status(200).json({
      status: "success",
      data: {
        usage: {
          totalSize: stats.totalSize,
          totalDocuments: stats.totalDocuments,
          usagePercentage: parseFloat(usagePercentage),
          storageLimit,
        },
        breakdown: typeBreakdown,
        limits: {
          maxFileSize: 100 * 1024 * 1024, // 100MB
          allowedTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "image/jpeg",
            "image/png",
            "image/gif",
          ],
        },
      },
    });
  } catch (error) {
    logger.error("Get storage info error:", error);
    next(new AppError("Failed to fetch storage information", 500));
  }
};

export default {
  getDocuments,
  uploadDocument,
  getDocumentById,
  deleteDocument,
  downloadDocument,
  shareDocument,
  getStorageInfo,
};
