import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import AuditLog from "../models/auditLog.model.js";
import Payment from "../models/payment.model.js";
import { createError } from "../utils/error.js";

/**
 * Admin Vendor Verification Service
 * Handles vendor verification and management operations
 */
class AdminVendorVerificationService {
  /**
   * Get vendor verification queue
   * @param {Object} options - Query options
   * @returns {Object} Paginated verification queue
   */
  async getVerificationQueue(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = "pending",
      sortBy = "createdAt",
      sortOrder = "asc",
    } = options;

    const query = { verificationStatus: status };

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .populate("owner", "email firstName lastName phone")
        .populate("verifiedBy", "email firstName lastName")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(query),
    ]);

    return {
      vendors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get vendor verification details
   * @param {String} vendorId - Vendor ID
   * @returns {Object} Vendor verification details
   */
  async getVerificationDetails(vendorId) {
    const vendor = await Vendor.findById(vendorId)
      .populate("owner", "email firstName lastName phone createdAt")
      .populate("verifiedBy", "email firstName lastName")
      .lean();

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    // Get additional verification data
    const [ownerUser, verificationHistory] = await Promise.all([
      User.findById(vendor.owner).select("status isEmailVerified lastLogin"),
      AuditLog.find({
        resource: "vendor",
        resourceId: vendorId,
        action: { $in: ["approve_vendor", "reject_vendor"] },
      })
        .populate("admin", "email firstName lastName")
        .sort("-timestamp")
        .limit(10)
        .lean(),
    ]);

    return {
      ...vendor,
      ownerDetails: ownerUser,
      verificationHistory,
    };
  }

  /**
   * Approve vendor verification
   * @param {String} vendorId - Vendor ID
   * @param {String} adminId - Admin ID performing the action
   * @returns {Object} Updated vendor
   */
  async approveVendor(vendorId, adminId) {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    if (vendor.verificationStatus === "verified") {
      throw createError(400, "Vendor is already verified");
    }

    // Update vendor verification status
    await vendor.verifyBusinessProfile(adminId);

    // Also update the general verified status
    vendor.isVerified = true;
    vendor.status = "approved";
    await vendor.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "approve_vendor",
      resource: "vendor",
      resourceId: vendorId,
      changes: {
        verificationStatus: { from: "pending", to: "verified" },
        isVerified: { from: false, to: true },
        status: { from: vendor.status, to: "approved" },
      },
      timestamp: new Date(),
    });

    // TODO: Send approval notification to vendor owner
    // await notificationService.sendVendorApprovalEmail(vendor.owner);

    return vendor;
  }

  /**
   * Reject vendor verification
   * @param {String} vendorId - Vendor ID
   * @param {String} adminId - Admin ID performing the action
   * @param {String} reason - Rejection reason
   * @returns {Object} Updated vendor
   */
  async rejectVendor(vendorId, adminId, reason) {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    if (!reason || reason.trim().length === 0) {
      throw createError(400, "Rejection reason is required");
    }

    const previousStatus = vendor.verificationStatus;

    // Update vendor verification status
    await vendor.rejectBusinessProfile(adminId, reason);

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "reject_vendor",
      resource: "vendor",
      resourceId: vendorId,
      changes: {
        verificationStatus: { from: previousStatus, to: "rejected" },
        rejectionReason: reason,
      },
      timestamp: new Date(),
    });

    // TODO: Send rejection notification to vendor owner
    // await notificationService.sendVendorRejectionEmail(vendor.owner, reason);

    return vendor;
  }

  /**
   * Get vendor performance metrics
   * @param {String} vendorId - Vendor ID
   * @returns {Object} Performance metrics
   */
  async getVendorPerformance(vendorId) {
    const vendor = await Vendor.findById(vendorId).lean();

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    // Get booking and revenue data
    const [bookingStats, revenueStats, recentReviews] = await Promise.all([
      this.getBookingStats(vendorId),
      this.getRevenueStats(vendorId),
      this.getRecentReviews(vendorId, 10),
    ]);

    return {
      vendor: {
        id: vendor._id,
        name: vendor.name,
        businessName: vendor.businessName,
        category: vendor.category,
        rating: vendor.rating,
        reviewCount: vendor.reviewCount,
      },
      stats: vendor.stats,
      bookings: bookingStats,
      revenue: revenueStats,
      recentReviews,
    };
  }

  /**
   * Get booking statistics for vendor
   * @param {String} vendorId - Vendor ID
   * @returns {Object} Booking stats
   */
  async getBookingStats(vendorId) {
    // TODO: Implement booking model and queries
    // For now, return mock data structure
    return {
      total: vendor.stats?.totalBookings || 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      completionRate: 0,
    };
  }

  /**
   * Get revenue statistics for vendor
   * @param {String} vendorId - Vendor ID
   * @returns {Object} Revenue stats
   */
  async getRevenueStats(vendorId) {
    const revenue = await Payment.aggregate([
      {
        $match: {
          vendor: vendorId,
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          average: { $avg: "$amount" },
        },
      },
    ]);

    if (revenue.length === 0) {
      return {
        total: 0,
        transactions: 0,
        average: 0,
      };
    }

    return {
      total: revenue[0].total,
      transactions: revenue[0].count,
      average: Math.round(revenue[0].average * 100) / 100,
    };
  }

  /**
   * Get recent reviews for vendor
   * @param {String} vendorId - Vendor ID
   * @param {Number} limit - Number of reviews to return
   * @returns {Array} Recent reviews
   */
  async getRecentReviews(vendorId, limit = 10) {
    const vendor = await Vendor.findById(vendorId)
      .select("reviews")
      .populate("reviews.user", "firstName lastName email")
      .lean();

    if (!vendor || !vendor.reviews) {
      return [];
    }

    return vendor.reviews
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Suspend vendor
   * @param {String} vendorId - Vendor ID
   * @param {String} adminId - Admin ID performing the action
   * @param {String} reason - Suspension reason
   * @returns {Object} Updated vendor
   */
  async suspendVendor(vendorId, adminId, reason = "") {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    if (vendor.status === "suspended") {
      throw createError(400, "Vendor is already suspended");
    }

    const previousStatus = vendor.status;

    // Update vendor status
    vendor.status = "suspended";
    vendor.isActive = false;
    await vendor.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "suspend_vendor",
      resource: "vendor",
      resourceId: vendorId,
      changes: {
        status: { from: previousStatus, to: "suspended" },
        isActive: { from: true, to: false },
        reason,
      },
      timestamp: new Date(),
    });

    // TODO: Send suspension notification to vendor owner
    // TODO: Hide vendor from search results

    return vendor;
  }

  /**
   * Activate vendor
   * @param {String} vendorId - Vendor ID
   * @param {String} adminId - Admin ID performing the action
   * @returns {Object} Updated vendor
   */
  async activateVendor(vendorId, adminId) {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    if (vendor.status === "approved" && vendor.isActive) {
      throw createError(400, "Vendor is already active");
    }

    const previousStatus = vendor.status;

    // Update vendor status
    vendor.status = "approved";
    vendor.isActive = true;
    await vendor.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "activate_vendor",
      resource: "vendor",
      resourceId: vendorId,
      changes: {
        status: { from: previousStatus, to: "approved" },
        isActive: { from: false, to: true },
      },
      timestamp: new Date(),
    });

    // TODO: Send activation notification to vendor owner

    return vendor;
  }

  /**
   * Flag vendor for investigation
   * @param {String} vendorId - Vendor ID
   * @param {String} adminId - Admin ID performing the action
   * @param {String} reason - Flag reason
   * @returns {Object} Updated vendor
   */
  async flagVendor(vendorId, adminId, reason) {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    // Add flag to vendor (you may want to add a flags field to the schema)
    // For now, we'll just log it
    await AuditLog.create({
      admin: adminId,
      action: "flag_vendor",
      resource: "vendor",
      resourceId: vendorId,
      changes: {
        flagged: true,
        reason,
      },
      timestamp: new Date(),
    });

    // TODO: Create a separate flags collection or add flags field to vendor schema
    // TODO: Send notification to senior admins

    return {
      success: true,
      message: "Vendor flagged for investigation",
      vendorId,
    };
  }

  /**
   * Update vendor category
   * @param {String} vendorId - Vendor ID
   * @param {String} category - New category
   * @param {String} adminId - Admin ID performing the action
   * @returns {Object} Updated vendor
   */
  async updateVendorCategory(vendorId, category, adminId) {
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw createError(404, "Vendor not found");
    }

    const previousCategory = vendor.category;

    // Update category
    vendor.category = category;
    await vendor.save();

    // Log the action
    await AuditLog.create({
      admin: adminId,
      action: "update_vendor_category",
      resource: "vendor",
      resourceId: vendorId,
      changes: {
        category: { from: previousCategory, to: category },
      },
      timestamp: new Date(),
    });

    // TODO: Update search indexes

    return vendor;
  }

  /**
   * Get vendor statistics
   * @returns {Object} Vendor statistics
   */
  async getVendorStatistics() {
    const [
      totalVendors,
      vendorsByStatus,
      vendorsByCategory,
      vendorsByVerificationStatus,
      topRatedVendors,
    ] = await Promise.all([
      Vendor.countDocuments(),
      Vendor.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Vendor.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
      Vendor.aggregate([
        { $group: { _id: "$verificationStatus", count: { $sum: 1 } } },
      ]),
      Vendor.find({ isVerified: true })
        .sort("-rating")
        .limit(10)
        .select("name businessName rating reviewCount category")
        .lean(),
    ]);

    return {
      total: totalVendors,
      byStatus: vendorsByStatus,
      byCategory: vendorsByCategory,
      byVerificationStatus: vendorsByVerificationStatus,
      topRated: topRatedVendors,
    };
  }

  /**
   * Get vendors with filters
   * @param {Object} options - Query options
   * @returns {Object} Filtered vendors
   */
  async getVendors(options = {}) {
    const {
      page = 1,
      limit = 20,
      search = "",
      category = "",
      status = "",
      verificationStatus = "",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { businessName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Verification status filter
    if (verificationStatus) {
      query.verificationStatus = verificationStatus;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .populate("owner", "email firstName lastName")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(query),
    ]);

    return {
      vendors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Export vendors data
   * @param {Object} filters - Export filters
   * @returns {Array} Vendors data for export
   */
  async exportVendors(filters = {}) {
    const query = {};

    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    if (filters.verificationStatus)
      query.verificationStatus = filters.verificationStatus;
    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const vendors = await Vendor.find(query)
      .populate("owner", "email firstName lastName")
      .lean();

    return vendors.map((vendor) => ({
      id: vendor._id,
      name: vendor.name,
      businessName: vendor.businessName,
      email: vendor.email,
      phone: vendor.phone,
      category: vendor.category,
      status: vendor.status,
      verificationStatus: vendor.verificationStatus,
      isVerified: vendor.isVerified,
      rating: vendor.rating,
      reviewCount: vendor.reviewCount,
      totalBookings: vendor.stats?.totalBookings || 0,
      totalRevenue: vendor.stats?.totalRevenue || 0,
      ownerEmail: vendor.owner?.email,
      createdAt: vendor.createdAt,
      verifiedAt: vendor.verifiedAt,
    }));
  }
}

export default new AdminVendorVerificationService();
