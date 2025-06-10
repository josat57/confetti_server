import Report from '../models/report.model.js';
import { AppError } from '../utils/error.js';
import { logger } from '../utils/logger.js';
import { createClient } from 'redis';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class ReportService {
  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URI
    });
    this.redis.connect().catch(err => {
      logger.error('Redis connection error:', err);
    });
  }

  // Create report
  async createReport(data) {
    try {
      const report = await Report.create({
        ...data,
        status: 'pending'
      });

      // Start report generation
      this.generateReport(report).catch(error => {
        logger.error('Error generating report:', error);
      });

      return report;
    } catch (error) {
      logger.error('Error creating report:', error);
      throw new AppError('Failed to create report', 500);
    }
  }

  // Get report by ID
  async getReport(reportId, user) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new AppError('Report not found', 404);
      }

      if (report.generatedBy.toString() !== user._id.toString()) {
        throw new AppError('Not authorized to access this report', 403);
      }

      return report;
    } catch (error) {
      logger.error('Error fetching report:', error);
      throw error;
    }
  }

  // Get user reports
  async getUserReports(userId, options = {}) {
    try {
      return await Report.findUserReports(userId, options);
    } catch (error) {
      logger.error('Error fetching user reports:', error);
      throw new AppError('Failed to fetch reports', 500);
    }
  }

  // Schedule report
  async scheduleReport(reportId, userId, scheduleData) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new AppError('Report not found', 404);
      }

      if (report.generatedBy.toString() !== userId.toString()) {
        throw new AppError('Not authorized to schedule this report', 403);
      }

      await report.schedule(scheduleData);
      return report;
    } catch (error) {
      logger.error('Error scheduling report:', error);
      throw error;
    }
  }

  // Cancel scheduled report
  async cancelSchedule(reportId, userId) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new AppError('Report not found', 404);
      }

      if (report.generatedBy.toString() !== userId.toString()) {
        throw new AppError('Not authorized to cancel this report', 403);
      }

      await report.cancelSchedule();
      return report;
    } catch (error) {
      logger.error('Error canceling report schedule:', error);
      throw error;
    }
  }

  // Process scheduled reports
  async processScheduledReports() {
    try {
      const reports = await Report.findScheduledReports();
      
      for (const report of reports) {
        await this.generateReport(report);
        
        // Update next run time
        const nextRun = this.calculateNextRun(report.schedule.frequency);
        await report.updateSchedule({ nextRun, lastRun: new Date() });
      }
    } catch (error) {
      logger.error('Error processing scheduled reports:', error);
    }
  }

  // Private methods

  // Generate report
  async generateReport(report) {
    try {
      await report.markAsProcessing();

      // Fetch data based on report type
      const data = await this.fetchReportData(report);

      // Generate file based on format
      const { filePath, metadata } = await this.generateFile(report, data);

      // Update report with results
      await report.markAsCompleted(data, filePath, metadata);

      // Notify recipients if scheduled
      if (report.schedule.isScheduled) {
        await this.notifyRecipients(report);
      }

      return report;
    } catch (error) {
      await report.markAsFailed(error.message);
      throw error;
    }
  }

  // Fetch report data
  async fetchReportData(report) {
    try {
      switch (report.type) {
        case 'event':
          return await this.fetchEventData(report);
        case 'vendor':
          return await this.fetchVendorData(report);
        case 'booking':
          return await this.fetchBookingData(report);
        case 'system':
          return await this.fetchSystemData(report);
        case 'financial':
          return await this.fetchFinancialData(report);
        case 'analytics':
          return await this.fetchAnalyticsData(report);
        default:
          throw new AppError('Invalid report type', 400);
      }
    } catch (error) {
      logger.error('Error fetching report data:', error);
      throw new AppError('Failed to fetch report data', 500);
    }
  }

  // Generate file
  async generateFile(report, data) {
    const startTime = Date.now();
    const fileName = `${uuidv4()}.${report.format}`;
    const filePath = path.join('reports', fileName);

    try {
      switch (report.format) {
        case 'excel':
          await this.generateExcel(filePath, data);
          break;
        case 'pdf':
          await this.generatePDF(filePath, data);
          break;
        case 'csv':
          await this.generateCSV(filePath, data);
          break;
        case 'json':
          await this.generateJSON(filePath, data);
          break;
        default:
          throw new AppError('Invalid report format', 400);
      }

      const stats = await fs.stat(filePath);
      return {
        filePath,
        metadata: {
          recordCount: data.length,
          processingTime: Date.now() - startTime,
          fileSize: stats.size
        }
      };
    } catch (error) {
      logger.error('Error generating report file:', error);
      throw new AppError('Failed to generate report file', 500);
    }
  }

  // Generate Excel file
  async generateExcel(filePath, data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Add headers
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // Add data
    data.forEach(row => {
      worksheet.addRow(Object.values(row));
    });

    await workbook.xlsx.writeFile(filePath);
  }

  // Generate PDF file
  async generatePDF(filePath, data) {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Add content
    doc.fontSize(16).text('Report', { align: 'center' });
    doc.moveDown();

    // Add data
    data.forEach(row => {
      Object.entries(row).forEach(([key, value]) => {
        doc.fontSize(12).text(`${key}: ${value}`);
      });
      doc.moveDown();
    });

    doc.end();
  }

  // Generate CSV file
  async generateCSV(filePath, data) {
    const parser = new Parser();
    const csv = parser.parse(data);
    await fs.writeFile(filePath, csv);
  }

  // Generate JSON file
  async generateJSON(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // Calculate next run time
  calculateNextRun(frequency) {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.setDate(now.getDate() + 1));
      case 'weekly':
        return new Date(now.setDate(now.getDate() + 7));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1));
      default:
        return null;
    }
  }

  // Notify recipients
  async notifyRecipients(report) {
    // TODO: Implement notification logic
    logger.info('Notification not implemented yet');
  }

  // Data fetching methods
  async fetchEventData(report) {
    // TODO: Implement event data fetching
    return [];
  }

  async fetchVendorData(report) {
    // TODO: Implement vendor data fetching
    return [];
  }

  async fetchBookingData(report) {
    // TODO: Implement booking data fetching
    return [];
  }

  async fetchSystemData(report) {
    // TODO: Implement system data fetching
    return [];
  }

  async fetchFinancialData(report) {
    // TODO: Implement financial data fetching
    return [];
  }

  async fetchAnalyticsData(report) {
    // TODO: Implement analytics data fetching
    return [];
  }
}

export default new ReportService(); 