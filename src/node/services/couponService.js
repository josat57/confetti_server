import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";
import Promotion from "../models/Promotion.js";
import crypto from "crypto";

class CouponService {
  // ==================== COUPON MANAGEMENT ====================

  /**
   * Generate unique coupon code
   */
  generateCouponCode(prefix = "", length = 8) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = prefix.toUpperCase();

    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return code;
  }

  /**
   * Generate multiple unique coupon codes
   */
  async generateUniqueCodes(count, prefix = "", length = 8) {
    const codes = new Set();

    while (codes.size < count) {
      const code = this.generateCouponCode(prefix, length);

      // Check if code already exists
      const existing = await Coupon.findOne({ code });
      if (!existing) {
        codes.add(code);
      }
    }

    return Array.from(codes);
  }

  /**
   * Get all coupons with filtering
   */
  async getCoupons(filters = {}) {
    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.search) {
      query.$or = [
        { code: { $regex: filters.search, $options: "i" } },
        { name: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    // Filter by validity
    if (filters.validity === "active") {
      const now = new Date();
      query.status = "active";
      query.validFrom = { $lte: now };
      query.validUntil = { $gte: now };
    } else if (filters.validity === "expired") {
      query.validUntil = { $lt: new Date() };
    } else if (filters.validity === "upcoming") {
      query.validFrom = { $gt: new Date() };
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      Coupon.find(query)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(query),
    ]);

    return {
      coupons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get coupon by ID
   */
  async getCouponById(couponId) {
    const coupon = await Coupon.findById(couponId)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!coupon) {
      throw new Error("Coupon not found");
    }

    // Get usage statistics
    const usageStats = await this.getCouponUsageStats(couponId);

    return {
      ...coupon,
      usageStats,
    };
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      throw new Error("Coupon not found");
    }

    return coupon;
  }

  /**
   * Create new coupon
   */
  async createCoupon(data, adminId) {
    // Generate code if not provided
    if (!data.code) {
      const codes = await this.generateUniqueCodes(
        1,
        data.name.substring(0, 3)
      );
      data.code = codes[0];
    } else {
      data.code = data.code.toUpperCase();

      // Check if code already exists
      const existing = await Coupon.findOne({ code: data.code });
      if (existing) {
        throw new Error("Coupon code already exists");
      }
    }

    // Validate dates
    if (new Date(data.validFrom) >= new Date(data.validUntil)) {
      throw new Error("Valid from date must be before valid until date");
    }

    const coupon = new Coupon({
      ...data,
      createdBy: adminId,
    });

    await coupon.save();

    return coupon;
  }

  /**
   * Create bulk coupons
   */
  async createBulkCoupons(data, count, adminId) {
    const codes = await this.generateUniqueCodes(
      count,
      data.codePrefix || "",
      data.codeLength || 8
    );

    const coupons = codes.map((code) => ({
      ...data,
      code,
      createdBy: adminId,
    }));

    const created = await Coupon.insertMany(coupons);

    return {
      count: created.length,
      coupons: created,
    };
  }

  /**
   * Update coupon
   */
  async updateCoupon(couponId, updates, adminId) {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    // Don't allow code changes
    delete updates.code;

    // Validate dates if provided
    if (updates.validFrom || updates.validUntil) {
      const validFrom = updates.validFrom || coupon.validFrom;
      const validUntil = updates.validUntil || coupon.validUntil;

      if (new Date(validFrom) >= new Date(validUntil)) {
        throw new Error("Valid from date must be before valid until date");
      }
    }

    Object.assign(coupon, updates);
    coupon.updatedBy = adminId;

    await coupon.save();

    return coupon;
  }

  /**
   * Delete coupon
   */
  async deleteCoupon(couponId) {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    // Check if coupon has been used
    const usageCount = await CouponUsage.countDocuments({ couponId });
    if (usageCount > 0) {
      throw new Error(
        "Cannot delete coupon that has been used. Consider deactivating it instead."
      );
    }

    await coupon.deleteOne();

    return { message: "Coupon deleted successfully" };
  }

  /**
   * Activate/Deactivate coupon
   */
  async toggleCouponStatus(couponId, adminId) {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    coupon.status = coupon.status === "active" ? "inactive" : "active";
    coupon.updatedBy = adminId;

    await coupon.save();

    return coupon;
  }

  /**
   * Validate coupon for user
   */
  async validateCoupon(code, userId, userType, subscriptionTier, amount) {
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return { valid: false, reason: "Invalid coupon code" };
    }

    // Check if coupon can be used by user
    const canUse = await coupon.canBeUsedBy(userId, userType, subscriptionTier);
    if (!canUse.valid) {
      return canUse;
    }

    // Check minimum purchase
    if (amount < coupon.minimumPurchase) {
      return {
        valid: false,
        reason: `Minimum purchase amount is ${coupon.currency} ${coupon.minimumPurchase}`,
      };
    }

    // Calculate discount
    const discount = coupon.calculateDiscount(amount);

    return {
      valid: true,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value,
      },
      discount,
      finalAmount: amount - discount,
    };
  }

  /**
   * Apply coupon
   */
  async applyCoupon(
    code,
    userId,
    userType,
    orderId,
    orderType,
    amount,
    currency = "USD"
  ) {
    const validation = await this.validateCoupon(
      code,
      userId,
      userType,
      null,
      amount
    );

    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const coupon = await Coupon.findById(validation.coupon.id);

    // Create usage record
    const usage = new CouponUsage({
      couponId: coupon._id,
      couponCode: coupon.code,
      userId,
      userType,
      orderId,
      orderType,
      originalAmount: amount,
      discountAmount: validation.discount,
      finalAmount: validation.finalAmount,
      currency,
    });

    await usage.save();

    // Increment usage count
    coupon.usageCount += 1;

    // Update status if depleted
    if (
      coupon.usageLimit.total &&
      coupon.usageCount >= coupon.usageLimit.total
    ) {
      coupon.status = "depleted";
    }

    await coupon.save();

    return {
      usage,
      discount: validation.discount,
      finalAmount: validation.finalAmount,
    };
  }

  /**
   * Get coupon usage statistics
   */
  async getCouponUsageStats(couponId) {
    const stats = await CouponUsage.aggregate([
      {
        $match: { couponId: mongoose.Types.ObjectId(couponId) },
      },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" },
          totalDiscount: { $sum: "$discountAmount" },
          totalRevenue: { $sum: "$finalAmount" },
          avgDiscount: { $avg: "$discountAmount" },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        totalUsage: 0,
        uniqueUsers: 0,
        totalDiscount: 0,
        totalRevenue: 0,
        avgDiscount: 0,
      };
    }

    const result = stats[0];
    return {
      totalUsage: result.totalUsage,
      uniqueUsers: result.uniqueUsers.length,
      totalDiscount: result.totalDiscount,
      totalRevenue: result.totalRevenue,
      avgDiscount: result.avgDiscount,
    };
  }

  /**
   * Get coupon analytics
   */
  async getCouponAnalytics(couponId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [usageStats, dailyUsage, topUsers] = await Promise.all([
      this.getCouponUsageStats(couponId),

      // Daily usage breakdown
      CouponUsage.aggregate([
        {
          $match: {
            couponId: mongoose.Types.ObjectId(couponId),
            usedAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$usedAt" } },
            count: { $sum: 1 },
            totalDiscount: { $sum: "$discountAmount" },
            totalRevenue: { $sum: "$finalAmount" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),

      // Top users
      CouponUsage.aggregate([
        {
          $match: { couponId: mongoose.Types.ObjectId(couponId) },
        },
        {
          $group: {
            _id: "$userId",
            usageCount: { $sum: 1 },
            totalDiscount: { $sum: "$discountAmount" },
          },
        },
        {
          $sort: { usageCount: -1 },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
      ]),
    ]);

    return {
      overview: usageStats,
      dailyUsage,
      topUsers,
    };
  }

  // ==================== PROMOTION MANAGEMENT ====================

  /**
   * Get all promotions
   */
  async getPromotions(filters = {}) {
    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [promotions, total] = await Promise.all([
      Promotion.find(query)
        .populate("coupons")
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Promotion.countDocuments(query),
    ]);

    return {
      promotions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get promotion by ID
   */
  async getPromotionById(promotionId) {
    const promotion = await Promotion.findById(promotionId)
      .populate("coupons")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!promotion) {
      throw new Error("Promotion not found");
    }

    // Calculate metrics
    const roi =
      ((promotion.performance.revenue - promotion.budget.spent) /
        promotion.budget.spent) *
      100;
    const conversionRate =
      promotion.performance.clicks > 0
        ? (promotion.performance.conversions / promotion.performance.clicks) *
          100
        : 0;

    return {
      ...promotion,
      metrics: {
        roi: roi.toFixed(2),
        conversionRate: conversionRate.toFixed(2),
        ctr:
          promotion.performance.impressions > 0
            ? (
                (promotion.performance.clicks /
                  promotion.performance.impressions) *
                100
              ).toFixed(2)
            : 0,
      },
    };
  }

  /**
   * Create promotion
   */
  async createPromotion(data, adminId) {
    // Validate dates
    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new Error("Start date must be before end date");
    }

    const promotion = new Promotion({
      ...data,
      createdBy: adminId,
    });

    await promotion.save();

    return promotion;
  }

  /**
   * Update promotion
   */
  async updatePromotion(promotionId, updates, adminId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      throw new Error("Promotion not found");
    }

    // Validate dates if provided
    if (updates.startDate || updates.endDate) {
      const startDate = updates.startDate || promotion.startDate;
      const endDate = updates.endDate || promotion.endDate;

      if (new Date(startDate) >= new Date(endDate)) {
        throw new Error("Start date must be before end date");
      }
    }

    Object.assign(promotion, updates);
    promotion.updatedBy = adminId;

    await promotion.save();

    return promotion;
  }

  /**
   * Delete promotion
   */
  async deletePromotion(promotionId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      throw new Error("Promotion not found");
    }

    if (promotion.status === "active") {
      throw new Error(
        "Cannot delete active promotion. Pause or cancel it first."
      );
    }

    await promotion.deleteOne();

    return { message: "Promotion deleted successfully" };
  }

  /**
   * Start promotion
   */
  async startPromotion(promotionId, adminId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      throw new Error("Promotion not found");
    }

    promotion.status = "active";
    promotion.updatedBy = adminId;

    await promotion.save();

    return promotion;
  }

  /**
   * Pause promotion
   */
  async pausePromotion(promotionId, adminId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      throw new Error("Promotion not found");
    }

    promotion.status = "paused";
    promotion.updatedBy = adminId;

    await promotion.save();

    return promotion;
  }

  /**
   * Complete promotion
   */
  async completePromotion(promotionId, adminId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      throw new Error("Promotion not found");
    }

    promotion.status = "completed";
    promotion.updatedBy = adminId;

    await promotion.save();

    return promotion;
  }

  /**
   * Track promotion impression
   */
  async trackImpression(promotionId) {
    await Promotion.updateOne(
      { _id: promotionId },
      { $inc: { "performance.impressions": 1 } }
    );
  }

  /**
   * Track promotion click
   */
  async trackClick(promotionId) {
    await Promotion.updateOne(
      { _id: promotionId },
      { $inc: { "performance.clicks": 1 } }
    );
  }

  /**
   * Track promotion conversion
   */
  async trackConversion(promotionId, revenue = 0) {
    await Promotion.updateOne(
      { _id: promotionId },
      {
        $inc: {
          "performance.conversions": 1,
          "performance.revenue": revenue,
        },
      }
    );
  }

  /**
   * Get promotion analytics
   */
  async getPromotionAnalytics(promotionId) {
    const promotion = await Promotion.findById(promotionId).populate("coupons");

    if (!promotion) {
      throw new Error("Promotion not found");
    }

    // Get coupon usage for this promotion
    const couponIds = promotion.coupons.map((c) => c._id);

    const couponStats = await CouponUsage.aggregate([
      {
        $match: {
          couponId: { $in: couponIds },
        },
      },
      {
        $group: {
          _id: "$couponId",
          usageCount: { $sum: 1 },
          totalDiscount: { $sum: "$discountAmount" },
          totalRevenue: { $sum: "$finalAmount" },
        },
      },
    ]);

    return {
      promotion,
      performance: promotion.performance,
      couponStats,
      metrics: {
        roi: promotion.calculateROI(),
        conversionRate: promotion.calculateConversionRate(),
        ctr:
          promotion.performance.impressions > 0
            ? (promotion.performance.clicks /
                promotion.performance.impressions) *
              100
            : 0,
      },
    };
  }
}

export default new CouponService();
