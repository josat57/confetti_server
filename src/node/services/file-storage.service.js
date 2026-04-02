/**
 * File Storage Service using GridFS
 *
 * This service handles file uploads, retrieval, and deletion using MongoDB GridFS.
 * GridFS is used for storing files larger than 16MB and provides efficient file management.
 */

import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

let gridFSBucket;

/**
 * Initialize GridFS bucket
 * Should be called after MongoDB connection is established
 */
export function initializeGridFS() {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection not established");
  }

  gridFSBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });

  console.log("✅ GridFS initialized");
  return gridFSBucket;
}

/**
 * Get GridFS bucket instance
 * @returns {GridFSBucket} GridFS bucket instance
 */
export function getGridFSBucket() {
  if (!gridFSBucket) {
    initializeGridFS();
  }
  return gridFSBucket;
}

/**
 * Upload a file to GridFS
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - File MIME type
 * @param {Object} metadata - Optional metadata to store with file
 * @returns {Promise<Object>} Upload result with fileId and file details
 */
export async function uploadToGridFS(
  buffer,
  filename,
  mimetype,
  metadata = {}
) {
  try {
    const bucket = getGridFSBucket();

    return new Promise((resolve, reject) => {
      const readableStream = Readable.from(buffer);
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: mimetype,
        metadata: {
          ...metadata,
          uploadedAt: new Date(),
          size: buffer.length,
        },
      });

      readableStream.pipe(uploadStream);

      uploadStream.on("error", (error) => {
        reject(new Error(`Failed to upload file: ${error.message}`));
      });

      uploadStream.on("finish", () => {
        resolve({
          fileId: uploadStream.id,
          filename: filename,
          contentType: mimetype,
          size: buffer.length,
          uploadedAt: new Date(),
        });
      });
    });
  } catch (error) {
    throw new Error(`GridFS upload error: ${error.message}`);
  }
}

/**
 * Download a file from GridFS
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<Buffer>} File buffer
 */
export async function getFileFromGridFS(fileId) {
  try {
    const bucket = getGridFSBucket();
    const objectId = mongoose.Types.ObjectId.isValid(fileId)
      ? new mongoose.Types.ObjectId(fileId)
      : fileId;

    return new Promise((resolve, reject) => {
      const chunks = [];
      const downloadStream = bucket.openDownloadStream(objectId);

      downloadStream.on("data", (chunk) => {
        chunks.push(chunk);
      });

      downloadStream.on("error", (error) => {
        reject(new Error(`Failed to download file: ${error.message}`));
      });

      downloadStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });
  } catch (error) {
    throw new Error(`GridFS download error: ${error.message}`);
  }
}

/**
 * Get file metadata from GridFS
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<Object>} File metadata
 */
export async function getFileMetadata(fileId) {
  try {
    const bucket = getGridFSBucket();
    const objectId = mongoose.Types.ObjectId.isValid(fileId)
      ? new mongoose.Types.ObjectId(fileId)
      : fileId;

    const files = await bucket.find({ _id: objectId }).toArray();

    if (files.length === 0) {
      throw new Error("File not found");
    }

    return files[0];
  } catch (error) {
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * Delete a file from GridFS
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<void>}
 */
export async function deleteFromGridFS(fileId) {
  try {
    const bucket = getGridFSBucket();
    const objectId = mongoose.Types.ObjectId.isValid(fileId)
      ? new mongoose.Types.ObjectId(fileId)
      : fileId;

    // Check if file exists before attempting deletion
    const files = await bucket.find({ _id: objectId }).toArray();
    if (files.length === 0) {
      throw new Error("File not found");
    }

    await bucket.delete(objectId);
    return { success: true, message: "File deleted successfully" };
  } catch (error) {
    throw new Error(`GridFS deletion error: ${error.message}`);
  }
}

/**
 * Stream a file from GridFS
 * Useful for serving files directly to HTTP responses
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {ReadableStream} File stream
 */
export function streamFileFromGridFS(fileId) {
  try {
    const bucket = getGridFSBucket();
    const objectId = mongoose.Types.ObjectId.isValid(fileId)
      ? new mongoose.Types.ObjectId(fileId)
      : fileId;

    return bucket.openDownloadStream(objectId);
  } catch (error) {
    throw new Error(`GridFS stream error: ${error.message}`);
  }
}

/**
 * Check if a file exists in GridFS
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(fileId) {
  try {
    const bucket = getGridFSBucket();
    const objectId = mongoose.Types.ObjectId.isValid(fileId)
      ? new mongoose.Types.ObjectId(fileId)
      : fileId;

    const files = await bucket.find({ _id: objectId }).toArray();
    return files.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * List all files in GridFS (with optional filtering)
 * @param {Object} filter - MongoDB filter object
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Promise<Array>} Array of file metadata
 */
export async function listFiles(filter = {}, options = {}) {
  try {
    const bucket = getGridFSBucket();
    const { limit = 100, skip = 0, sort = { uploadDate: -1 } } = options;

    const files = await bucket
      .find(filter)
      .limit(limit)
      .skip(skip)
      .sort(sort)
      .toArray();

    return files;
  } catch (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/**
 * Replace an existing file with a new one
 * Deletes the old file and uploads the new one
 * @param {string|ObjectId} oldFileId - Old file ID to replace
 * @param {Buffer} buffer - New file buffer
 * @param {string} filename - New filename
 * @param {string} mimetype - New file MIME type
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<Object>} Upload result with new fileId
 */
export async function replaceFile(
  oldFileId,
  buffer,
  filename,
  mimetype,
  metadata = {}
) {
  try {
    // Upload new file first
    const uploadResult = await uploadToGridFS(
      buffer,
      filename,
      mimetype,
      metadata
    );

    // Delete old file only after successful upload
    if (oldFileId) {
      try {
        await deleteFromGridFS(oldFileId);
      } catch (error) {
        console.warn(
          `Warning: Failed to delete old file ${oldFileId}:`,
          error.message
        );
        // Don't throw error here, new file is already uploaded
      }
    }

    return uploadResult;
  } catch (error) {
    throw new Error(`Failed to replace file: ${error.message}`);
  }
}

export default {
  initializeGridFS,
  getGridFSBucket,
  uploadToGridFS,
  getFileFromGridFS,
  getFileMetadata,
  deleteFromGridFS,
  streamFileFromGridFS,
  fileExists,
  listFiles,
  replaceFile,
};
