import reportService from '../services/report.service.js';
import { AppError } from '../utils/error.js';
import { logger } from '../utils/logger.js';

// Create report
export const createReport = async (req, res, next) => {
  try {
    const report = await reportService.createReport({
      ...req.body,
      generatedBy: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Get report by ID
export const getReport = async (req, res, next) => {
  try {
    const report = await reportService.getReport(
      req.params.reportId,
      req.user
    );

    res.status(200).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Get user reports
export const getUserReports = async (req, res, next) => {
  try {
    const reports = await reportService.getUserReports(
      req.user._id,
      {
        type: req.query.type,
        status: req.query.status,
        limit: parseInt(req.query.limit) || 50,
        skip: parseInt(req.query.skip) || 0
      }
    );

    res.status(200).json({
      status: 'success',
      data: reports
    });
  } catch (error) {
    next(error);
  }
};

// Schedule report
export const scheduleReport = async (req, res, next) => {
  try {
    const report = await reportService.scheduleReport(
      req.params.reportId,
      req.user._id,
      req.body
    );

    res.status(200).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Cancel scheduled report
export const cancelSchedule = async (req, res, next) => {
  try {
    const report = await reportService.cancelSchedule(
      req.params.reportId,
      req.user._id
    );

    res.status(200).json({
      status: 'success',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

// Download report
export const downloadReport = async (req, res, next) => {
  try {
    const report = await reportService.getReport(
      req.params.reportId,
      req.user
    );

    if (report.status !== 'completed') {
      throw new AppError('Report is not ready for download', 400);
    }

    res.download(report.url);
  } catch (error) {
    next(error);
  }
}; 