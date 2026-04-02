import Vendor from "../models/vendor.model.js";
import VendorBooking from "../models/vendor-booking.model.js";
import User from "../models/user.model.js";

export const searchVendors = async (req, res) => {
  try {
    const {
      category,
      location,
      minPrice,
      maxPrice,
      rating,
      search,
      page = 1,
      limit = 20,
      sortBy = "rating",
    } = req.query;

    const query = { status: "approved", isActive: true };

    if (category) {
      query.category = category;
    }

    if (rating) {
      query.rating = { $gte: parseFloat(rating) };
    }

    if (minPrice || maxPrice) {
      query["priceRange.min"] = {};
      if (minPrice) query["priceRange.min"].$gte = parseFloat(minPrice);
      if (maxPrice) query["priceRange.max"] = { $lte: parseFloat(maxPrice) };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { businessName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (location) {
      query["address.city"] = { $regex: location, $options: "i" };
    }

    let sortOptions = {};
    switch (sortBy) {
      case "rating":
        // Prioritize verified vendors, then by rating
        sortOptions = { verificationStatus: -1, rating: -1, reviewCount: -1 };
        break;
      case "price_low":
        sortOptions = { verificationStatus: -1, "priceRange.min": 1 };
        break;
      case "price_high":
        sortOptions = { verificationStatus: -1, "priceRange.min": -1 };
        break;
      case "newest":
        sortOptions = { verificationStatus: -1, createdAt: -1 };
        break;
      default:
        sortOptions = { verificationStatus: -1, rating: -1 };
    }

    const skip = (page - 1) * limit;

    const vendors = await Vendor.find(query)
      .select(
        "name businessName category rating reviewCount priceRange address location services availabilityStatus logo verificationStatus registrationNumber yearEstablished"
      )
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOptions);

    // Add verification badge and format response
    const formattedVendors = vendors.map((vendor) => {
      const vendorData = vendor.toObject();
      vendorData.isBusinessVerified = vendor.verificationStatus === "verified";
      vendorData.hasVerifiedBadge = vendor.verificationStatus === "verified";
      return vendorData;
    });

    const total = await Vendor.countDocuments(query);

    res.status(200).json({
      success: true,
      data: formattedVendors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error searching vendors",
      error: error.message,
    });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      _id: req.params.id,
      status: "approved",
      isActive: true,
    }).populate("owner", "name email");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching vendor",
      error: error.message,
    });
  }
};

export const addVendorToFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.favorites) {
      user.favorites = { vendors: [] };
    }

    if (!user.favorites.vendors) {
      user.favorites.vendors = [];
    }

    const vendorId = req.params.id;

    if (user.favorites.vendors.includes(vendorId)) {
      return res.status(400).json({
        success: false,
        message: "Vendor already in favorites",
      });
    }

    user.favorites.vendors.push(vendorId);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Vendor added to favorites",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding vendor to favorites",
      error: error.message,
    });
  }
};

export const removeVendorFromFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.favorites || !user.favorites.vendors) {
      return res.status(400).json({
        success: false,
        message: "No favorites found",
      });
    }

    const vendorId = req.params.id;
    user.favorites.vendors = user.favorites.vendors.filter(
      (id) => id.toString() !== vendorId
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: "Vendor removed from favorites",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error removing vendor from favorites",
      error: error.message,
    });
  }
};

export const getFavoriteVendors = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "favorites.vendors",
      select:
        "name businessName category rating reviewCount priceRange address availabilityStatus",
    });

    const favorites = user.favorites?.vendors || [];

    res.status(200).json({
      success: true,
      data: favorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching favorite vendors",
      error: error.message,
    });
  }
};

export const createBooking = async (req, res) => {
  try {
    // Handle both vendor-initiated and planner-initiated bookings
    const vendorId = req.params.id || req.user._id; // Use logged-in vendor if no ID in params

    const {
      eventId,
      serviceRequirements,
      budget,
      specialRequirements,
      // Vendor-initiated booking fields
      clientName,
      clientEmail,
      clientPhone,
      eventType,
      eventDate,
      eventEndDate,
      location,
      guestCount,
      totalAmount,
      depositAmount,
      currency,
      eventNotes,
    } = req.body;

    const vendor = await Vendor.findOne({
      _id: vendorId,
      status: "approved",
      isActive: true,
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found or not available",
      });
    }

    const existingBooking = await VendorBooking.findOne({
      vendor: vendorId,
      event: eventId,
      planner: req.user._id,
      status: { $nin: ["cancelled", "completed"] },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "Active booking already exists for this vendor and event",
      });
    }

    // Create booking data
    const bookingData = {
      vendor: vendorId,
      status: "pending",
    };

    // Planner-initiated booking
    if (eventId) {
      bookingData.planner = req.user._id;
      bookingData.event = eventId;
      bookingData.serviceRequirements = serviceRequirements;
      bookingData.budget = budget;
      bookingData.specialRequirements = specialRequirements;
    }
    // Vendor-initiated booking
    else if (clientName) {
      bookingData.clientName = clientName;
      bookingData.clientEmail = clientEmail;
      bookingData.clientPhone = clientPhone;
      bookingData.eventType = eventType;
      bookingData.eventDate = eventDate ? new Date(eventDate) : undefined;
      bookingData.eventEndDate = eventEndDate
        ? new Date(eventEndDate)
        : undefined;
      bookingData.location = location;
      bookingData.guestCount = guestCount;
      bookingData.totalAmount = totalAmount;
      bookingData.depositAmount = depositAmount;
      bookingData.currency = currency || "NGN";
      bookingData.notes = eventNotes;
    } else {
      return res.status(400).json({
        success: false,
        message: "Either eventId or client details are required",
      });
    }

    const booking = await VendorBooking.create(bookingData);

    await booking.populate([
      { path: "vendor", select: "name businessName category" },
      { path: "event", select: "title startDate" },
    ]);

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating booking",
      error: error.message,
    });
  }
};

