import Vendor from "../models/vendor.model.js";
import { logger } from "../utils/logger.js";

/**
 * Repository for vendor data access
 */
class VendorRepository {
  /**
   * Find vendors by location using geospatial query
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate
   * @param {number} radiusKm - Search radius in kilometers
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Array of vendors
   */
  async findByLocation(latitude, longitude, radiusKm = 50, filters = {}) {
    try {
      const query = {
        "location.coordinates": {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusKm * 1000, // Convert km to meters
          },
        },
        status: filters.status || "approved",
        isVerified: true,
      };

      // Add event type filter if provided
      if (filters.eventType) {
        query.$or = [
          { eventTypes: filters.eventType },
          { eventTypes: { $exists: false } },
          { eventTypes: { $size: 0 } },
        ];
      }

      // Add category filter if provided
      if (filters.category) {
        query.category = filters.category;
      }

      const vendors = await Vendor.find(query)
        .select({
          name: 1,
          category: 1,
          subcategory: 1,
          description: 1,
          location: 1,
          address: 1,
          averagePrice: 1,
          priceRange: 1,
          rating: 1,
          reviewCount: 1,
          eventTypes: 1,
          capacity: 1,
          availabilityStatus: 1,
          features: 1,
          images: 1,
          email: 1,
          phone: 1,
        })
        .limit(filters.limit || 200)
        .lean();

      logger.info("Vendors found by location", {
        latitude,
        longitude,
        radiusKm,
        count: vendors.length,
        filters,
      });

      return vendors;
    } catch (error) {
      logger.error("Error finding vendors by location:", {
        error: error.message,
        latitude,
        longitude,
        radiusKm,
      });
      throw error;
    }
  }

  /**
   * Find vendors by city and state
   * @param {string} city - City name
   * @param {string} state - State name
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Array of vendors
   */
  async findByCityState(city, state, filters = {}) {
    try {
      const query = {
        $or: [
          { "address.city": new RegExp(city, "i") },
          { "address.state": new RegExp(state, "i") },
        ],
        status: filters.status || "approved",
        isVerified: true,
      };

      // Add event type filter if provided
      if (filters.eventType) {
        query.$and = [
          {
            $or: [
              { eventTypes: filters.eventType },
              { eventTypes: { $exists: false } },
              { eventTypes: { $size: 0 } },
            ],
          },
        ];
      }

      // Add category filter if provided
      if (filters.category) {
        query.category = filters.category;
      }

      const vendors = await Vendor.find(query)
        .select({
          name: 1,
          category: 1,
          subcategory: 1,
          description: 1,
          location: 1,
          address: 1,
          averagePrice: 1,
          priceRange: 1,
          rating: 1,
          reviewCount: 1,
          eventTypes: 1,
          capacity: 1,
          availabilityStatus: 1,
          features: 1,
          images: 1,
          email: 1,
          phone: 1,
        })
        .limit(filters.limit || 200)
        .lean();

      logger.info("Vendors found by city/state", {
        city,
        state,
        count: vendors.length,
        filters,
      });

      return vendors;
    } catch (error) {
      logger.error("Error finding vendors by city/state:", {
        error: error.message,
        city,
        state,
      });
      throw error;
    }
  }

  /**
   * Get category statistics for a location
   * @param {string} city - City name
   * @param {string} state - State name
   * @param {string} eventType - Event type filter
   * @returns {Promise<Object>} Category statistics
   */
  async getCategoryStatistics(city, state, eventType = null) {
    try {
      const matchStage = {
        status: "approved",
        isVerified: true,
        $or: [
          { "address.city": new RegExp(city, "i") },
          { "address.state": new RegExp(state, "i") },
        ],
      };

      if (eventType) {
        matchStage.$and = [
          {
            $or: [
              { eventTypes: eventType },
              { eventTypes: { $exists: false } },
              { eventTypes: { $size: 0 } },
            ],
          },
        ];
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            avgRating: { $avg: "$rating" },
            avgPrice: { $avg: "$averagePrice" },
            minPrice: { $min: "$priceRange.min" },
            maxPrice: { $max: "$priceRange.max" },
          },
        },
        { $sort: { count: -1 } },
      ];

      const results = await Vendor.aggregate(pipeline);

      const categoryStats = {};
      results.forEach((stat) => {
        if (stat._id) {
          categoryStats[stat._id] = {
            count: stat.count,
            avgRating: Math.round(stat.avgRating * 10) / 10,
            avgPrice: stat.avgPrice || 0,
            priceRange: {
              min: stat.minPrice || 0,
              max: stat.maxPrice || 0,
            },
          };
        }
      });

      logger.info("Category statistics calculated", {
        city,
        state,
        eventType,
        categoriesFound: Object.keys(categoryStats).length,
      });

      return categoryStats;
    } catch (error) {
      logger.error("Error getting category statistics:", {
        error: error.message,
        city,
        state,
      });
      throw error;
    }
  }

  /**
   * Get location statistics
   * @param {string} city - City name
   * @param {string} state - State name
   * @returns {Promise<Object>} Location statistics
   */
  async getLocationStatistics(city, state) {
    try {
      const matchStage = {
        status: "approved",
        isVerified: true,
        $or: [
          { "address.city": new RegExp(city, "i") },
          { "address.state": new RegExp(state, "i") },
        ],
      };

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalVendors: { $sum: 1 },
            avgRating: { $avg: "$rating" },
            avgPrice: { $avg: "$averagePrice" },
            categories: { $addToSet: "$category" },
          },
        },
      ];

      const [result] = await Vendor.aggregate(pipeline);

      if (!result) {
        return {
          totalVendors: 0,
          avgRating: 0,
          avgPrice: 0,
          availableCategories: [],
        };
      }

      const stats = {
        totalVendors: result.totalVendors,
        avgRating: Math.round(result.avgRating * 10) / 10,
        avgPrice: result.avgPrice || 0,
        availableCategories: result.categories.filter(Boolean),
      };

      logger.info("Location statistics calculated", {
        city,
        state,
        stats,
      });

      return stats;
    } catch (error) {
      logger.error("Error getting location statistics:", {
        error: error.message,
        city,
        state,
      });
      throw error;
    }
  }

  /**
   * Find vendors by category
   * @param {string} category - Vendor category
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Array of vendors
   */
  async findByCategory(category, filters = {}) {
    try {
      const query = {
        category,
        status: filters.status || "approved",
        isVerified: true,
      };

      if (filters.eventType) {
        query.$or = [
          { eventTypes: filters.eventType },
          { eventTypes: { $exists: false } },
          { eventTypes: { $size: 0 } },
        ];
      }

      const vendors = await Vendor.find(query)
        .select({
          name: 1,
          category: 1,
          subcategory: 1,
          description: 1,
          location: 1,
          address: 1,
          averagePrice: 1,
          priceRange: 1,
          rating: 1,
          reviewCount: 1,
          eventTypes: 1,
          capacity: 1,
          availabilityStatus: 1,
          features: 1,
          images: 1,
        })
        .sort({ rating: -1, reviewCount: -1 })
        .limit(filters.limit || 50)
        .lean();

      return vendors;
    } catch (error) {
      logger.error("Error finding vendors by category:", {
        error: error.message,
        category,
      });
      throw error;
    }
  }

  /**
   * Count vendors matching criteria
   * @param {Object} query - Query criteria
   * @returns {Promise<number>} Vendor count
   */
  async count(query = {}) {
    try {
      return await Vendor.countDocuments(query);
    } catch (error) {
      logger.error("Error counting vendors:", {
        error: error.message,
        query,
      });
      throw error;
    }
  }
}

export default new VendorRepository();
