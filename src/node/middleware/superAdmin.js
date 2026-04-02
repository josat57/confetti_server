import User from "../models/user.model.js";
import crypto from "crypto";
import { logger } from "../utils/logger.js";

/**
 * Super Admin Configuration
 */
const SUPER_ADMIN_CONFIG = {
  // Email patterns that trigger super admin check
  // Detects emails containing "admin" OR "power" (e.g., power.admin@confetti.com)
  emailPatterns: ["admin", "power"],

  // Default super admin credentials
  defaultEmail: "power.admin@confetti.com",
  defaultPassword: process.env.SUPER_ADMIN_PASSWORD || "Ginger@123A",

  // Super admin role (uses existing admin role with special flag)
  role: "admin",
  isSuperAdmin: true,
};

/**
 * Check if email or username contains admin/power keywords
 * @param {string} email - User email
 * @param {string} username - Username
 * @returns {boolean}
 */
const containsAdminKeyword = (email, username) => {
  const emailLower = (email || "").toLowerCase();
  const usernameLower = (username || "").toLowerCase();

  return SUPER_ADMIN_CONFIG.emailPatterns.some(
    (pattern) => emailLower.includes(pattern) || usernameLower.includes(pattern)
  );
};

/**
 * Find existing super admin in database
 * @returns {Promise<User|null>}
 */
const findSuperAdmin = async () => {
  try {
    // Look for user with isSuperAdmin flag
    const superAdmin = await User.findOne({
      role: "admin",
      "metadata.isSuperAdmin": true,
    }).select("+password");

    return superAdmin;
  } catch (error) {
    logger.error("Error finding super admin:", error);
    return null;
  }
};

/**
 * Create super admin account
 * @param {string} email - Email for super admin
 * @param {string} password - Password for super admin
 * @returns {Promise<User>}
 */
const createSuperAdmin = async (email, password) => {
  try {
    logger.info("Creating super admin account...");

    // Check if super admin already exists
    const existingSuperAdmin = await findSuperAdmin();
    if (existingSuperAdmin) {
      logger.warn("Super admin already exists. Cannot create another one.");
      return existingSuperAdmin;
    }

    // Create super admin user
    const superAdmin = await User.create({
      email: email || SUPER_ADMIN_CONFIG.defaultEmail,
      password: password || SUPER_ADMIN_CONFIG.defaultPassword,
      username: "poweradmin",
      firstName: "Power",
      lastName: "Admin",
      role: SUPER_ADMIN_CONFIG.role,
      status: "active",
      isActive: true,
      isEmailVerified: true,
      metadata: {
        isSuperAdmin: true,
        createdAt: new Date(),
        autoCreated: true,
      },
    });

    logger.info(`Super admin created successfully: ${superAdmin.email}`);
    return superAdmin;
  } catch (error) {
    logger.error("Error creating super admin:", error);
    throw error;
  }
};

/**
 * Middleware to handle super admin login/creation
 * This should be used in the login route
 */
