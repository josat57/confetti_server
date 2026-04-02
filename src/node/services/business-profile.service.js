/**
 * Business Profile Service
 *
 * Handles business profile operations for both planners and vendors.
 * Provides CRUD operations, validation, and business logic for managing
 * business information including company details, addresses, and verification.
 */

import PlannerBusinessProfile from "../models/planner-business-profile.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import {
  uploadToGridFS,
  deleteFromGridFS,
  replaceFile,
} from "./file-storage.service.js";

/**
 * Create a planner business profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data
 * @returns {Promise<Object>} Created profile
 */
export async function createPlannerProfile(userId, profileData) {
  try {
    // Check if profile already exists
    const existingProfile = await PlannerBusinessProfile.findOne({ userId });
    if (existingProfile) {
      throw new AppError("Business profile already exists for this user", 409);
    }

    // Create new profile
    const profile = new PlannerBusinessProfile({
      userId,
      ...profileData,
    });

    await profile.save();
    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to create planner profile: ${error.message}`,
      500
    );
  }
}

/**
 * Get planner business profile by user ID
 * @param {string} userId - User ID
 * @param {boolean} includeTaxId - Whether to include tax ID (default: false)
 * @returns {Promise<Object>} Profile data
 */
export async function getPlannerProfile(userId, includeTaxId = false) {
  try {
    let query = PlannerBusinessProfile.findOne({ userId });

    // Include taxId if requested (it's excluded by default)
    if (includeTaxId) {
      query = query.select("+taxId");
    }

    const profile = await query;

    if (!profile) {
      throw new AppError("Business profile not found", 404);
    }

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get planner profile: ${error.message}`, 500);
  }
}

/**
 * Update planner business profile
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated profile
 */
export async function updatePlannerProfile(userId, updateData) {
  try {
    const profile = await PlannerBusinessProfile.findOne({ userId });

    if (!profile) {
      throw new AppError(
        "Business profile not found. Please create a profile first.",
        404
      );
    }

    // Remove fields that shouldn't be updated
    delete updateData.userId;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Update fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined && key !== "userId") {
        profile[key] = updateData[key];
      }
    });

    await profile.save();
    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to update planner profile: ${error.message}`,
      500
    );
  }
}

/**
 * Delete planner business profile
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deletePlannerProfile(userId) {
  try {
    const result = await PlannerBusinessProfile.findOneAndDelete({ userId });

    if (!result) {
      throw new AppError("Business profile not found", 404);
    }

    return { success: true, message: "Business profile deleted successfully" };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to delete planner profile: ${error.message}`,
      500
    );
  }
}

/**
 * Update vendor business information
 * @param {string} vendorId - Vendor ID
 * @param {Object} businessData - Business data to update
 * @returns {Promise<Object>} Updated vendor
 */
export async function updateVendorBusinessInfo(vendorId, businessData) {
  try {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }

    // Store original values of non-business fields for comparison
    const originalServices = JSON.stringify(vendor.services);
    const originalRating = vendor.rating;
    const originalReviews = JSON.stringify(vendor.reviews);
    const originalStats = JSON.stringify(vendor.stats);

    // Update only business-related fields
    const businessFields = [
      "businessName",
      "registrationNumber",
      "taxId",
      "yearEstablished",
      "description",
      "address",
      "logo",
      "logoFileId",
      "branding",
    ];

    businessFields.forEach((field) => {
      if (businessData[field] !== undefined) {
        vendor[field] = businessData[field];
      }
    });

    await vendor.save();

    // Verify that non-business fields weren't modified
    const updatedVendor = await Vendor.findById(vendorId);
    if (
      JSON.stringify(updatedVendor.services) !== originalServices ||
      updatedVendor.rating !== originalRating ||
      JSON.stringify(updatedVendor.reviews) !== originalReviews ||
      JSON.stringify(updatedVendor.stats) !== originalStats
    ) {
      console.warn(
        "Warning: Non-business fields were modified during business update"
      );
    }

    return updatedVendor;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to update vendor business info: ${error.message}`,
      500
    );
  }
}

/**
 * Get vendor business information
 * @param {string} vendorId - Vendor ID
 * @param {boolean} includeTaxId - Whether to include tax ID (default: false)
 * @returns {Promise<Object>} Vendor business data
 */
export async function getVendorBusinessInfo(vendorId, includeTaxId = false) {
  try {
    let query = Vendor.findById(vendorId);

    // Include taxId if requested (it's excluded by default)
    if (includeTaxId) {
      query = query.select("+taxId");
    }

    const vendor = await query;

    if (!vendor) {
      throw new AppError("Vendor not found", 404);
    }

    // Return only business-related fields
    return {
      _id: vendor._id,
      businessName: vendor.businessName,
      registrationNumber: vendor.registrationNumber,
      taxId: includeTaxId ? vendor.taxId : undefined,
      yearEstablished: vendor.yearEstablished,
      description: vendor.description,
      address: vendor.address,
      logo: vendor.logo,
      logoFileId: vendor.logoFileId,
      verificationStatus: vendor.verificationStatus,
      verifiedAt: vendor.verifiedAt,
      verifiedBy: vendor.verifiedBy,
      rejectionReason: vendor.rejectionReason,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to get vendor business info: ${error.message}`,
      500
    );
  }
}

