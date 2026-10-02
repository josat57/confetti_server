import multer from "multer";
import path from "path";
import { AppError } from "./AppError.js";
import { logger } from "./logger.js";

/**
 * Document storage for planner uploads.
 *
 * - Cloudinary when CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
 *   CLOUDINARY_API_SECRET are set (public_id = Cloudinary id, secure_url = CDN URL)
 * - otherwise MongoDB GridFS (public_id = "gridfs:<fileId>", secure_url = null;
 *   the file is streamed by the document download/share endpoints)
 */

export const GRIDFS_PREFIX = "gridfs:";
const MAX_FILE_SIZE = Number(process.env.DOCUMENT_MAX_FILE_MB || 25) * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv", ".rtf", ".odt", ".ods",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".svg",
  ".mp4", ".mov", ".avi", ".webm",
  ".mp3", ".wav", ".m4a",
  ".zip",
]);

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new AppError(`File type ${ext || "(none)"} is not allowed`, 400));
    }
    cb(null, true);
  },
});

/** multer wrapper that turns MulterErrors into proper 4xx AppErrors. */
export const upload = {
  single: (field) => (req, res, next) =>
    multerUpload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        const message =
          err.code === "LIMIT_FILE_SIZE"
            ? `File is too large (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB)`
            : `Upload error: ${err.message}`;
        return next(new AppError(message, status));
      }
      next(err);
    }),
};

export const isCloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

let cloudinaryClient = null;
const getCloudinary = async () => {
  if (cloudinaryClient) return cloudinaryClient;
  const { v2 } = (await import("cloudinary")).default;
  v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  cloudinaryClient = v2;
  return v2;
};

/**
 * Upload an image Cloudinary fetches itself: an http(s) URL or a data: URI.
 * Requires Cloudinary to be configured (see isCloudinaryConfigured).
 */
export const uploadRemoteImage = async (source, options = {}) => {
  const cloudinary = await getCloudinary();
  return cloudinary.uploader.upload(source, {
    folder: options.folder || "confetti-ai-images",
    resource_type: "image",
  });
};

/**
 * Store a file buffer. `options` accepts { folder, public_id, resource_type,
 * filename, mimetype, metadata }.
 */
export const uploadToCloudinary = async (buffer, options = {}) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new AppError("Uploaded file is empty", 400);
  }

  if (isCloudinaryConfigured()) {
    const cloudinary = await getCloudinary();
    // Promise API (the callback-style upload_stream leaks an unhandled rejection on failure)
    const dataUri = `data:${options.mimetype || "application/octet-stream"};base64,${buffer.toString("base64")}`;
    try {
      return await cloudinary.uploader.upload(dataUri, {
        folder: options.folder || "confetti-documents",
        public_id: options.public_id ? String(options.public_id).replace(/[^\w.-]+/g, "_") : undefined,
        resource_type: options.resource_type || "auto",
      });
    } catch (error) {
      throw new Error(`Cloud upload failed: ${error.message || error.error?.message || "unknown error"}`);
    }
  }

  const { uploadToGridFS } = await import("../services/file-storage.service.js");
  const stored = await uploadToGridFS(
    buffer,
    options.filename || options.public_id || `document-${Date.now()}`,
    options.mimetype || "application/octet-stream",
    { folder: options.folder, ...(options.metadata || {}) }
  );
  return {
    public_id: `${GRIDFS_PREFIX}${stored.fileId}`,
    secure_url: null,
    resource_type: "gridfs",
    bytes: stored.size,
  };
};

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return { result: "not found" };
  if (String(publicId).startsWith(GRIDFS_PREFIX)) {
    const { deleteFromGridFS } = await import("../services/file-storage.service.js");
    try {
      await deleteFromGridFS(String(publicId).slice(GRIDFS_PREFIX.length));
      return { result: "ok" };
    } catch (error) {
      logger.warn(`GridFS delete failed for ${publicId}: ${error.message}`);
      return { result: "not found" };
    }
  }
  if (!isCloudinaryConfigured()) return { result: "not found" };
  const cloudinary = await getCloudinary();
  // resource_type must match the upload; try each until one reports "ok"
  for (const resource_type of ["image", "raw", "video"]) {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type }).catch(() => null);
    if (res?.result === "ok") return res;
  }
  return { result: "not found" };
};

/** Stream a GridFS-backed document to the response. Returns false if not GridFS. */
export const streamStoredFile = async (publicId, res, { filename, mimeType, inline = false } = {}) => {
  if (!String(publicId || "").startsWith(GRIDFS_PREFIX)) return false;
  const { streamFileFromGridFS, fileExists } = await import("../services/file-storage.service.js");
  const fileId = String(publicId).slice(GRIDFS_PREFIX.length);
  // Check before sending headers so a missing file can still produce a JSON 404
  if (!(await fileExists(fileId))) throw new AppError("Stored file not found", 404);
  const stream = streamFileFromGridFS(fileId);
  res.setHeader("Content-Type", mimeType || "application/octet-stream");
  const safeName = String(filename || "document").replace(/[^\w.\- ]+/g, "_");
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeName}"`);
  await new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(res);
  });
  return true;
};

export default {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
  streamStoredFile,
  isCloudinaryConfigured,
};
