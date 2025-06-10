import Vendor from '../models/vendor.model.js';
import AppError from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

// Create a new vendor
export const createVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.create({ ...req.body, owner: req.user._id });
    res.status(201).json({ status: 'success', vendor });
  } catch (error) {
    next(error);
  }
};

// Get vendor by ID
export const getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError('Vendor not found', 404));
    res.status(200).json({ status: 'success', vendor });
  } catch (error) {
    next(error);
  }
};

// Update vendor
export const updateVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vendor) return next(new AppError('Vendor not found', 404));
    res.status(200).json({ status: 'success', vendor });
  } catch (error) {
    next(error);
  }
};

// Delete vendor
export const deleteVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) return next(new AppError('Vendor not found', 404));
    res.status(200).json({ status: 'success', message: 'Vendor deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// List all vendors
export const listVendors = async (req, res, next) => {
  try {
    const vendors = await Vendor.find();
    res.status(200).json({ status: 'success', vendors });
  } catch (error) {
    next(error);
  }
};

// Search vendors
export const searchVendors = async (req, res, next) => {
  try {
    const { query } = req.query;
    const vendors = await Vendor.find({ $text: { $search: query } });
    res.status(200).json({ status: 'success', vendors });
  } catch (error) {
    next(error);
  }
};

// Add or update service
export const addOrUpdateService = async (req, res, next) => {
  try {
    const { serviceId, ...serviceData } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError('Vendor not found', 404));
    if (serviceId) {
      const serviceIndex = vendor.services.findIndex(s => s._id.toString() === serviceId);
      if (serviceIndex === -1) return next(new AppError('Service not found', 404));
      vendor.services[serviceIndex] = { ...vendor.services[serviceIndex].toObject(), ...serviceData };
    } else {
      vendor.services.push(serviceData);
    }
    await vendor.save();
    res.status(200).json({ status: 'success', vendor });
  } catch (error) {
    next(error);
  }
};

// Add or update portfolio item
export const addOrUpdatePortfolioItem = async (req, res, next) => {
  try {
    const { portfolioId, ...portfolioData } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError('Vendor not found', 404));
    if (portfolioId) {
      const portfolioIndex = vendor.portfolio.findIndex(p => p._id.toString() === portfolioId);
      if (portfolioIndex === -1) return next(new AppError('Portfolio item not found', 404));
      vendor.portfolio[portfolioIndex] = { ...vendor.portfolio[portfolioIndex].toObject(), ...portfolioData };
    } else {
      vendor.portfolio.push(portfolioData);
    }
    await vendor.save();
    res.status(200).json({ status: 'success', vendor });
  } catch (error) {
    next(error);
  }
};

// Manage availability
export const manageAvailability = async (req, res, next) => {
  try {
    const { date, slots } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError('Vendor not found', 404));
    const availabilityIndex = vendor.availability.findIndex(a => a.date.toISOString() === new Date(date).toISOString());
    if (availabilityIndex === -1) {
      vendor.availability.push({ date, slots });
    } else {
      vendor.availability[availabilityIndex].slots = slots;
    }
    await vendor.save();
    res.status(200).json({ status: 'success', vendor });
  } catch (error) {
    next(error);
  }
};

// Add review
export const addReview = async (req, res, next) => {
  try {
    const { rating, comment, event } = req.body;
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return next(new AppError('Vendor not found', 404));
    vendor.reviews.push({ user: req.user._id, rating, comment, event });
    await vendor.save();
    res.status(200).json({ status: 'success', vendor });
  } catch (error) {
    next(error);
  }
}; 