/**
 * Business Verification Controller (Admin)
 *
 * Handles admin operations for verifying business profiles.
 * Requires admin role authorization.
 */

import businessVerificationService from "../services/business-verification.service.js";
import { AppError } from "../utils/AppError.js";

/**
 * List all business profiles with filtering
 * GET /api/v1/admin/business-profiles
 */
export const listProfiles = async (req, res, next) => {
  try {
    const { status, type, search, page, limit } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (search) filters.search = search;

    const pagination = {};
    if (page) pagination.page = parseInt(page);
    if (limit) pagination.limit = parseInt(limit);

    const result = await businessVerificationService.listAllProfiles(
      filters,
      pagination
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
 * List pending business profiles
 * GET /api/v1/admin/business-profiles/pending
 */
export const listPending = async (req, res, next) => {
  try {
    const result = await businessVerificationService.listPendingProfiles();

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get business profile details
 * GET /api/v1/admin/business-profiles/:id
 */
export const getProfileDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (!type || !["planner", "vendor"].includes(type)) {
      return next(
        new AppError("Profile type is required (planner or vendor)", 400)
      );
    }

    const profile = await businessVerificationService.getProfileDetails(
      id,
      type
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
 * Verify business profile
 * PUT /api/v1/admin/business-profiles/:id/verify
 */
export const verifyProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const adminId = req.user._id;

    if (!type || !["planner", "vendor"].includes(type)) {
      return next(
        new AppError("Profile type is required (planner or vendor)", 400)
      );
    }

    const result = await businessVerificationService.verifyProfile(
      id,
      type,
      adminId
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
 * Reject business profile
 * PUT /api/v1/admin/business-profiles/:id/reject
 */
export const rejectProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, reason } = req.body;
    const adminId = req.user._id;

    if (!type || !["planner", "vendor"].includes(type)) {
      return next(
        new AppError("Profile type is required (planner or vendor)", 400)
      );
    }

    if (!reason || reason.trim().length === 0) {
      return next(new AppError("Rejection reason is required", 400));
    }

    const result = await businessVerificationService.rejectProfile(
      id,
      type,
      adminId,
      reason
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
 * Get verification statistics
 * GET /api/v1/admin/business-profiles/stats
 */
export const getStats = async (req, res, next) => {
  try {
    const stats = await businessVerificationService.getVerificationStats();

    res.status(200).json({
      status: "success",
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  listProfiles,
  listPending,
  getProfileDetails,
  verifyProfile,
  rejectProfile,
  getStats,
};
