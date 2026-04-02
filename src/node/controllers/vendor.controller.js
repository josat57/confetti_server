import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import {
  uploadToGridFS,
  downloadFromGridFS,
  deleteFromGridFS,
  fileToBase64,
  fileExists,
} from "../utils/gridfs.js";

// Create a new vendor
export const createVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.create({ ...req.body, owner: req.user._id });
    res.status(201).json({ status: "success", vendor });
  } catch (error) {
    next(error);
  }
};

// Get vendor by ID
export const getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError("Vendor not found", 404));

    // Add verification badge flag
    const vendorData = vendor.toObject();
    vendorData.isBusinessVerified = vendor.verificationStatus === "verified";
    vendorData.hasVerifiedBadge = vendor.verificationStatus === "verified";

    // Exclude sensitive fields from public response
    delete vendorData.taxId;
    delete vendorData.rejectionReason;

    res.status(200).json({ status: "success", vendor: vendorData });
  } catch (error) {
    next(error);
  }
};

// Update vendor
export const updateVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!vendor) return next(new AppError("Vendor not found", 404));
    res.status(200).json({ status: "success", vendor });
  } catch (error) {
    next(error);
  }
};

// Delete vendor
export const deleteVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return next(new AppError("Vendor not found", 404));
    res
      .status(200)
      .json({ status: "success", message: "Vendor deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// List all vendors
export const listVendors = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      location,
      minPrice,
      maxPrice,
      minRating,
      eventType,
      sort = "-createdAt",
    } = req.query;

    // Build query
    const query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (location) {
      query.$or = [
        { "address.city": new RegExp(location, "i") },
        { "address.state": new RegExp(location, "i") },
        { "serviceArea.cities": new RegExp(location, "i") },
        { "serviceArea.states": new RegExp(location, "i") },
      ];
    }

    if (minPrice || maxPrice) {
      query["priceRange.min"] = {};
      if (minPrice) query["priceRange.min"].$gte = Number(minPrice);
      if (maxPrice) query["priceRange.max"] = { $lte: Number(maxPrice) };
    }

    if (minRating) {
      query["stats.averageRating"] = { $gte: Number(minRating) };
    }

    if (eventType) {
      query.eventTypes = eventType;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const vendors = await Vendor.find(query)
      .select("-__v")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .populate("subscription", "planName planType");

    const total = await Vendor.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: vendors.length,
      data: {
        vendors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Search vendors with advanced filters
export const searchVendors = async (req, res, next) => {
  try {
    const {
      query: searchQuery,
      category,
      location,
      minPrice,
      maxPrice,
      minRating,
      eventType,
      features,
      availability,
      page = 1,
      limit = 10,
      sort = "-stats.averageRating",
    } = req.query;

    // Build search query
    const query = { isActive: true };

    // Text search
    if (searchQuery) {
      query.$or = [
        { businessName: new RegExp(searchQuery, "i") },
        { displayName: new RegExp(searchQuery, "i") },
        { description: new RegExp(searchQuery, "i") },
        { tagline: new RegExp(searchQuery, "i") },
        { category: new RegExp(searchQuery, "i") },
        { tags: new RegExp(searchQuery, "i") },
      ];
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Location filter
    if (location) {
      query.$or = [
        { "address.city": new RegExp(location, "i") },
        { "address.state": new RegExp(location, "i") },
        { "serviceArea.cities": new RegExp(location, "i") },
        { "serviceArea.states": new RegExp(location, "i") },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      if (minPrice) {
        query["priceRange.min"] = { $gte: Number(minPrice) };
      }
      if (maxPrice) {
        query["priceRange.max"] = { $lte: Number(maxPrice) };
      }
    }

    // Rating filter
    if (minRating) {
      query["stats.averageRating"] = { $gte: Number(minRating) };
    }

    // Event type filter
    if (eventType) {
      query.eventTypes = eventType;
    }

    // Features filter
    if (features) {
      const featureArray = Array.isArray(features) ? features : [features];
      query.features = { $all: featureArray };
    }

    // Availability filter (check if vendor has availability on specific date)
    if (availability) {
      // This would require checking against bookings/availability
      // For now, we'll just ensure the vendor is active
      query.isActive = true;
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const vendors = await Vendor.find(query)
      .select("-__v")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .populate("subscription", "planName planType");

    const total = await Vendor.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: vendors.length,
      data: {
        vendors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        filters: {
          category,
          location,
          minPrice,
          maxPrice,
          minRating,
          eventType,
          features,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add or update service
export const addOrUpdateService = async (req, res, next) => {
  try {
    const { serviceId, ...serviceData } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError("Vendor not found", 404));
    if (serviceId) {
      const serviceIndex = vendor.services.findIndex(
        (s) => s._id.toString() === serviceId
      );
      if (serviceIndex === -1)
        return next(new AppError("Service not found", 404));
      vendor.services[serviceIndex] = {
        ...vendor.services[serviceIndex].toObject(),
        ...serviceData,
      };
    } else {
      vendor.services.push(serviceData);
    }
    await vendor.save();
    res.status(200).json({ status: "success", vendor });
  } catch (error) {
    next(error);
  }
};

// Add or update portfolio item
export const addOrUpdatePortfolioItem = async (req, res, next) => {
  try {
    const { portfolioId, ...portfolioData } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError("Vendor not found", 404));
    if (portfolioId) {
      const portfolioIndex = vendor.portfolio.findIndex(
        (p) => p._id.toString() === portfolioId
      );
      if (portfolioIndex === -1)
        return next(new AppError("Portfolio item not found", 404));
      vendor.portfolio[portfolioIndex] = {
        ...vendor.portfolio[portfolioIndex].toObject(),
        ...portfolioData,
      };
    } else {
      vendor.portfolio.push(portfolioData);
    }
    await vendor.save();
    res.status(200).json({ status: "success", vendor });
  } catch (error) {
    next(error);
  }
};

// Manage availability
export const manageAvailability = async (req, res, next) => {
  try {
    const { date, slots } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError("Vendor not found", 404));
    const availabilityIndex = vendor.availability.findIndex(
      (a) => a.date.toISOString() === new Date(date).toISOString()
    );
    if (availabilityIndex === -1) {
      vendor.availability.push({ date, slots });
    } else {
      vendor.availability[availabilityIndex].slots = slots;
    }
    await vendor.save();
    res.status(200).json({ status: "success", vendor });
  } catch (error) {
    next(error);
  }
};

// Add review
export const addReview = async (req, res, next) => {
  try {
    const { rating, comment, event } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError("Vendor not found", 404));
    vendor.reviews.push({ user: req.user._id, rating, comment, event });
    await vendor.save();
    res.status(200).json({ status: "success", vendor });
  } catch (error) {
    next(error);
  }
};

// ============================================
// VENDOR DASHBOARD - PROFILE MANAGEMENT
// ============================================

/**
 * Get own vendor profile
 * GET /api/v1/vendors/profile
 */
export const getOwnProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id })
      .populate("subscription", "planName planType status")
      .populate("owner", "email userName");

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Convert vendor to plain object
    const vendorData = vendor.toObject();

    // Convert logo to base64 if stored in GridFS
    if (vendorData.logoFileId) {
      vendorData.logo = await fileToBase64(vendorData.logoFileId);
    }

    // Convert photos to base64 if stored in GridFS
    if (vendorData.photos && vendorData.photos.length > 0) {
      vendorData.photos = await Promise.all(
        vendorData.photos.map(async (photo) => {
          if (photo.fileId) {
            return {
              ...photo,
              url: await fileToBase64(photo.fileId),
              isGridFS: true,
            };
          }
          return photo;
        })
      );
    }

    // Note: Videos are not converted to base64 due to size
    // They will be streamed or accessed via URL

    res.status(200).json({
      status: "success",
      data: { vendor: vendorData },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update vendor profile
 * PUT /api/v1/vendors/profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Fields that can be updated
    const allowedFields = [
      "businessName",
      "displayName",
      "tagline",
      "description",
      "phone",
      "category",
      "businessType",
      "eventTypes",
      "address",
      "serviceArea",
      "businessHours",
      "socialMedia",
      "priceRange",
      "averagePrice",
      "capacity",
      "features",
      "subcategory",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        vendor[field] = req.body[field];
      }
    });

    await vendor.save();

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: { vendor },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload logo
 * POST /api/v1/vendors/profile/logo
 */
export const uploadLogo = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Check if file was uploaded
    if (!req.file && !req.body.logoUrl) {
      return next(new AppError("Logo file or URL is required", 400));
    }

    // Delete old logo from GridFS if it exists and is a GridFS file
    if (vendor.logoFileId) {
      try {
        await deleteFromGridFS(vendor.logoFileId);
      } catch (error) {
        console.error("Error deleting old logo:", error);
      }
    }

    // If file was uploaded, store in GridFS
    if (req.file) {
      const uploadResult = await uploadToGridFS(
        req.file.buffer,
        `logo-${vendor._id}-${Date.now()}${req.file.originalname.substring(
          req.file.originalname.lastIndexOf(".")
        )}`,
        req.file.mimetype,
        {
          vendorId: vendor._id,
          type: "logo",
        }
      );

      vendor.logoFileId = uploadResult.fileId;
      vendor.logo = null; // Clear URL if switching from URL to GridFS
    } else {
      // Otherwise use the provided URL
      vendor.logo = req.body.logoUrl;
      vendor.logoFileId = null; // Clear GridFS ID if switching from GridFS to URL
    }

    await vendor.save();

    // Return base64 if GridFS file
    let logoData = vendor.logo;
    if (vendor.logoFileId) {
      logoData = await fileToBase64(vendor.logoFileId);
    }

    res.status(200).json({
      status: "success",
      message: "Logo uploaded successfully",
      data: {
        logo: logoData,
        isGridFS: !!vendor.logoFileId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload media (photos/videos)
 * POST /api/v1/vendors/profile/media
 */
export const uploadMedia = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { type, caption, thumbnail, title, duration } = req.body;

    // Check if file was uploaded or URL provided
    if (!req.file && !req.body.url) {
      return next(new AppError("Media file or URL is required", 400));
    }

    let mediaFileId = null;
    let mediaUrl = null;
    let mediaType = type;

    // If file was uploaded, store in GridFS
    if (req.file) {
      // Auto-detect type from mimetype if not provided
      if (!mediaType) {
        mediaType = req.file.mimetype.startsWith("video") ? "video" : "photo";
      }

      const uploadResult = await uploadToGridFS(
        req.file.buffer,
        `${mediaType}-${
          vendor._id
        }-${Date.now()}${req.file.originalname.substring(
          req.file.originalname.lastIndexOf(".")
        )}`,
        req.file.mimetype,
        {
          vendorId: vendor._id,
          type: mediaType,
        }
      );

      mediaFileId = uploadResult.fileId;
    } else {
      mediaUrl = req.body.url;
    }

    if (!mediaType) {
      return next(new AppError("Media type is required", 400));
    }

    if (mediaType === "photo") {
      vendor.photos.push({
        url: mediaUrl,
        fileId: mediaFileId,
        caption,
        order: vendor.photos.length,
      });
    } else if (mediaType === "video") {
      vendor.videos.push({
        url: mediaUrl,
        fileId: mediaFileId,
        thumbnail,
        title,
        duration,
      });
    } else {
      return next(
        new AppError("Invalid media type. Must be 'photo' or 'video'", 400)
      );
    }

    await vendor.save();

    res.status(200).json({
      status: "success",
      message: "Media uploaded successfully",
      data: {
        photos: vendor.photos,
        videos: vendor.videos,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete media
 * DELETE /api/v1/vendors/profile/media/:id
 */
export const deleteMedia = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { type } = req.query;
    const mediaId = req.params.id;

    if (type === "photo") {
      vendor.photos = vendor.photos.filter(
        (photo) => photo._id.toString() !== mediaId
      );
    } else if (type === "video") {
      vendor.videos = vendor.videos.filter(
        (video) => video._id.toString() !== mediaId
      );
    } else {
      return next(new AppError("Invalid media type", 400));
    }

    await vendor.save();

    res.status(200).json({
      status: "success",
      message: "Media deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update branding (Professional+ only)
 * PUT /api/v1/vendors/profile/branding
 */
export const updateBranding = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id }).populate(
      "subscription"
    );

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Check if vendor has Professional+ subscription
    if (!vendor.canAccessFeature("branding")) {
      return next(
        new AppError(
          "Branding customization requires Professional plan or higher",
          403
        )
      );
    }

    const { primaryColor, secondaryColor, font, customCSS } = req.body;

    if (primaryColor) vendor.branding.primaryColor = primaryColor;
    if (secondaryColor) vendor.branding.secondaryColor = secondaryColor;
    if (font) vendor.branding.font = font;
    if (customCSS) vendor.branding.customCSS = customCSS;

    await vendor.save();

    res.status(200).json({
      status: "success",
      message: "Branding updated successfully",
      data: { branding: vendor.branding },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get profile stats
 * GET /api/v1/vendors/profile/stats
 */
export const getProfileStats = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Try to update rating before returning stats (non-critical)
    try {
      await vendor.updateRating();
    } catch (ratingError) {
      // Log but don't fail the request if rating update fails
      logger.warn("Failed to update vendor rating:", {
        vendorId: vendor._id,
        error: ratingError.message,
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        stats: vendor.stats,
        isFeatured: vendor.isFeaturedNow(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard summary
 * GET /api/v1/vendors/dashboard/summary
 */
export const getDashboardSummary = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Import models needed for aggregation
    const Lead = (await import("../models/lead.model.js")).default;
    const Payment = (await import("../models/payment.model.js")).default;

    // Try to update rating before calculating stats (non-critical)
    try {
      await vendor.updateRating();
    } catch (ratingError) {
      // Log but don't fail the request if rating update fails
      logger.warn("Failed to update vendor rating:", {
        vendorId: vendor._id,
        error: ratingError.message,
      });
    }

    // Get date range for filtering (default: last 30 days)
    const { startDate, endDate } = req.query;
    const dateFilter = {};

    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    } else {
      // Default to last 30 days
      dateFilter.$gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // 1. Profile Stats (views, rating, etc.)
    const profileStats = {
      profileViews: vendor.stats.profileViews,
      totalBookings: vendor.stats.totalBookings,
      totalReviews: vendor.stats.totalReviews,
      averageRating: vendor.stats.averageRating,
      responseTime: vendor.stats.responseTime,
      responseRate: vendor.stats.responseRate,
      totalRevenue: vendor.stats.totalRevenue,
      isFeatured: vendor.isFeaturedNow(),
    };

    // 2. Lead/Inquiry Statistics
    const leadQuery = { vendor: vendor._id };
    if (Object.keys(dateFilter).length > 0) {
      leadQuery.createdAt = dateFilter;
    }

    const [totalLeads, leadsByStatus, recentLeads] = await Promise.all([
      Lead.countDocuments({ vendor: vendor._id }),
      Lead.aggregate([
        { $match: { vendor: vendor._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Lead.find(leadQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("customer eventDetails status priority createdAt")
        .lean(),
    ]);

    // Calculate conversion rate
    const wonLeads = leadsByStatus.find((s) => s._id === "won")?.count || 0;
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    // Format leads by status
    const leadsBreakdown = {
      total: totalLeads,
      new: leadsByStatus.find((s) => s._id === "new")?.count || 0,
      contacted: leadsByStatus.find((s) => s._id === "contacted")?.count || 0,
      qualified: leadsByStatus.find((s) => s._id === "qualified")?.count || 0,
      proposal_sent:
        leadsByStatus.find((s) => s._id === "proposal_sent")?.count || 0,
      negotiating:
        leadsByStatus.find((s) => s._id === "negotiating")?.count || 0,
      won: wonLeads,
      lost: leadsByStatus.find((s) => s._id === "lost")?.count || 0,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };

    // Get leads needing follow-up
    const needingFollowUp = await Lead.countDocuments({
      vendor: vendor._id,
      status: {
        $in: ["contacted", "qualified", "proposal_sent", "negotiating"],
      },
      followUpDate: { $lte: new Date() },
    });

    // 3. Revenue Statistics (for the filtered period)
    const paymentQuery = {
      vendor: vendor._id,
      status: "completed",
    };

    if (Object.keys(dateFilter).length > 0) {
      paymentQuery.createdAt = dateFilter;
    }

    const [payments, revenueByMonth] = await Promise.all([
      Payment.find(paymentQuery).lean(),
      Payment.aggregate([
        { $match: paymentQuery },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        { $limit: 12 }, // Last 12 months
      ]),
    ]);

    const periodRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const periodBookings = payments.length;
    const averageBookingValue =
      periodBookings > 0 ? periodRevenue / periodBookings : 0;

    // Format revenue trends
    const revenueTrends = revenueByMonth.map((item) => ({
      period: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      revenue: item.revenue,
      bookings: item.count,
    }));

    // 4. Recent Activity (combine recent leads and payments)
    const recentPayments = await Payment.find({
      vendor: vendor._id,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("amount status createdAt")
      .populate("booking", "eventType eventDate")
      .lean();

    const recentActivity = [
      ...recentLeads.map((lead) => ({
        type: "lead",
        id: lead._id,
        title: `New inquiry from ${lead.customer?.name || "Unknown"}`,
        description: `${lead.eventDetails?.type || "Event"} ${
          lead.eventDetails?.date
            ? `on ${new Date(lead.eventDetails.date).toLocaleDateString()}`
            : ""
        }`,
        status: lead.status,
        priority: lead.priority,
        date: lead.createdAt,
      })),
      ...recentPayments.map((payment) => ({
        type: "payment",
        id: payment._id,
        title: `Payment received`,
        description: `${payment.amount} for ${
          payment.booking?.eventType || "booking"
        }`,
        status: payment.status,
        date: payment.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // 5. Quick Actions / Alerts
    const alerts = [];

    if (needingFollowUp > 0) {
      alerts.push({
        type: "warning",
        message: `${needingFollowUp} lead${
          needingFollowUp > 1 ? "s" : ""
        } need follow-up`,
        action: "View leads",
        link: "/vendors/leads/followup",
      });
    }

    if (profileStats.profileViews < 100) {
      alerts.push({
        type: "info",
        message: "Boost your profile visibility",
        action: "Upgrade plan",
        link: "/subscriptions",
      });
    }

    if (profileStats.averageRating < 4.0 && profileStats.totalReviews > 5) {
      alerts.push({
        type: "warning",
        message: "Your rating could use improvement",
        action: "View reviews",
        link: "/vendors/profile",
      });
    }

    // 6. Performance Metrics
    const performanceMetrics = {
      profileCompleteness: calculateProfileCompleteness(vendor),
      responseMetrics: {
        responseTime: profileStats.responseTime,
        responseRate: profileStats.responseRate,
      },
      engagement: {
        viewsToInquiryRate:
          profileStats.profileViews > 0
            ? Math.round((totalLeads / profileStats.profileViews) * 100 * 100) /
              100
            : 0,
        inquiryToBookingRate: conversionRate,
      },
    };

    // Construct response
    res.status(200).json({
      status: "success",
      data: {
        summary: {
          profileViews: profileStats.profileViews,
          totalInquiries: totalLeads,
          totalBookings: profileStats.totalBookings,
          totalRevenue: profileStats.totalRevenue,
          averageRating: profileStats.averageRating,
          totalReviews: profileStats.totalReviews,
          isFeatured: profileStats.isFeatured,
        },
        inquiries: {
          ...leadsBreakdown,
          needingFollowUp,
        },
        revenue: {
          period: {
            start: dateFilter.$gte?.toISOString() || "all time",
            end: dateFilter.$lte?.toISOString() || "present",
          },
          total: periodRevenue,
          bookings: periodBookings,
          averageValue: Math.round(averageBookingValue * 100) / 100,
          trends: revenueTrends,
        },
        recentActivity,
        alerts,
        performance: performanceMetrics,
      },
    });
  } catch (error) {
    logger.error("Error fetching dashboard summary:", error);
    next(error);
  }
};

/**
 * Helper function to calculate profile completeness
 */
function calculateProfileCompleteness(vendor) {
  let score = 0;
  const maxScore = 100;

  // Basic info (30 points)
  if (vendor.businessName) score += 5;
  if (vendor.displayName) score += 5;
  if (vendor.description && vendor.description.length > 50) score += 10;
  if (vendor.category) score += 5;
  if (vendor.contactInfo?.email) score += 5;

  // Location (10 points)
  if (vendor.address?.city) score += 5;
  if (vendor.address?.state) score += 5;

  // Media (20 points)
  if (vendor.logo) score += 10;
  if (vendor.media && vendor.media.length > 0) score += 10;

  // Services (15 points)
  if (vendor.services && vendor.services.length > 0) score += 15;

  // Pricing (10 points)
  if (vendor.pricing?.basePrice) score += 5;
  if (vendor.pricing?.currency) score += 5;

  // Social proof (15 points)
  if (vendor.stats.totalReviews > 0) score += 10;
  if (vendor.stats.averageRating >= 4.0) score += 5;

  return Math.min(score, maxScore);
}

// ============================================
// SEARCH & DISCOVERY
// ============================================

/**
 * Get featured vendors
 * GET /api/v1/vendors/featured
 */
export const getFeaturedVendors = async (req, res, next) => {
  try {
    const { category, location, limit = 10, page = 1 } = req.query;

    // Build query for featured vendors
    const query = {
      isActive: true,
      isFeatured: true,
      featuredUntil: { $gt: new Date() }, // Only get vendors with active featured status
    };

    // Add optional filters
    if (category) {
      query.category = category;
    }

    if (location) {
      query.$or = [
        { "address.city": new RegExp(location, "i") },
        { "address.state": new RegExp(location, "i") },
        { "serviceArea.cities": new RegExp(location, "i") },
        { "serviceArea.states": new RegExp(location, "i") },
      ];
    }

    const skip = (page - 1) * limit;

    // Get featured vendors sorted by rating
    const vendors = await Vendor.find(query)
      .select("-__v")
      .sort("-stats.averageRating -stats.totalReviews")
      .limit(parseInt(limit))
      .skip(skip)
      .populate("subscription", "planName planType");

    const total = await Vendor.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: vendors.length,
      data: {
        vendors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Track profile view
 * POST /api/v1/vendors/:id/track-view
 */
export const trackProfileView = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    // Increment profile views
    vendor.stats.profileViews += 1;
    await vendor.save({ validateBeforeSave: false });

    // Optionally track in analytics if user is logged in
    if (req.user) {
      // TODO: Create analytics entry for detailed tracking
      // This would include: user ID, timestamp, referrer, etc.
      logger.info(
        `Profile view tracked: Vendor ${vendor._id} by User ${req.user._id}`
      );
    }

    res.status(200).json({
      status: "success",
      message: "Profile view tracked",
      data: {
        profileViews: vendor.stats.profileViews,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public vendor profile
 * GET /api/v1/vendors/:id/public
 */
export const getPublicProfile = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .select("-__v -owner")
      .populate("subscription", "planName planType");

    if (!vendor) {
      return next(new AppError("Vendor not found", 404));
    }

    if (!vendor.isActive) {
      return next(new AppError("Vendor profile is not active", 404));
    }

    // Get portfolio items
    const Portfolio = (await import("../models/portfolio.model.js")).default;
    const portfolioItems = await Portfolio.find({
      vendor: vendor._id,
      status: "published",
    })
      .select("title coverPhoto eventType eventDate location tags views")
      .sort("-createdAt")
      .limit(6);

    // Get reviews
    const Review = (await import("../models/review.model.js")).default;
    const reviews = await Review.find({
      vendor: vendor._id,
      isPublic: true,
    })
      .select("rating comment createdAt vendorResponse")
      .populate("user", "name")
      .sort("-createdAt")
      .limit(5);

    // Calculate review statistics
    const reviewStats = await Review.aggregate([
      { $match: { vendor: vendor._id, isPublic: true } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          fiveStars: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          fourStars: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          twoStars: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          oneStar: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      data: {
        vendor,
        portfolioItems,
        reviews,
        reviewStats: reviewStats[0] || {
          totalReviews: 0,
          averageRating: 0,
          fiveStars: 0,
          fourStars: 0,
          threeStars: 0,
          twoStars: 0,
          oneStar: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get vendor categories with counts
 * GET /api/v1/vendors/categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Vendor.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          averageRating: { $avg: "$stats.averageRating" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      status: "success",
      results: categories.length,
      data: { categories },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get popular locations
 * GET /api/v1/vendors/locations
 */
export const getPopularLocations = async (req, res, next) => {
  try {
    const locations = await Vendor.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: {
            city: "$address.city",
            state: "$address.state",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    res.status(200).json({
      status: "success",
      results: locations.length,
      data: { locations },
    });
  } catch (error) {
    next(error);
  }
};
