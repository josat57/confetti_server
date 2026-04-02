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
    this.contingencyRates = {
      strict: 0.05,    // 5% contingency in strict mode
      moderate: 0.08,  // 8% contingency in moderate mode
      flexible: 0.12,  // 12% contingency in flexible mode
    };
  }

  /**
   * Optimize budget allocation across categories
   * @param {Object} budget - Budget data {amount, currency}
   * @param {string} eventType - Type of event
   * @param {number} guestCount - Number of guests
   * @param {Object} vendorData - Vendor pricing data
   * @param {string} budgetFlexibility - 'strict' | 'moderate' | 'flexible'
   * @returns {Promise<Object>} Optimized budget allocation
   */
  async optimizeBudget(budget, eventType, guestCount, vendorData, budgetFlexibility = 'moderate') {
    try {
      const startTime = Date.now();

      // Extract budget amount
      const totalBudget = budget.amount || budget;

      // Determine contingency rate based on flexibility mode
      const contingencyRate = this.contingencyRates[budgetFlexibility] ?? this.contingencyRates.moderate;
      const contingency = Math.round(totalBudget * contingencyRate);
      const allocatableBudget = totalBudget - contingency;

      // Get base allocation template
      let baseAllocations = applyBudgetTemplate(eventType, totalBudget);

      // Adjust for guest count
      baseAllocations = this.adjustForGuestCount(
        baseAllocations,
        guestCount,
        eventType
      );

      // Adjust based on vendor pricing only in non-strict modes
      if (budgetFlexibility !== 'strict') {
        baseAllocations = this.adjustForVendorPricing(
          baseAllocations,
          vendorData
        );
      }

      // Calculate final allocations
      let categories = baseAllocations.map((allocation) => {
        const allocatedAmount = allocatableBudget * allocation.percentage;
        const priceRange = this.getVendorPriceRange(
          allocation.category,
          vendorData
        );

        return {
          category: allocation.category,
          name: this.getCategoryDisplayName(allocation.category),
          allocatedAmount: Math.round(allocatedAmount),
          // percentage = true % of TOTAL budget (not allocatable)
          percentage: Math.round((allocatedAmount / totalBudget) * 100),
          priceRange,
          priority: allocation.priority,
          rationale: this.generateRationale(allocation, eventType, guestCount),
          confidence: this.calculateConfidence(allocatedAmount, priceRange),
        };
      });

      // Hard cap: ensure sum of allocations + contingency never exceeds totalBudget
      const totalAllocated = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);
      if (totalAllocated + contingency > totalBudget) {
        const scaleFactor = (totalBudget - contingency) / totalAllocated;
        categories = categories.map((c) => {
          const scaled = Math.round(c.allocatedAmount * scaleFactor);
          return {
            ...c,
            allocatedAmount: scaled,
            percentage: Math.round((scaled / totalBudget) * 100),
          };
        });
      }

      // Calculate feasibility score
      const feasibilityScore = this.calculateFeasibilityScore(
        totalBudget,
        guestCount,
        eventType,
        categories
      );

      const finalAllocated = categories.reduce((sum, c) => sum + c.allocatedAmount, 0);

      const result = {
        categories,
        totalAllocated: finalAllocated,
        contingency,
        contingencyPercentage: Math.round(contingencyRate * 100),
        feasibilityScore,
        currency: budget.currency || "NGN",
        budgetFlexibility,
      };

      logger.info("Budget optimized successfully", {
        eventType,
        guestCount,
        totalBudget: totalBudget,
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
  /**
   * Get display name for category
   * @param {string} category - Category name
   * @returns {string} Display name
   */
  getCategoryDisplayName(category) {
    if (!category || typeof category !== "string") return "Event Essentials";

    const names = {
      venue: "Venue Rental",
      catering: "Catering & Food Service",
      photography: "Photography Services",
      videography: "Videography & Video Production",
      decoration: "Decoration & Styling",
      entertainment: "Entertainment & Music",
      audio_visual: "Audio/Visual Equipment",
      av_equipment: "Audio/Visual Equipment",
      event_planning: "Event Planning & Coordination",
      event_coordination: "Event Planning & Coordination",
      transportation: "Guest Transportation",
      florals: "Floral Arrangements",
      flowers: "Floral Arrangements",
      security: "Security Services",
      lighting: "Lighting & Ambiance",
      cake_desserts: "Cake & Desserts",
      cake: "Wedding/Event Cake",
      attire: "Wedding Attire & Accessories",
      invitations: "Invitations & Stationery",
      wedding_favors: "Wedding Favors & Gifts",
      party_favors: "Party Favors & Gifts",
      event_supplies: "Event Supplies & Materials",
      event_staff: "Event Staff & Personnel",
      staff: "Event Staff & Personnel",
      rentals: "Equipment & Furniture Rentals",
      equipment_rentals: "Equipment & Furniture Rentals",
      branding_materials: "Branding & Marketing Materials",
      guest_amenities: "Guest Amenities & Comfort",
      contingency_buffer: "Contingency & Emergency Fund",
      favors: "Guest Favors & Gifts",
    };

    return (
      names[category] ||
      category
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    );
  }

  generateRationale(allocation, eventType, guestCount) {
    const percentage = Math.round(allocation.percentage * 100);
    const displayName = this.getCategoryDisplayName(allocation.category);

    const rationales = {
      venue: `${percentage}% for venue rental - Secure a beautiful space that comfortably accommodates ${guestCount} guests with proper facilities and ambiance.`,
      catering: `${percentage}% for catering services - Provide quality meals and beverages for ${guestCount} guests, including appetizers, main courses, and drinks.`,
      photography: `${percentage}% for professional photography - Capture every precious moment with high-quality images you'll treasure forever.`,
      videography: `${percentage}% for videography services - Create a cinematic video that lets you relive your special day for years to come.`,
      decoration: `${percentage}% for decoration and styling - Transform your venue with stunning decor that reflects your theme and creates the perfect atmosphere.`,
      entertainment: `${percentage}% for entertainment - Keep your ${guestCount} guests engaged and dancing with professional DJs, live bands, or performers.`,
      audio_visual: `${percentage}% for AV equipment - Ensure crystal-clear sound and professional presentations with quality microphones, speakers, and projectors.`,
      av_equipment: `${percentage}% for AV equipment - Ensure crystal-clear sound and professional presentations with quality microphones, speakers, and projectors.`,
      event_planning: `${percentage}% for professional event coordination - Let experts handle logistics, vendor management, and day-of coordination for stress-free execution.`,
      event_coordination: `${percentage}% for professional event coordination - Let experts handle logistics, vendor management, and day-of coordination for stress-free execution.`,
      transportation: `${percentage}% for guest transportation - Provide convenient shuttle services or parking arrangements for ${guestCount} guests.`,
      florals: `${percentage}% for floral arrangements - Add natural beauty with fresh flowers for centerpieces, bouquets, and venue decoration.`,
      flowers: `${percentage}% for floral arrangements - Add natural beauty with fresh flowers for centerpieces, bouquets, and venue decoration.`,
      security: `${percentage}% for security services - Ensure the safety and peace of mind for ${guestCount} guests with professional security personnel.`,
      lighting: `${percentage}% for lighting design - Create the perfect mood with professional lighting that enhances your venue's beauty and atmosphere.`,
      cake_desserts: `${percentage}% for cake and desserts - Delight guests with a beautiful custom cake and sweet treats that complement your theme.`,
      cake: `${percentage}% for event cake - Order a stunning custom cake that serves as both dessert and a beautiful centerpiece for ${guestCount} guests.`,
      attire: `${percentage}% for wedding attire - Invest in beautiful wedding outfits, accessories, and alterations for the bride, groom, and wedding party.`,
      invitations: `${percentage}% for invitations and stationery - Create elegant invitations, programs, and signage that set the tone for your event.`,
      wedding_favors: `${percentage}% for wedding favors - Thank your ${guestCount} guests with thoughtful keepsakes they'll cherish as a memory of your special day.`,
      party_favors: `${percentage}% for party favors - Send ${guestCount} guests home with fun gifts and treats as a thank-you for celebrating with you.`,
      event_supplies: `${percentage}% for event supplies - Cover essential items like tableware, linens, chairs, and other materials needed for smooth operations.`,
      event_staff: `${percentage}% for event staff - Hire professional servers, bartenders, and support staff to ensure excellent service for ${guestCount} guests.`,
      staff: `${percentage}% for event staff - Hire professional servers, bartenders, and support staff to ensure excellent service for ${guestCount} guests.`,
      rentals: `${percentage}% for equipment rentals - Rent essential items like tables, chairs, linens, tents, and specialty equipment for your event.`,
      equipment_rentals: `${percentage}% for equipment rentals - Rent essential items like tables, chairs, linens, tents, and specialty equipment for your event.`,
      branding_materials: `${percentage}% for branding materials - Create professional banners, signage, branded items, and marketing collateral for your corporate event.`,
      guest_amenities: `${percentage}% for guest amenities - Provide comfort items like coat check, restrooms, lounge areas, and refreshment stations for ${guestCount} guests.`,
      contingency_buffer: `${percentage}% for contingency fund - Reserve emergency funds for unexpected costs, last-minute changes, or spontaneous upgrades.`,
      favors: `${percentage}% for guest favors - Show appreciation to ${guestCount} guests with memorable gifts and tokens of gratitude.`,
    };

    return (
      rationales[allocation.category] ||
      `${percentage}% for ${displayName} - Essential investment to ensure quality and success for your ${eventType} with ${guestCount} guests.`
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
    const minBudget = this.getMinimumBudget(eventType, guestCount);
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
   * Get minimum budget for event type and guest count
   * @param {string} eventType - Event type
   * @param {number} guestCount - Guest count
   * @returns {number} Minimum budget amount
   */
  getMinimumBudget(eventType, guestCount) {
    // Base cost per guest by event type (in NGN)
    const baseCostPerGuest = {
      wedding: 15000,
      corporate: 12000,
      birthday: 8000,
      graduation: 7000,
      conference: 10000,
      anniversary: 10000,
      default: 8000,
    };

    const costPerGuest =
      baseCostPerGuest[eventType?.toLowerCase()] || baseCostPerGuest.default;

    // Base venue and fixed costs
    const fixedCosts = {
      wedding: 200000,
      corporate: 150000,
      birthday: 100000,
      graduation: 80000,
      conference: 120000,
      anniversary: 120000,
      default: 100000,
    };

    const fixedCost =
      fixedCosts[eventType?.toLowerCase()] || fixedCosts.default;

    return fixedCost + costPerGuest * guestCount;
  }

  /**
   * Validate budget and provide recommendations
   * @param {Object} budget - Budget data
   * @param {string} eventType - Event type
   * @param {number} guestCount - Guest count
   * @returns {Object} Budget analysis with warnings and recommendations
   */
  validateBudgetSufficiency(budget, eventType, guestCount) {
    const recommendedBudget = this.getMinimumBudget(eventType, guestCount);
    const budgetRatio = budget.amount / recommendedBudget;

    const analysis = {
      isAdequate: budgetRatio >= 1.0,
      budgetRatio: Math.round(budgetRatio * 100) / 100,
      enteredBudget: budget.amount,
      recommendedBudget: Math.round(recommendedBudget),
      shortfall:
        budgetRatio < 1.0 ? Math.round(recommendedBudget - budget.amount) : 0,
      warnings: [],
      recommendations: [],
      optimizations: [],
    };

    // Categorize budget levels and provide specific guidance
    if (budgetRatio < 0.5) {
      // Severely constrained budget (less than 50% of recommended)
      analysis.budgetLevel = "severely_constrained";
      analysis.warnings.push(
        `Your budget is ${Math.round(
          (1 - budgetRatio) * 100
        )}% below the recommended amount for a ${eventType} with ${guestCount} guests.`,
        "Significant compromises will be required on venue quality, catering options, and services.",
        "The event experience may not meet typical expectations for this event type."
      );
      analysis.recommendations.push(
        `Consider reducing guest count to ${Math.round(
          guestCount * 0.6
        )} guests to improve per-guest experience`,
        "Focus budget on 2-3 priority categories (e.g., venue + catering only)",
        "Explore DIY options for decorations and entertainment",
        "Consider a simpler venue like community halls or outdoor spaces",
        "Opt for buffet or food stations instead of plated meals"
      );
      analysis.optimizations.push(
        "Schedule event on a weekday for 30-40% venue savings",
        "Book vendors 6+ months in advance for better rates",
        "Combine services (e.g., venue with in-house catering)",
        "Limit event duration to reduce costs"
      );
    } else if (budgetRatio < 0.7) {
      // Tight budget (50-70% of recommended)
      analysis.budgetLevel = "tight";
      analysis.warnings.push(
        `Your budget is ${Math.round(
          (1 - budgetRatio) * 100
        )}% below the recommended amount.`,
        "Some compromises on quality and service options will be necessary.",
        "You may need to prioritize certain aspects over others."
      );
      analysis.recommendations.push(
        `Consider reducing guest count to ${Math.round(
          guestCount * 0.8
        )} guests for better quality`,
        "Prioritize 3-4 key categories that matter most to you",
        "Mix premium and budget-friendly options strategically",
        "Choose a venue with included amenities to reduce separate costs",
        "Consider buffet-style service to reduce catering costs by 20-30%"
      );
      analysis.optimizations.push(
        "Book during off-peak season for 15-25% savings",
        "Negotiate package deals with vendors",
        "Use digital invitations instead of printed ones",
        "Limit bar service to beer, wine, and soft drinks"
      );
    } else if (budgetRatio < 1.0) {
      // Slightly below recommended (70-100%)
      analysis.budgetLevel = "slightly_constrained";
      analysis.warnings.push(
        `Your budget is ${Math.round(
          (1 - budgetRatio) * 100
        )}% below the recommended amount.`,
        "Minor adjustments may be needed to stay within budget."
      );
      analysis.recommendations.push(
        "Prioritize your top 5 must-haves and be flexible on others",
        "Compare multiple vendor quotes to find best value",
        "Consider mid-tier options instead of premium for some categories",
        "Allocate contingency of 5-8% for unexpected costs"
      );
      analysis.optimizations.push(
        "Book vendors early for better rates",
        "Bundle services where possible",
        "Negotiate payment terms to spread costs",
        "Use seasonal flowers and decorations for savings"
      );
    } else if (budgetRatio >= 1.0 && budgetRatio < 1.3) {
      // Adequate budget
      analysis.budgetLevel = "adequate";
      analysis.warnings.push(
        "Your budget is adequate for a quality event with standard options."
      );
      analysis.recommendations.push(
        "You can afford good quality vendors across all categories",
        "Allocate 8-10% contingency for unexpected costs or upgrades",
        "Consider upgrading 1-2 priority categories for enhanced experience",
        "Balance spending across all essential categories"
      );
      analysis.optimizations.push(
        "Shop around for best value without compromising quality",
        "Invest in areas that create lasting memories (photography, venue)",
        "Consider small upgrades that have big impact (lighting, music)"
      );
    } else {
      // Comfortable budget (130%+)
      analysis.budgetLevel = "comfortable";
      analysis.warnings.push(
        "Your budget allows for premium options and enhanced experiences."
      );
      analysis.recommendations.push(
        "You can afford premium vendors and services",
        "Consider upgrading key categories for exceptional experience",
        "Allocate 10-15% contingency for spontaneous enhancements",
        "Invest in unique experiences that wow your guests"
      );
      analysis.optimizations.push(
        "Focus on creating memorable moments and experiences",
        "Consider premium add-ons like photo booths, live bands, or specialty bars",
        "Upgrade catering to include premium menu options",
        "Invest in professional videography to capture memories"
      );
    }

    // Add currency-specific context
    if (budget.currency === "NGN" && budget.amount < 100000) {
      analysis.warnings.push(
        "Note: For events in Nigeria, budgets below ₦100,000 typically require significant DIY efforts and very basic services."
      );
    }

    return analysis;
  }
}

export default new BudgetService();