/**
 * Check if a planner profile exists
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if profile exists
 */
export async function plannerProfileExists(userId) {
  try {
    const count = await PlannerBusinessProfile.countDocuments({ userId });
    return count > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get business profile by role
 * Determines whether to fetch planner or vendor profile
 * @param {string} userId - User ID
 * @param {string} role - User role ('event-planner' or 'vendor')
 * @param {string} vendorId - Vendor ID (required if role is 'vendor')
 * @returns {Promise<Object>} Business profile
 */
export async function getBusinessProfileByRole(userId, role, vendorId = null) {
  try {
    if (role === "event-planner") {
      return await getPlannerProfile(userId);
    } else if (role === "vendor") {
      if (!vendorId) {
        throw new AppError("Vendor ID is required for vendor role", 400);
      }
      return await getVendorBusinessInfo(vendorId);
    } else {
      throw new AppError("Invalid role for business profile", 400);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to get business profile: ${error.message}`, 500);
  }
}

/**
 * Update business profile by role
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @param {Object} profileData - Profile data to update
 * @param {string} vendorId - Vendor ID (required if role is 'vendor')
 * @returns {Promise<Object>} Updated profile
 */
export async function updateBusinessProfileByRole(
  userId,
  role,
  profileData,
  vendorId = null
) {
  try {
    if (role === "event-planner") {
      return await updatePlannerProfile(userId, profileData);
    } else if (role === "vendor") {
      if (!vendorId) {
        throw new AppError("Vendor ID is required for vendor role", 400);
      }
      return await updateVendorBusinessInfo(vendorId, profileData);
    } else {
      throw new AppError("Invalid role for business profile", 400);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to update business profile: ${error.message}`,
      500
    );
  }
}

/**
 * Upload logo for business profile
 * @param {string} userId - User ID
 * @param {string} role - User role ('event-planner' or 'vendor')
 * @param {Object} file - Multer file object
 * @param {string} vendorId - Vendor ID (required if role is 'vendor')
 * @returns {Promise<Object>} Upload result with logo URL and fileId
 */
export async function uploadLogo(userId, role, file, vendorId = null) {
  try {
    if (!file || !file.buffer) {
      throw new AppError("No file provided", 400);
    }

    // Get existing profile to check for old logo
    let profile;
    let oldLogoFileId = null;

    if (role === "event-planner") {
      profile = await PlannerBusinessProfile.findOne({ userId });
      if (!profile) {
        throw new AppError("Business profile not found", 404);
      }
      oldLogoFileId = profile.logoFileId;
    } else if (role === "vendor") {
      if (!vendorId) {
        throw new AppError("Vendor ID is required for vendor role", 400);
      }
      profile = await Vendor.findById(vendorId);
      if (!profile) {
        throw new AppError("Vendor not found", 404);
      }
      oldLogoFileId = profile.logoFileId;
    } else {
      throw new AppError("Invalid role", 400);
    }

    // Upload new logo (and delete old one if exists)
    let uploadResult;
    if (oldLogoFileId) {
      uploadResult = await replaceFile(
        oldLogoFileId,
        file.buffer,
        file.originalname,
        file.mimetype,
        { userId, role, type: "logo" }
      );
    } else {
      uploadResult = await uploadToGridFS(
        file.buffer,
        file.originalname,
        file.mimetype,
        { userId, role, type: "logo" }
      );
    }

    // Update profile with new logo info
    profile.logoFileId = uploadResult.fileId;
    profile.logo = `/api/v1/files/${uploadResult.fileId}`; // URL to access the logo
    await profile.save();

    return {
      logoFileId: uploadResult.fileId,
      logo: profile.logo,
      filename: uploadResult.filename,
      size: uploadResult.size,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to upload logo: ${error.message}`, 500);
  }
}

/**
 * Delete logo from business profile
 * @param {string} userId - User ID
 * @param {string} role - User role ('event-planner' or 'vendor')
 * @param {string} vendorId - Vendor ID (required if role is 'vendor')
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteLogo(userId, role, vendorId = null) {
  try {
    let profile;

    if (role === "event-planner") {
      profile = await PlannerBusinessProfile.findOne({ userId });
      if (!profile) {
        throw new AppError("Business profile not found", 404);
      }
    } else if (role === "vendor") {
      if (!vendorId) {
        throw new AppError("Vendor ID is required for vendor role", 400);
      }
      profile = await Vendor.findById(vendorId);
      if (!profile) {
        throw new AppError("Vendor not found", 404);
      }
    } else {
      throw new AppError("Invalid role", 400);
    }

    if (!profile.logoFileId) {
      throw new AppError("No logo to delete", 404);
    }

    // Delete file from GridFS
    await deleteFromGridFS(profile.logoFileId);

    // Remove logo references from profile
    profile.logoFileId = undefined;
    profile.logo = undefined;
    await profile.save();

    return { success: true, message: "Logo deleted successfully" };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete logo: ${error.message}`, 500);
  }
}

/**
 * Add a location to business profile
 * Note: Only planners have additional locations. Vendors use the main address field.
 * @param {string} userId - User ID
 * @param {string} role - User role (must be 'event-planner')
 * @param {Object} locationData - Location data
 * @returns {Promise<Object>} Updated profile
 */
export async function addLocation(userId, role, locationData) {
  try {
    if (role !== "event-planner") {
      throw new AppError("Only planners can have multiple locations", 400);
    }

    const profile = await PlannerBusinessProfile.findOne({ userId });
    if (!profile) {
      throw new AppError("Business profile not found", 404);
    }

    // Use the model method to add location
    await profile.addLocation(locationData);

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to add location: ${error.message}`, 500);
  }
}

/**
 * Update a location in business profile
 * @param {string} userId - User ID
 * @param {string} role - User role (must be 'event-planner')
 * @param {string} locationId - Location ID
 * @param {Object} locationData - Updated location data
 * @returns {Promise<Object>} Updated profile
 */
export async function updateLocation(userId, role, locationId, locationData) {
  try {
    if (role !== "event-planner") {
      throw new AppError("Only planners can have multiple locations", 400);
    }

    const profile = await PlannerBusinessProfile.findOne({ userId });
    if (!profile) {
      throw new AppError("Business profile not found", 404);
    }

    // Use the model method to update location
    await profile.updateLocation(locationId, locationData);

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update location: ${error.message}`, 500);
  }
}

/**
 * Delete a location from business profile
 * @param {string} userId - User ID
 * @param {string} role - User role (must be 'event-planner')
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>} Updated profile
 */
export async function deleteLocation(userId, role, locationId) {
  try {
    if (role !== "event-planner") {
      throw new AppError("Only planners can have multiple locations", 400);
    }

    const profile = await PlannerBusinessProfile.findOne({ userId });
    if (!profile) {
      throw new AppError("Business profile not found", 404);
    }

    // Use the model method to delete location
    // This will throw an error if trying to delete primary location
    await profile.deleteLocation(locationId);

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to delete location: ${error.message}`, 500);
  }
}

/**
 * Set a location as primary
 * @param {string} userId - User ID
 * @param {string} role - User role (must be 'event-planner')
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>} Updated profile
 */
export async function setPrimaryLocation(userId, role, locationId) {
  try {
    if (role !== "event-planner") {
      throw new AppError("Only planners can have multiple locations", 400);
    }

    const profile = await PlannerBusinessProfile.findOne({ userId });
    if (!profile) {
      throw new AppError("Business profile not found", 404);
    }

    // Use the model method to set primary location
    await profile.setPrimaryLocation(locationId);

    return profile;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to set primary location: ${error.message}`, 500);
  }
}

export default {
  createPlannerProfile,
  getPlannerProfile,
  updatePlannerProfile,
  deletePlannerProfile,
  updateVendorBusinessInfo,
  getVendorBusinessInfo,
  plannerProfileExists,
  getBusinessProfileByRole,
  updateBusinessProfileByRole,
  uploadLogo,
  deleteLogo,
  addLocation,
  updateLocation,
  deleteLocation,
  setPrimaryLocation,
};
