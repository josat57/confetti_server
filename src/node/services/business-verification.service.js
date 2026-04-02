/**
 * Business Verification Service
 *
 * Handles admin verification operations for business profiles.
 * Manages verification workflow for both planner and vendor profiles.
 */

import PlannerBusinessProfile from "../models/planner-business-profile.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import notificationService from "./notification.service.js";

/**
 * List all business profiles pending verification
 * @returns {Promise<Object>} Pending profiles (planners and vendors)
 */
export async function listPendingProfiles() {
  try {
    // Get pending planner profiles
    const pendingPlanners = await PlannerBusinessProfile.find({
      verificationStatus: "pending",
    })
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    // Get pending vendor profiles
    const pendingVendors = await Vendor.find({
      verificationStatus: "pending",
    })
      .populate("owner", "firstName lastName email")
      .select(
        "businessName email registrationNumber yearEstablished verificationStatus createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    return {
      planners: pendingPlanners.map((p) => ({
        ...p,
        type: "planner",
        user: p.userId,
      })),
      vendors: pendingVendors.map((v) => ({
        ...v,
        type: "vendor",
        user: v.owner,
      })),
      total: pendingPlanners.length + pendingVendors.length,
    };
  } catch (error) {
    throw new AppError(
      `Failed to list pending profiles: ${error.message}`,
      500
    );
  }
}

/**
 * List all business profiles with filtering and pagination
 * @param {Object} filters - Filter options (status, type, search)
 * @param {Object} pagination - Pagination options (page, limit)
 * @returns {Promise<Object>} Filtered profiles with pagination
 */
