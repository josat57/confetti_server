import VendorRepository from "../repositories/vendor.repository.js";
import CacheService from "./cache.service.js";
import { logger } from "../utils/logger.js";
import { LocationNotSupportedError } from "../utils/ai-planner-errors.js";

/**
 * Service for vendor data aggregation and analysis
 */
class VendorService {
  constructor() {
    this.searchRadius = 50; // km
    this.cacheTTL = 3600; // 1 hour
    this.minVendorsThreshold = 10; // Minimum vendors for good coverage
  }

  /**
   * Aggregate vendor data for AI analysis
   * @param {Object} location - Event location
   * @param {string} eventType - Type of event
   * @returns {Promise<Object>} Aggregated vendor data
   */
  async aggregateVendorData(location, eventType) {
    try {
      const startTime = Date.now();

      // Generate cache key
      const cacheKey = this.generateCacheKey(
        location.city,
        location.state,
        eventType
      );

      // Try cache first
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        logger.info("Vendor data retrieved from cache", {
          location: `${location.city}, ${location.state}`,
          eventType,
          vendorCount: cached.vendors.length,
        });
        return cached;
      }

      // Fetch vendors
      let vendors;
      if (location.coordinates && location.coordinates.length === 2) {
        // Use geospatial search
        vendors = await VendorRepository.findByLocation(
          location.coordinates[1], // latitude
          location.coordinates[0], // longitude
          this.searchRadius,
          { eventType, limit: 200 }
        );
      } else {
        // Fallback to city/state search
        vendors = await VendorRepository.findByCityState(
          location.city,
          location.state,
          { eventType, limit: 200 }
        );
      }

      // Check if we have enough vendors
      if (vendors.length < this.minVendorsThreshold) {
        logger.warn("Insufficient vendors found", {
          location: `${location.city}, ${location.state}`,
          eventType,
          vendorCount: vendors.length,
        });

        // Still proceed but with a warning
        // In production, you might want to suggest nearby cities
      }

      // Get statistics
      const [categoryStats, locationStats] = await Promise.all([
        VendorRepository.getCategoryStatistics(
          location.city,
          location.state,
          eventType
        ),
        VendorRepository.getLocationStatistics(location.city, location.state),
      ]);

      // Format vendor data for AI
      const formattedVendors = vendors.map(this.formatVendorForAI);

      const result = {
        vendors: formattedVendors,
        statistics: {
          totalVendors: vendors.length,
          categoryCounts: categoryStats,
          locationStats,
          searchRadius: this.searchRadius,
          eventType,
        },
        metadata: {
          location: {
            city: location.city,
            state: location.state,
            coordinates: location.coordinates,
          },
          generatedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
        },
      };

      // Cache the result
      await CacheService.set(cacheKey, result, this.cacheTTL);

      logger.info("Vendor data aggregated successfully", {
        location: `${location.city}, ${location.state}`,
        eventType,
        vendorCount: vendors.length,
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error("Error aggregating vendor data:", {
        location,
        eventType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Format vendor data for AI processing
   * @param {Object} vendor - Raw vendor data
   * @returns {Object} Formatted vendor data
   */
  formatVendorForAI(vendor) {
    return {
      id: vendor._id.toString(),
      name: vendor.name,
      category: vendor.category,
      subcategory: vendor.subcategory || "",
      description: vendor.description || "",
      location: {
        lat: vendor.location?.coordinates?.[1] || 0,
        lng: vendor.location?.coordinates?.[0] || 0,
        address: vendor.address || {},
      },
      pricing: {
        averagePrice: vendor.averagePrice || 0,
        priceRange: {
          min: vendor.priceRange?.min || 0,
          max: vendor.priceRange?.max || 0,
        },
      },
      rating: vendor.rating || 0,
      reviewCount: vendor.reviewCount || 0,
      eventTypes: vendor.eventTypes || [],
      capacity: vendor.capacity || 0,
      availabilityStatus: vendor.availabilityStatus || "medium",
      features: vendor.features || [],
    };
  }

  /**
   * Get vendors by category for a location
   * @param {string} category - Vendor category
   * @param {Object} location - Event location
   * @param {string} eventType - Event type
   * @returns {Promise<Array>} Array of vendors
   */
  async getVendorsByCategory(category, location, eventType) {
    try {
      let vendors;

      if (location.coordinates && location.coordinates.length === 2) {
        vendors = await VendorRepository.findByLocation(
          location.coordinates[1],
          location.coordinates[0],
          this.searchRadius,
          { eventType, category, limit: 50 }
        );
      } else {
        vendors = await VendorRepository.findByCityState(
          location.city,
          location.state,
          { eventType, category, limit: 50 }
        );
      }

      return vendors.map(this.formatVendorForAI);
    } catch (error) {
      logger.error("Error getting vendors by category:", {
        category,
        location,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if location has sufficient vendor coverage
   * @param {Object} location - Event location
   * @param {string} eventType - Event type
   * @returns {Promise<Object>} Coverage assessment
   */
  async checkLocationCoverage(location, eventType) {
    try {
      const vendors = await VendorRepository.findByCityState(
        location.city,
        location.state,
        { eventType, limit: 200 }
      );

      const categoryStats = await VendorRepository.getCategoryStatistics(
        location.city,
        location.state,
        eventType
      );

      const essentialCategories = ["venue", "catering", "photography"];
      const missingCategories = essentialCategories.filter(
        (cat) => !categoryStats[cat] || categoryStats[cat].count === 0
      );

      const coverage = {
        totalVendors: vendors.length,
        hasSufficientCoverage: vendors.length >= this.minVendorsThreshold,
        missingEssentialCategories: missingCategories,
        categoryCoverage: categoryStats,
        recommendation:
          vendors.length >= this.minVendorsThreshold
            ? "good"
            : vendors.length >= 5
            ? "limited"
            : "insufficient",
      };

      logger.info("Location coverage assessed", {
        location: `${location.city}, ${location.state}`,
        eventType,
        coverage: coverage.recommendation,
      });

      return coverage;
    } catch (error) {
      logger.error("Error checking location coverage:", {
        location,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate cache key for vendor data
   * @param {string} city - City name
   * @param {string} state - State name
   * @param {string} eventType - Event type
   * @returns {string} Cache key
   */
  generateCacheKey(city, state, eventType) {
    const locationKey = `${city}-${state}`.toLowerCase().replace(/\s+/g, "-");
    return `vendors:${locationKey}:${eventType}`;
  }

  /**
   * Get price range for a category in a location
   * @param {string} category - Vendor category
   * @param {Object} location - Event location
   * @returns {Promise<Object>} Price range
   */
  async getCategoryPriceRange(category, location) {
    try {
      const vendors = await VendorRepository.findByCityState(
        location.city,
        location.state,
        { category, limit: 100 }
      );

      if (vendors.length === 0) {
        return {
          min: 0,
          max: 0,
          average: 0,
          currency: "NGN",
        };
      }

      const prices = vendors.map((v) => v.averagePrice).filter((p) => p > 0);

      if (prices.length === 0) {
        return {
          min: 0,
          max: 0,
          average: 0,
          currency: "NGN",
        };
      }

      return {
        min: Math.min(...prices),
        max: Math.max(...prices),
        average: prices.reduce((a, b) => a + b, 0) / prices.length,
        currency: "NGN",
      };
    } catch (error) {
      logger.error("Error getting category price range:", {
        category,
        location,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Find vendors for a specific event (used by AI planner)
   * @param {Object} params - Event parameters
   * @returns {Promise<Array>} Array of vendors
   */
  async findVendorsForEvent(params) {
    try {
      const { eventType, location, budget } = params;

      logger.info("Finding vendors for event", {
        eventType,
        location: location?.city,
        budget: budget?.amount,
      });

      // Use existing aggregateVendorData method
      const vendorData = await this.aggregateVendorData(location, eventType);

      // Filter vendors based on budget if provided
      let vendors = vendorData.vendors || [];

      if (budget && budget.amount) {
        // Filter vendors based on category-specific budget allocations
        vendors = vendors.filter((vendor) => {
          // If vendor has pricing info, check if it fits budget based on category
          if (vendor.averagePrice) {
            // Category-specific budget percentages
            const categoryBudgetPercentages = {
              venue: 0.4, // Venues can take up to 40% of budget
              catering: 0.5, // Catering can take up to 50% of budget
              photography: 0.2, // Photography up to 20%
              videography: 0.2, // Videography up to 20%
              entertainment: 0.2, // Entertainment up to 20%
              decoration: 0.15, // Decoration up to 15%
              transportation: 0.1, // Transportation up to 10%
              security: 0.05, // Security up to 5%
              audio_visual: 0.15, // AV up to 15%
              cake_desserts: 0.1, // Cake up to 10%
              florals: 0.15, // Florals up to 15%
              rentals: 0.2, // Rentals up to 20%
              other: 0.3, // Other services up to 30%
            };

            const maxBudgetForCategory =
              budget.amount *
              (categoryBudgetPercentages[vendor.category] || 0.3);
            return vendor.averagePrice <= maxBudgetForCategory;
          }
          return true; // Include vendors without pricing info
        });
      }

      logger.info("Vendors found for event", {
        totalVendors: vendors.length,
        originalVendorCount: vendorData.vendors?.length || 0,
        afterBudgetFilter: vendors.length,
        eventType,
        location: location?.city,
        budget: budget?.amount,
      });

      return vendors;
    } catch (error) {
      logger.error("Error finding vendors for event:", error);
      // Return empty array instead of throwing to prevent AI planner from failing
      return [];
    }
  }

  /**
   * Invalidate cache for a location
   * @param {string} city - City name
   * @param {string} state - State name
   * @param {string} eventType - Event type
   * @returns {Promise<void>}
   */
  async invalidateCache(city, state, eventType) {
    const cacheKey = this.generateCacheKey(city, state, eventType);
    await CacheService.delete(cacheKey);
    logger.info("Vendor cache invalidated", { city, state, eventType });
  }
}

export default new VendorService();
