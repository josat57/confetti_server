import { AppError } from "../utils/AppError.js";
import Vendor from "../models/vendor.model.js";
import { logger } from "../utils/logger.js";
import { PLAN_CATALOGUE, resolvePlan } from "../config/plans.js";
import { getRequestPlan, PlanFeatureError } from "../services/plan-access.service.js";

/**
 * Vendor plan gates for the vendor AI routes. The plan comes from the user's
 * Subscription (see services/plan-access.service.js), so it matches billing.
 *
 * Vendor levels: Listing 1, Pro 2, Business 3, Venue 4.
 * Older names keep their meaning: "business" = Business and above,
 * "professional"/"enterprise" = the top vendor plan.
 */
const LEGACY_REQUIREMENTS = {
  basic: 1,
  starter: 1,
  business: 3,
  professional: 4,
  enterprise: 4,
};

const minimumLevelFor = (requiredPlans) => {
  const plans = Array.isArray(requiredPlans) ? requiredPlans : [requiredPlans];
  const levels = plans.map((name) => {
    const key = String(name).toLowerCase();
    return resolvePlan("vendor", name)?.key.toLowerCase() === key
      ? resolvePlan("vendor", name).level
      : LEGACY_REQUIREMENTS[key] ?? 1;
  });
  return Math.min(...levels);
};

/**
 * Middleware: the vendor's plan must be at least the lowest of `requiredPlans`.
 * Attaches the vendor profile as req.vendor.
 */
export const requireSubscriptionPlan = (requiredPlans) => {
  const minimumLevel = minimumLevelFor(requiredPlans);
  const requiredPlan = PLAN_CATALOGUE.vendor.find((p) => p.level >= minimumLevel);

  return async (req, res, next) => {
    try {
      const userId = req.user?._id || req.user?.id;
      if (!userId) {
        return next(new AppError("Authentication required", 401));
      }

      const vendor = await Vendor.findOne({ owner: userId }).lean();
      if (!vendor) {
        return next(new AppError("Vendor profile not found", 404));
      }

      const { plan, planType, subscription } = await getRequestPlan(req);
      if (planType !== "vendor" || !plan || plan.level < minimumLevel) {
        const error = new PlanFeatureError({
          feature: "vendorAI",
          plan,
          planType: "vendor",
          label: "This feature",
        });
        if (requiredPlan) {
          error.message = `This feature is available on the ${requiredPlan.displayName} plan and above.`;
          error.details.upgradeTo = requiredPlan.key;
        }
        return next(error);
      }

      // Controllers read req.vendor.subscription.planName
      req.vendor = {
        ...vendor,
        subscription: {
          _id: subscription?._id,
          planName: plan.key,
          planType: "vendor",
          status: subscription?.status || "active",
        },
      };
      next();
    } catch (error) {
      logger.error("Subscription check failed:", error);
      next(new AppError("Failed to verify subscription", 500));
    }
  };
};

/** Business plan and above (Business, Venue) */
export const requireBusinessPlan = requireSubscriptionPlan(["business"]);

/** The top vendor plan (Venue), formerly Professional/Enterprise */
export const requireProfessionalPlan = requireSubscriptionPlan(["professional"]);

/** The top vendor plan (Venue) */
export const requireEnterprisePlan = requireSubscriptionPlan(["enterprise"]);

/**
 * AI feature level (1–5, see universal-ai.service featureAccess) for a plan name
 * of any type. Unknown names get level 1.
 */
export const getPlanLevel = (planName, planType) => {
  const types = planType ? [planType] : ["vendor", "planner", "client"];
  for (const type of types) {
    const plan = resolvePlan(type, planName);
    if (plan) return plan.aiLevel;
  }
  return 1;
};

/** Check if a vendor plan is at least another vendor plan */
export const hasMinimumPlan = (currentPlan, requiredPlan) =>
  (resolvePlan("vendor", currentPlan)?.level || 0) >= minimumLevelFor(requiredPlan);
