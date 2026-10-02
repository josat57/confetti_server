import AIPlanActionsService from "../services/ai-plan-actions.service.js";
import { getUserContext } from "./universal-ai-planner.controller.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const requireAuth = (userContext) => {
  if (!userContext.isAuthenticated) {
    throw new AppError("Authentication required", 401);
  }
};

/**
 * Download a plan as PDF or JSON
 * GET /api/v1/ai-planner/plans/:planId/export?format=pdf|json
 * planId: saved planId, guest session token or share token
 */
export const exportPlan = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    const format = String(req.query.format || "pdf").toLowerCase();
    const { buffer, contentType, filename } = await AIPlanActionsService.exportPlan({
      resultId: req.params.planId,
      userContext,
      format,
    });
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.status(200).end(buffer);
  } catch (error) {
    logger.error("Plan export failed:", error);
    next(error);
  }
};

/**
 * Email a read-only link to a saved plan
 * POST /api/v1/ai-planner/plans/:planId/share  { email, message? }
 */
export const sharePlan = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    requireAuth(userContext);
    const email = String(req.body.email || "").trim();
    if (!EMAIL_RE.test(email)) {
      return next(new AppError("A valid email address is required", 400));
    }
    const message = String(req.body.message || "").slice(0, 1000);
    const senderName =
      req.user?.name ||
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ") ||
      req.vendor?.businessName ||
      undefined;

    const { shareUrl } = await AIPlanActionsService.sharePlan({
      planId: req.params.planId,
      userContext,
      email,
      message,
      senderName,
    });
    res.status(200).json({ status: "success", data: { shareUrl, sharedWith: email } });
  } catch (error) {
    logger.error("Plan share failed:", error);
    next(error);
  }
};

/**
 * Draft a quote from a saved plan's budget (vendors)
 * POST /api/v1/ai-planner/plans/:planId/quote  { customerName, customerEmail, customerPhone? }
 */
export const convertPlanToQuote = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    requireAuth(userContext);
    const name = String(req.body.customerName || "").trim();
    const email = String(req.body.customerEmail || "").trim();
    if (!name || !EMAIL_RE.test(email)) {
      return next(new AppError("Customer name and a valid email are required", 400));
    }
    const quote = await AIPlanActionsService.convertPlanToQuote({
      planId: req.params.planId,
      userContext,
      user: req.user,
      customer: { name, email, phone: req.body.customerPhone },
    });
    res.status(201).json({
      status: "success",
      data: { quoteId: quote._id, quoteNumber: quote.quoteNumber },
    });
  } catch (error) {
    logger.error("Plan to quote conversion failed:", error);
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Chat sessions
// ---------------------------------------------------------------------------

/** POST /api/v1/ai-planner/sessions  { title? } */
export const createChatSession = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    requireAuth(userContext);
    const session = await AIPlanActionsService.createSession({
      userContext,
      title: req.body.title,
    });
    res.status(201).json({ status: "success", data: { session } });
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/ai-planner/sessions */
export const listChatSessions = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    requireAuth(userContext);
    const sessions = await AIPlanActionsService.listSessions({
      userContext,
      limit: req.query.limit,
    });
    res.status(200).json({ status: "success", data: { sessions } });
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/ai-planner/sessions/:sessionId */
export const getChatSession = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    requireAuth(userContext);
    const session = await AIPlanActionsService.getSession({
      sessionId: req.params.sessionId,
      userContext,
    });
    res.status(200).json({ status: "success", data: { session } });
  } catch (error) {
    if (error.name === "CastError") return next(new AppError("Chat session not found", 404));
    next(error);
  }
};

/** POST /api/v1/ai-planner/sessions/:sessionId/messages  { message } */
export const sendChatSessionMessage = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    requireAuth(userContext);
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) return next(new AppError("Message is required", 400));
    if (message.length > 2000) {
      return next(new AppError("Message is too long (max 2000 characters)", 400));
    }
    const result = await AIPlanActionsService.sendSessionMessage({
      sessionId: req.params.sessionId,
      userContext,
      message,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    if (error.name === "CastError") return next(new AppError("Chat session not found", 404));
    next(error);
  }
};

/** POST /api/v1/ai-planner/sessions/:sessionId/generate-plan */
export const generatePlanFromChatSession = async (req, res, next) => {
  try {
    const userContext = await getUserContext(req);
    requireAuth(userContext);
    const result = await AIPlanActionsService.generatePlanFromSession({
      sessionId: req.params.sessionId,
      userContext,
      ipAddress: req.ip,
    });
    res.status(201).json({ status: "success", data: result });
  } catch (error) {
    if (error.name === "CastError") return next(new AppError("Chat session not found", 404));
    logger.error("Plan generation from chat failed:", error);
    next(error);
  }
};
