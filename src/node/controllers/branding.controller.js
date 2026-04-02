/**
 * Branding Controller
 *
 * Handles HTTP requests for branding and theme customization.
 */

import brandingService from "../services/branding.service.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get user's branding configuration
 * GET /api/v1/branding
 */
export const getBranding = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const branding = await brandingService.getUserBranding(userId, userRole);

    res.status(200).json({
      status: "success",
      data: { branding },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's theme object (for frontend application)
 * GET /api/v1/branding/theme
 */
export const getTheme = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const branding = await brandingService.getUserBranding(userId, userRole);
    const theme = brandingService.generateThemeObject(branding);

    res.status(200).json({
      status: "success",
      data: { theme },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get CSS variables for user's branding
 * GET /api/v1/branding/css
 */
export const getCSSVariables = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const branding = await brandingService.getUserBranding(userId, userRole);
    const cssVariables = brandingService.generateCSSVariables(branding);

    res.setHeader("Content-Type", "text/css");
    res.status(200).send(cssVariables);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user's branding
 * PUT /api/v1/branding
 */
export const updateBranding = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    const brandingData = req.body;

    const branding = await brandingService.updateUserBranding(
      userId,
      userRole,
      brandingData
    );

    res.status(200).json({
      status: "success",
      data: { branding },
      message: "Branding updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset branding to default
 * POST /api/v1/branding/reset
 */
export const resetBranding = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const branding = await brandingService.resetBranding(userId, userRole);

    res.status(200).json({
      status: "success",
      data: { branding },
      message: "Branding reset to default",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getBranding,
  getTheme,
  getCSSVariables,
  updateBranding,
  resetBranding,
};
