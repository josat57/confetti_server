import analyticsService from '../services/analytics.service.js';
import AppError from '../utils/AppError.js';

export const createAnalytics = async (req, res, next) => {
  try {
    const analytics = await analyticsService.createAnalytics(req.body);
    res.status(201).json(analytics);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await analyticsService.getAnalyticsById(req.params.id);
    res.status(200).json(analytics);
  } catch (error) {
    next(new AppError(error.message, 404));
  }
};

export const listAnalytics = async (req, res, next) => {
  try {
    const analytics = await analyticsService.listAnalytics(req.query);
    res.status(200).json(analytics);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
}; 