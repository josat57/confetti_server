import {
  applyBudgetTemplate,
  budgetTemplates,
} from "../config/budget-templates.js";
import { InsufficientBudgetError } from "../utils/ai-planner-errors.js";
import { logger } from "../utils/logger.js";

/**
 * Service for budget optimization and allocation
 */
class BudgetService {
  constructor() {
    this.contingencyPercentage = 0.08; // 8% contingency buffer
  }

  /**
   * Optimize budget allocation across categories
   * @param {Object} budget - Budget data {amount, currency}
   * @param {string} eventType - Type of event
   * @param {number} guestCount - Number of guests
   * @param {Object} vendorData - Vendor pricing data
   * @returns {Promise<Object>} Optimized budget allocation
   */
  async optimizeBudget(budget, eventType, guestCount, vendorData) {
    try {
      const startTime = Date.now();

      // Get base allocation template
      let baseAllocations = applyBudgetTemplate(eventType, totalBudget);

      // Adjust for guest count
      baseAllocations = this.adjustForGuestCount(
        baseAllocations,
        guestCount,
        eventType
      );

      // Adjust based on vendor pricing in location
      baseAllocations = this.adjustForVendorPricing(
        baseAllocations,
        vendorData
      );

      // Calculate contingency
      const contingency = budget.amount * this.contingencyPercentage;
      const allocatableBudget = budget.amount - contingency;

      // Calculate final allocations
      const categories = baseAllocations.map((allocation) => {
        const allocatedAmount = allocatableBudget * allocation.percentage;
        const priceRange = this.getVendorPriceRange(
          allocation.category,
          vendorData
        );

        return {
          category: allocation.category,
          name: getCategoryInfo(allocation.category).displayName,
          allocatedAmount: Math.round(allocatedAmount),
          percentage: Math.round(allocation.percentage * 100),
          priceRange,
          priority: allocation.priority,
          rationale: this.generateRationale(allocation, eventType, guestCount),
          confidence: this.calculateConfidence(allocatedAmount, priceRange),
        };
      });

      // Calculate feasibility score
      const feasibilityScore = this.calculateFeasibilityScore(
        budget.amount,
        guestCount,
        eventType,
        categories
      );

      const result = {
        categories,
        totalAllocated: allocatableBudget,
        contingency: Math.round(contingency),
        contingencyPercentage: this.contingencyPercentage * 100,
        feasibilityScore,
        currency: budget.currency,
      };

      logger.info("Budget optimized successfully", {
        eventType,
        guestCount,
        totalBudget: budget.amount,
        feasibilityScore,
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error("Error optimizing budget:", {
        budget,
        eventType,
        guestCount,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Adjust allocations based on guest count
   * @param {Array} allocations - Base allocations
   * @param {number} guestCount - Number of guests
   * @param {string} eventType - Event type
   * @returns {Array} Adjusted allocations
   */
  adjustForGuestCount(allocations, guestCount, eventType) {
    const adjusted = [...allocations];

    // For large events (200+ guests), increase catering and venue percentages
    if (guestCount >= 200) {
      const cateringIndex = adjusted.findIndex(
        (a) => a.category === "catering"
      );
      const venueIndex = adjusted.findIndex((a) => a.category === "venue");

      if (cateringIndex !== -1) {
        adjusted[cateringIndex].percentage += 0.05;
      }
      if (venueIndex !== -1) {
        adjusted[venueIndex].percentage += 0.03;
      }

      // Reduce other categories proportionally
      const reduction = 0.08 / (adjusted.length - 2);
      adjusted.forEach((allocation, index) => {
        if (index !== cateringIndex && index !== venueIndex) {
          allocation.percentage = Math.max(
            0.02,
            allocation.percentage - reduction
          );
        }
      });
    }

    // For small events (< 50 guests), can reduce venue percentage
    if (guestCount < 50) {
      const venueIndex = adjusted.findIndex((a) => a.category === "venue");
      if (venueIndex !== -1) {
        const reduction = 0.05;
        adjusted[venueIndex].percentage -= reduction;

        // Distribute to other categories
        const increase = reduction / (adjusted.length - 1);
        adjusted.forEach((allocation, index) => {
          if (index !== venueIndex) {
            allocation.percentage += increase;
          }
        });
      }
    }

    // Normalize to ensure total is 1.0
    const total = adjusted.reduce((sum, a) => sum + a.percentage, 0);
    adjusted.forEach((a) => {
      a.percentage = a.percentage / total;
    });

    return adjusted;
  }

  /**
   * Adjust allocations based on vendor pricing
   * @param {Array} allocations - Base allocations
   * @param {Object} vendorData - Vendor data with pricing
   * @returns {Array} Adjusted allocations
   */
  adjustForVendorPricing(allocations, vendorData) {
    if (
      !vendorData ||
      !vendorData.statistics ||
      !vendorData.statistics.categoryCounts
    ) {
      return allocations;
    }

    const adjusted = [...allocations];
    const categoryStats = vendorData.statistics.categoryCounts;

    // Adjust based on vendor availability and pricing
    adjusted.forEach((allocation) => {
      const stats = categoryStats[allocation.category];

      if (stats) {
        // If category has high average pricing, slightly increase allocation
        if (stats.avgPrice > 0) {
          const avgPriceRatio = stats.avgPrice / 100000; // Normalize
          if (avgPriceRatio > 1.5) {
            allocation.percentage *= 1.1; // Increase by 10%
          }
        }

        // If category has low vendor count, might need to adjust
        if (stats.count < 3) {
          // Limited vendors might mean higher prices
          allocation.percentage *= 1.05;
        }
      }
    });

    // Normalize to ensure total is 1.0
    const total = adjusted.reduce((sum, a) => sum + a.percentage, 0);
    adjusted.forEach((a) => {
      a.percentage = a.percentage / total;
    });

    return adjusted;
  }

  /**
   * Get vendor price range for a category
   * @param {string} category - Vendor category
   * @param {Object} vendorData - Vendor data
   * @returns {Object} Price range
   */
  getVendorPriceRange(category, vendorData) {
    if (
      !vendorData ||
      !vendorData.statistics ||
      !vendorData.statistics.categoryCounts
    ) {
      return { min: 0, max: 0, average: 0, currency: "NGN" };
    }

    const stats = vendorData.statistics.categoryCounts[category];

    if (stats && stats.priceRange) {
      return {
        min: stats.priceRange.min || 0,
        max: stats.priceRange.max || 0,
        average: stats.avgPrice || 0,
        currency: "NGN",
      };
    }

    return { min: 0, max: 0, average: 0, currency: "NGN" };
  }

  /**
   * Generate rationale for budget allocation
   * @param {Object} allocation - Allocation data
   * @param {string} eventType - Event type
   * @param {number} guestCount - Guest count
   * @returns {string} Rationale
   */
  generateRationale(allocation, eventType, guestCount) {
    const categoryInfo = getCategoryInfo(allocation.category);
    const percentage = Math.round(allocation.percentage * 100);

    const rationales = {
      venue: `${percentage}% allocated for venue rental. Essential for hosting ${guestCount} guests comfortably.`,
      catering: `${percentage}% allocated for catering. Based on ${guestCount} guests, this covers quality food and beverages.`,
      photography: `${percentage}% allocated for photography. Professional documentation of your ${eventType}.`,
      videography: `${percentage}% allocated for videography. Captures memorable moments in video format.`,
      decoration: `${percentage}% allocated for decoration. Creates the right ambiance for your ${eventType}.`,
      entertainment: `${percentage}% allocated for entertainment. Keeps guests engaged throughout the event.`,
      audio_visual: `${percentage}% allocated for AV equipment. Essential for presentations and sound quality.`,
      event_planning: `${percentage}% allocated for professional planning. Ensures smooth execution.`,
      transportation: `${percentage}% allocated for transportation. Convenient guest transport services.`,
      florals: `${percentage}% allocated for floral arrangements. Adds elegance to your event.`,
      security: `${percentage}% allocated for security. Ensures safety for ${guestCount} guests.`,
      lighting: `${percentage}% allocated for lighting. Creates the perfect atmosphere.`,
      cake_desserts: `${percentage}% allocated for cake and desserts. Sweet treats for your celebration.`,
    };

    return (
      rationales[allocation.category] ||
      `${percentage}% allocated for ${categoryInfo.displayName}. ${categoryInfo.description}`
    );
  }

  /**
   * Calculate confidence score for allocation
   * @param {number} allocatedAmount - Allocated amount
   * @param {Object} priceRange - Vendor price range
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(allocatedAmount, priceRange) {
    if (!priceRange || priceRange.average === 0) {
      return 50; // Neutral confidence when no data
    }

    const ratio = allocatedAmount / priceRange.average;

    if (ratio >= 1.2) return 95; // Well above average
    if (ratio >= 1.0) return 85; // At or above average
    if (ratio >= 0.8) return 70; // Slightly below average
    if (ratio >= 0.6) return 55; // Below average
    return 40; // Significantly below average
  }

  /**
   * Calculate overall feasibility score
   * @param {number} totalBudget - Total budget
   * @param {number} guestCount - Guest count
   * @param {string} eventType - Event type
   * @param {Array} categories - Budget categories
   * @returns {number} Feasibility score (0-100)
   */
  calculateFeasibilityScore(totalBudget, guestCount, eventType, categories) {
    // Check against minimum budget
    const minBudget = getMinimumBudget(eventType, guestCount);
    const budgetRatio = totalBudget / minBudget;

    let score = 0;

    if (budgetRatio >= 2.0) score = 95; // Excellent budget
    else if (budgetRatio >= 1.5) score = 85; // Very good budget
    else if (budgetRatio >= 1.2) score = 75; // Good budget
    else if (budgetRatio >= 1.0) score = 65; // Adequate budget
    else if (budgetRatio >= 0.8) score = 50; // Tight budget
    else score = 35; // Insufficient budget

    // Adjust based on category confidence
    const avgConfidence =
      categories.reduce((sum, cat) => sum + cat.confidence, 0) /
      categories.length;
    score = score * 0.7 + avgConfidence * 0.3;

    return Math.round(score);
  }

  /**
   * Validate budget sufficiency
   * @param {Object} budget - Budget data
   * @param {string} eventType - Event type
   * @param {number} guestCount - Guest count
   * @throws {InsufficientBudgetError} If budget is too low
   */
  validateBudgetSufficiency(budget, eventType, guestCount) {
    const minBudget = getMinimumBudget(eventType, guestCount);

    if (budget.amount < minBudget * 0.7) {
      const suggestedBudget = Math.round(minBudget * 1.2);
      const alternatives = [
        "Reduce guest count",
        "Choose a more budget-friendly venue",
        "Opt for buffet-style catering instead of plated meals",
        "Consider a weekday event for better pricing",
      ];

      throw new InsufficientBudgetError(
        Math.round(minBudget),
        suggestedBudget,
        alternatives
      );
    }
  }
}

export default new BudgetService();