export const getBookingStats = async (req, res) => {
  try {
    const query = { planner: req.user._id };

    // Get total bookings count
    const total = await VendorBooking.countDocuments(query);

    // Get bookings by status
    const statusBreakdown = await VendorBooking.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get bookings by category
    const categoryBreakdown = await VendorBooking.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "vendors",
          localField: "vendor",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      { $unwind: "$vendorInfo" },
      {
        $group: {
          _id: "$vendorInfo.category",
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate total spent
    const totalSpent = await VendorBooking.aggregate([
      { $match: { ...query, status: { $in: ["confirmed", "completed"] } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalCost" },
        },
      },
    ]);

    // Format status breakdown
    const stats = {
      total,
      pending: statusBreakdown.find((s) => s._id === "pending")?.count || 0,
      confirmed: statusBreakdown.find((s) => s._id === "confirmed")?.count || 0,
      completed: statusBreakdown.find((s) => s._id === "completed")?.count || 0,
      cancelled: statusBreakdown.find((s) => s._id === "cancelled")?.count || 0,
    };

    res.status(200).json({
      success: true,
      data: {
        stats,
        byCategory: categoryBreakdown.map((item) => ({
          category: item._id,
          count: item.count,
        })),
        totalSpent: totalSpent[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching booking stats",
      error: error.message,
    });
  }
};

export const getBookings = async (req, res) => {
  try {
    const { status, eventId, page = 1, limit = 20 } = req.query;

    const query = { planner: req.user._id };

    if (status) {
      query.status = status;
    }

    if (eventId) {
      query.event = eventId;
    }

    const skip = (page - 1) * limit;

    const bookings = await VendorBooking.find(query)
      .populate("vendor", "name businessName category rating")
      .populate("event", "title startDate")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await VendorBooking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await VendorBooking.findOne({
      _id: req.params.id,
      planner: req.user._id,
    })
      .populate("vendor")
      .populate("event")
      .populate("communication.from", "name email");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching booking",
      error: error.message,
    });
  }
};

export const updateBooking = async (req, res) => {
  try {
    const { status, note } = req.body;

    const booking = await VendorBooking.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (status) {
      await booking.updateStatus(status, req.user._id, note);
    }

    Object.keys(req.body).forEach((key) => {
      if (key !== "status" && key !== "note" && req.body[key] !== undefined) {
        booking[key] = req.body[key];
      }
    });

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating booking",
      error: error.message,
    });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await VendorBooking.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (["completed", "cancelled"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status: ${booking.status}`,
      });
    }

    await booking.updateStatus("cancelled", req.user._id, reason);

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error cancelling booking",
      error: error.message,
    });
  }
};

export const getVendorCategories = async (req, res) => {
  try {
    // Get all unique vendor categories from approved vendors
    const categories = await Vendor.aggregate([
      {
        $match: {
          status: "approved",
          isActive: true,
          category: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          minPrice: { $min: "$priceRange.min" },
          maxPrice: { $max: "$priceRange.max" },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          vendorCount: "$count",
          averageRating: { $round: ["$avgRating", 1] },
          priceRange: {
            min: "$minPrice",
            max: "$maxPrice",
          },
        },
      },
      {
        $sort: { vendorCount: -1 },
      },
    ]);

    // Add category metadata
    const categoryMetadata = {
      catering: {
        name: "Catering",
        description: "Food and beverage services",
        icon: "🍽️",
      },
      photography: {
        name: "Photography",
        description: "Professional photography services",
        icon: "📸",
      },
      videography: {
        name: "Videography",
        description: "Video recording and editing services",
        icon: "🎥",
      },
      decoration: {
        name: "Decoration",
        description: "Event decoration and styling",
        icon: "🎨",
      },
      music: {
        name: "Music & Entertainment",
        description: "DJs, bands, and entertainment services",
        icon: "🎵",
      },
      venue: {
        name: "Venues",
        description: "Event venues and locations",
        icon: "🏛️",
      },
      transportation: {
        name: "Transportation",
        description: "Transportation and logistics",
        icon: "🚗",
      },
      flowers: {
        name: "Flowers",
        description: "Floral arrangements and bouquets",
        icon: "🌸",
      },
      makeup: {
        name: "Makeup & Beauty",
        description: "Beauty and styling services",
        icon: "💄",
      },
      security: {
        name: "Security",
        description: "Event security services",
        icon: "🛡️",
      },
      other: {
        name: "Other Services",
        description: "Miscellaneous event services",
        icon: "⭐",
      },
    };

    // Enhance categories with metadata
    const enhancedCategories = categories.map((cat) => ({
      ...cat,
      ...(categoryMetadata[cat.category] || {
        name: cat.category.charAt(0).toUpperCase() + cat.category.slice(1),
        description: `${cat.category} services`,
        icon: "⭐",
      }),
    }));

    res.status(200).json({
      success: true,
      message: "Vendor categories retrieved successfully",
      data: {
        categories: enhancedCategories,
        totalCategories: enhancedCategories.length,
        totalVendors: categories.reduce((sum, cat) => sum + cat.vendorCount, 0),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching vendor categories",
      error: error.message,
    });
  }
};
