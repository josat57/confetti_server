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
        sortOptions = { rating: -1, reviewCount: -1 };
        break;
      case "price_low":
        sortOptions = { "priceRange.min": 1 };
        break;
      case "price_high":
        sortOptions = { "priceRange.min": -1 };
        break;
      case "newest":
        sortOptions = { createdAt: -1 };
        break;
      default:
        sortOptions = { rating: -1 };
    }

    const skip = (page - 1) * limit;

    const vendors = await Vendor.find(query)
      .select(
        "name businessName category rating reviewCount priceRange address location services availabilityStatus"
      )
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOptions);

    const total = await Vendor.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vendors,
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
    const { eventId, serviceRequirements, budget, specialRequirements } =
      req.body;
    const vendorId = req.params.id;

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

    const booking = await VendorBooking.create({
      vendor: vendorId,
      planner: req.user._id,
      event: eventId,
      serviceRequirements,
      budget,
      specialRequirements,
      status: "pending",
    });

    await booking.populate([
      { path: "vendor", select: "name businessName category" },
      { path: "event", select: "title startDate" },
    ]);

    res.status(201).json({
      success: true,
      message: "Booking request created successfully",
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
