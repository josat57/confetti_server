// Try to import sharp, but make it optional
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch (error) {
  console.warn(
    "Sharp module not available. Image optimization will be disabled."
  );
  sharp = null;
}

import { logger } from "../utils/logger.js";
import path from "path";

/**
 * Image Optimization Service
 * Handles image compression and optimization for mobile devices
 */

class ImageOptimizationService {
  constructor() {
    this.formats = {
      jpeg: { quality: 80 },
      png: { compressionLevel: 8 },
      webp: { quality: 80 },
    };

    this.sizes = {
      thumbnail: { width: 150, height: 150 },
      small: { width: 320, height: 320 },
      medium: { width: 640, height: 640 },
      large: { width: 1280, height: 1280 },
      original: null, // Keep original size
    };
  }

  /**
   * Optimize image for web/mobile
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Object} options - Optimization options
   * @returns {Promise<Buffer>} - Optimized image buffer
   */
  async optimizeImage(imageBuffer, options = {}) {
    if (!sharp) {
      logger.warn("Sharp not available, returning original image buffer");
      return imageBuffer;
    }

    try {
      const {
        format = "jpeg",
        quality = 80,
        width,
        height,
        fit = "cover",
        progressive = true,
      } = options;

      let pipeline = sharp(imageBuffer);

      // Resize if dimensions provided
      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit,
          withoutEnlargement: true,
        });
      }

      // Apply format-specific optimizations
      switch (format.toLowerCase()) {
        case "jpeg":
        case "jpg":
          pipeline = pipeline.jpeg({
            quality,
            progressive,
            mozjpeg: true,
          });
          break;

        case "png":
          pipeline = pipeline.png({
            compressionLevel: 8,
            progressive,
          });
          break;

        case "webp":
          pipeline = pipeline.webp({
            quality,
          });
          break;

        default:
          pipeline = pipeline.jpeg({ quality, progressive });
      }

      const optimized = await pipeline.toBuffer();

      logger.info("Image optimized", {
        originalSize: imageBuffer.length,
        optimizedSize: optimized.length,
        reduction: `${(
          ((imageBuffer.length - optimized.length) / imageBuffer.length) *
          100
        ).toFixed(2)}%`,
        format,
        width,
        height,
      });

      return optimized;
    } catch (error) {
      logger.error("Image optimization error:", error);
      throw new Error("Failed to optimize image");
    }
  }

  /**
   * Generate responsive image sizes
   * @param {Buffer} imageBuffer - Original image buffer
   * @param {string} format - Output format
   * @returns {Promise<Object>} - Object with different sizes
   */
  async generateResponsiveSizes(imageBuffer, format = "jpeg") {
    try {
      const sizes = {};

      for (const [sizeName, dimensions] of Object.entries(this.sizes)) {
        if (dimensions === null) {
          // Keep original
          sizes[sizeName] = imageBuffer;
        } else {
          sizes[sizeName] = await this.optimizeImage(imageBuffer, {
            format,
            width: dimensions.width,
            height: dimensions.height,
          });
        }
      }

      return sizes;
    } catch (error) {
      logger.error("Error generating responsive sizes:", error);
      throw new Error("Failed to generate responsive image sizes");
    }
  }

  /**
   * Get image metadata
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Object>} - Image metadata
   */
  async getMetadata(imageBuffer) {
    if (!sharp) {
      logger.warn("Sharp not available, returning basic metadata");
      return {
        format: "unknown",
        width: 0,
        height: 0,
        size: imageBuffer.length,
      };
    }

    try {
      const metadata = await sharp(imageBuffer).metadata();

      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        size: imageBuffer.length,
      };
    } catch (error) {
      logger.error("Error getting image metadata:", error);
      throw new Error("Failed to get image metadata");
    }
  }

  /**
   * Compress image for mobile
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} quality - Quality level (low, medium, high)
   * @returns {Promise<Buffer>} - Compressed image
   */
  async compressForMobile(imageBuffer, quality = "medium") {
    const qualitySettings = {
      low: { quality: 60, width: 640 },
      medium: { quality: 75, width: 1024 },
      high: { quality: 85, width: 1280 },
    };

    const settings = qualitySettings[quality] || qualitySettings.medium;

    return await this.optimizeImage(imageBuffer, {
      format: "jpeg",
      quality: settings.quality,
      width: settings.width,
      progressive: true,
    });
  }

  /**
   * Convert image to WebP format
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} quality - Quality (0-100)
   * @returns {Promise<Buffer>} - WebP image
   */
  async convertToWebP(imageBuffer, quality = 80) {
    if (!sharp) {
      logger.warn("Sharp not available, returning original image buffer");
      return imageBuffer;
    }

    try {
      return await sharp(imageBuffer).webp({ quality }).toBuffer();
    } catch (error) {
      logger.error("Error converting to WebP:", error);
      throw new Error("Failed to convert image to WebP");
    }
  }

  /**
   * Create thumbnail
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} size - Thumbnail size
   * @returns {Promise<Buffer>} - Thumbnail image
   */
  async createThumbnail(imageBuffer, size = 150) {
    return await this.optimizeImage(imageBuffer, {
      format: "jpeg",
      width: size,
      height: size,
      fit: "cover",
      quality: 80,
    });
  }

  /**
   * Validate image file
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<boolean>} - Validation result
   */
  async validateImage(imageBuffer) {
    try {
      const metadata = await this.getMetadata(imageBuffer);

      // Check if valid image format
      const validFormats = ["jpeg", "jpg", "png", "webp", "gif"];
      if (!validFormats.includes(metadata.format)) {
        return false;
      }

      // Check dimensions (max 10000x10000)
      if (metadata.width > 10000 || metadata.height > 10000) {
        return false;
      }

      // Check file size (max 10MB)
      if (metadata.size > 10 * 1024 * 1024) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Image validation error:", error);
      return false;
    }
  }

  /**
   * Get optimal format for image
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<string>} - Optimal format
   */
  async getOptimalFormat(imageBuffer) {
    try {
      const metadata = await this.getMetadata(imageBuffer);

      // Use WebP for modern browsers
      if (metadata.hasAlpha) {
        return "webp"; // WebP supports transparency
      }

      // Use JPEG for photos
      return "jpeg";
    } catch (error) {
      logger.error("Error determining optimal format:", error);
      return "jpeg";
    }
  }

  /**
   * Calculate image dimensions maintaining aspect ratio
   * @param {number} originalWidth - Original width
   * @param {number} originalHeight - Original height
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height
   * @returns {Object} - New dimensions
   */
  calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    const aspectRatio = originalWidth / originalHeight;

    let newWidth = originalWidth;
    let newHeight = originalHeight;

    if (originalWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / aspectRatio;
    }

    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }

    return {
      width: Math.round(newWidth),
      height: Math.round(newHeight),
    };
  }
}

// Create singleton instance
const imageOptimizationService = new ImageOptimizationService();

export default imageOptimizationService;
