import { getCategoryInfo } from "../config/budget-templates.js";
import { logger } from "../utils/logger.js";

/**
 * Service for vendor category recommendations
 */
class CategoryService {
  /**
   * Recommend vendor categories based on event requirements
   * @param {string} eventType - Type of event
   * @param {Object} guestClass - Guest demographics
   * @param {Object} budgetAllocation - Budget allocation data
   * @returns {Promise<Array>} Vendor category recommendations
   */
  async recommendCategories(eventType, guestClass, budgetAllocation) {
    try {
      const startTime = Date.now();

      // Get required categories for event type
      const requiredCategories = this.getRequiredCategories(eventType);

      // Get recommended categories based on guest class
      const recommendedCategories = this.getRecommendedCategories(
        eventType,
        guestClass
      );

      // Get optional categories based on budget
      const optionalCategories = this.getOptionalCategories(
        eventType,
        budgetAllocation
      );

      // Combine all categories
      const allCategories = [
        ...requiredCategories.map((c) => ({
          category: c,
          priority: "essential",
        })),
        ...recommendedCategories.map((c) => ({
          category: c,
          priority: "recommended",
        })),
        ...optionalCategories.map((c) => ({
          category: c,
          priority: "optional",
        })),
      ];

      // Remove duplicates
      const uniqueCategories = this.removeDuplicates(allCategories);

      // Format for teaser
      const formattedCategories = uniqueCategories.map((cat) => {
        const info = getCategoryInfo(cat.category);
        const allocation = budgetAllocation.categories.find(
          (a) => a.category === cat.category
        );

        return {
          name: info.displayName,
          category: cat.category,
          description: info.description,
          estimatedCost: allocation
            ? {
                min: allocation.priceRange.min,
                max: allocation.priceRange.max,
              }
            : { min: 0, max: 0 },
          allocatedAmount: allocation ? allocation.allocatedAmount : 0,
          priority: cat.priority,
          locked: true, // Always locked for teaser
          vendorCount: 0, // Will be populated by vendor service
        };
      });

      logger.info("Categories recommended successfully", {
        eventType,
        totalCategories: formattedCategories.length,
        essential: formattedCategories.filter((c) => c.priority === "essential")
          .length,
        recommended: formattedCategories.filter(
          (c) => c.priority === "recommended"
        ).length,
        optional: formattedCategories.filter((c) => c.priority === "optional")
          .length,
        processingTime: Date.now() - startTime,
      });

      return formattedCategories;
    } catch (error) {
      logger.error("Error recommending categories:", {
        eventType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get required categories for event type
   * @param {string} eventType - Event type
   * @returns {Array} Required categories
   */
  getRequiredCategories(eventType) {
    const required = {
      wedding: ["venue", "catering", "photography"],
      corporate: ["venue", "catering", "audio_visual"],
      birthday: ["venue", "catering"],
      graduation: ["venue", "catering"],
      conference: ["venue", "catering", "audio_visual"],
      other: ["venue", "catering"],
    };

    return required[eventType] || required.other;
  }

  /**
   * Get recommended categories based on guest class
   * @param {string} eventType - Event type
   * @param {Object} guestClass - Guest demographics
   * @returns {Array} Recommended categories
   */
  getRecommendedCategories(eventType, guestClass) {
    const categories = [];

    // Add entertainment for events with children
    if (guestClass.ageGroups && guestClass.ageGroups.includes("children")) {
      categories.push("entertainment");
    }

    // Add luxury categories for affluent guests
    if (
      guestClass.socialStatus &&
      (guestClass.socialStatus.includes("affluent") ||
        guestClass.socialStatus.includes("luxury"))
    ) {
      if (eventType === "wedding" || eventType === "corporate") {
        categories.push("valet_parking");
        categories.push("videography");
      }
    }

    // Add transportation for formal events
    if (
      guestClass.formality === "black-tie" ||
      guestClass.formality === "formal"
    ) {
      categories.push("transportation");
    }

    // Add decoration for most events
    if (!categories.includes("decoration")) {
      categories.push("decoration");
    }

    // Add entertainment for birthday and graduation
    if (eventType === "birthday" || eventType === "graduation") {
      if (!categories.includes("entertainment")) {
        categories.push("entertainment");
      }
    }

    // Add florals for weddings
    if (eventType === "wedding") {
      categories.push("florals");
      categories.push("videography");
    }

    // Add event planning for large corporate events
    if (eventType === "corporate" || eventType === "conference") {
      categories.push("event_planning");
    }

    // Add security for large events
    if (eventType === "corporate" || eventType === "conference") {
      categories.push("security");
    }

    return categories;
  }

  /**
   * Get optional categories based on budget
   * @param {string} eventType - Event type
   * @param {Object} budgetAllocation - Budget allocation
   * @returns {Array} Optional categories
   */
  getOptionalCategories(eventType, budgetAllocation) {
    const categories = [];

    // Check if budget allows for optional categories
    const feasibilityScore = budgetAllocation.feasibilityScore || 0;

    if (feasibilityScore >= 70) {
      // Good budget - can add more optional categories
      if (eventType === "wedding") {
        categories.push(
          "lighting",
          "invitations",
          "favors_gifts",
          "bar_services"
        );
      } else if (eventType === "corporate" || eventType === "conference") {
        categories.push("transportation", "rentals");
      } else if (eventType === "birthday") {
        categories.push("cake_desserts", "favors_gifts");
      } else if (eventType === "graduation") {
        categories.push("photography", "favors_gifts");
      }
    } else if (feasibilityScore >= 50) {
      // Moderate budget - add few optional categories
      if (eventType === "wedding") {
        categories.push("lighting");
      } else if (eventType === "birthday") {
        categories.push("cake_desserts");
      }
    }

    return categories;
  }

  /**
   * Remove duplicate categories, keeping highest priority
   * @param {Array} categories - Categories with priorities
   * @returns {Array} Unique categories
   */
  removeDuplicates(categories) {
    const priorityOrder = { essential: 1, recommended: 2, optional: 3 };
    const categoryMap = new Map();

    categories.forEach((cat) => {
      const existing = categoryMap.get(cat.category);
      if (
        !existing ||
        priorityOrder[cat.priority] < priorityOrder[existing.priority]
      ) {
        categoryMap.set(cat.category, cat);
      }
    });

    return Array.from(categoryMap.values());
  }

  /**
   * Get category display name
   * @param {string} category - Category name
   * @returns {string} Display name
   */
  getCategoryDisplayName(category) {
    return getCategoryInfo(category).displayName;
  }

  /**
   * Get category description
   * @param {string} category - Category name
   * @param {string} eventType - Event type
   * @returns {string} Description
   */
  getCategoryDescription(category, eventType) {
    const info = getCategoryInfo(category);
    return info.description;
  }

  /**
   * Update vendor counts for categories
   * @param {Array} categories - Category recommendations
   * @param {Object} vendorData - Vendor data with counts
   * @returns {Array} Updated categories
   */
  updateVendorCounts(categories, vendorData) {
    if (
      !vendorData ||
      !vendorData.statistics ||
      !vendorData.statistics.categoryCounts
    ) {
      return categories;
    }

    const categoryStats = vendorData.statistics.categoryCounts;

    return categories.map((cat) => ({
      ...cat,
      vendorCount: categoryStats[cat.category]?.count || 0,
    }));
  }
}

export default new CategoryService();
