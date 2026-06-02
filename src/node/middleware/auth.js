import { verifyAccessToken } from "../utils/auth.js";
import { AppError } from "../utils/AppError.js";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { createError } from "../utils/error.js";
import speakeasy from "speakeasy";
import { logger } from "../utils/logger.js";

export const protect = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.accessToken;

    // If no cookie, check Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return next(new AppError("Not authenticated. Please log in.", 401));
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      // Check if this might be an admin token
      if (decoded.type === "admin") {
        const admin = await Admin.findById(decoded.id);
        if (admin) {
          req.admin = admin;
          req.user = admin; // Also attach as user for compatibility
          await populateUserProfiles(req);
          return next();
        }
      }

      return next(new AppError("User no longer exists.", 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return next(new AppError("User account is deactivated.", 401));
    }

    // Check if user email is verified
    if (!user.isEmailVerified) {
      return next(new AppError("User email is not verified.", 401));
    }

    // Check if user changed password after the token was issued
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return next(new AppError("User recently changed password", 401));
    }

    // Grant access to protected route
    req.user = user;

    // Populate vendor and planner profiles if needed
    await populateUserProfiles(req);

    next();
  } catch (error) {
    next(new AppError("Not authenticated. Please log in.", 401));
  }
};

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Not authenticated. Please log in.", 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

export const verifyEmail = async (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return next(new AppError("Please verify your email address", 403));
  }
  next();
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.accessToken;

    // If no cookie, check Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      // No token, but that's okay - continue without user
      return next();
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (user && user.isActive) {
      // User exists and is active, attach to request
      req.user = user;

      // Populate vendor and planner profiles if needed
      await populateUserProfiles(req);
    }

    next();
  } catch (error) {
    // Token verification failed, but that's okay - continue without user
    next();
  }
};

// Helper function to populate vendor and planner profiles
const populateUserProfiles = async (req) => {
  if (!req.user) return;

  try {
    // Import models dynamically to avoid circular dependencies
    const { default: Vendor } = await import("../models/vendor.model.js");
    const { default: PlannerBusinessProfile } = await import(
      "../models/planner-business-profile.model.js"
    );

    // Check if user is a vendor
    if (req.user.role === "vendor") {
      const vendor = await Vendor.findOne({ owner: req.user._id })
        .populate("subscription", "planName planType status")
        .lean();
      if (vendor) {
        req.vendor = vendor;
      }
    }

    // Check if user is a planner
    if (req.user.role === "event-planner") {
      const planner = await PlannerBusinessProfile.findOne({
        owner: req.user._id,
      })
        .populate("subscription", "planName planType status")
        .lean();
      if (planner) {
        req.planner = planner;
      }
    }
  } catch (error) {
    // Don't fail if profile lookup fails
    logger.warn("Profile lookup failed:", { message: error.message });
  }
};

// Middleware to handle token refresh
export const handleTokenRefresh = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken && refreshToken) {
      // Access token is missing but refresh token exists
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET
        );

        if (decoded.type === "refreshToken") {
          const admin = await Admin.findById(decoded.id);
          if (admin && admin.isActive) {
            // Set new secure cookies
            const newAccessToken = jwt.sign(
              { id: admin._id, role: admin.role, type: "admin" },
              process.env.JWT_ACCESS_SECRET,
              { expiresIn: "15m" }
            );

            res.cookie("accessToken", newAccessToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              maxAge: 15 * 60 * 1000, // 15 minutes
              path: "/",
            });

            req.admin = admin;
            return next();
          }
        }
      } catch (refreshError) {
        // Refresh token is invalid, clear cookies
        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/api/v1/admin/refresh" });
        return next(createError(401, "Session expired. Please login again."));
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    // Get token from HTTP-only cookie or Authorization header
    let token = req.cookies.accessToken;

    // If no cookie, check Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw createError(401, "Authentication required");
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Verify token type
    if (decoded.type !== "admin") {
      throw createError(401, "Invalid token type");
    }

    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      throw createError(401, "Admin not found");
    }

    if (!admin.isActive) {
      throw createError(403, "Account is deactivated");
    }

    if (admin.twoFactorEnabled) {
      const twoFactorToken = req.header("X-2FA-Token");
      if (!twoFactorToken) {
        throw createError(401, "Two-factor authentication required");
      }

      const verified = speakeasy.totp.verify({
        secret: admin.twoFactorSecret,
        encoding: "base32",
        token: twoFactorToken,
      });

      if (!verified) {
        throw createError(401, "Invalid two-factor token");
      }
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      next(createError(401, "Invalid token"));
    } else {
      next(error);
    }
  }
};

const authorizeAdmin = (requiredPermissions) => {
  return (req, res, next) => {
    try {
      const admin = req.admin;

      if (admin.role === "super_admin") {
        return next();
      }

      const hasPermission = requiredPermissions.every((permission) =>
        admin.permissions.includes(permission)
      );

      if (!hasPermission) {
        throw createError(403, "Insufficient permissions");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export { authenticateAdmin, authorizeAdmin };
