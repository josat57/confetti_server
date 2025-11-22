import User from "../models/user.model.js";
import Subscription from "../models/subscription.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import paymentMethodService from "../services/paymentMethod.service.js";
import {
  uploadToGridFS,
  deleteFromGridFS,
  fileToBase64,
} from "../utils/gridfs.js";

/**
 * Get all user settings
 * GET /api/v1/settings
 */
export const getSettings = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -twoFactorSecret -twoFactorTempSecret")
      .populate("subscription");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Convert profile image to base64 if stored in GridFS
    let profileImageBase64 = null;
    if (user.profileImageFileId) {
      profileImageBase64 = await fileToBase64(user.profileImageFileId);
    } else if (user.profilePicture) {
      // Fallback to profilePicture URL if no GridFS file
      profileImageBase64 = user.profilePicture;
    }

    // Convert cover photo to base64 if stored in GridFS
    let coverPhotoBase64 = null;
    if (user.coverPhotoFileId) {
      coverPhotoBase64 = await fileToBase64(user.coverPhotoFileId);
    } else if (user.coverPhoto) {
      // Fallback to coverPhoto URL if no GridFS file
      coverPhotoBase64 = user.coverPhoto;
    }

    const settings = {
      profile: {
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        businessName: user.businessName,
        businessAddress: user.businessAddress,
        profileImage: profileImageBase64 || null,
        coverPhoto: coverPhotoBase64 || null,
        bio: user.bio,
        website: user.website,
        socialMedia: user.socialMedia,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
      security: {
        twoFactorEnabled: user.twoFactorEnabled,
        hasBackupCodes: user.twoFactorBackupCodes?.length > 0,
        lastPasswordChange: user.passwordChangedAt,
      },
      notifications: user.preferences.notifications,
      preferences: {
        theme: user.preferences.theme,
        language: user.preferences.language,
        timezone: user.preferences.timezone,
        currency: user.preferences.currency,
        dateFormat: user.preferences.dateFormat,
        timeFormat: user.preferences.timeFormat,
      },
      billing: {
        subscription: user.subscription || null,
        hasSubscription: !!user.subscription,
        paymentMethods:
          user.paymentMethods?.map((pm) => ({
            id: pm._id,
            type: pm.type,
            last4: pm.last4,
            brand: pm.brand,
            expiryMonth: pm.expiryMonth,
            expiryYear: pm.expiryYear,
            isDefault: pm.isDefault,
          })) || [],
      },
    };

    res.status(200).json({
      status: "success",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification settings
 * PATCH /api/v1/settings/notifications
 */
export const updateNotificationSettings = async (req, res, next) => {
  try {
    const allowedFields = [
      "email",
      "push",
      "sms",
      "newLeads",
      "bookingUpdates",
      "paymentReminders",
      "marketingEmails",
      "systemUpdates",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[`preferences.notifications.${field}`] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Notification settings updated successfully",
      data: {
        notifications: user.preferences.notifications,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update preference settings
 * PATCH /api/v1/settings/preferences
 */
export const updatePreferenceSettings = async (req, res, next) => {
  try {
    const allowedFields = [
      "theme",
      "language",
      "timezone",
      "currency",
      "dateFormat",
      "timeFormat",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[`preferences.${field}`] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Preference settings updated successfully",
      data: {
        preferences: {
          theme: user.preferences.theme,
          language: user.preferences.language,
          timezone: user.preferences.timezone,
          currency: user.preferences.currency,
          dateFormat: user.preferences.dateFormat,
          timeFormat: user.preferences.timeFormat,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Enable 2FA - Generate QR code
 * POST /api/v1/settings/security/2fa/enable
 */
export const enable2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.twoFactorEnabled) {
      return next(new AppError("2FA is already enabled", 400));
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `EventPlanner (${user.email})`,
      length: 32,
    });

    // Store temporary secret (not enabled yet)
    user.twoFactorTempSecret = secret.base32;
    await user.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      status: "success",
      message: "Scan this QR code with your authenticator app",
      data: {
        qrCode: qrCodeUrl,
        secret: secret.base32,
        manualEntry: secret.base32,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify and activate 2FA
 * POST /api/v1/settings/security/2fa/verify
 */
export const verify2FA = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return next(new AppError("Verification token is required", 400));
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.twoFactorTempSecret) {
      return next(new AppError("2FA setup not initiated", 400));
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorTempSecret,
      encoding: "base32",
      token: token,
      window: 2,
    });

    if (!verified) {
      return next(new AppError("Invalid verification code", 400));
    }

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
    }

    // Activate 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = undefined;
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "2FA enabled successfully",
      data: {
        backupCodes: backupCodes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable 2FA
 * POST /api/v1/settings/security/2fa/disable
 */
export const disable2FA = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return next(new AppError("Password is required to disable 2FA", 400));
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Incorrect password", 401));
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorTempSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save();

    res.status(200).json({
      status: "success",
      message: "2FA disabled successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate backup codes
 * POST /api/v1/settings/security/2fa/backup-codes
 */
export const regenerateBackupCodes = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!user.twoFactorEnabled) {
      return next(new AppError("2FA is not enabled", 400));
    }

    // Generate new backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(
        Math.random().toString(36).substring(2, 10).toUpperCase()
      );
    }

    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Backup codes regenerated successfully",
      data: {
        backupCodes: backupCodes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initialize payment method setup
 * POST /api/v1/settings/billing/payment-methods/initialize
 */
export const initializePaymentMethod = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Initialize payment method setup with Flutterwave
    const result = await paymentMethodService.initializePaymentMethodSetup(
      user._id,
      user.email
    );

    res.status(200).json({
      status: "success",
      message: "Payment method setup initialized",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify and add payment method
 * POST /api/v1/settings/billing/payment-methods/verify
 */
export const verifyPaymentMethod = async (req, res, next) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return next(new AppError("Payment reference is required", 400));
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Verify and add payment method
    const paymentMethod = await paymentMethodService.verifyPaymentMethodSetup(
      reference,
      user._id
    );

    // Fetch updated user
    const updatedUser = await User.findById(req.user._id);

    res.status(201).json({
      status: "success",
      message: "Payment method added successfully",
      data: {
        paymentMethod: {
          id: paymentMethod._id,
          type: paymentMethod.type,
          last4: paymentMethod.last4,
          brand: paymentMethod.brand,
          expiryMonth: paymentMethod.expiryMonth,
          expiryYear: paymentMethod.expiryYear,
          isDefault: paymentMethod.isDefault,
        },
        paymentMethods: updatedUser.paymentMethods.map((pm) => ({
          id: pm._id,
          type: pm.type,
          last4: pm.last4,
          brand: pm.brand,
          expiryMonth: pm.expiryMonth,
          expiryYear: pm.expiryYear,
          isDefault: pm.isDefault,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove payment method
 * DELETE /api/v1/settings/billing/payment-methods/:id
 */
export const removePaymentMethod = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const paymentMethod = user.paymentMethods.id(req.params.id);

    if (!paymentMethod) {
      return next(new AppError("Payment method not found", 404));
    }

    // Don't allow removing the last payment method if user has active subscription
    if (user.paymentMethods.length === 1 && user.subscription) {
      return next(
        new AppError(
          "Cannot remove the last payment method with an active subscription",
          400
        )
      );
    }

    paymentMethod.remove();
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Payment method removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set default payment method
 * PATCH /api/v1/settings/billing/payment-methods/:id/default
 */
export const setDefaultPaymentMethod = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const paymentMethod = user.paymentMethods.id(req.params.id);

    if (!paymentMethod) {
      return next(new AppError("Payment method not found", 404));
    }

    // Unset all defaults
    user.paymentMethods.forEach((pm) => {
      pm.isDefault = false;
    });

    // Set new default
    paymentMethod.isDefault = true;
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Default payment method updated successfully",
      data: {
        paymentMethods: user.paymentMethods.map((pm) => ({
          id: pm._id,
          type: pm.type,
          last4: pm.last4,
          brand: pm.brand,
          isDefault: pm.isDefault,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change subscription plan
 * POST /api/v1/settings/billing/change-plan
 */
export const changeSubscriptionPlan = async (req, res, next) => {
  try {
    // Accept both planId and planName for backward compatibility
    const { planId, planName: planNameFromBody, amount } = req.body;
    const planName = planNameFromBody || planId;

    if (!planName) {
      return next(new AppError("Plan name or plan ID is required", 400));
    }

    if (amount === undefined || amount === null) {
      return next(new AppError("Plan amount is required", 400));
    }

    const user = await User.findById(req.user._id).populate("subscription");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Log for debugging
    logger.info(`Change plan request for user ${user._id}`, {
      hasSubscription: !!user.subscription,
      subscriptionId: user.subscription?._id,
      requestedPlan: planName,
      requestedAmount: amount,
    });

    if (!user.subscription) {
      return next(
        new AppError(
          "No active subscription found. Please subscribe first.",
          400
        )
      );
    }

    const subscription = await Subscription.findById(user.subscription._id);

    // Check if trying to change to the same plan
    if (subscription.planName === planName) {
      return next(new AppError("You are already on this plan", 400));
    }

    // Store old plan details for history
    const oldPlanName = subscription.planName;
    const oldAmount = subscription.amount;

    // Determine if this is an upgrade or downgrade
    const changeType = amount > oldAmount ? "upgrade" : "downgrade";

    // Calculate prorated amount if upgrading
    let proratedAmount = 0;
    if (changeType === "upgrade") {
      const prorationDetails = subscription.calculateProration(amount);
      proratedAmount = prorationDetails.amountDue;
    }

    // Update subscription plan
    subscription.planName = planName;
    subscription.amount = amount;

    // Add to history
    subscription.history.push({
      planName: oldPlanName,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      amount: oldAmount,
      changeType: changeType,
      proratedAmount: proratedAmount,
      reason: `Plan changed from ${oldPlanName} to ${planName}`,
    });

    // If downgrade, apply at end of current billing period
    // If upgrade, apply immediately (would require payment in production)
    if (changeType === "downgrade") {
      subscription.pendingUpgrade = {
        newPlanName: planName,
        amount: amount,
        proratedAmount: 0,
      };
    }

    await subscription.save();

    // Populate the subscription for response
    await subscription.populate("user");

    res.status(200).json({
      status: "success",
      message: `Subscription plan ${
        changeType === "downgrade" ? "will be changed" : "changed"
      } successfully${
        changeType === "downgrade"
          ? " at the end of your current billing period"
          : ""
      }`,
      data: {
        subscription: subscription,
        changeType: changeType,
        proratedAmount: proratedAmount,
        effectiveDate:
          changeType === "downgrade" ? subscription.endDate : new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get security activity log
 * GET /api/v1/settings/security/activity
 */
export const getSecurityActivity = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      "lastLogin loginAttempts lockUntil"
    );

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        lastLogin: user.lastLogin,
        failedLoginAttempts: user.loginAttempts,
        accountLocked: user.isLocked(),
        lockUntil: user.lockUntil,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export user data (GDPR compliance)
 * GET /api/v1/settings/export-data
 */
export const exportUserData = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -twoFactorSecret -twoFactorTempSecret")
      .populate("subscription");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const userData = user.toObject();

    res.status(200).json({
      status: "success",
      message: "User data exported successfully",
      data: userData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/v1/settings/profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "address",
      "businessName",
      "businessAddress",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password -twoFactorSecret -twoFactorTempSecret");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload profile picture
 * POST /api/v1/settings/profile/picture
 */
export const uploadProfilePicture = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if file was uploaded or URL provided
    if (!req.file && !req.body.profileImageUrl) {
      return next(new AppError("Profile image file or URL is required", 400));
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
      user.profilePicture = req.body.profileImageUrl;
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
      message: "Profile picture uploaded successfully",
      data: {
        profileImage: imageData,
        isGridFS: !!user.profileImageFileId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload cover photo
 * POST /api/v1/settings/profile/cover
 */
export const uploadCoverPhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if file was uploaded or URL provided
    if (!req.file && !req.body.coverPhotoUrl) {
      return next(new AppError("Cover photo file or URL is required", 400));
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
      user.coverPhoto = req.body.coverPhotoUrl;
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
 * Update user preferences
 * PUT /api/v1/settings/preferences
 */
export const updatePreferences = async (req, res, next) => {
  try {
    const allowedFields = [
      "theme",
      "language",
      "timezone",
      "currency",
      "dateFormat",
      "timeFormat",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[`preferences.${field}`] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password -twoFactorSecret -twoFactorTempSecret");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Preferences updated successfully",
      data: {
        preferences: {
          theme: user.preferences.theme,
          language: user.preferences.language,
          timezone: user.preferences.timezone,
          currency: user.preferences.currency,
          dateFormat: user.preferences.dateFormat,
          timeFormat: user.preferences.timeFormat,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account
 * DELETE /api/v1/settings/account
 */
export const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return next(new AppError("Password is required to delete account", 400));
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Incorrect password", 401));
    }

    // Soft delete - mark as inactive
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();

    // In production, you might want to:
    // 1. Cancel active subscriptions
    // 2. Remove payment methods
    // 3. Archive user data
    // 4. Send confirmation email

    res.status(200).json({
      status: "success",
      message:
        "Account deleted successfully. Your data will be retained for 30 days.",
    });
  } catch (error) {
    next(error);
  }
};
