import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

let gfsBucket;

/**
 * Initialize GridFS bucket
 */
export const initGridFS = () => {
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, {
    bucketName: "uploads",
  });
  console.log("✅ GridFS initialized");
  return gfsBucket;
};

/**
 * Get GridFS bucket instance
 */
export const getGridFSBucket = () => {
  if (!gfsBucket) {
    throw new Error("GridFS not initialized. Call initGridFS() first.");
  }
  return gfsBucket;
};

/**
 * Upload file to GridFS from buffer
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - File mimetype
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} - Upload result with file ID
 */
export const uploadToGridFS = (buffer, filename, mimetype, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const readableStream = Readable.from(buffer);

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimetype,
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
      },
    });

    readableStream.pipe(uploadStream);

    uploadStream.on("error", (error) => {
      reject(error);
    });

    uploadStream.on("finish", () => {
      resolve({
        fileId: uploadStream.id,
        filename: filename,
        contentType: mimetype,
        size: uploadStream.length,
      });
    });
  });
};

/**
 * Download file from GridFS as buffer
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<Buffer>} - File buffer
 */
export const downloadFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const chunks = [];

    const downloadStream = bucket.openDownloadStream(
      new mongoose.Types.ObjectId(fileId)
    );

    downloadStream.on("data", (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on("error", (error) => {
      reject(error);
    });

    downloadStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

/**
 * Get file info from GridFS
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<Object>} - File metadata
 */
export const getFileInfo = async (fileId) => {
  const bucket = getGridFSBucket();
  const files = await bucket
    .find({ _id: new mongoose.Types.ObjectId(fileId) })
    .toArray();

  if (files.length === 0) {
    throw new Error("File not found");
  }

  return files[0];
};

/**
 * Delete file from GridFS
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<void>}
 */
export const deleteFromGridFS = async (fileId) => {
  const bucket = getGridFSBucket();
  await bucket.delete(new mongoose.Types.ObjectId(fileId));
};

/**
 * Convert file to base64
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<string>} - Base64 string with data URI
 */
export const fileToBase64 = async (fileId) => {
  try {
    const fileInfo = await getFileInfo(fileId);
    const buffer = await downloadFromGridFS(fileId);
    const base64 = buffer.toString("base64");
    return `data:${fileInfo.contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error converting file to base64:", error);
    return null;
  }
};

/**
 * Check if file exists in GridFS
 * @param {string|ObjectId} fileId - GridFS file ID
 * @returns {Promise<boolean>}
 */
export const fileExists = async (fileId) => {
  try {
    await getFileInfo(fileId);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * List all files in GridFS (with pagination)
 * @param {Object} filter - MongoDB filter
 * @param {number} limit - Number of files to return
 * @param {number} skip - Number of files to skip
 * @returns {Promise<Array>} - Array of file metadata
 */
export const listFiles = async (filter = {}, limit = 50, skip = 0) => {
  const bucket = getGridFSBucket();
  return await bucket.find(filter).limit(limit).skip(skip).toArray();
};
