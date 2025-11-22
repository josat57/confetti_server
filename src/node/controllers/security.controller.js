import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import { AppError } from "../utils/AppError.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";

/**
 * Enable 2FA
 * POST /api/v1/vendors/security/2fa/enable
 */
export const enable2FA = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError("User not found", 404));

    if (user.twoFactorEnabled) {
      return next(new AppError("2FA is already enabled", 400));
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Confetti (${user.email})`,
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (will be confirmed on verification)
    user.twoFactorSecret = secret.base32;
    user.twoFactorTempSecret = secret.base32;
    await user.save();

    // Log activity
    await AuditLog.create({
      user: user._id,
      action: "2FA_SETUP_INITIATED",
      resource: "User",
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      status: "success",
      message:
        "2FA setup initiated. Scan the QR code with your authenticator app.",
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify and confirm 2FA
 * POST /api/v1/vendors/security/2fa/verify
 */
export const verify2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token)
      return next(new AppError("Verification token is required", 400));

    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError("User not found", 404));

    const secret = user.twoFactorTempSecret || user.twoFactorSecret;
    if (!secret) {
      return next(
        new AppError("2FA is not set up. Please enable 2FA first.", 400)
      );
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (!verified) {
      return next(new AppError("Invalid verification code", 400));
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorSecret = secret;
    user.twoFactorTempSecret = undefined;

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }
    user.twoFactorBackupCodes = backupCodes;

    await user.save();

    // Log activity
    await AuditLog.create({
      user: user._id,
      action: "2FA_ENABLED",
      resource: "User",
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      status: "success",
      message: "2FA enabled successfully",
      data: {
        backupCodes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Disable 2FA
 * POST /api/v1/vendors/security/2fa/disable
 */
export const disable2FA = async (req, res, next) => {
  try {
    const { password, token } = req.body;
    if (!password || !token) {
      return next(
        new AppError("Password and verification token are required", 400)
      );
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return next(new AppError("User not found", 404));

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Invalid password", 401));
    }

    // Verify 2FA token
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (!verified) {
      return next(new AppError("Invalid verification code", 400));
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = [];
    await user.save();

    // Log activity
    await AuditLog.create({
      user: user._id,
      action: "2FA_DISABLED",
      resource: "User",
      resourceId: user._id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      status: "success",
      message: "2FA disabled successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs
 * GET /api/v1/vendors/security/audit-logs
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      resource,
      startDate,
      endDate,
    } = req.query;

    const query = { user: req.user._id };

    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate("user", "email userName");

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: logs.length,
      data: {
        logs,
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
 * Export audit logs
 * GET /api/v1/vendors/security/audit-logs/export
 */
export const exportAuditLogs = async (req, res, next) => {
  try {
    const { startDate, endDate, format = "csv" } = req.query;

    const query = { user: req.user._id };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .populate("user", "email userName");

    if (format === "csv") {
      // Generate CSV
      const csv = [
        "Timestamp,Action,Resource,Resource ID,IP Address,User Agent",
        ...logs.map((log) =>
          [
            log.createdAt.toISOString(),
            log.action,
            log.resource,
            log.resourceId,
            log.ipAddress,
            `"${log.userAgent}"`,
          ].join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=audit-logs-${Date.now()}.csv`
      );
      res.send(csv);
    } else {
      res.status(200).json({
        status: "success",
        data: { logs },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get active sessions
 * GET /api/v1/vendors/security/sessions
 */
export const getSessions = async (req, res, next) => {
  try {
    const RefreshToken = (await import("../models/refreshToken.model.js"))
      .default;

    const sessions = await RefreshToken.find({
      user: req.user._id,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: sessions.length,
      data: { sessions },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke session
 * DELETE /api/v1/vendors/security/sessions/:id
 */
export const revokeSession = async (req, res, next) => {
  try {
    const RefreshToken = (await import("../models/refreshToken.model.js"))
      .default;

    const session = await RefreshToken.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!session) {
      return next(new AppError("Session not found", 404));
    }

    // Log activity
    await AuditLog.create({
      user: req.user._id,
      action: "SESSION_REVOKED",
      resource: "RefreshToken",
      resourceId: session._id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      status: "success",
      message: "Session revoked successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke all other sessions
 * DELETE /api/v1/vendors/security/sessions
 */
export const revokeAllSessions = async (req, res, next) => {
  try {
    const RefreshToken = (await import("../models/refreshToken.model.js"))
      .default;

    // Get current session token from request
    const currentToken = req.cookies.refreshToken || req.body.currentToken;

    // Delete all sessions except current one
    const result = await RefreshToken.deleteMany({
      user: req.user._id,
      token: { $ne: currentToken },
    });

    // Log activity
    await AuditLog.create({
      user: req.user._id,
      action: "ALL_SESSIONS_REVOKED",
      resource: "RefreshToken",
      details: { count: result.deletedCount },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      status: "success",
      message: `${result.deletedCount} session(s) revoked successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Configure SSO (Enterprise only)
 * POST /api/v1/vendors/security/sso/configure
 */
export const configureSSO = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(new AppError("User not found", 404));

    // Check if user is vendor owner
    const Vendor = (await import("../models/vendor.model.js")).default;
    const vendor = await Vendor.findOne({ owner: user._id }).populate(
      "subscription"
    );

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Check subscription tier (Enterprise only)
    if (!vendor.canAccessFeature("sso")) {
      return next(
        new AppError("SSO configuration requires Enterprise plan", 403)
      );
    }

    const { provider, clientId, clientSecret, domain, metadata } = req.body;

    if (!provider || !clientId) {
      return next(new AppError("Provider and client ID are required", 400));
    }

    // Store SSO configuration (in production, encrypt sensitive data)
    user.ssoConfig = {
      enabled: true,
      provider,
      clientId,
      clientSecret, // Should be encrypted
      domain,
      metadata,
      configuredAt: new Date(),
    };

    await user.save();

    // Log activity
    await AuditLog.create({
      user: user._id,
      action: "SSO_CONFIGURED",
      resource: "User",
      resourceId: user._id,
      details: { provider },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(200).json({
      status: "success",
      message: "SSO configured successfully",
      data: {
        provider,
        enabled: true,
      },
    });
  } catch (error) {
    next(error);
  }
};
