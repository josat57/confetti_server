import Vendor from "../models/vendor.model.js";
import User from "../models/user.model.js";
import Admin from "../models/Admin.js";
import AuditLog from "../models/auditLog.model.js";
import Payment from "../models/payment.model.js";
import { createError } from "../utils/error.js";
import { escapeRegExp } from "../utils/escape-regex.js";

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

    const previous = {
      verificationStatus: vendor.verificationStatus,
      isVerified: vendor.isVerified,
      status: vendor.status,
    };

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
        verificationStatus: { from: previous.verificationStatus, to: "verified" },
        isVerified: { from: previous.isVerified, to: true },
        status: { from: previous.status, to: "approved" },
      },
      timestamp: new Date(),
    });

    // Notify vendor owner of approval
    try {
      const owner = await User.findById(vendor.owner).select("email firstName name");
      if (owner?.email) {
        const { sendEmailDirect } = await import("../utils/email.js");
        await sendEmailDirect({
          to: owner.email,
          subject: "Your vendor profile has been approved on Confetti!",
          html: `
            <h2>Vendor Approved!</h2>
            <p>Hi ${owner.firstName || owner.name || "there"},</p>
            <p>Great news! Your vendor profile <strong>${vendor.businessName || vendor.name}</strong> has been reviewed and approved on Confetti.</p>
            <p>You can now receive bookings and appear in search results.</p>
            <p><a href="${process.env.FRONTEND_URL}/vendor/dashboard" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;">Go to Dashboard</a></p>
          `,
        });
      }
    } catch (emailError) {
      // Non-critical
    }

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

    // Notify vendor owner of rejection
    try {
      const owner = await User.findById(vendor.owner).select("email firstName name");
      if (owner?.email) {
        const { sendEmailDirect } = await import("../utils/email.js");
        await sendEmailDirect({
          to: owner.email,
          subject: "Update on your Confetti vendor application",
          html: `
            <h2>Vendor Application Update</h2>
            <p>Hi ${owner.firstName || owner.name || "there"},</p>
            <p>Thank you for applying to be a vendor on Confetti. After reviewing your profile <strong>${vendor.businessName || vendor.name}</strong>, we were unable to approve your application at this time.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>You may update your profile and reapply. If you have questions, please contact our support team.</p>
            <p><a href="${process.env.FRONTEND_URL}/vendor/profile" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Update Profile</a></p>
          `,
        });
      }
    } catch (emailError) {
      // Non-critical
    }

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
    try {
      const Booking = (await import("../models/booking.model.js")).default;
      const stats = await Booking.aggregate([
        { $match: { vendor: vendorId } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      const counts = { total: 0, completed: 0, pending: 0, cancelled: 0, rejected: 0 };
      stats.forEach((s) => {
        counts[s._id] = s.count;
        counts.total += s.count;
      });

      const completionRate =
        counts.total > 0
          ? Math.round((counts.completed / counts.total) * 100 * 100) / 100
          : 0;

      return { ...counts, completionRate };
    } catch {
      return { total: 0, completed: 0, pending: 0, cancelled: 0, completionRate: 0 };
    }
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

    // Notify vendor owner of suspension
    try {
      const owner = await User.findById(vendor.owner).select("email firstName name");
      if (owner?.email) {
        const { sendEmailDirect } = await import("../utils/email.js");
        await sendEmailDirect({
          to: owner.email,
          subject: "Your Confetti vendor account has been suspended",
          html: `
            <h2>Vendor Account Suspended</h2>
            <p>Hi ${owner.firstName || owner.name || "there"},</p>
            <p>Your vendor profile <strong>${vendor.businessName || vendor.name}</strong> has been suspended${reason ? ` for the following reason: <strong>${reason}</strong>` : ""}.</p>
            <p>Your profile is now hidden from search results. If you believe this is a mistake, please contact our support team.</p>
          `,
        });
      }
    } catch (emailError) {
      // Non-critical
    }

    // Hide vendor from search by setting isActive=false (already done above in status update)
    // Ensure the vendor is excluded from public-facing queries via isActive flag

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

    // Notify vendor owner of reactivation
    try {
      const owner = await User.findById(vendor.owner).select("email firstName name");
      if (owner?.email) {
        const { sendEmailDirect } = await import("../utils/email.js");
        await sendEmailDirect({
          to: owner.email,
          subject: "Your Confetti vendor account is active again",
          html: `
            <h2>Vendor Account Reactivated</h2>
            <p>Hi ${owner.firstName || owner.name || "there"},</p>
            <p>Your vendor profile <strong>${vendor.businessName || vendor.name}</strong> has been reactivated and is now visible in search results.</p>
            <p><a href="${process.env.FRONTEND_URL}/vendor/dashboard" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;">Go to Dashboard</a></p>
          `,
        });
      }
    } catch (emailError) {
      // Non-critical
    }

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

    // Persist flag on the vendor document
    if (!vendor.flags) {
      vendor.flags = [];
    }
    vendor.flags.push({
      reason,
      flaggedBy: adminId,
      flaggedAt: new Date(),
      resolved: false,
    });
    vendor.isFlagged = true;
    await vendor.save();

    // Notify senior admins of the flag
    try {
      // Admin accounts live in the Admin collection (not User)
      const seniorAdmins = await Admin.find({ role: "super_admin", isActive: true, _id: { $ne: adminId } })
        .select("email firstName")
        .lean();
      const { sendEmailDirect } = await import("../utils/email.js");
      for (const admin of seniorAdmins) {
        await sendEmailDirect({
          to: admin.email,
          subject: `Vendor flagged for investigation: ${vendor.businessName || vendor.name}`,
          html: `
            <h2>Vendor Flagged</h2>
            <p>Hi ${admin.firstName || admin.name || "there"},</p>
            <p>A vendor has been flagged for investigation by an admin.</p>
            <table style="width:100%;border-collapse:collapse;margin:12px 0;">
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Vendor</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${vendor.businessName || vendor.name}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Reason</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${String(reason || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Flagged At</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${new Date().toLocaleString()}</td></tr>
            </table>
            <p><a href="${process.env.FRONTEND_URL}/admin/vendors/${vendorId}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;">Review Vendor</a></p>
          `,
        }).catch(() => {});
      }
    } catch (emailError) {
      // Non-critical
    }

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

    // Invalidate any cached search results for this vendor
    try {
      const { createClient } = await import("redis");
      const redis = createClient({ url: process.env.REDIS_URI });
      await redis.connect();
      // Delete vendor search cache keys that might contain this vendor
      const keys = await redis.keys(`search:vendors:*`);
      if (keys.length) {
        await redis.del(keys);
      }
      await redis.del(`vendor:${vendorId}`);
      await redis.quit();
    } catch {
      // Redis may not be available; search indexes will self-correct on next query
    }

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
        { name: { $regex: escapeRegExp(search), $options: "i" } },
        { businessName: { $regex: escapeRegExp(search), $options: "i" } },
        { email: { $regex: escapeRegExp(search), $options: "i" } },
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
