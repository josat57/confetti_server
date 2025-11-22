import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Get all subscription plans
 * GET /api/v1/subscription-plans
 */
export const getAllPlans = async (req, res, next) => {
  try {
    let { planType, currency, activeOnly = "true" } = req.query;

    // Support both 'event_planner' and 'planner' as aliases
    if (planType === "event_planner") {
      planType = "planner";
    }

    const query = {};
    if (planType) query.planType = planType;
    if (activeOnly === "true") query.isActive = true;

    const plans = await SubscriptionPlan.find(query).sort({
      sortOrder: 1,
      planName: 1,
    });

    // Filter by currency if specified
    let filteredPlans = plans;
    if (currency) {
      filteredPlans = plans
        .map((plan) => {
          const pricing = plan.getPriceForCurrency(currency);
          if (!pricing) return null;

          return {
            ...plan.toObject(),
            selectedPricing: pricing,
          };
        })
        .filter((plan) => plan !== null);
    }

    res.status(200).json({
      status: "success",
      results: filteredPlans.length,
      data: {
        plans: filteredPlans,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single subscription plan
 * GET /api/v1/subscription-plans/:id
 */
export const getPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return next(new AppError("Plan not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: {
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get plan by type and name
 * GET /api/v1/subscription-plans/find/:planType/:planName
 */
export const getPlanByTypeAndName = async (req, res, next) => {
  try {
    let { planType, planName } = req.params;
    const { currency } = req.query;

    // Support both 'event_planner' and 'planner' as aliases
    if (planType === "event_planner") {
      planType = "planner";
    }

    const plan = await SubscriptionPlan.findByTypeAndName(planType, planName);

    if (!plan) {
      return next(new AppError("Plan not found", 404));
    }

    let response = plan.toObject();

    // Add selected pricing if currency specified
    if (currency) {
      const pricing = plan.getPriceForCurrency(currency);
      if (pricing) {
        response.selectedPricing = pricing;
      }
    }

    res.status(200).json({
      status: "success",
      data: {
        plan: response,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create subscription plan (Admin only)
 * POST /api/v1/subscription-plans
 */
export const createPlan = async (req, res, next) => {
  try {
    const {
      planType,
      planName,
      displayName,
      description,
      pricing,
      features,
      limitations,
      billingCycle,
      isPopular,
      sortOrder,
    } = req.body;

    // Validate pricing array
    if (!pricing || !Array.isArray(pricing) || pricing.length === 0) {
      return next(
        new AppError("At least one pricing configuration is required", 400)
      );
    }

    // Convert amounts to minor units if needed
    const processedPricing = pricing.map((p) => {
      let amountInMinorUnits = p.amountInMinorUnits;

      // If amountInMinorUnits not provided, calculate from amount
      if (!amountInMinorUnits && p.amount !== undefined) {
        amountInMinorUnits = Math.round(p.amount * 100);
      }

      return {
        currency: p.currency,
        amount: p.amount,
        amountInMinorUnits,
      };
    });

    const plan = await SubscriptionPlan.create({
      planType,
      planName,
      displayName,
      description,
      pricing: processedPricing,
      features: features || [],
      limitations: limitations || [],
      billingCycle: billingCycle || "monthly",
      isPopular: isPopular || false,
      sortOrder: sortOrder || 0,
    });

    logger.info(`Subscription plan created: ${plan.planName}`, {
      planId: plan._id,
      planType: plan.planType,
      createdBy: req.user?._id,
    });

    res.status(201).json({
      status: "success",
      data: {
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update subscription plan (Admin only)
 * PATCH /api/v1/subscription-plans/:id
 */
export const updatePlan = async (req, res, next) => {
  try {
    const {
      displayName,
      description,
      pricing,
      features,
      limitations,
      billingCycle,
      isActive,
      isPopular,
      sortOrder,
    } = req.body;

    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return next(new AppError("Plan not found", 404));
    }

    // Update fields
    if (displayName !== undefined) plan.displayName = displayName;
    if (description !== undefined) plan.description = description;
    if (features !== undefined) plan.features = features;
    if (limitations !== undefined) plan.limitations = limitations;
    if (billingCycle !== undefined) plan.billingCycle = billingCycle;
    if (isActive !== undefined) plan.isActive = isActive;
    if (isPopular !== undefined) plan.isPopular = isPopular;
    if (sortOrder !== undefined) plan.sortOrder = sortOrder;

    // Update pricing if provided
    if (pricing && Array.isArray(pricing)) {
      const processedPricing = pricing.map((p) => {
        let amountInMinorUnits = p.amountInMinorUnits;

        if (!amountInMinorUnits && p.amount !== undefined) {
          amountInMinorUnits = Math.round(p.amount * 100);
        }

        return {
          currency: p.currency,
          amount: p.amount,
          amountInMinorUnits,
        };
      });

      plan.pricing = processedPricing;
    }

    await plan.save();

    logger.info(`Subscription plan updated: ${plan.planName}`, {
      planId: plan._id,
      updatedBy: req.user?._id,
    });

    res.status(200).json({
      status: "success",
      data: {
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update plan pricing (Admin only)
 * PATCH /api/v1/subscription-plans/:id/pricing
 */
export const updatePlanPricing = async (req, res, next) => {
  try {
    const { currency, amount } = req.body;

    if (!currency || amount === undefined) {
      return next(new AppError("Currency and amount are required", 400));
    }

    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return next(new AppError("Plan not found", 404));
    }

    // Calculate amount in minor units (kobo, cents, etc.)
    const amountInMinorUnits = Math.round(amount * 100);

    // Update or add pricing
    plan.setPricing(currency, amount, amountInMinorUnits);
    await plan.save();

    logger.info(`Plan pricing updated: ${plan.planName}`, {
      planId: plan._id,
      currency,
      amount,
      updatedBy: req.user?._id,
    });

    res.status(200).json({
      status: "success",
      data: {
        plan,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete subscription plan (Admin only)
 * DELETE /api/v1/subscription-plans/:id
 */
export const deletePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);

    if (!plan) {
      return next(new AppError("Plan not found", 404));
    }

    // Soft delete - just deactivate
    plan.isActive = false;
    await plan.save();

    logger.info(`Subscription plan deactivated: ${plan.planName}`, {
      planId: plan._id,
      deletedBy: req.user?._id,
    });

    res.status(200).json({
      status: "success",
      message: "Plan deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update plan prices (Admin only)
 * POST /api/v1/subscription-plans/bulk-update-pricing
 */
export const bulkUpdatePricing = async (req, res, next) => {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return next(new AppError("Updates array is required", 400));
    }

    const results = [];

    for (const update of updates) {
      const { planId, currency, amount } = update;

      if (!planId || !currency || amount === undefined) {
        results.push({
          planId,
          success: false,
          error: "Missing required fields",
        });
        continue;
      }

      try {
        const plan = await SubscriptionPlan.findById(planId);

        if (!plan) {
          results.push({
            planId,
            success: false,
            error: "Plan not found",
          });
          continue;
        }

        const amountInMinorUnits = Math.round(amount * 100);
        plan.setPricing(currency, amount, amountInMinorUnits);
        await plan.save();

        results.push({
          planId,
          planName: plan.planName,
          success: true,
        });
      } catch (error) {
        results.push({
          planId,
          success: false,
          error: error.message,
        });
      }
    }

    logger.info(`Bulk pricing update completed`, {
      totalUpdates: updates.length,
      successful: results.filter((r) => r.success).length,
      updatedBy: req.user?._id,
    });

    res.status(200).json({
      status: "success",
      data: {
        results,
      },
    });
  } catch (error) {
    next(error);
  }
};
