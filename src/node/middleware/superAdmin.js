import Admin from "../models/Admin.js";
import { logger } from "../utils/logger.js";

const SUPER_ADMIN_CONFIG = {
  emailPatterns: ["admin", "power"],
  defaultEmail: process.env.SUPER_ADMIN_EMAIL || "power.admin@confetti.com",
  defaultPassword: process.env.SUPER_ADMIN_PASSWORD,
  role: "super_admin",
};

const containsAdminKeyword = (email, username) => {
  const emailLower = (email || "").toLowerCase();
  const usernameLower = (username || "").toLowerCase();
  return SUPER_ADMIN_CONFIG.emailPatterns.some(
    (pattern) => emailLower.includes(pattern) || usernameLower.includes(pattern)
  );
};

const findSuperAdmin = async () => {
  try {
    return await Admin.findOne({ role: "super_admin" }).select("+password");
  } catch (error) {
    logger.error("Error finding super admin:", error);
    return null;
  }
};

const createSuperAdmin = async (email, password) => {
  try {
    logger.info("Creating super admin account...");

    const existing = await findSuperAdmin();
    if (existing) {
      logger.warn("Super admin already exists. Cannot create another one.");
      return existing;
    }

    const superAdmin = await Admin.create({
      email: email || SUPER_ADMIN_CONFIG.defaultEmail,
      password: password || SUPER_ADMIN_CONFIG.defaultPassword,
      firstName: "Power",
      lastName: "Admin",
      role: "super_admin",
      isActive: true,
      permissions: [
        "user_management",
        "content_management",
        "system_configuration",
        "moderation",
        "support_tickets",
        "audit_logs",
        "analytics",
        "vendor_management",
        "communication_management",
        "security_compliance",
        "financial_oversight",
      ],
    });

    logger.info(`Super admin created successfully: ${superAdmin.email}`);
    return superAdmin;
  } catch (error) {
    logger.error("Error creating super admin:", error);
    throw error;
  }
};

/**
 * Previously this created a super admin from the credentials submitted to the
 * public user sign-in endpoint (when none existed) and disclosed the super
 * admin's email to any caller. Admin accounts are never created from public
 * requests now: the super admin is bootstrapped from SUPER_ADMIN_EMAIL /
 * SUPER_ADMIN_PASSWORD at startup, or via POST /admin/super-admin (see
 * authorizeAdminCreation). Kept as a pass-through for route compatibility.
 */
export const handleSuperAdminLogin = async (req, res, next) => next();

/**
 * Guards POST /admin/super-admin:
 *  - when admins exist: only an authenticated, active super admin may create admins
 *  - when no admin exists (first run): allowed outside production, or in
 *    production only with the X-Bootstrap-Token header matching ADMIN_BOOTSTRAP_TOKEN
 */
export const authorizeAdminCreation = async (req, res, next) => {
  try {
    const adminCount = await Admin.estimatedDocumentCount();
    if (adminCount === 0) {
      const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
      const provided = req.get("X-Bootstrap-Token");
      const isProduction = process.env.NODE_ENV === "production";
      if (isProduction && (!expected || provided !== expected)) {
        return res.status(403).json({
          success: false,
          message: "Initial admin creation requires a valid bootstrap token",
        });
      }
      req.body.role = "super_admin"; // the first admin is the super admin
      req.isAdminBootstrap = true;
      return next();
    }

    const { authenticateAdmin } = await import("./auth.js");
    return authenticateAdmin(req, res, (err) => {
      if (err) return next(err);
      if (req.admin?.role !== "super_admin") {
        return res.status(403).json({ success: false, message: "Only a super admin can create admin accounts" });
      }
      next();
    });
  } catch (error) {
    logger.error("Error authorizing admin creation:", error);
    next(error);
  }
};

/**
 * Startup: create the super admin from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
 * if none exists. An existing super admin is never changed, unless
 * SUPER_ADMIN_RESET=true — then its email and password are set from those
 * variables (remove the flag after one deploy).
 *
 * Outcomes are logged at warn level so they show in production logs.
 */
export const ensureSuperAdminExists = async () => {
  try {
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const email = SUPER_ADMIN_CONFIG.defaultEmail.toLowerCase();

    if (!password) {
      logger.warn("SUPER_ADMIN_PASSWORD not set — skipping automatic super admin creation");
      return;
    }

    const superAdmin = await findSuperAdmin();

    if (!superAdmin) {
      await createSuperAdmin(email, password);
      logger.warn(`Super admin created: ${email}`);
      return;
    }

    if (process.env.SUPER_ADMIN_RESET === "true") {
      superAdmin.email = email;
      superAdmin.password = password; // hashed by the model's pre-save hook
      superAdmin.isActive = true;
      await superAdmin.save();
      logger.warn(
        `Super admin credentials reset to SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD (${email}). ` +
          "Remove SUPER_ADMIN_RESET now so later restarts don't reset it again."
      );
      return;
    }

    const emailMatches = superAdmin.email === email;
    const passwordMatches = await superAdmin.comparePassword(password);
    if (emailMatches && passwordMatches) {
      logger.info(`✓ Super admin exists: ${superAdmin.email}`);
    } else {
      logger.warn(
        `A super admin already exists (${superAdmin.email}, created ${superAdmin.createdAt?.toISOString?.() || superAdmin.createdAt}) ` +
          `and its ${emailMatches ? "password does not" : "email does not"} match SUPER_ADMIN_` +
          `${emailMatches ? "PASSWORD" : "EMAIL"}, so those settings were not applied. ` +
          "Sign in with the existing credentials, or set SUPER_ADMIN_RESET=true for one deploy to apply them."
      );
    }
  } catch (error) {
    logger.error("Error ensuring super admin exists:", error);
  }
};

export const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const admin = await Admin.findById(req.user._id);

    if (!admin || admin.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Super admin access required" });
    }

    next();
  } catch (error) {
    logger.error("Error in requireSuperAdmin middleware:", error);
    res.status(500).json({ success: false, message: "Error checking super admin status" });
  }
};

export const getSuperAdminInfo = async () => {
  try {
    const superAdmin = await findSuperAdmin();
    if (!superAdmin) {
      return { exists: false, message: "No super admin account found" };
    }
    return {
      exists: true,
      email: superAdmin.email,
      createdAt: superAdmin.createdAt,
      lastLogin: superAdmin.lastLogin,
    };
  } catch (error) {
    logger.error("Error getting super admin info:", error);
    return { exists: false, error: error.message };
  }
};

export const enforceSingleSuperAdmin = async () => {
  try {
    const superAdmins = await Admin.find({ role: "super_admin" }).sort({ createdAt: 1 });

    if (superAdmins.length > 1) {
      logger.warn(`Multiple super admins found (${superAdmins.length}). Keeping only the first one.`);
      const [, ...extras] = superAdmins;
      for (const admin of extras) {
        admin.role = "admin";
        await admin.save();
        logger.info(`Demoted super_admin to admin: ${admin.email}`);
      }
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
