/**
 * Business Profile Controller
 *
 * Handles HTTP requests for business profile management.
 * Supports both planner and vendor roles with role-based operations.
 */

import businessProfileService from "../services/business-profile.service.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Create business profile
 * POST /api/v1/business-profile
 */
export const createProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only planners can create business profiles via this endpoint
    // Vendors have their business info in the vendor model
    if (userRole !== "event-planner") {
      return next(
        new AppError(
          "Only event planners can create business profiles. Vendors should update their vendor profile.",
          403
        )
      );
    }

    const profile = await businessProfileService.createPlannerProfile(
      userId,
      req.body
    );

    res.status(201).json({
      status: "success",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get business profile
 * GET /api/v1/business-profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let profile;

    if (userRole === "event-planner") {
      profile = await businessProfileService.getPlannerProfile(userId);
    } else if (userRole === "vendor") {
      // Get vendor ID from vendor model
      const vendor = await Vendor.findOne({ owner: userId });
      if (!vendor) {
        return next(new AppError("Vendor profile not found", 404));
      }
      profile = await businessProfileService.getVendorBusinessInfo(vendor._id);
    } else {
      return next(
        new AppError("Invalid role for business profile access", 403)
      );
    }

    res.status(200).json({
      status: "success",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update business profile
 * PUT /api/v1/business-profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let profile;

    if (userRole === "event-planner") {
      profile = await businessProfileService.updatePlannerProfile(
        userId,
        req.body
      );
    } else if (userRole === "vendor") {
      // Get vendor ID from vendor model
      const vendor = await Vendor.findOne({ owner: userId });
      if (!vendor) {
        return next(new AppError("Vendor profile not found", 404));
      }
      profile = await businessProfileService.updateVendorBusinessInfo(
        vendor._id,
        req.body
      );
    } else {
      return next(
        new AppError("Invalid role for business profile update", 403)
      );
    }

    console.log(`[Business Profile] Update successful`);

    // Convert to plain object to avoid circular references
    const profileData = profile.toObject ? profile.toObject() : profile;

    res.status(200).json({
      status: "success",
      data: { profile: profileData },
      message: "Business profile updated successfully",
    });
  } catch (error) {
    console.error(`[Business Profile] Update error:`, error);
    next(error);
  }
};

/**
 * Delete business profile
 * DELETE /api/v1/business-profile
 */
export const deleteProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only planners can delete business profiles
    // Vendors cannot delete their business info (it's part of vendor model)
    if (userRole !== "event-planner") {
      return next(
        new AppError("Only event planners can delete business profiles", 403)
      );
    }

    await businessProfileService.deletePlannerProfile(userId);

    res.status(200).json({
      status: "success",
      message: "Business profile deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload company logo
 * POST /api/v1/business-profile/logo
 */
export const uploadLogo = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!req.file) {
      return next(new AppError("No file uploaded", 400));
    }

    let vendorId = null;
    if (userRole === "vendor") {
      const vendor = await Vendor.findOne({ owner: userId });
      if (!vendor) {
        return next(new AppError("Vendor profile not found", 404));
      }
      vendorId = vendor._id;
    }

    const result = await businessProfileService.uploadLogo(
      userId,
      userRole,
      req.file,
      vendorId
    );

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete company logo
 * DELETE /api/v1/business-profile/logo
 */
export const deleteLogo = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let vendorId = null;
    if (userRole === "vendor") {
      const vendor = await Vendor.findOne({ owner: userId });
      if (!vendor) {
        return next(new AppError("Vendor profile not found", 404));
      }
      vendorId = vendor._id;
    }

    const result = await businessProfileService.deleteLogo(
      userId,
      userRole,
      vendorId
    );

    res.status(200).json({
      status: "success",
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add business location
 * POST /api/v1/business-profile/locations
 */
export const addLocation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    if (userRole !== "event-planner") {
      return next(
        new AppError("Only event planners can add multiple locations", 403)
      );
    }

    const profile = await businessProfileService.addLocation(
      userId,
      userRole,
      req.body
    );

    res.status(201).json({
      status: "success",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update business location
 * PUT /api/v1/business-profile/locations/:id
 */
export const updateLocation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const locationId = req.params.id;

    if (userRole !== "event-planner") {
      return next(
        new AppError("Only event planners can update locations", 403)
      );
    }

    const profile = await businessProfileService.updateLocation(
      userId,
      userRole,
      locationId,
      req.body
    );

    res.status(200).json({
      status: "success",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete business location
 * DELETE /api/v1/business-profile/locations/:id
 */
export const deleteLocation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const locationId = req.params.id;

    if (userRole !== "event-planner") {
      return next(
        new AppError("Only event planners can delete locations", 403)
      );
    }

    const profile = await businessProfileService.deleteLocation(
      userId,
      userRole,
      locationId
    );

    res.status(200).json({
      status: "success",
      data: { profile },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createProfile,
  getProfile,
  updateProfile,
  deleteProfile,
  uploadLogo,
  deleteLogo,
  addLocation,
  updateLocation,
  deleteLocation,
};
