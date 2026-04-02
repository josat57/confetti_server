/**
 * Branding Service
 *
 * Handles business branding and theme customization.
 * Provides functions to get and apply brand colors to user dashboards.
 */

import PlannerBusinessProfile from "../models/planner-business-profile.model.js";
import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get branding for a user based on their role
 * @param {string} userId - User ID
 * @param {string} role - User role ('event-planner' or 'vendor')
 * @returns {Promise<Object>} Branding configuration
 */
export async function getUserBranding(userId, role) {
  try {
    let branding = null;

    if (role === "event-planner") {
      const profile = await PlannerBusinessProfile.findOne({ userId });
      if (profile && profile.branding) {
        branding = profile.branding;
      }
    } else if (role === "vendor") {
      const vendor = await Vendor.findOne({ owner: userId });
      if (vendor && vendor.branding) {
        branding = vendor.branding;
      }
    }

    // Return default branding if none found
    if (!branding) {
      return getDefaultBranding();
    }

    return {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      font: branding.font,
      customCSS: branding.customCSS,
    };
  } catch (error) {
    console.error("Error getting user branding:", error);
    return getDefaultBranding();
  }
}

/**
 * Get default branding configuration
 * @returns {Object} Default branding
 */
export function getDefaultBranding() {
  return {
    primaryColor: "#6366F1", // Indigo
    secondaryColor: "#10B981", // Green
    accentColor: "#F59E0B", // Amber
    font: "Inter",
    customCSS: null,
  };
}

/**
 * Update branding for a user
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @param {Object} brandingData - Branding configuration
 * @returns {Promise<Object>} Updated branding
 */
export async function updateUserBranding(userId, role, brandingData) {
  try {
    // Validate colors
    if (
      brandingData.primaryColor &&
      !isValidHexColor(brandingData.primaryColor)
    ) {
      throw new AppError("Invalid primary color format", 400);
    }
    if (
      brandingData.secondaryColor &&
      !isValidHexColor(brandingData.secondaryColor)
    ) {
      throw new AppError("Invalid secondary color format", 400);
    }
    if (
      brandingData.accentColor &&
      !isValidHexColor(brandingData.accentColor)
    ) {
      throw new AppError("Invalid accent color format", 400);
    }

    let result;

    if (role === "event-planner") {
      const profile = await PlannerBusinessProfile.findOne({ userId });
      if (!profile) {
        throw new AppError("Business profile not found", 404);
      }

      // Update branding
      profile.branding = {
        ...profile.branding,
        ...brandingData,
      };

      await profile.save();
      result = profile.branding;
    } else if (role === "vendor") {
      const vendor = await Vendor.findOne({ owner: userId });
      if (!vendor) {
        throw new AppError("Vendor profile not found", 404);
      }

      // Update branding
      vendor.branding = {
        ...vendor.branding,
        ...brandingData,
      };

      await vendor.save();
      result = vendor.branding;
    } else {
      throw new AppError("Invalid role", 400);
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Failed to update branding: ${error.message}`, 500);
  }
}

/**
 * Generate CSS variables from branding
 * @param {Object} branding - Branding configuration
 * @returns {string} CSS variables string
 */
export function generateCSSVariables(branding) {
  const { primaryColor, secondaryColor, accentColor, font } = branding;

  return `
    :root {
      --brand-primary: ${primaryColor};
      --brand-secondary: ${secondaryColor};
      --brand-accent: ${accentColor};
      --brand-font: '${font}', sans-serif;
      
      /* Derived colors */
      --brand-primary-light: ${lightenColor(primaryColor, 20)};
      --brand-primary-dark: ${darkenColor(primaryColor, 20)};
      --brand-secondary-light: ${lightenColor(secondaryColor, 20)};
      --brand-secondary-dark: ${darkenColor(secondaryColor, 20)};
    }
  `.trim();
}

/**
 * Generate theme object for frontend
 * @param {Object} branding - Branding configuration
 * @returns {Object} Theme object
 */
export function generateThemeObject(branding) {
  const { primaryColor, secondaryColor, accentColor, font } = branding;

  return {
    colors: {
      primary: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
      primaryLight: lightenColor(primaryColor, 20),
      primaryDark: darkenColor(primaryColor, 20),
      secondaryLight: lightenColor(secondaryColor, 20),
      secondaryDark: darkenColor(secondaryColor, 20),
    },
    typography: {
      fontFamily: font,
    },
    customCSS: branding.customCSS || null,
  };
}

/**
 * Validate hex color format
 * @param {string} color - Hex color code
 * @returns {boolean} True if valid
 */
function isValidHexColor(color) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Lighten a hex color
 * @param {string} color - Hex color code
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color
 */
function lightenColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

/**
 * Darken a hex color
 * @param {string} color - Hex color code
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color
 */
function darkenColor(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = ((num >> 8) & 0x00ff) - amt;
  const B = (num & 0x0000ff) - amt;
  return (
    "#" +
    (
      0x1000000 +
      (R > 0 ? R : 0) * 0x10000 +
      (G > 0 ? G : 0) * 0x100 +
      (B > 0 ? B : 0)
    )
      .toString(16)
      .slice(1)
  );
}

/**
 * Reset branding to default
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Default branding
 */
export async function resetBranding(userId, role) {
  const defaultBranding = getDefaultBranding();
  return await updateUserBranding(userId, role, defaultBranding);
}

export default {
  getUserBranding,
  getDefaultBranding,
  updateUserBranding,
  generateCSSVariables,
  generateThemeObject,
  resetBranding,
};