export const handleSuperAdminLogin = async (req, res, next) => {
  try {
    const { email, username } = req.body;

    // Check if email/username contains admin keywords
    if (!containsAdminKeyword(email, username)) {
      // Not an admin login attempt, proceed normally
      return next();
    }

    logger.info(`Admin login attempt detected: ${email || username}`);

    // Check if super admin exists
    let superAdmin = await findSuperAdmin();

    if (!superAdmin) {
      // No super admin exists, create one
      logger.info("No super admin found. Creating super admin account...");

      try {
        superAdmin = await createSuperAdmin(email, req.body.password);

        // Attach super admin to request for login processing
        req.superAdminCreated = true;
        req.superAdmin = superAdmin;

        logger.info(
          `Super admin account created successfully: ${superAdmin.email}`
        );
        logger.info("Proceeding with login...");
      } catch (error) {
        logger.error("Failed to create super admin:", error);

        // Check if error is due to duplicate email
        if (error.code === 11000 || error.message.includes("duplicate")) {
          logger.info(
            "Super admin with this email already exists. Proceeding with login..."
          );
          // Try to find the user with this email
          const existingUser = await User.findOne({ email }).select(
            "+password"
          );
          if (existingUser) {
            req.superAdmin = existingUser;
            return next();
          }
        }

        return res.status(500).json({
          success: false,
          message: "Failed to create super admin account",
          error: error.message,
        });
      }
    } else {
      // Super admin exists, check if trying to login with different email
      if (email && email.toLowerCase() !== superAdmin.email.toLowerCase()) {
        logger.warn(`Login attempt with different admin email: ${email}`);
        logger.warn(`Existing super admin: ${superAdmin.email}`);

        // Check if a user with this email exists
        const userWithEmail = await User.findOne({ email }).select("+password");

        if (!userWithEmail) {
          return res.status(400).json({
            success: false,
            message: `Super admin already exists with email: ${superAdmin.email}. Only one super admin is allowed. Please use the existing super admin email to login.`,
          });
        }

        // User exists with this email, check if they're an admin
        if (userWithEmail.role === "admin") {
          logger.info(
            "Admin user found with this email. Proceeding with login..."
          );
          req.superAdmin = userWithEmail;
        }
      } else {
        // Super admin exists with same email
        logger.info("Super admin found. Proceeding with login...");
        req.superAdmin = superAdmin;
      }
    }

    // Continue to normal login flow
    next();
  } catch (error) {
    logger.error("Error in super admin middleware:", error);
    next(error);
  }
};

/**
 * Helper function to ensure super admin exists
 * Can be called during app initialization
 */
export const ensureSuperAdminExists = async () => {
  try {
    const superAdmin = await findSuperAdmin();

    if (!superAdmin) {
      logger.info(
        "No super admin found during initialization. Creating default super admin..."
      );
      await createSuperAdmin();
      logger.info("Default super admin created successfully");
    } else {
      logger.info(`Super admin exists: ${superAdmin.email}`);
    }
  } catch (error) {
    logger.error("Error ensuring super admin exists:", error);
  }
};

/**
 * Middleware to check if user is super admin
 * Use this to protect super admin-only routes
 */
export const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user is super admin
    const user = await User.findById(req.user._id);

    if (!user || user.role !== "admin" || !user.metadata?.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Super admin access required",
      });
    }

    next();
  } catch (error) {
    logger.error("Error in requireSuperAdmin middleware:", error);
    res.status(500).json({
      success: false,
      message: "Error checking super admin status",
      error: error.message,
    });
  }
};

/**
 * Get super admin info
 */
export const getSuperAdminInfo = async () => {
  try {
    const superAdmin = await findSuperAdmin();

    if (!superAdmin) {
      return {
        exists: false,
        message: "No super admin account found",
      };
    }

    return {
      exists: true,
      email: superAdmin.email,
      username: superAdmin.username,
      createdAt: superAdmin.createdAt,
      lastLogin: superAdmin.lastLogin,
    };
  } catch (error) {
    logger.error("Error getting super admin info:", error);
    return {
      exists: false,
      error: error.message,
    };
  }
};

/**
 * Check if there can only be one super admin
 * This enforces the single super admin rule
 */
export const enforceSingleSuperAdmin = async () => {
  try {
    const superAdmins = await User.find({
      role: "admin",
      "metadata.isSuperAdmin": true,
    });

    if (superAdmins.length > 1) {
      logger.warn(
        `Multiple super admins found (${superAdmins.length}). Keeping only the first one.`
      );

      // Keep the oldest super admin, remove others
      const [firstSuperAdmin, ...otherSuperAdmins] = superAdmins.sort(
        (a, b) => a.createdAt - b.createdAt
      );

      for (const admin of otherSuperAdmins) {
        admin.metadata.isSuperAdmin = false;
        await admin.save();
        logger.info(`Removed super admin flag from: ${admin.email}`);
      }

      logger.info(`Enforced single super admin: ${firstSuperAdmin.email}`);
    }
  } catch (error) {
    logger.error("Error enforcing single super admin:", error);
  }
};

export default {
  handleSuperAdminLogin,
  ensureSuperAdminExists,
  requireSuperAdmin,
  getSuperAdminInfo,
  enforceSingleSuperAdmin,
  containsAdminKeyword,
  findSuperAdmin,
  createSuperAdmin,
};
