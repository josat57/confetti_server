import { AppError } from "../utils/AppError.js";
import Vendor from "../models/vendor.model.js";
import { logger } from "../utils/logger.js";

/**
 * Middleware to check if vendor has required subscription plan
 * @param {string|Array} requiredPlans - Required plan name(s)
 * @returns {Function} Express middleware
 */
export const requireSubscriptionPlan = (requiredPlans) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return next(new AppError("Authentication required", 401));
      }

      // Get vendor with subscription details
      const vendor = await Vendor.findOne({ owner: userId })
        .populate("subscription", "planName planType status")
        .lean();

      if (!vendor) {
        return next(new AppError("Vendor profile not found", 404));
      }

      if (!vendor.subscription) {
        return next(new AppError("No active subscription found", 403));
      }

      const { planName, status } = vendor.subscription;

      // Check if subscription is active
      if (status !== "active") {
        return next(new AppError("Subscription is not active", 403));
      }

      // Normalize required plans to array
      const plans = Array.isArray(requiredPlans)
        ? requiredPlans
        : [requiredPlans];

      // Check if current plan is in required plans
      if (!plans.includes(planName)) {
        return next(
          new AppError(
            `This feature requires ${plans.join(
              " or "
            )} subscription plan. Current plan: ${planName}`,
            403
          )
        );
      }

      // Attach vendor info to request
      req.vendor = vendor;
      next();
    } catch (error) {
      logger.error("Subscription check failed:", error);
      next(new AppError("Failed to verify subscription", 500));
    }
  };
};

/**
 * Middleware to check if vendor has business plan or above
 */
export const requireBusinessPlan = requireSubscriptionPlan([
  "business",
  "professional",
  "enterprise",
]);

/**
 * Middleware to check if vendor has professional plan or above
 */
export const requireProfessionalPlan = requireSubscriptionPlan([
  "professional",
  "enterprise",
]);

/**
 * Middleware to check if vendor has enterprise plan
 */
export const requireEnterprisePlan = requireSubscriptionPlan(["enterprise"]);

/**
 * Get plan hierarchy level for comparison
 * @param {string} planName - Plan name
 * @returns {number} Plan level (higher = better)
 */
export const getPlanLevel = (planName) => {
  const levels = {
    basic: 1,
    starter: 2,
    business: 3,
    professional: 4,
    enterprise: 5,
  };
  return levels[planName] || 0;
};

/**
 * Check if vendor has minimum plan level
 * @param {string} currentPlan - Current plan name
 * @param {string} requiredPlan - Required minimum plan
 * @returns {boolean} True if meets requirement
 */
export const hasMinimumPlan = (currentPlan, requiredPlan) => {
  return getPlanLevel(currentPlan) >= getPlanLevel(requiredPlan);
};
