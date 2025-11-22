import Location from "../models/location.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * Get all locations for vendor
 * GET /api/v1/vendors/locations
 */
export const getLocations = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { status, page = 1, limit = 20 } = req.query;

    const query = { vendor: vendor._id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const locations = await Location.find(query)
      .sort({ isPrimary: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Location.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: locations.length,
      data: {
        locations,
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
 * Get single location
 * GET /api/v1/vendors/locations/:id
 */
export const getLocation = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const location = await Location.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!location) return next(new AppError("Location not found", 404));

    res.status(200).json({
      status: "success",
      data: { location },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create location
 * POST /api/v1/vendors/locations
 */
export const createLocation = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id }).populate(
      "subscription"
    );
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    // Check subscription tier (Professional+ only)
    if (!vendor.canAccessFeature("multi_location")) {
      return next(
        new AppError(
          "Multi-location management requires Professional plan or higher",
          403
        )
      );
    }

    const location = await Location.create({
      ...req.body,
      vendor: vendor._id,
    });

    res.status(201).json({
      status: "success",
      message: "Location created successfully",
      data: { location },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update location
 * PUT /api/v1/vendors/locations/:id
 */
export const updateLocation = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const location = await Location.findOneAndUpdate(
      { _id: req.params.id, vendor: vendor._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!location) return next(new AppError("Location not found", 404));

    res.status(200).json({
      status: "success",
      message: "Location updated successfully",
      data: { location },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete location
 * DELETE /api/v1/vendors/locations/:id
 */
export const deleteLocation = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const location = await Location.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!location) return next(new AppError("Location not found", 404));

    // Prevent deletion of primary location if it's the only one
    if (location.isPrimary) {
      const locationCount = await Location.countDocuments({
        vendor: vendor._id,
      });
      if (locationCount === 1) {
        return next(new AppError("Cannot delete the only location", 400));
      }
    }

    await location.deleteOne();

    res.status(200).json({
      status: "success",
      message: "Location deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get location analytics
 * GET /api/v1/vendors/locations/:id/analytics
 */
export const getLocationAnalytics = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const location = await Location.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!location) return next(new AppError("Location not found", 404));

    // Get bookings for this location
    const Booking = (await import("../models/booking.model.js")).default;
    const bookings = await Booking.find({ location: location._id });

    // Calculate analytics
    const totalRevenue = bookings.reduce(
      (sum, booking) => sum + (booking.totalAmount || 0),
      0
    );
    const completedBookings = bookings.filter(
      (b) => b.status === "completed"
    ).length;

    res.status(200).json({
      status: "success",
      data: {
        location: {
          id: location._id,
          name: location.name,
        },
        analytics: {
          totalBookings: bookings.length,
          completedBookings,
          totalRevenue,
          averageBookingValue:
            bookings.length > 0 ? totalRevenue / bookings.length : 0,
          stats: location.stats,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
