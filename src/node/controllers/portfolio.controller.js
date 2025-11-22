import Portfolio from "../models/portfolio.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Get all portfolio items for vendor
 * GET /api/v1/vendors/portfolio
 */
export const getPortfolioItems = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { status, eventType, limit = 20, page = 1 } = req.query;

    const query = { vendor: vendor._id };
    if (status) query.status = status;
    if (eventType) query.eventType = eventType;

    const skip = (page - 1) * limit;

    const portfolioItems = await Portfolio.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Portfolio.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: portfolioItems.length,
      data: {
        portfolioItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single portfolio item
 * GET /api/v1/vendors/portfolio/:id
 */
export const getPortfolioItem = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!portfolioItem) {
      return next(new AppError("Portfolio item not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { portfolioItem },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create portfolio item
 * POST /api/v1/vendors/portfolio
 */
export const createPortfolioItem = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.create({
      ...req.body,
      vendor: vendor._id,
    });

    res.status(201).json({
      status: "success",
      message: "Portfolio item created successfully",
      data: { portfolioItem },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update portfolio item
 * PUT /api/v1/vendors/portfolio/:id
 */
export const updatePortfolioItem = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!portfolioItem) {
      return next(new AppError("Portfolio item not found", 404));
    }

    // Update allowed fields
    const allowedFields = [
      "title",
      "description",
      "eventType",
      "eventDate",
      "location",
      "tags",
      "isFeatured",
      "coverPhoto",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        portfolioItem[field] = req.body[field];
      }
    });

    await portfolioItem.save();

    res.status(200).json({
      status: "success",
      message: "Portfolio item updated successfully",
      data: { portfolioItem },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete portfolio item
 * DELETE /api/v1/vendors/portfolio/:id
 */
export const deletePortfolioItem = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.findOneAndDelete({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!portfolioItem) {
      return next(new AppError("Portfolio item not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Portfolio item deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publish portfolio item
 * POST /api/v1/vendors/portfolio/:id/publish
 */
export const publishPortfolioItem = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!portfolioItem) {
      return next(new AppError("Portfolio item not found", 404));
    }

    await portfolioItem.publish();

    res.status(200).json({
      status: "success",
      message: "Portfolio item published successfully",
      data: { portfolioItem },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive portfolio item
 * POST /api/v1/vendors/portfolio/:id/archive
 */
export const archivePortfolioItem = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!portfolioItem) {
      return next(new AppError("Portfolio item not found", 404));
    }

    await portfolioItem.archive();

    res.status(200).json({
      status: "success",
      message: "Portfolio item archived successfully",
      data: { portfolioItem },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add photos to portfolio item
 * POST /api/v1/vendors/portfolio/:id/photos
 */
export const addPhotos = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!portfolioItem) {
      return next(new AppError("Portfolio item not found", 404));
    }

    const { photos } = req.body;

    if (!photos || !Array.isArray(photos)) {
      return next(new AppError("Photos array is required", 400));
    }

    photos.forEach((photo) => {
      portfolioItem.photos.push({
        url: photo.url,
        caption: photo.caption,
        order: portfolioItem.photos.length,
      });
    });

    await portfolioItem.save();

    res.status(200).json({
      status: "success",
      message: "Photos added successfully",
      data: { photos: portfolioItem.photos },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete photo from portfolio item
 * DELETE /api/v1/vendors/portfolio/:id/photos/:photoId
 */
export const deletePhoto = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const portfolioItem = await Portfolio.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!portfolioItem) {
      return next(new AppError("Portfolio item not found", 404));
    }

    portfolioItem.photos = portfolioItem.photos.filter(
      (photo) => photo._id.toString() !== req.params.photoId
    );

    await portfolioItem.save();

    res.status(200).json({
      status: "success",
      message: "Photo deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
