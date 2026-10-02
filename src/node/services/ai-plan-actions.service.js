import crypto from "crypto";
import PDFDocument from "pdfkit";
import UniversalAIService from "./universal-ai.service.js";
import PythonService from "./python.service.js";
import AIPlan from "../models/ai-plan.model.js";
import AIChatSession from "../models/ai-chat-session.model.js";
import Quote from "../models/quote.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

const MAX_SESSION_MESSAGES = 200;

const humanize = (key) =>
  String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Helvetica (pdfkit's built-in font) has no ₦ glyph, so spell the currency
const money = (amount, currency = "NGN") =>
  typeof amount === "number" && amount > 0
    ? `${currency} ${Math.round(amount).toLocaleString("en-US")}`
    : "Quote on request";

const shortDate = (value) => {
  const date = new Date(value);
  return isNaN(date.getTime())
    ? String(value || "")
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

class AIPlanActionsService {
  /** A saved plan the user owns, with its full content (rebuilding old plans). */
  async getOwnedPlan(planId, userContext) {
    if (!userContext.isAuthenticated) {
      throw new AppError("Sign in to save, share or quote a plan", 401);
    }
    const doc = await AIPlan.findOne({ planId, userId: userContext.userId });
    if (!doc) {
      throw new AppError(
        "Plan not found. Only saved plans can be shared or converted — save it first.",
        404
      );
    }
    const generatedPlan = await UniversalAIService.ensureGeneratedPlan(doc, userContext);
    return { doc, plan: generatedPlan };
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  /**
   * Export a plan (saved planId, guest session token or share token).
   * Returns { buffer, contentType, filename }.
   */
  async exportPlan({ resultId, userContext, format }) {
    const result = await UniversalAIService.getPlanResult({ resultId, userContext });
    if (!result?.eventPlan) {
      throw new AppError("Plan not found or expired", 404);
    }
    const plan = result.eventPlan;
    const eventType = plan.eventDetails?.eventType || "event";
    const base = `${eventType}-plan-${String(resultId).slice(0, 8)}`;

    if (format === "json") {
      return {
        buffer: Buffer.from(JSON.stringify(plan, null, 2)),
        contentType: "application/json",
        filename: `${base}.json`,
      };
    }
    if (format === "pdf") {
      return {
        buffer: await this.renderPlanPdf(plan),
        contentType: "application/pdf",
        filename: `${base}.pdf`,
      };
    }
    throw new AppError("Unsupported export format. Use pdf or json.", 400);
  }

  renderPlanPdf(plan) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "Event Plan" } });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const details = plan.eventDetails || {};
      const currency = plan.budgetBreakdown?.currency || details.budget?.currency || "NGN";
      const heading = (text) => {
        doc.moveDown(0.8).font("Helvetica-Bold").fontSize(14).fillColor("#4c1d95").text(text);
        doc.moveDown(0.3).font("Helvetica").fontSize(10).fillColor("#111827");
      };
      const bullet = (text) => doc.text(`•  ${text}`, { indent: 10 });

      // Title + event details
      doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827")
        .text(`${humanize(details.eventType || "Event")} Plan`);
      doc.font("Helvetica").fontSize(10).fillColor("#4b5563");
      const facts = [
        details.eventDate && `Date: ${shortDate(details.eventDate)}`,
        details.location?.fullLocation && `Location: ${details.location.fullLocation}`,
        details.guestCount && `Guests: ${details.guestCount}`,
        details.budget?.amount && `Budget: ${money(details.budget.amount, currency)}`,
      ].filter(Boolean);
      doc.text(facts.join("   ·   "));
      doc.fillColor("#111827");

      // Client insights
      const analysis = plan.clientAnalysis || {};
      const insightGroups = [
        ["Cultural considerations", analysis.culturalConsiderations],
        ["Easy to overlook", analysis.hiddenNeeds],
        ["What success looks like", analysis.successMetrics],
        ["Personal touches", analysis.personalizationOpportunities],
      ].filter(([, items]) => Array.isArray(items) && items.length);
      if (insightGroups.length) {
        heading("Client insights");
        for (const [title, items] of insightGroups) {
          doc.font("Helvetica-Bold").text(title).font("Helvetica");
          items.forEach(bullet);
        }
      }

      // Budget
      const breakdown = plan.budgetBreakdown?.breakdown;
      if (breakdown && typeof breakdown === "object") {
        heading("Budget breakdown");
        Object.entries(breakdown)
          .filter(([, cat]) => cat && typeof cat.amount === "number")
          .sort(([, a], [, b]) => (a.priority || 99) - (b.priority || 99))
          .forEach(([key, cat]) => {
            doc.font("Helvetica-Bold")
              .text(`${humanize(key)} — ${cat.percentage ?? 0}% — ${money(cat.amount, currency)}`)
              .font("Helvetica");
            (cat.items || []).forEach((item) =>
              bullet(`${item.name || item.item}: ${money(item.cost, currency)}`)
            );
          });
      }
      const tips = [
        ...(plan.budgetBreakdown?.validation?.recommendations || []),
        ...(plan.budgetOptimizationTips || []),
      ];
      if (tips.length) {
        doc.moveDown(0.3).font("Helvetica-Bold").text("Budget tips").font("Helvetica");
        tips.forEach(bullet);
      }

      // Vendors
      const recommendations = plan.vendorRecommendations?.recommendations || [];
      if (recommendations.length) {
        heading("Recommended vendors");
        recommendations.forEach((rec) => {
          const v = rec.vendor || {};
          const parts = [
            humanize(v.category),
            v.rating ? `rating ${v.rating}` : null,
            money(rec.estimatedCost, currency),
            typeof rec.matchScore === "number" ? `${Math.round(rec.matchScore * 100)}% match` : null,
          ].filter(Boolean);
          doc.font("Helvetica-Bold").text(v.name || "Vendor").font("Helvetica").text(parts.join(" · "));
        });
      }

      // Timeline
      const phases = plan.timeline?.phases;
      if (Array.isArray(phases) && phases.length) {
        heading("Planning timeline");
        phases.forEach((phase) => {
          doc.font("Helvetica-Bold").text(phase.phase).font("Helvetica");
          (phase.tasks || []).forEach((task) =>
            bullet(`${task.task}${task.deadline ? ` (due ${shortDate(task.deadline)})` : ""}`)
          );
        });
      } else if (Array.isArray(plan.timeline) && plan.timeline.length) {
        heading("Planning timeline");
        plan.timeline.forEach((item) => bullet(item.task || item.activity || item.name || ""));
      }

      // Risks
      const categories = plan.riskAnalysis?.riskCategories;
      if (categories) {
        const risks = Object.entries(categories).filter(([, v]) => v && v.level);
        if (risks.length) {
          heading("Risks");
          risks.forEach(([key, v]) => bullet(`${humanize(key)}: ${v.level}`));
          (plan.riskAnalysis.mitigationStrategies || []).forEach((tip) => bullet(`Mitigation: ${tip}`));
        }
      }

      doc.moveDown(1.5).fontSize(8).fillColor("#6b7280")
        .text(`Generated by Confetti AI Planner on ${shortDate(plan.generatedAt || new Date())}`);
      doc.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Share
  // ---------------------------------------------------------------------------

  /** Email a read-only link to a saved plan. Returns { shareUrl }. */
  async sharePlan({ planId, userContext, email, message, senderName }) {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new AppError("Sharing isn't configured (FRONTEND_URL is not set)", 503);
    }
    const { doc, plan } = await this.getOwnedPlan(planId, userContext);

    if (!doc.shareToken) {
      const shareToken = crypto.randomBytes(24).toString("hex"); // 48 hex chars
      await AIPlan.updateOne({ _id: doc._id }, { $set: { shareToken } });
      doc.shareToken = shareToken;
    }
    const shareUrl = `${frontendUrl.replace(/\/$/, "")}/ai-event-planner/result/${doc.shareToken}`;

    const details = plan.eventDetails || {};
    const eventLabel = humanize(details.eventType || "event");
    const { sendEmailDirect } = await import("../utils/email.js");
    try {
      await sendEmailDirect({
        to: email,
        subject: `${senderName || "Someone"} shared a ${eventLabel.toLowerCase()} plan with you`,
        html: `
          <h2>${escapeHtml(eventLabel)} plan</h2>
          <p>${escapeHtml(senderName || "Someone")} shared an event plan with you on Confetti.</p>
          ${message ? `<blockquote style="border-left:3px solid #8b5cf6;padding-left:12px;color:#374151;">${escapeHtml(message)}</blockquote>` : ""}
          <p>
            ${details.guestCount ? `${escapeHtml(details.guestCount)} guests · ` : ""}
            ${details.location?.fullLocation ? escapeHtml(details.location.fullLocation) : ""}
          </p>
          <p><a href="${shareUrl}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">View the plan</a></p>
        `,
        text: `${senderName || "Someone"} shared an event plan with you: ${shareUrl}${message ? `\n\n${message}` : ""}`,
      });
    } catch (error) {
      logger.error(`Share email failed for plan ${planId}: ${error.message}`);
      throw new AppError("Couldn't send the share email. Please try again later.", 502);
    }

    await AIPlan.updateOne(
      { _id: doc._id },
      { $push: { sharedWith: { email: email.toLowerCase(), sharedAt: new Date() } } }
    );
    logger.info("AI plan shared", { planId, userId: userContext.userId });
    return { shareUrl };
  }

  // ---------------------------------------------------------------------------
  // Convert to quote (vendors)
  // ---------------------------------------------------------------------------

  /** Draft quote from a saved plan's budget categories. Returns the Quote. */
  async convertPlanToQuote({ planId, userContext, user, customer }) {
    if (userContext.userType !== "vendor") {
      throw new AppError("Only vendors can convert a plan to a quote", 403);
    }
    const vendor = await Vendor.findOne({ owner: user._id });
    if (!vendor) throw new AppError("Vendor profile not found", 404);

    const { plan } = await this.getOwnedPlan(planId, userContext);
    const breakdown = plan.budgetBreakdown?.breakdown || {};
    const items = Object.entries(breakdown)
      .filter(([, cat]) => cat && typeof cat.amount === "number" && cat.amount > 0)
      .sort(([, a], [, b]) => (a.priority || 99) - (b.priority || 99))
      .map(([key, cat]) => ({
        description: humanize(key),
        category: key,
        quantity: 1,
        unitPrice: cat.amount,
        total: cat.amount,
        notes: (cat.items || [])
          .map((item) => item.name || item.item)
          .filter(Boolean)
          .join(", ")
          .slice(0, 500) || cat.purpose || undefined,
      }));
    if (items.length === 0) {
      throw new AppError("This plan has no budget breakdown to quote from", 422);
    }

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    const details = plan.eventDetails || {};

    const quote = await Quote.create({
      vendor: vendor._id,
      quoteNumber: await Quote.generateQuoteNumber(vendor._id),
      customer: {
        name: customer.name,
        email: customer.email,
        ...(customer.phone && { phone: customer.phone }),
      },
      items,
      subtotal,
      total: subtotal,
      currency: plan.budgetBreakdown?.currency || "NGN",
      validUntil,
      status: "draft",
      notes: `Drafted from AI plan: ${humanize(details.eventType || "event")}${
        details.guestCount ? `, ${details.guestCount} guests` : ""
      }. Review prices before sending.`,
      createdBy: user._id,
    });
    logger.info("AI plan converted to quote", { planId, quoteId: quote._id });
    return quote;
  }

  // ---------------------------------------------------------------------------
  // Chat sessions
  // ---------------------------------------------------------------------------

  async createSession({ userContext, title }) {
    return AIChatSession.create({
      userId: userContext.userId,
      userType: userContext.userType,
      title: (title || "Planning Session").slice(0, 200),
    });
  }

  async listSessions({ userContext, limit = 20 }) {
    return AIChatSession.find({ userId: userContext.userId, status: { $ne: "archived" } })
      .select("title status generatedPlanId createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(Math.min(Number(limit) || 20, 50));
  }

  async getSession({ sessionId, userContext }) {
    const session = await AIChatSession.findOne({ _id: sessionId, userId: userContext.userId });
    if (!session) throw new AppError("Chat session not found", 404);
    return session;
  }

  /** Store the user's message, get the assistant's reply, store it too. */
  async sendSessionMessage({ sessionId, userContext, message }) {
    const session = await this.getSession({ sessionId, userContext });
    const history = session.messages.map((m) => ({ role: m.role, content: m.content }));

    const chat = await UniversalAIService.chatGeneral({ userContext, message, history });

    session.messages.push({ role: "user", content: message });
    session.messages.push({ role: "assistant", content: chat.response });
    if (session.messages.length > MAX_SESSION_MESSAGES) {
      session.messages.splice(0, session.messages.length - MAX_SESSION_MESSAGES);
    }
    await session.save();

    const [userMessage, assistantMessage] = session.messages.slice(-2);
    return { userMessage, assistantMessage, suggestions: chat.suggestions || [] };
  }

  /**
   * Turn a conversation into a full AI plan: extract the event details with
   * the model, then run the normal plan generation. Returns { resultId }.
   */
  async generatePlanFromSession({ sessionId, userContext, ipAddress }) {
    const session = await this.getSession({ sessionId, userContext });
    const userText = session.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(-12000);
    if (!session.messages.some((m) => m.role === "user")) {
      throw new AppError("Describe your event in the chat first", 422);
    }

    const models = UniversalAIService.featureAccess[userContext.planLevel]?.aiModels || [];
    const model = ["gpt4", "claude", "gemini"].find((m) => models.includes(m) || models.includes("all"));
    if (!model) {
      throw new AppError(
        "Generating a plan from chat needs a plan that includes AI chat. Use the plan form instead.",
        403
      );
    }

    let extracted;
    try {
      const ai = await PythonService.queryAIModel({
        model,
        temperature: 0.1,
        maxTokens: 500,
        prompt: `Extract the event details the user gave in this conversation. Use null for anything not stated — do not guess.

CONVERSATION:
${userText}

Respond with this exact JSON schema:
{
  "eventType": "wedding|birthday|corporate|conference|graduation|anniversary|other or null",
  "eventDate": "YYYY-MM-DD or null",
  "guestCount": number or null,
  "budgetAmount": number or null,
  "currency": "NGN|USD|... or null",
  "city": "string or null",
  "state": "string or null",
  "country": "string or null",
  "theme": "string or null",
  "specialRequirements": "string or null"
}`,
      });
      extracted = ai.response && typeof ai.response === "object" ? ai.response : null;
    } catch (error) {
      throw new AppError("The AI assistant is unavailable right now. Please try again later.", 503);
    }
    if (!extracted) {
      throw new AppError("Couldn't read the event details from the chat", 422);
    }

    const missing = [
      !extracted.eventType && "event type",
      !extracted.guestCount && "guest count",
      !extracted.budgetAmount && "budget",
      !extracted.city && "city",
    ].filter(Boolean);
    if (missing.length) {
      throw new AppError(`Tell the assistant the ${missing.join(", ")} first, then try again.`, 422);
    }

    const plan = await UniversalAIService.generateComprehensivePlan({
      eventType: String(extracted.eventType).toLowerCase(),
      eventDate: extracted.eventDate || undefined,
      guestCount: Number(extracted.guestCount),
      budget: { amount: Number(extracted.budgetAmount), currency: extracted.currency || "NGN" },
      location: {
        city: extracted.city,
        state: extracted.state || "",
        country: extracted.country || "Nigeria",
      },
      theme: extracted.theme || undefined,
      specialRequirements: extracted.specialRequirements || undefined,
      userContext,
      ipAddress,
    });

    const resultId = plan.planId || plan.sessionToken;
    session.generatedPlanId = resultId;
    session.status = "completed";
    await session.save();
    return { resultId, autoSaved: plan.autoSaved === true };
  }
}

export default new AIPlanActionsService();
