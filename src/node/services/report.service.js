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

  // Notify recipients of scheduled report completion
  async notifyRecipients(report) {
    try {
      const User = (await import('../models/user.model.js')).default;
      const { sendEmailDirect } = await import('../utils/email.js');

      const recipients = report.schedule?.recipients || [];
      // Always include the report creator
      const creator = await User.findById(report.generatedBy).select('email firstName name').lean();
      if (creator) recipients.push(creator.email);

      const uniqueEmails = [...new Set(recipients.filter(Boolean))];

      for (const email of uniqueEmails) {
        await sendEmailDirect({
          to: email,
          subject: `Your scheduled report is ready: ${report.name || report.type}`,
          html: `
            <h2>Scheduled Report Ready</h2>
            <p>Hi there,</p>
            <p>Your scheduled <strong>${report.type}</strong> report has been generated and is ready to download.</p>
            <table style="width:100%;border-collapse:collapse;margin:12px 0;">
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Report Type</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${report.type}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Format</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${report.format?.toUpperCase()}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Records</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${report.metadata?.recordCount || 0}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Generated At</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${new Date().toLocaleString()}</td></tr>
            </table>
            <p><a href="${process.env.FRONTEND_URL}/reports/${report._id}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Download Report</a></p>
          `,
        }).catch(() => {});
      }

      logger.info('Report recipients notified', { reportId: report._id, count: uniqueEmails.length });
    } catch (error) {
      logger.error('Failed to notify report recipients:', error.message);
    }
  }

  // Data fetching methods
  async fetchEventData(report) {
    try {
      const Event = (await import('../models/event.model.js')).default;
      const filter = {};
      if (report.filters?.startDate && report.filters?.endDate) {
        filter.createdAt = {
          $gte: new Date(report.filters.startDate),
          $lte: new Date(report.filters.endDate),
        };
      }
      if (report.filters?.userId) filter.organizer = report.filters.userId;

      const events = await Event.find(filter)
        .select('name eventType status date budget createdAt')
        .populate('organizer', 'email firstName lastName')
        .lean();

      return events.map((e) => ({
        id: e._id,
        name: e.name,
        type: e.eventType,
        status: e.status,
        date: e.date,
        budget: e.budget?.total || 0,
        organizer: e.organizer ? `${e.organizer.firstName || ''} ${e.organizer.lastName || ''}`.trim() : 'N/A',
        organizerEmail: e.organizer?.email || '',
        createdAt: e.createdAt,
      }));
    } catch (error) {
      logger.error('Error fetching event data:', error.message);
      return [];
    }
  }

  async fetchVendorData(report) {
    try {
      const Vendor = (await import('../models/vendor.model.js')).default;
      const filter = {};
      if (report.filters?.startDate && report.filters?.endDate) {
        filter.createdAt = {
          $gte: new Date(report.filters.startDate),
          $lte: new Date(report.filters.endDate),
        };
      }
      if (report.filters?.category) filter.category = report.filters.category;

      const vendors = await Vendor.find(filter)
        .select('businessName category status isVerified rating reviewCount createdAt')
        .populate('owner', 'email firstName lastName')
        .lean();

      return vendors.map((v) => ({
        id: v._id,
        businessName: v.businessName,
        category: v.category,
        status: v.status,
        verified: v.isVerified,
        rating: v.rating || 0,
        reviewCount: v.reviewCount || 0,
        owner: v.owner ? `${v.owner.firstName || ''} ${v.owner.lastName || ''}`.trim() : 'N/A',
        ownerEmail: v.owner?.email || '',
        createdAt: v.createdAt,
      }));
    } catch (error) {
      logger.error('Error fetching vendor data:', error.message);
      return [];
    }
  }

  async fetchBookingData(report) {
    try {
      const Booking = (await import('../models/booking.model.js')).default;
      const filter = {};
      if (report.filters?.startDate && report.filters?.endDate) {
        filter.createdAt = {
          $gte: new Date(report.filters.startDate),
          $lte: new Date(report.filters.endDate),
        };
      }
      if (report.filters?.status) filter.status = report.filters.status;

      const bookings = await Booking.find(filter)
        .populate('event', 'name')
        .populate('vendor', 'businessName')
        .populate('client', 'email firstName lastName')
        .lean();

      return bookings.map((b) => ({
        id: b._id,
        event: b.event?.name || 'N/A',
        vendor: b.vendor?.businessName || 'N/A',
        client: b.client ? `${b.client.firstName || ''} ${b.client.lastName || ''}`.trim() : 'N/A',
        clientEmail: b.client?.email || '',
        status: b.status,
        date: b.date,
        amount: b.totalAmount || 0,
        createdAt: b.createdAt,
      }));
    } catch (error) {
      logger.error('Error fetching booking data:', error.message);
      return [];
    }
  }

  async fetchSystemData(report) {
    try {
      const ErrorLog = (await import('../models/errorLog.model.js')).default;
      const filter = {};
      if (report.filters?.startDate && report.filters?.endDate) {
        filter.createdAt = {
          $gte: new Date(report.filters.startDate),
          $lte: new Date(report.filters.endDate),
        };
      }

      const [errors, byType, bySeverity] = await Promise.all([
        ErrorLog.find(filter).sort('-createdAt').limit(500).lean(),
        ErrorLog.aggregate([{ $match: filter }, { $group: { _id: '$errorType', count: { $sum: 1 } } }]),
        ErrorLog.aggregate([{ $match: filter }, { $group: { _id: '$severity', count: { $sum: 1 } } }]),
      ]);

      const summary = {
        id: 'system_summary',
        totalErrors: errors.length,
        byType: Object.fromEntries(byType.map((b) => [b._id, b.count])),
        bySeverity: Object.fromEntries(bySeverity.map((b) => [b._id, b.count])),
        generatedAt: new Date(),
      };

      return [
        summary,
        ...errors.map((e) => ({
          id: e._id,
          type: e.errorType,
          severity: e.severity,
          message: e.message,
          endpoint: e.endpoint || '',
          resolved: e.resolved,
          occurrenceCount: e.occurrenceCount,
          createdAt: e.createdAt,
        })),
      ];
    } catch (error) {
      logger.error('Error fetching system data:', error.message);
      return [];
    }
  }

  async fetchFinancialData(report) {
    try {
      const Payment = (await import('../models/payment.model.js')).default;
      const filter = {};
      if (report.filters?.startDate && report.filters?.endDate) {
        filter.createdAt = {
          $gte: new Date(report.filters.startDate),
          $lte: new Date(report.filters.endDate),
        };
      }
      if (report.filters?.status) filter.status = report.filters.status;

      const payments = await Payment.find(filter)
        .populate('user', 'email firstName lastName')
        .sort('-createdAt')
        .lean();

      return payments.map((p) => ({
        id: p._id,
        reference: p.reference,
        transactionId: p.transactionId,
        user: p.user ? `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim() : 'N/A',
        userEmail: p.user?.email || '',
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentType: p.paymentType,
        paymentMethod: p.paymentMethod,
        refundAmount: p.refundDetails?.refundAmount || 0,
        createdAt: p.createdAt,
      }));
    } catch (error) {
      logger.error('Error fetching financial data:', error.message);
      return [];
    }
  }

  async fetchAnalyticsData(report) {
    try {
      const User = (await import('../models/user.model.js')).default;
      const Event = (await import('../models/event.model.js')).default;
      const Payment = (await import('../models/payment.model.js')).default;
      const AIPlannerUsage = (await import('../models/ai-planner-usage.model.js')).default;

      const dateFilter = {};
      if (report.filters?.startDate && report.filters?.endDate) {
        dateFilter.createdAt = {
          $gte: new Date(report.filters.startDate),
          $lte: new Date(report.filters.endDate),
        };
      }

      const [totalUsers, newUsers, totalEvents, totalRevenue, aiUsage] = await Promise.all([
        User.countDocuments(),
        User.countDocuments(dateFilter),
        Event.countDocuments(dateFilter),
        Payment.aggregate([
          { $match: { ...dateFilter, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        AIPlannerUsage.aggregate([
          { $group: { _id: '$usageType', total: { $sum: '$count' } } },
        ]),
      ]);

      return [{
        id: 'analytics_summary',
        totalUsers,
        newUsers,
        totalEvents,
        totalRevenue: totalRevenue[0]?.total || 0,
        aiPlannerUsage: Object.fromEntries(aiUsage.map((a) => [a._id, a.total])),
        period: {
          startDate: report.filters?.startDate,
          endDate: report.filters?.endDate,
        },
        generatedAt: new Date(),
      }];
    } catch (error) {
      logger.error('Error fetching analytics data:', error.message);
      return [];
    }
  }
}

export default new ReportService(); 