import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import bcrypt from "bcryptjs";
import {
  uploadToGridFS,
  deleteFromGridFS,
  fileToBase64,
} from "../utils/gridfs.js";

// Get current user profile
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return next(new AppError("User not found", 404));

    // Convert user to plain object
    const userData = user.toObject();

    // Ensure all fields exist (even if null/undefined)
    userData.firstName = userData.firstName || null;
    userData.lastName = userData.lastName || null;
    userData.address = userData.address || null;

    // Convert profile image to base64 if stored in GridFS
    if (userData.profileImageFileId) {
      userData.profilePicture = await fileToBase64(userData.profileImageFileId);
    }

    // Convert cover photo to base64 if stored in GridFS
    if (userData.coverPhotoFileId) {
      userData.coverPhoto = await fileToBase64(userData.coverPhotoFileId);
    }

    res.status(200).json({ status: "success", user: userData });
  } catch (error) {
    next(error);
  }
};

// Update user profile
export const updateProfile = async (req, res, next) => {
  try {
    const updates = (({
      firstName,
      lastName,
      phone,
      address,
      preferences,
    }) => ({ firstName, lastName, phone, address, preferences }))(req.body);
    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!user) return next(new AppError("User not found", 404));
    res.status(200).json({ status: "success", user });
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return next(new AppError("User not found", 404));
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch)
      return next(new AppError("Current password is incorrect", 400));
    user.password = newPassword;
    await user.save();
    res
      .status(200)
      .json({ status: "success", message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

// Deactivate/Delete account
export const deactivateAccount = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isActive: false },
      { new: true }
    );
    if (!user) return next(new AppError("User not found", 404));
    res.status(200).json({ status: "success", message: "Account deactivated" });
  } catch (error) {
    next(error);
  }
};

// Update user preferences
export const updatePreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences },
      { new: true, runValidators: true }
    ).select("-password");
    if (!user) return next(new AppError("User not found", 404));
    res.status(200).json({ status: "success", user });
  } catch (error) {
    next(error);
  }
};

// ADMIN: List all users
export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json({ status: "success", users });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Get user by ID
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return next(new AppError("User not found", 404));
    res.status(200).json({ status: "success", user });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Activate/Deactivate user
export const setUserActiveStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!user) return next(new AppError("User not found", 404));
    res.status(200).json({ status: "success", user });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Lock/Unlock user account
export const setUserLockStatus = async (req, res, next) => {
  try {
    const { lock } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError("User not found", 404));
    if (lock) {
      user.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    } else {
      user.lockUntil = undefined;
      user.loginAttempts = 0;
    }
    await user.save();
    res.status(200).json({ status: "success", user });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload profile image
 * POST /api/v1/users/me/profile-image
 */
export const uploadProfileImage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if file was uploaded
    if (!req.file && !req.body.imageUrl) {
      return next(new AppError("Image file or URL is required", 400));
    }

    // Delete old profile image from GridFS if it exists
    if (user.profileImageFileId) {
      try {
        await deleteFromGridFS(user.profileImageFileId);
      } catch (error) {
        console.error("Error deleting old profile image:", error);
      }
    }

    // If file was uploaded, store in GridFS
    if (req.file) {
      const uploadResult = await uploadToGridFS(
        req.file.buffer,
        `profile-image-${
          user._id
        }-${Date.now()}${req.file.originalname.substring(
          req.file.originalname.lastIndexOf(".")
        )}`,
        req.file.mimetype,
        {
          userId: user._id,
          type: "profile-image",
        }
      );

      user.profileImageFileId = uploadResult.fileId;
      user.profilePicture = null; // Clear URL if switching from URL to GridFS
    } else {
      // Otherwise use the provided URL
      user.profilePicture = req.body.imageUrl;
      user.profileImageFileId = null; // Clear GridFS ID if switching from GridFS to URL
    }

    await user.save();

    // Return base64 if GridFS file
    let imageData = user.profilePicture;
    if (user.profileImageFileId) {
      imageData = await fileToBase64(user.profileImageFileId);
    }

    res.status(200).json({
      status: "success",
      message: "Profile image uploaded successfully",
      data: {
        profilePicture: imageData,
        isGridFS: !!user.profileImageFileId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload cover photo
 * POST /api/v1/users/me/cover-photo
 */
export const uploadCoverPhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if file was uploaded
    if (!req.file && !req.body.imageUrl) {
      return next(new AppError("Image file or URL is required", 400));
    }

    // Delete old cover photo from GridFS if it exists
    if (user.coverPhotoFileId) {
      try {
        await deleteFromGridFS(user.coverPhotoFileId);
      } catch (error) {
        console.error("Error deleting old cover photo:", error);
      }
    }

    // If file was uploaded, store in GridFS
    if (req.file) {
      const uploadResult = await uploadToGridFS(
        req.file.buffer,
        `cover-photo-${user._id}-${Date.now()}${req.file.originalname.substring(
          req.file.originalname.lastIndexOf(".")
        )}`,
        req.file.mimetype,
        {
          userId: user._id,
          type: "cover-photo",
        }
      );

      user.coverPhotoFileId = uploadResult.fileId;
      user.coverPhoto = null; // Clear URL if switching from URL to GridFS
    } else {
      // Otherwise use the provided URL
      user.coverPhoto = req.body.imageUrl;
      user.coverPhotoFileId = null; // Clear GridFS ID if switching from GridFS to URL
    }

    await user.save();

    // Return base64 if GridFS file
    let imageData = user.coverPhoto;
    if (user.coverPhotoFileId) {
      imageData = await fileToBase64(user.coverPhotoFileId);
    }

    res.status(200).json({
      status: "success",
      message: "Cover photo uploaded successfully",
      data: {
        coverPhoto: imageData,
        isGridFS: !!user.coverPhotoFileId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete profile image
 * DELETE /api/v1/users/me/profile-image
 */
export const deleteProfileImage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Delete from GridFS if it exists
    if (user.profileImageFileId) {
      try {
        await deleteFromGridFS(user.profileImageFileId);
      } catch (error) {
        console.error("Error deleting profile image from GridFS:", error);
      }
    }

    // Clear both fields
    user.profileImageFileId = null;
    user.profilePicture = null;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Profile image deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete cover photo
 * DELETE /api/v1/users/me/cover-photo
 */
export const deleteCoverPhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Delete from GridFS if it exists
    if (user.coverPhotoFileId) {
      try {
        await deleteFromGridFS(user.coverPhotoFileId);
      } catch (error) {
        console.error("Error deleting cover photo from GridFS:", error);
      }
    }

    // Clear both fields
    user.coverPhotoFileId = null;
    user.coverPhoto = null;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Cover photo deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