export async function listAllProfiles(filters = {}, pagination = {}) {
  try {
    const { status, type, search } = filters;
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    let planners = [];
    let vendors = [];
    let plannerCount = 0;
    let vendorCount = 0;

    // Build query for planners
    if (!type || type === "planner") {
      const plannerQuery = {};
      if (status) plannerQuery.verificationStatus = status;
      if (search) {
        plannerQuery.$or = [
          { companyName: { $regex: search, $options: "i" } },
          { registrationNumber: { $regex: search, $options: "i" } },
        ];
      }

      planners = await PlannerBusinessProfile.find(plannerQuery)
        .populate("userId", "firstName lastName email")
        .populate("verifiedBy", "firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      plannerCount = await PlannerBusinessProfile.countDocuments(plannerQuery);

      planners = planners.map((p) => ({
        ...p,
        type: "planner",
        user: p.userId,
      }));
    }

    // Build query for vendors
    if (!type || type === "vendor") {
      const vendorQuery = {};
      if (status) vendorQuery.verificationStatus = status;
      if (search) {
        vendorQuery.$or = [
          { businessName: { $regex: search, $options: "i" } },
          { registrationNumber: { $regex: search, $options: "i" } },
        ];
      }

      vendors = await Vendor.find(vendorQuery)
        .populate("owner", "firstName lastName email")
        .populate("verifiedBy", "firstName lastName email")
        .select(
          "businessName email registrationNumber yearEstablished verificationStatus verifiedAt verifiedBy rejectionReason createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      vendorCount = await Vendor.countDocuments(vendorQuery);

      vendors = vendors.map((v) => ({
        ...v,
        type: "vendor",
        user: v.owner,
      }));
    }

    // Combine and sort results
    const allProfiles = [...planners, ...vendors].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const total = plannerCount + vendorCount;

    return {
      profiles: allProfiles.slice(0, limit),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw new AppError(`Failed to list profiles: ${error.message}`, 500);
  }
}

/**
 * Get profile details by ID and type
 * @param {string} profileId - Profile ID
 * @param {string} type - Profile type ('planner' or 'vendor')
 * @returns {Promise<Object>} Profile details
 */
export async function getProfileDetails(profileId, type) {
  try {
    let profile;

    if (type === "planner") {
      profile = await PlannerBusinessProfile.findById(profileId)
        .populate("userId", "firstName lastName email phone")
        .populate("verifiedBy", "firstName lastName email")
        .select("+taxId") // Include tax ID for admin view
        .lean();

      if (!profile) {
        throw new AppError("Planner profile not found", 404);
      }

      profile.type = "planner";
      profile.user = profile.userId;
    } else if (type === "vendor") {
      profile = await Vendor.findById(profileId)
        .populate("owner", "firstName lastName email phone")
        .populate("verifiedBy", "firstName lastName email")
        .select("+taxId") // Include tax ID for admin view
        .lean();

      if (!profile) {
        throw new AppError("Vendor profile not found", 404);
      }

      profile.type = "vendor";
      profile.user = profile.owner;
    } else {
      throw new AppError("Invalid profile type", 400);
    }

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get profile details: ${error.message}`, 500);
  }
}

/**
 * Verify a business profile
 * @param {string} profileId - Profile ID
 * @param {string} type - Profile type ('planner' or 'vendor')
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Verified profile
 */
export async function verifyProfile(profileId, type, adminId) {
  try {
    let profile;
    let userId;

    if (type === "planner") {
      profile = await PlannerBusinessProfile.findById(profileId);
      if (!profile) {
        throw new AppError("Planner profile not found", 404);
      }
      userId = profile.userId;
      await profile.verify(adminId);
    } else if (type === "vendor") {
      profile = await Vendor.findById(profileId);
      if (!profile) {
        throw new AppError("Vendor profile not found", 404);
      }
      userId = profile.owner;
      await profile.verifyBusinessProfile(adminId);
    } else {
      throw new AppError("Invalid profile type", 400);
    }

    // Send verification notification
    await sendVerificationNotification(userId, type, "verified");

    return {
      success: true,
      message: "Profile verified successfully",
      profile: {
        id: profile._id,
        type,
        verificationStatus: profile.verificationStatus,
        verifiedAt: profile.verifiedAt,
        verifiedBy: profile.verifiedBy,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to verify profile: ${error.message}`, 500);
  }
}

/**
 * Reject a business profile
 * @param {string} profileId - Profile ID
 * @param {string} type - Profile type ('planner' or 'vendor')
 * @param {string} adminId - Admin user ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejected profile
 */
export async function rejectProfile(profileId, type, adminId, reason) {
  try {
    if (!reason || reason.trim().length === 0) {
      throw new AppError("Rejection reason is required", 400);
    }

    let profile;
    let userId;

    if (type === "planner") {
      profile = await PlannerBusinessProfile.findById(profileId);
      if (!profile) {
        throw new AppError("Planner profile not found", 404);
      }
      userId = profile.userId;
      await profile.reject(adminId, reason);
    } else if (type === "vendor") {
      profile = await Vendor.findById(profileId);
      if (!profile) {
        throw new AppError("Vendor profile not found", 404);
      }
      userId = profile.owner;
      await profile.rejectBusinessProfile(adminId, reason);
    } else {
      throw new AppError("Invalid profile type", 400);
    }

    // Send rejection notification
    await sendVerificationNotification(userId, type, "rejected", reason);

    return {
      success: true,
      message: "Profile rejected successfully",
      profile: {
        id: profile._id,
        type,
        verificationStatus: profile.verificationStatus,
        verifiedBy: profile.verifiedBy,
        rejectionReason: profile.rejectionReason,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to reject profile: ${error.message}`, 500);
  }
}

/**
 * Get verification statistics
 * @returns {Promise<Object>} Verification stats
 */
export async function getVerificationStats() {
  try {
    const plannerStats = await PlannerBusinessProfile.aggregate([
      {
        $group: {
          _id: "$verificationStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const vendorStats = await Vendor.aggregate([
      {
        $group: {
          _id: "$verificationStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      planners: {},
      vendors: {},
      total: {},
    };

    // Process planner stats
    plannerStats.forEach((stat) => {
      stats.planners[stat._id] = stat.count;
      stats.total[stat._id] = (stats.total[stat._id] || 0) + stat.count;
    });

    // Process vendor stats
    vendorStats.forEach((stat) => {
      stats.vendors[stat._id] = stat.count;
      stats.total[stat._id] = (stats.total[stat._id] || 0) + stat.count;
    });

    return stats;
  } catch (error) {
    throw new AppError(
      `Failed to get verification stats: ${error.message}`,
      500
    );
  }
}

/**
 * Send verification status notification to user
 * @param {string} userId - User ID
 * @param {string} profileType - Profile type ('planner' or 'vendor')
 * @param {string} status - Verification status ('verified' or 'rejected')
 * @param {string} reason - Rejection reason (if rejected)
 * @returns {Promise<void>}
 */
async function sendVerificationNotification(
  userId,
  profileType,
  status,
  reason = null
) {
  try {
    const user = await User.findById(userId).select("firstName email");
    if (!user) {
      console.warn(`User not found for verification notification: ${userId}`);
      return;
    }

    let title, message, actionUrl;

    if (status === "verified") {
      title = "Business Profile Verified! ✅";
      message = `Congratulations! Your business profile has been verified. You can now access all features available to verified ${profileType}s.`;
      actionUrl = "/business-profile";
    } else if (status === "rejected") {
      title = "Business Profile Verification Update";
      message = `Your business profile verification was not approved. Reason: ${reason}. Please update your information and resubmit.`;
      actionUrl = "/business-profile";
    }

    // Create in-app notification
    await notificationService.createNotification({
      userId,
      type: "business_verification",
      title,
      message,
      priority: "high",
      actionUrl,
      actionText: "View Profile",
      metadata: {
        profileType,
        verificationStatus: status,
        rejectionReason: reason,
      },
      channels: {
        inApp: true,
        email: true, // Send email for verification updates
      },
    });

    console.log(`Verification notification sent to user ${userId}: ${status}`);
  } catch (error) {
    console.error("Failed to send verification notification:", error);
    // Don't throw error - notification failure shouldn't block verification
  }
}

export default {
  listPendingProfiles,
  listAllProfiles,
  getProfileDetails,
  verifyProfile,
  rejectProfile,
  getVerificationStats,
};
