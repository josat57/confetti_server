import Quote from "../models/quote.model.js";
import Vendor from "../models/vendor.model.js";
import Lead from "../models/lead.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { sendEmailDirect } from "../utils/email.js";
import { escapeRegExp } from "../utils/escape-regex.js";
import { assertWithinLimit } from "../services/plan-access.service.js";

/**
 * Get all quotes
 * GET /api/v1/vendors/quotes
 */
export const getQuotes = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const {
      status,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    // Build query
    const query = { vendor: vendor._id };

    if (status) query.status = status;

    // Search in customer name, email, or quote number
    if (search) {
      query.$or = [
        { "customer.name": new RegExp(escapeRegExp(search), "i") },
        { "customer.email": new RegExp(escapeRegExp(search), "i") },
        { quoteNumber: new RegExp(escapeRegExp(search), "i") },
      ];
    }

    const skip = (page - 1) * limit;

    const quotes = await Quote.find(query)
      .populate("lead", "customer eventDetails status")
      .populate("createdBy", "name email")
      .populate("sentBy", "name email")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Quote.countDocuments(query);

    // Get status counts
    const statusCounts = await Quote.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = {
      draft: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
    };

    statusCounts.forEach((item) => {
      counts[item._id] = item.count;
    });

    res.status(200).json({
      status: "success",
      results: quotes.length,
      data: {
        quotes,
        counts,
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
 * Get single quote
 * GET /api/v1/vendors/quotes/:id
 */
export const getQuote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const quote = await Quote.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    })
      .populate("lead", "customer eventDetails status priority")
      .populate("createdBy", "name email phone")
      .populate("sentBy", "name email")
      .populate("template", "name");

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { quote },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create quote
 * POST /api/v1/vendors/quotes
 */
export const createQuote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    // Set default valid until date if not provided (30 days from now)
    if (!req.body.validUntil) {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      req.body.validUntil = validUntil;
    }

    const quoteData = {
      ...req.body,
      vendor: vendor._id,
      createdBy: req.user._id,
    };

    const quote = await Quote.create(quoteData);

    // Update lead if provided
    if (quote.lead) {
      await Lead.findByIdAndUpdate(quote.lead, {
        quote: quote._id,
        status: "quoted",
      });
    }

    await quote.populate("createdBy", "name email");

    res.status(201).json({
      status: "success",
      message: "Quote created successfully",
      data: { quote },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update quote
 * PUT /api/v1/vendors/quotes/:id
 */
export const updateQuote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const quote = await Quote.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    // Cannot update sent, accepted, or rejected quotes
    if (["sent", "viewed", "accepted", "rejected"].includes(quote.status)) {
      return next(
        new AppError(
          `Cannot update quote with status: ${quote.status}. Create a new quote or duplicate this one.`,
          400
        )
      );
    }

    // Update allowed fields
    const allowedFields = [
      "customer",
      "items",
      "discount",
      "discountType",
      "taxRate",
      "validUntil",
      "terms",
      "notes",
      "internalNotes",
      "paymentTerms",
      "depositRequired",
      "depositPercentage",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        quote[field] = req.body[field];
      }
    });

    await quote.save();
    await quote.populate("createdBy", "name email");

    res.status(200).json({
      status: "success",
      message: "Quote updated successfully",
      data: { quote },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete quote
 * DELETE /api/v1/vendors/quotes/:id
 */
export const deleteQuote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const quote = await Quote.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    // Can only delete draft quotes
    if (quote.status !== "draft") {
      return next(new AppError("Can only delete draft quotes", 400));
    }

    await Quote.findByIdAndDelete(quote._id);

    res.status(200).json({
      status: "success",
      message: "Quote deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send quote
 * POST /api/v1/vendors/quotes/:id/send
 */
export const sendQuote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const quote = await Quote.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    if (quote.status !== "draft") {
      return next(new AppError("Quote has already been sent", 400));
    }

    // Sending a quote answers an enquiry: counts toward the plan's monthly lead replies
    await assertWithinLimit(req, "leadRepliesPerMonth");

    await quote.send(req.user._id);

    // Send quote email to customer
    try {
      const customerEmail = quote.client?.email || quote.customerEmail;
      const customerName = quote.client?.name || quote.customerName || "Customer";
      if (customerEmail) {
        const validUntil = quote.validUntil
          ? new Date(quote.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : "30 days from today";
        const itemsHtml = (quote.items || [])
          .map(
            (item) =>
              `<tr>
                <td style="padding:8px;border:1px solid #e5e7eb;">${item.description || item.name}</td>
                <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${quote.currency || "NGN"} ${((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString()}</td>
              </tr>`
          )
          .join("");
        await sendEmailDirect({
          to: customerEmail,
          subject: `Quote #${quote.quoteNumber} from ${vendor.businessName || vendor.displayName}`,
          html: `
            <h2>Quote from ${vendor.businessName || vendor.displayName}</h2>
            <p>Hi ${customerName},</p>
            <p>Please find your quote below:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Description</th>
                  <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">Amount</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                <tr>
                  <td style="padding:8px;border:1px solid #e5e7eb;"><strong>Total</strong></td>
                  <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;"><strong>${quote.currency || "NGN"} ${(quote.total || 0).toLocaleString()}</strong></td>
                </tr>
              </tfoot>
            </table>
            <p><strong>Quote Number:</strong> #${quote.quoteNumber}</p>
            <p><strong>Valid Until:</strong> ${validUntil}</p>
            ${quote.notes ? `<p><strong>Notes:</strong> ${quote.notes}</p>` : ""}
            <p>To accept this quote or ask questions, please contact us.</p>
            <p>Thank you for considering our services!</p>
            <p><em>${vendor.businessName || vendor.displayName}</em></p>
          `,
        });
      }
    } catch (emailError) {
      logger.error("Failed to send quote email:", emailError.message);
    }

    res.status(200).json({
      status: "success",
      message: "Quote sent successfully",
      data: { quote },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Duplicate quote
 * POST /api/v1/vendors/quotes/:id/duplicate
 */
export const duplicateQuote = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const quote = await Quote.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    const duplicatedQuote = await quote.duplicate();
    await duplicatedQuote.populate("createdBy", "name email");

    res.status(201).json({
      status: "success",
      message: "Quote duplicated successfully",
      data: { quote: duplicatedQuote },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark quote as viewed (public endpoint)
 * POST /api/v1/quotes/:id/view
 */
export const markAsViewed = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    await quote.markAsViewed();

    res.status(200).json({
      status: "success",
      message: "Quote marked as viewed",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept quote (public endpoint)
 * POST /api/v1/quotes/:id/accept
 */
export const acceptQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    if (quote.isExpired) {
      return next(new AppError("Quote has expired", 400));
    }

    await quote.accept();

    // Update lead status if linked
    if (quote.lead) {
      await Lead.findByIdAndUpdate(quote.lead, {
        status: "negotiating",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Quote accepted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject quote (public endpoint)
 * POST /api/v1/quotes/:id/reject
 */
export const rejectQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id);

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    await quote.reject();

    res.status(200).json({
      status: "success",
      message: "Quote rejected",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get quote statistics
 * GET /api/v1/vendors/quotes/stats
 */
export const getQuoteStats = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { startDate, endDate } = req.query;

    const stats = await Quote.getStatistics(
      vendor._id,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    // Get acceptance rate
    const acceptanceRate = await Quote.getAcceptanceRate(vendor._id);

    // Get expiring quotes
    const expiring = await Quote.getExpiring(vendor._id, 7);

    res.status(200).json({
      status: "success",
      data: {
        stats: {
          ...stats,
          acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        },
        expiring: expiring.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get expiring quotes
 * GET /api/v1/vendors/quotes/expiring
 */
export const getExpiringQuotes = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ owner: req.user._id });

    if (!vendor) {
      return next(new AppError("Vendor profile not found", 404));
    }

    const { days = 7 } = req.query;

    const quotes = await Quote.getExpiring(vendor._id, parseInt(days));

    res.status(200).json({
      status: "success",
      results: quotes.length,
      data: { quotes },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public quote (for customer viewing)
 * GET /api/v1/quotes/:id/public
 */
export const getPublicQuote = async (req, res, next) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate(
        "vendor",
        "businessName displayName logo phone email address socialMedia"
      )
      .select("-internalNotes -createdBy -sentBy");

    if (!quote) {
      return next(new AppError("Quote not found", 404));
    }

    // Auto-mark as viewed
    if (quote.status === "sent") {
      await quote.markAsViewed();
    }

    res.status(200).json({
      status: "success",
      data: { quote },
    });
  } catch (error) {
    next(error);
  }
};
