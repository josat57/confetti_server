import Document from "../models/document.model.js";
import { AppError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs/promises";
import { createClient } from "redis";

// Try to import sharp, but make it optional
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch (error) {
  console.warn(
    "Sharp module not available. Image processing will be disabled."
  );
  sharp = null;
}

class DocumentService {
  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URI,
    });
    this.redis.connect().catch((err) => {
      logger.error("Redis connection error:", err);
    });
  }

  // Upload document
  async uploadDocument(file, userId, metadata = {}) {
    try {
      const document = await Document.create({
        name: file.originalname,
        type: this.getDocumentType(file.mimetype),
        mimeType: file.mimetype,
        size: file.size,
        url: file.path,
        owner: userId,
        metadata: {
          ...metadata,
          originalName: file.originalname,
          encoding: file.encoding,
        },
      });

      // Process document based on type
      await this.processDocument(document);

      return document;
    } catch (error) {
      logger.error("Error uploading document:", error);
      throw new AppError("Failed to upload document", 500);
    }
  }

  // Get document by ID
  async getDocument(documentId, user) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new AppError("Document not found", 404);
      }

      if (!document.hasPermission(user)) {
        throw new AppError("Not authorized to access this document", 403);
      }

      return document;
    } catch (error) {
      logger.error("Error fetching document:", error);
      throw error;
    }
  }

  // Get documents by owner
  async getDocumentsByOwner(userId, options = {}) {
    try {
      const { type, status, limit = 50, skip = 0 } = options;
      const query = { owner: userId };

      if (type) query.type = type;
      if (status) query.status = status;

      const documents = await Document.find(query)
        .sort({ "timestamps.uploaded": -1 })
        .skip(skip)
        .limit(limit);

      return documents;
    } catch (error) {
      logger.error("Error fetching documents:", error);
      throw new AppError("Failed to fetch documents", 500);
    }
  }

  // Get documents by event
  async getDocumentsByEvent(eventId, options = {}) {
    try {
      const { type, status, limit = 50, skip = 0 } = options;
      const query = { event: eventId };

      if (type) query.type = type;
      if (status) query.status = status;

      const documents = await Document.find(query)
        .sort({ "timestamps.uploaded": -1 })
        .skip(skip)
        .limit(limit);

      return documents;
    } catch (error) {
      logger.error("Error fetching event documents:", error);
      throw new AppError("Failed to fetch event documents", 500);
    }
  }

  // Get documents by vendor
  async getDocumentsByVendor(vendorId, options = {}) {
    try {
      const { type, status, limit = 50, skip = 0 } = options;
      const query = { vendor: vendorId };

      if (type) query.type = type;
      if (status) query.status = status;

      const documents = await Document.find(query)
        .sort({ "timestamps.uploaded": -1 })
        .skip(skip)
        .limit(limit);

      return documents;
    } catch (error) {
      logger.error("Error fetching vendor documents:", error);
      throw new AppError("Failed to fetch vendor documents", 500);
    }
  }

  // Update document
  async updateDocument(documentId, userId, updates) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new AppError("Document not found", 404);
      }

      if (document.owner.toString() !== userId.toString()) {
        throw new AppError("Not authorized to update this document", 403);
      }

      Object.assign(document, updates);
      await document.save();

      return document;
    } catch (error) {
      logger.error("Error updating document:", error);
      throw error;
    }
  }

  // Delete document
  async deleteDocument(documentId, userId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new AppError("Document not found", 404);
      }

      if (document.owner.toString() !== userId.toString()) {
        throw new AppError("Not authorized to delete this document", 403);
      }

      await document.delete();
      await this.deleteFile(document.url);

      return document;
    } catch (error) {
      logger.error("Error deleting document:", error);
      throw error;
    }
  }

  // Archive document
  async archiveDocument(documentId, userId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new AppError("Document not found", 404);
      }

      if (document.owner.toString() !== userId.toString()) {
        throw new AppError("Not authorized to archive this document", 403);
      }

      await document.archive();
      return document;
    } catch (error) {
      logger.error("Error archiving document:", error);
      throw error;
    }
  }

  // Add document version
  async addVersion(documentId, userId, file, changes) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new AppError("Document not found", 404);
      }

      if (document.owner.toString() !== userId.toString()) {
        throw new AppError("Not authorized to update this document", 403);
      }

      const versionData = {
        url: file.path,
        size: file.size,
        mimeType: file.mimetype,
        userId,
        changes,
      };

      await document.addVersion(versionData);
      await this.processDocument(document);

      return document;
    } catch (error) {
      logger.error("Error adding document version:", error);
      throw error;
    }
  }

  // Update document permissions
  async updatePermissions(documentId, userId, permissions) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new AppError("Document not found", 404);
      }

      if (document.owner.toString() !== userId.toString()) {
        throw new AppError("Not authorized to update permissions", 403);
      }

      document.permissions = permissions;
      await document.save();

      return document;
    } catch (error) {
      logger.error("Error updating document permissions:", error);
      throw error;
    }
  }

  // Get document statistics
  async getDocumentStats(userId) {
    try {
      const stats = await Document.aggregate([
        {
          $match: {
            owner: userId,
            status: { $ne: "deleted" },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalSize: { $sum: "$size" },
            byType: {
              $push: {
                type: "$type",
                count: 1,
                size: "$size",
              },
            },
            byStatus: {
              $push: {
                status: "$status",
                count: 1,
              },
            },
          },
        },
      ]);

      return (
        stats[0] || {
          total: 0,
          totalSize: 0,
          byType: [],
          byStatus: [],
        }
      );
    } catch (error) {
      logger.error("Error getting document stats:", error);
      throw new AppError("Failed to get document statistics", 500);
    }
  }

  // Private methods

  // Get document type from MIME type
  getDocumentType(mimeType) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("application/")) return "document";
    return "other";
  }

  // Process document based on type
  async processDocument(document) {
    try {
      switch (document.type) {
        case "image":
          await this.processImage(document);
          break;
        case "video":
          await this.processVideo(document);
          break;
        case "document":
          await this.processDocument(document);
          break;
      }

      await document.markAsProcessed();
    } catch (error) {
      logger.error("Error processing document:", error);
      throw new AppError("Failed to process document", 500);
    }
  }

  // Process image document
  async processImage(document) {
    if (!sharp) {
      logger.warn("Sharp not available, skipping image processing");
      return;
    }

    try {
      const image = sharp(document.url);
      const metadata = await image.metadata();

      // Update document metadata
      document.metadata.width = metadata.width;
      document.metadata.height = metadata.height;

      // Generate thumbnail
      const thumbnailPath = path.join(
        path.dirname(document.url),
        `${path.basename(document.url, path.extname(document.url))}_thumb.jpg`
      );

      await image
        .resize(200, 200, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      document.thumbnail = thumbnailPath;
      await document.save();
    } catch (error) {
      logger.error("Error processing image:", error);
      throw error;
    }
  }

  // Process video document
  async processVideo(document) {
    // TODO: Implement video processing (generate thumbnail, extract metadata)
    logger.info("Video processing not implemented yet");
  }

  // Process document file
  async processDocument(document) {
    // TODO: Implement document processing (extract text, generate preview)
    logger.info("Document processing not implemented yet");
  }

  // Delete file from storage
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.error("Error deleting file:", error);
      // Don't throw error as this is a non-critical operation
    }
  }
}

export default new DocumentService();
