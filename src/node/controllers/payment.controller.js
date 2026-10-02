import Invoice from "../models/invoice.model.js";
import Vendor from "../models/vendor.model.js";
import Payment from "../models/payment.model.js";
import { AppError } from "../utils/AppError.js";
import { sendEmailDirect } from "../utils/email.js";
import { logger } from "../utils/logger.js";

/**
 * Get all invoices
 * GET /api/v1/vendors/invoices
 */
export const getInvoices = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { status, page = 1, limit = 20, sort = "-createdAt" } = req.query;
    const query = { vendor: vendor._id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const invoices = await Invoice.find(query)
      .populate("booking", "eventDate eventType")
      .populate("sentBy", "name email")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      status: "success",
      results: invoices.length,
      data: {
        invoices,
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
 * Get single invoice
 * GET /api/v1/vendors/invoices/:id
 */
export const getInvoice = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    })
      .populate("booking", "eventDate eventType customer")
      .populate("sentBy", "name email");

    if (!invoice) return next(new AppError("Invoice not found", 404));

    res.status(200).json({
      status: "success",
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create invoice
 * POST /api/v1/vendors/invoices
 */
export const createInvoice = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const invoiceData = {
      ...req.body,
      vendor: vendor._id,
    };

    const invoice = await Invoice.create(invoiceData);

    res.status(201).json({
      status: "success",
      message: "Invoice created successfully",
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send invoice
 * POST /api/v1/vendors/invoices/:id/send
 */
export const sendInvoice = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!invoice) return next(new AppError("Invoice not found", 404));
    if (invoice.status !== "draft") {
      return next(new AppError("Invoice has already been sent", 400));
    }

    await invoice.send(req.user._id);

    // Send invoice email to customer
    try {
      const customerEmail = invoice.client?.email || invoice.customerEmail;
      const customerName = invoice.client?.name || invoice.customerName || "Customer";
      if (customerEmail) {
        const dueDate = invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : "Upon receipt";
        await sendEmailDirect({
          to: customerEmail,
          subject: `Invoice #${invoice.invoiceNumber} from ${vendor.businessName || vendor.displayName}`,
          html: `
            <h2>Invoice from ${vendor.businessName || vendor.displayName}</h2>
            <p>Hi ${customerName},</p>
            <p>Please find your invoice below:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Invoice Number</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">#${invoice.invoiceNumber}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Amount Due</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${invoice.currency || "NGN"} ${(invoice.total || 0).toLocaleString()}</td></tr>
              <tr><td style="padding:8px;border:1px solid #e5e7eb;"><strong>Due Date</strong></td><td style="padding:8px;border:1px solid #e5e7eb;">${dueDate}</td></tr>
            </table>
            <p>Please make payment by the due date to avoid any late fees.</p>
            <p>If you have any questions about this invoice, please contact us.</p>
            <p>Thank you for your business!</p>
            <p><em>${vendor.businessName || vendor.displayName}</em></p>
          `,
        });
      }
    } catch (emailError) {
      logger.error("Failed to send invoice email:", emailError.message);
    }

    res.status(200).json({
      status: "success",
      message: "Invoice sent successfully",
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record payment
 * POST /api/v1/vendors/invoices/:id/payment
 */
export const recordPayment = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { amount, method, reference, notes } = req.body;
    if (!amount) return next(new AppError("Payment amount is required", 400));

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!invoice) return next(new AppError("Invoice not found", 404));

    await invoice.recordPayment(amount, method, reference, notes);

    res.status(200).json({
      status: "success",
      message: "Payment recorded successfully",
      data: { invoice },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment history
 * GET /api/v1/vendors/payments
 */
export const getPaymentHistory = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ vendor: vendor._id })
      .populate("booking", "eventDate eventType")
      .populate("customer", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Payment.countDocuments({ vendor: vendor._id });

    res.status(200).json({
      status: "success",
      results: payments.length,
      data: {
        payments,
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
 * Get pending payments
 * GET /api/v1/vendors/payments/pending
 */
export const getPendingPayments = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });
    if (!vendor) return next(new AppError("Vendor profile not found", 404));

    const pendingInvoices = await Invoice.getPending(vendor._id);
    const overdueInvoices = await Invoice.getOverdue(vendor._id);

    const totalPending = pendingInvoices.reduce(
      (sum, inv) => sum + inv.amountDue,
      0
    );
    const totalOverdue = overdueInvoices.reduce(
      (sum, inv) => sum + inv.amountDue,
      0
    );

    res.status(200).json({
      status: "success",
      data: {
        pending: {
          count: pendingInvoices.length,
          total: totalPending,
          invoices: pendingInvoices,
        },
        overdue: {
          count: overdueInvoices.length,
          total: totalOverdue,
          invoices: overdueInvoices,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
