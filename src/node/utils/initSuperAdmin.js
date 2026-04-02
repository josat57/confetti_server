import {
  ensureSuperAdminExists,
  enforceSingleSuperAdmin,
  getSuperAdminInfo,
} from "../middleware/superAdmin.js";
import { logger } from "./logger.js";

/**
 * Initialize super admin on server startup
 * This ensures there's always a super admin account available
 */
export const initializeSuperAdmin = async () => {
  try {
    logger.info("Initializing super admin...");

    // Ensure only one super admin exists
    await enforceSingleSuperAdmin();

    // Ensure super admin exists (create if not)
    await ensureSuperAdminExists();

    // Get super admin info
    const info = await getSuperAdminInfo();

    if (info.exists) {
      logger.info(`✓ Super admin initialized: ${info.email}`);
      logger.info(`  - Created: ${info.createdAt}`);
      logger.info(`  - Last login: ${info.lastLogin || "Never"}`);
    } else {
      logger.warn("⚠ Super admin initialization failed");
    }

    return info;
  } catch (error) {
    logger.error("Error initializing super admin:", error);
    throw error;
  }
};

export default initializeSuperAdmin;
