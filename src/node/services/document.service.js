import Document from "../models/document.model.js";
import { AppError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
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
      url: process.env.REDIS_URL || process.env.REDIS_URI,
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

  // Process video document — extract metadata and generate a poster thumbnail via ffmpeg
  async processVideo(document) {
    try {
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      // Extract video metadata using ffprobe
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-show_format",
        document.filePath,
      ]);

      const info = JSON.parse(stdout);
      const videoStream = (info.streams || []).find((s) => s.codec_type === "video");
      const format = info.format || {};

      document.metadata = {
        duration: parseFloat(format.duration) || 0,
        size: parseInt(format.size) || document.size,
        bitrate: parseInt(format.bit_rate) || 0,
        width: videoStream?.width,
        height: videoStream?.height,
        codec: videoStream?.codec_name,
        fps: videoStream?.r_frame_rate,
      };

      // Generate thumbnail at 5-second mark (or 10% of duration)
      const seekTime = Math.min(5, (document.metadata.duration || 10) * 0.1);
      const thumbnailPath = document.filePath.replace(/\.[^.]+$/, "_thumb.jpg");

      await execFileAsync("ffmpeg", [
        "-ss", String(seekTime),
        "-i", document.filePath,
        "-vframes", "1",
        "-q:v", "2",
        "-y",
        thumbnailPath,
      ]);

      document.thumbnail = thumbnailPath;
      await document.save();

      logger.info("Video processed successfully", { documentId: document._id });
    } catch (error) {
      logger.warn("Video processing failed (ffmpeg may not be installed):", error.message);
    }
  }

  // Process document file — extract text content and generate a preview snippet
  async processDocument(document) {
    try {
      const ext = path.extname(document.filePath).toLowerCase();

      if (ext === ".pdf") {
        // Use pdf-parse if available
        try {
          const { default: pdfParse } = await import("pdf-parse");
          const buffer = await fs.readFile(document.filePath);
          const data = await pdfParse(buffer);

          document.metadata = {
            pageCount: data.numpages,
            wordCount: (data.text || "").split(/\s+/).filter(Boolean).length,
            extractedText: data.text?.substring(0, 2000) || "",
          };
          document.preview = data.text?.substring(0, 500) || "";
          await document.save();
        } catch (pdfError) {
          logger.warn("pdf-parse not available:", pdfError.message);
        }
      } else if ([".txt", ".md", ".csv"].includes(ext)) {
        const content = await fs.readFile(document.filePath, "utf-8");
        document.metadata = {
          wordCount: content.split(/\s+/).filter(Boolean).length,
          lineCount: content.split("\n").length,
          extractedText: content.substring(0, 2000),
        };
        document.preview = content.substring(0, 500);
        await document.save();
      } else {
        // For other document types (docx, xlsx, etc.) record file stats only
        const stats = await fs.stat(document.filePath);
        document.metadata = { size: stats.size, type: ext.replace(".", "") };
        await document.save();
      }

      logger.info("Document processed successfully", { documentId: document._id });
    } catch (error) {
      logger.warn("Document processing failed:", error.message);
    }
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
