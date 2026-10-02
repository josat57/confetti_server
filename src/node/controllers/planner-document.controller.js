import Document from "../models/document.model.js";
import Event from "../models/event.model.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  streamStoredFile,
} from "../utils/cloudinary.js";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const shareSecret = () => process.env.DOCUMENT_SHARE_SECRET || process.env.JWT_ACCESS_SECRET;

/** HMAC-signed "<docId>.<expiryMs>.<signature>" token. */
const createShareToken = (documentId, days) => {
  const payload = `${documentId}.${Date.now() + days * 24 * 60 * 60 * 1000}`;
  const sig = crypto.createHmac("sha256", shareSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
};

const verifyShareToken = (documentId, token) => {
  const [id, expiry, sig] = String(token || "").split(".");
  if (!id || !expiry || !sig || id !== String(documentId)) return false;
  const expected = crypto.createHmac("sha256", shareSecret()).update(`${id}.${expiry}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(expiry) > Date.now();
};

/**
 * Public access to a shared document via its signed link.
 * GET /api/v1/shared/documents/:id?token=...  (add &format=json for metadata)
 */
export const accessSharedDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id) || !verifyShareToken(id, req.query.token)) {
      return next(new AppError("This share link is invalid or has expired", 403));
    }
    const document = await Document.findOne({ _id: id, status: { $ne: "deleted" } })
      .populate("event", "title")
      .lean();
    if (!document) {
      return next(new AppError("Document not found", 404));
    }
    const isGridFS = String(document.cloudinaryId || "").startsWith("gridfs:");
    if (req.query.format === "json") {
      return res.status(200).json({
        status: "success",
        data: {
          document: {
            id: document._id,
            name: document.name,
            type: document.type,
            mimeType: document.mimeType,
            size: document.size,
            url: isGridFS ? null : document.url,
            event: document.event?.title,
          },
        },
      });
    }
    if (await streamStoredFile(document.cloudinaryId, res, { filename: document.name, mimeType: document.mimeType })) {
      return;
    }
    res.redirect(document.url);
  } catch (error) {
    next(error);
  }
};

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
    const query = { owner: userId, status: { $ne: "deleted" } };

    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { "metadata.description": rx }, { "metadata.tags": rx }];
    }

    if (eventId) {
      query.event = eventId;
    }

    if (type) {
      query.type = type;
    }

    // Execute query with pagination
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * (parseInt(limit, 10) || 20);
    const sortOptions = {
      [["createdAt", "name", "size", "type"].includes(sortBy) ? sortBy : "createdAt"]: sortOrder === "desc" ? -1 : 1,
    };

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
        $or: [{ planner: userId }, { organizer: userId }, { createdBy: userId }],
      });

      if (!event) {
        return next(new AppError("Event not found or access denied", 404));
      }
    }

    // Upload to cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      folder: "planner-documents",
      resource_type: "auto",
      public_id: `${userId}_${Date.now()}_${path.parse(req.file.originalname).name}`,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      metadata: { owner: String(userId) },
    });

    const validTypes = ["image", "video", "document", "audio", "other"];
    const docType = validTypes.includes(type)
      ? type
      : /^image\//.test(req.file.mimetype)
      ? "image"
      : /^video\//.test(req.file.mimetype)
      ? "video"
      : /^audio\//.test(req.file.mimetype)
      ? "audio"
      : "document";

    // Create document record
    const document = new Document({
      name: req.file.originalname,
      type: docType,
      // GridFS-stored files are served by the (authenticated) download endpoint
      url: uploadResult.secure_url || "pending",
      cloudinaryId: uploadResult.public_id,
      size: req.file.size,
      mimeType: req.file.mimetype,
      event: eventId || null,
      owner: userId,
      status: "active",
      metadata: {
        description,
        originalName: req.file.originalname,
      },
    });

    if (!uploadResult.secure_url) {
      document.url = `/api/v1/planner/documents/${document._id}/download`;
    }
    try {
      await document.save();
    } catch (saveError) {
      // Don't leave an orphaned file behind
      await deleteFromCloudinary(uploadResult.public_id).catch(() => {});
      throw saveError;
    }

    // Populate event info
    await document.populate("event", "title eventDate");

    res.status(201).json({
      status: "success",
      message: "Document uploaded successfully",
      data: { document },
    });
  } catch (error) {
    logger.error("Upload document error:", error);
    next(error.statusCode ? error : new AppError("Failed to upload document", 500));
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
      owner: userId,
      status: { $ne: "deleted" },
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
      owner: userId,
      status: { $ne: "deleted" },
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
      owner: userId,
      status: { $ne: "deleted" },
    });

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // GridFS-stored files are streamed; cloud-hosted files redirect to the CDN
    if (await streamStoredFile(document.cloudinaryId, res, { filename: document.name, mimeType: document.mimeType })) {
      return;
    }
    res.redirect(document.url);
  } catch (error) {
    logger.error("Download document error:", error);
    next(error.statusCode ? error : new AppError("Failed to download document", 500));
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
      owner: userId,
      status: { $ne: "deleted" },
    }).populate("event", "title");

    if (!document) {
      return next(new AppError("Document not found", 404));
    }

    // Validate recipients
    const recipients = [...new Set((Array.isArray(emails) ? emails : emails ? [emails] : []).map((e) => String(e).trim().toLowerCase()))];
    const invalid = recipients.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) {
      return next(new AppError(`Invalid email address(es): ${invalid.join(", ")}`, 400));
    }
    if (recipients.length > 20) {
      return next(new AppError("You can share with at most 20 recipients at a time", 400));
    }
    const days = Math.min(30, Math.max(1, parseInt(req.body.expiresInDays, 10) || 7));

    // Signed, expiring link served by GET /api/v1/shared/documents/:id
    const token = createShareToken(document._id, days);
    const base = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const shareableLink = `${base}/api/v1/shared/documents/${document._id}?token=${encodeURIComponent(token)}`;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const delivery = [];
    if (recipients.length) {
      const { sendEmailDirect } = await import("../utils/email.js");
      const sender = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || req.user.email || "An event planner";
      for (const to of recipients) {
        try {
          await sendEmailDirect({
            to,
            subject: `${sender} shared "${document.name}" with you`,
            text: `${sender} shared the document "${document.name}"${document.event?.title ? ` for ${document.event.title}` : ""} with you.${message ? `\n\n"${message}"` : ""}\n\nOpen it here (link expires ${expiresAt.toDateString()}):\n${shareableLink}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
              <p><strong>${escapeHtml(sender)}</strong> shared the document <strong>${escapeHtml(document.name)}</strong>${
                document.event?.title ? ` for <strong>${escapeHtml(document.event.title)}</strong>` : ""
              } with you.</p>
              ${message ? `<blockquote style="border-left:3px solid #ddd;margin:12px 0;padding-left:12px;color:#4b5563">${escapeHtml(message)}</blockquote>` : ""}
              <p><a href="${escapeHtml(shareableLink)}" style="background:#6d28d9;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open document</a></p>
              <p style="font-size:12px;color:#6b7280">This link expires on ${expiresAt.toDateString()}.</p></div>`,
          });
          delivery.push({ email: to, status: "sent" });
        } catch (error) {
          logger.error("Document share email failed", { to, error: error.message });
          delivery.push({ email: to, status: "failed", error: error.message });
        }
      }
    }

    res.status(200).json({
      status: "success",
      message: delivery.some((d) => d.status === "failed")
        ? "Document shared, but some emails could not be sent"
        : "Document shared successfully",
      data: {
        shareableLink,
        expiresAt,
        sharedWith: recipients,
        delivery,
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
      {
        $match: {
          owner: new mongoose.Types.ObjectId(String(userId)),
          status: { $ne: "deleted" },
        },
      },
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
