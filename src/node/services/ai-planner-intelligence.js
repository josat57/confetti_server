/**
 * Deterministic planning intelligence for the universal AI planner.
 *
 * These methods are mixed into UniversalAIService.prototype (see the end of
 * universal-ai.service.js) and replace the former placeholder methods. They
 * derive their output from the request (budget, dates, guest count, theme),
 * from market insights / vendor matches produced earlier in the pipeline, and
 * from the user's own history in the database — no random or canned data.
 */
import AIPlan from "../models/ai-plan.model.js";
import Event from "../models/event.model.js";
import MarketInsight from "../models/market-insight.model.js";
import AIPlannerUsage from "../models/ai-planner-usage.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

const DAY = 24 * 60 * 60 * 1000;

// ─── Small helpers ───────────────────────────────────────────────────────────

export const budgetAmount = (budget) => {
  if (typeof budget === "number") return budget;
  if (typeof budget === "string") return Number(budget.replace(/[^\d.]/g, "")) || 0;
  return Number(budget?.amount ?? budget?.total ?? budget?.max ?? 0) || 0;
};

const budgetCurrency = (budget) => (typeof budget === "object" && budget?.currency) || "NGN";

const round = (n, step = 1) => Math.round(n / step) * step;
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const riskLevel = (score) => (score >= 0.6 ? "high" : score >= 0.35 ? "medium" : "low");
const toDate = (d) => {
  const date = d ? new Date(d) : null;
  return date && !isNaN(date) ? date : null;
};
const weeksUntil = (d) => {
  const date = toDate(d);
  return date ? Math.floor((date - Date.now()) / (7 * DAY)) : null;
};

/** Read a trend direction from the heterogeneous market-insight payloads. */
const trendDirection = (value) => {
  const s = String(value?.trend ?? value?.direction ?? value ?? "").toLowerCase();
  if (/(ris|increas|up|high|grow|surge)/.test(s)) return "rising";
  if (/(fall|decreas|down|low|declin|drop)/.test(s)) return "falling";
  return "stable";
};

// Nigeria-centric calendar (the platform's primary market): wet season and
// the December "detty December" / Easter peaks drive demand and logistics risk.
const SEASON = {
  peakMonths: new Set([11, 3]), // December, April (0-based: 11 = Dec, 3 = Apr)
  highMonths: new Set([9, 10, 0]), // Oct, Nov, Jan
  rainyMonths: new Set([4, 5, 6, 8]), // May–Jul, Sep
};

const seasonOf = (date) => {
  const d = toDate(date);
  if (!d) return { label: "unknown", demandMultiplier: 1, rainy: false };
  const m = d.getMonth();
  if (SEASON.peakMonths.has(m)) return { label: "peak", demandMultiplier: 1.2, rainy: false };
  if (SEASON.highMonths.has(m)) return { label: "high", demandMultiplier: 1.1, rainy: false };
  if (SEASON.rainyMonths.has(m)) return { label: "rainy", demandMultiplier: 0.95, rainy: true };
  return { label: "off-peak", demandMultiplier: 0.9, rainy: false };
};

// Typical share of budget per category by event type (used when the plan has no breakdown)
const CATEGORY_SHARES = {
  wedding: { venue: 0.3, catering: 0.3, photography: 0.1, decoration: 0.12, entertainment: 0.08, attire: 0.05, other: 0.05 },
  corporate: { venue: 0.35, catering: 0.3, "audio-visual": 0.15, decoration: 0.05, entertainment: 0.05, other: 0.1 },
  birthday: { venue: 0.25, catering: 0.35, decoration: 0.15, entertainment: 0.15, other: 0.1 },
  default: { venue: 0.3, catering: 0.3, decoration: 0.12, entertainment: 0.1, photography: 0.08, other: 0.1 },
};
const sharesFor = (eventType) => CATEGORY_SHARES[String(eventType || "").toLowerCase()] || CATEGORY_SHARES.default;

// Theme → palette / mood vocabulary
const THEMES = {
  rustic: { palette: ["#8B5E3C", "#D9C5A0", "#6B8E23", "#F5F0E6"], moods: ["rustic", "warm wood", "natural greenery"] },
  modern: { palette: ["#1F2937", "#F9FAFB", "#9CA3AF", "#D4AF37"], moods: ["minimalist", "clean lines", "metallic accents"] },
  vintage: { palette: ["#C9A9A6", "#EAD7C3", "#7D6B5D", "#B7A57A"], moods: ["vintage", "lace", "antique details"] },
  elegant: { palette: ["#FFFFFF", "#D4AF37", "#1C1C1C", "#E8E1D9"], moods: ["elegant", "black tie", "gold accents"] },
  garden: { palette: ["#A3C585", "#F6E7CB", "#E8A0BF", "#FFFFFF"], moods: ["garden", "florals", "soft pastels"] },
  beach: { palette: ["#F4E1C1", "#4FB0C6", "#FFFFFF", "#F08A5D"], moods: ["coastal", "breezy fabrics", "shells and driftwood"] },
  traditional: { palette: ["#008751", "#FFFFFF", "#D4AF37", "#7B1E1E"], moods: ["traditional", "aso-ebi coordination", "cultural motifs"] },
  bohemian: { palette: ["#C97C5D", "#E9C46A", "#264653", "#F4A261"], moods: ["bohemian", "macramé", "layered textures"] },
};
const EVENT_THEME_DEFAULT = { wedding: "elegant", corporate: "modern", birthday: "garden", social: "bohemian" };
const themeFor = (theme, eventType) => {
  const key = String(theme || "").toLowerCase();
  const match = Object.keys(THEMES).find((t) => key.includes(t));
  return THEMES[match || EVENT_THEME_DEFAULT[String(eventType || "").toLowerCase()] || "elegant"];
};

// ─── Mixin ───────────────────────────────────────────────────────────────────

export const aiPlannerIntelligence = {
  // ── Usage limits ──────────────────────────────────────────────────────────

  /**
   * Guest (unauthenticated) rate limiting: sliding windows keyed by guest
   * session token or IP. Redis is used when available so limits hold across
   * instances; otherwise an in-process store is used.
   */
  async checkGuestRateLimits(userContext, { ipAddress } = {}) {
    const key = userContext?.guestSessionToken || ipAddress;
    if (!key) return true; // nothing to key on (e.g. internal calls)

    const limits = [
      { window: 60 * 60, max: Number(process.env.GUEST_AI_PLANS_PER_HOUR) || 3, label: "hour" },
      { window: 24 * 60 * 60, max: Number(process.env.GUEST_AI_PLANS_PER_DAY) || 10, label: "day" },
    ];

    for (const { window, max, label } of limits) {
      const count = await this.incrementGuestCounter(`guest_ai_limit:${label}:${key}`, window);
      if (count > max) {
        throw new AppError(
          `Guest limit reached (${max} plans per ${label}). Sign up for a free account to generate more plans.`,
          429
        );
      }
    }
    return true;
  },

  async incrementGuestCounter(redisKey, windowSeconds) {
    try {
      if (this.redis?.status === "ready") {
        const count = await this.redis.incr(redisKey);
        if (count === 1) await this.redis.expire(redisKey, windowSeconds);
        return count;
      }
    } catch (error) {
      logger.warn("Guest limit Redis error, using in-process counter", { error: error.message });
    }
    this._guestCounters ||= new Map();
    const now = Date.now();
    let entry = this._guestCounters.get(redisKey);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowSeconds * 1000 };
      this._guestCounters.set(redisKey, entry);
      if (this._guestCounters.size > 100000) {
        for (const [k, v] of this._guestCounters) if (v.resetAt <= now) this._guestCounters.delete(k);
      }
    }
    entry.count += 1;
    return entry.count;
  },

  /** Plans generated this calendar month (shared counter with the planner AI endpoints). */
  async getMonthlyUsage(userId, month) {
    try {
      if (!userId) return 0;
      const [year, mon] = String(month || new Date().toISOString().slice(0, 7)).split("-").map(Number);
      const usage = await AIPlannerUsage.findOne({ planner: userId, usageType: "generate-plan", month: mon, year }).lean();
      return usage?.count || 0;
    } catch (error) {
      logger.error("Failed to get monthly usage:", error);
      return 0;
    }
  },

  async recordPlanUsage(userContext) {
    if (!userContext?.isAuthenticated || !userContext.userId) return;
    try {
      await AIPlannerUsage.incrementUsage(userContext.userId, "generate-plan");
    } catch (error) {
      logger.warn("Failed to record AI plan usage", { error: error.message });
    }
  },

  // ── History ───────────────────────────────────────────────────────────────

  /**
   * The user's past plans (saved AI plans + events they plan/organise),
   * normalised to { eventType, budget, currency, guestCount, location, date, theme, status, source }.
   */
  async getUserHistory(userContext) {
    try {
      if (!userContext?.userId) return [];
      const userId = userContext.userId;
      const [plans, events] = await Promise.all([
        AIPlan.find({ userId }).sort({ createdAt: -1 }).limit(25).select("originalRequest status createdAt").lean(),
        Event.find({ $or: [{ planner: userId }, { organizer: userId }, { createdBy: userId }] })
          .sort({ createdAt: -1 })
          .limit(25)
          .select("eventType budget guestCount location startDate status theme createdAt")
          .lean(),
      ]);
      const fromPlans = plans.map((p) => ({
        source: "ai_plan",
        eventType: p.originalRequest?.eventType,
        budget: budgetAmount(p.originalRequest?.budget),
        currency: budgetCurrency(p.originalRequest?.budget),
        guestCount: p.originalRequest?.guestCount,
        location: p.originalRequest?.location?.city || p.originalRequest?.location,
        date: p.originalRequest?.date?.startDate || p.originalRequest?.date,
        theme: p.originalRequest?.preferences?.theme,
        status: p.status,
        createdAt: p.createdAt,
      }));
      const fromEvents = events.map((e) => ({
        source: "event",
        eventType: e.eventType,
        budget: budgetAmount(e.budget),
        currency: budgetCurrency(e.budget),
        guestCount: e.guestCount,
        location: e.location?.city || e.location?.address,
        date: e.startDate,
        theme: e.theme,
        status: e.status,
        createdAt: e.createdAt,
      }));
      return [...fromPlans, ...fromEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      logger.error("Failed to get user history:", error);
      return [];
    }
  },

  // ── Visual ────────────────────────────────────────────────────────────────

  async generateColorPalette(params) {
    return themeFor(params?.theme, params?.eventType).palette;
  },

  async generateMoodBoardConcepts(params) {
    return themeFor(params?.theme, params?.eventType).moods;
  },

  async generateLayoutSuggestions(params) {
    const guests = Number(params?.guestCount) || 0;
    const type = String(params?.eventType || "").toLowerCase();
    const layouts = [];
    if (type === "corporate") layouts.push(guests > 80 ? "Theatre seating facing a central stage" : "Boardroom or U-shape seating");
    else if (guests > 200) layouts.push("Banquet rounds of 10 with wide service aisles");
    else if (guests > 60) layouts.push("Mixed banquet rounds and a lounge area");
    else layouts.push("Long family-style tables for an intimate feel");
    layouts.push(type === "wedding" ? "Central dance floor with head table facing guests" : "Open floor plan around a focal feature");
    if (guests > 100) layouts.push("Separate buffet/serving stations to avoid queues");
    return layouts;
  },

  async analyzeCurrentDesignTrends(eventType) {
    const insight = await MarketInsight.findOne({ eventType }).sort({ "timeframe.endDate": -1 }).lean().catch(() => null);
    const fromInsights = (insight?.aiInsights?.predictions || [])
      .map((p) => p?.prediction || p?.title || p?.description || p)
      .filter((p) => typeof p === "string")
      .slice(0, 3);
    const base = {
      wedding: ["Monochrome florals", "Statement lighting installations", "Personalised signage"],
      corporate: ["Branded immersive backdrops", "Hybrid-ready stages", "Sustainable materials"],
      birthday: ["Balloon installations", "Interactive photo walls", "Themed dessert tables"],
    }[String(eventType || "").toLowerCase()] || ["Warm ambient lighting", "Natural textures", "Personal touches"];
    return {
      eventType,
      trends: [...new Set([...fromInsights, ...base])].slice(0, 5),
      source: fromInsights.length ? "market_insights" : "curated",
    };
  },

  async generatePhotoSuggestions(theme, eventType) {
    const t = themeFor(theme, eventType);
    const subject = String(eventType || "event").toLowerCase();
    return t.moods.map((mood) => ({
      concept: `${mood} ${subject} setup`,
      searchQuery: `${mood} ${subject} decor`,
      palette: t.palette,
    }));
  },

  async generateCustomMoodBoard(params) {
    const t = themeFor(params?.theme, params?.eventType);
    return {
      theme: params?.theme || "auto",
      palette: t.palette,
      sections: [
        { name: "Colour story", items: t.palette.map((hex) => ({ type: "swatch", value: hex })) },
        { name: "Textures & materials", items: t.moods.map((m) => ({ type: "keyword", value: m })) },
        { name: "Layout", items: (await this.generateLayoutSuggestions(params)).map((l) => ({ type: "note", value: l })) },
      ],
    };
  },

  async generate3DVisualization(params) {
    const guests = Number(params?.guestCount) || 100;
    // ~1.2 m² per seated guest plus 30% for stage, service and circulation
    const floorArea = Math.ceil(guests * 1.2 * 1.3);
    const tables = Math.ceil(guests / 10);
    return {
      type: "floorplan_spec",
      estimatedFloorAreaSqm: floorArea,
      tables: { count: tables, seatsPerTable: 10, shape: "round", diameterM: 1.8 },
      zones: [
        { zone: "Seating", sharePercent: 60 },
        { zone: "Stage / focal point", sharePercent: 15 },
        { zone: "Dance / open floor", sharePercent: 15 },
        { zone: "Service & circulation", sharePercent: 10 },
      ],
      palette: themeFor(params?.theme, params?.eventType).palette,
      note: "Specification for rendering in a floor-plan / 3D tool",
    };
  },

  async generateVirtualWalkthrough(params) {
    const stops = ["Arrival & welcome", "Reception / cocktail area", "Main hall", "Stage / focal point", "Dining", "Photo area", "Exit & send-off"];
    return {
      type: "walkthrough_script",
      stops: stops.map((name, i) => ({ order: i + 1, name, cue: `${name}: ${themeFor(params?.theme, params?.eventType).moods[i % 3]}` })),
    };
  },

  // ── Budget ────────────────────────────────────────────────────────────────

  /** Contingency sized by market pricing trend and how far out the event is. */
  async calculateRiskAdjustedBudget(budget, marketInsights) {
    const amount = budgetAmount(budget);
    if (!amount) return null;
    const pricing = trendDirection(marketInsights?.pricingTrends);
    const contingencyRate = pricing === "rising" ? 0.15 : pricing === "falling" ? 0.07 : 0.1;
    const contingency = round(amount * contingencyRate, 100);
    return {
      originalBudget: amount,
      currency: budgetCurrency(budget),
      pricingTrend: pricing,
      contingencyRate,
      contingency,
      plannableBudget: amount - contingency,
      rationale: `Reserve ${Math.round(contingencyRate * 100)}% because prices are ${pricing}`,
    };
  },

  async calculateSeasonalAdjustments(budget, eventType, eventDate) {
    const amount = budgetAmount(budget);
    const season = seasonOf(eventDate);
    if (!amount) return { season: season.label, multiplier: season.demandMultiplier };
    return {
      season: season.label,
      multiplier: season.demandMultiplier,
      expectedCostImpact: round(amount * (season.demandMultiplier - 1), 100),
      advice:
        season.demandMultiplier > 1
          ? "Peak demand: book key vendors early and lock prices in writing"
          : season.rainy
          ? "Rainy season: budget for tenting/indoor backup"
          : "Off-peak: negotiate package discounts",
    };
  },

  async identifyNegotiationOpportunities(marketInsights) {
    const supply = trendDirection(marketInsights?.supply ?? marketInsights?.marketData?.supply);
    const demand = trendDirection(marketInsights?.demandTrends ?? marketInsights?.marketData?.demand);
    const pricing = trendDirection(marketInsights?.pricingTrends);
    const opportunities = [];
    if (demand !== "rising") opportunities.push({ lever: "Off-peak pricing", detail: "Demand is not rising — ask for weekday/off-season rates" });
    if (supply === "rising") opportunities.push({ lever: "Competitive quotes", detail: "Vendor supply is growing — collect 3+ quotes" });
    if (pricing === "rising") opportunities.push({ lever: "Price lock", detail: "Prices are rising — pay deposits early to lock current rates" });
    opportunities.push({ lever: "Bundling", detail: "Bundle venue + catering or décor + lighting for package discounts" });
    return opportunities;
  },

  /** Category allocation at the current budget and at ±15%. */
  async generateBudgetSimulator(budget, eventType) {
    const amount = budgetAmount(budget);
    if (!amount) return null;
    const shares = sharesFor(eventType);
    const allocate = (total) =>
      Object.fromEntries(Object.entries(shares).map(([cat, share]) => [cat, round(total * share, 100)]));
    return {
      currency: budgetCurrency(budget),
      categoryShares: shares,
      scenarios: [
        { label: "Reduced (-15%)", total: round(amount * 0.85, 100), allocation: allocate(amount * 0.85) },
        { label: "Current", total: amount, allocation: allocate(amount) },
        { label: "Expanded (+15%)", total: round(amount * 1.15, 100), allocation: allocate(amount * 1.15) },
      ],
    };
  },

  async generateWhatIfScenarios(budget, { guestCount, eventType } = {}) {
    const amount = budgetAmount(budget);
    if (!amount) return null;
    const guests = Number(guestCount) || null;
    const catering = sharesFor(eventType).catering || 0.3;
    const scenarios = [
      { scenario: "Prices rise 10%", newTotal: round(amount * 1.1, 100), impact: "Trim décor/entertainment or use contingency" },
      { scenario: "Switch to off-peak date", newTotal: round(amount * 0.9, 100), impact: "Typical 10% saving on venue and vendors" },
    ];
    if (guests) {
      const perGuestCatering = (amount * catering) / guests;
      scenarios.push({
        scenario: "Guest count +20%",
        newTotal: round(amount + perGuestCatering * guests * 0.2, 100),
        impact: `≈${round(perGuestCatering, 10)} per extra guest in catering alone`,
      });
    }
    return scenarios;
  },

  // ── Timeline ──────────────────────────────────────────────────────────────

  async generateBasicTimeline(params) {
    const eventDate = toDate(params?.eventDate);
    const weeks = weeksUntil(eventDate);
    const at = (weeksBefore) => (eventDate ? new Date(eventDate - weeksBefore * 7 * DAY) : null);
    const phases = [
      { phase: "Foundation", weeksBefore: 16, tasks: ["Confirm budget", "Book venue", "Draft guest list"], priority: "high" },
      { phase: "Vendors", weeksBefore: 12, tasks: ["Book caterer", "Book photographer", "Book entertainment"], priority: "high" },
      { phase: "Details", weeksBefore: 6, tasks: ["Send invitations", "Finalise décor", "Plan menu tasting"], priority: "medium" },
      { phase: "Final checks", weeksBefore: 1, tasks: ["Confirm headcount", "Share run-of-show", "Pay balances"], priority: "high" },
    ];
    return phases.map((p) => {
      // Compress phases that are already overdue into "as soon as possible"
      const deadline = at(p.weeksBefore);
      const overdue = weeks !== null && weeks < p.weeksBefore;
      return {
        phase: p.phase,
        deadline: overdue ? new Date() : deadline,
        status: overdue ? "urgent" : "scheduled",
        tasks: p.tasks.map((task) => ({ task, priority: p.priority, deadline: overdue ? new Date() : deadline })),
      };
    });
  },

  async identifyRiskWindows(eventDate, eventType) {
    const date = toDate(eventDate);
    if (!date) return null;
    const weeks = weeksUntil(date);
    const windows = [];
    if (weeks !== null && weeks < 12) windows.push({ window: "Vendor booking", severity: weeks < 6 ? "high" : "medium", detail: `Only ${Math.max(weeks, 0)} weeks left — popular vendors may be booked` });
    const season = seasonOf(date);
    if (season.label === "peak") windows.push({ window: "Peak season", severity: "high", detail: "December/Easter demand — confirm bookings in writing" });
    if (season.rainy) windows.push({ window: "Rainy season", severity: "medium", detail: "Arrange covered/indoor backup for outdoor elements" });
    const dow = date.getDay();
    if (dow === 5 || dow === 6) windows.push({ window: "Weekend traffic", severity: "low", detail: "Schedule vendor load-in early" });
    if (String(eventType).toLowerCase() === "wedding" && weeks !== null && weeks < 8) windows.push({ window: "Invitations", severity: "medium", detail: "Send invitations now to give guests 6+ weeks notice" });
    return windows;
  },

  /** Likelihood of securing each recommended vendor given lead time and demand. */
  async calculateBookingProbabilities(vendorRecommendations, eventDate) {
    const recs = vendorRecommendations?.recommendations || (Array.isArray(vendorRecommendations) ? vendorRecommendations : []);
    if (!recs.length) return [];
    const weeks = weeksUntil(eventDate);
    const leadFactor = weeks === null ? 0.8 : clamp(weeks / 16, 0.3, 1);
    const seasonFactor = 1 / seasonOf(eventDate).demandMultiplier;
    return recs.map((r) => {
      const v = r.vendor || r;
      const rating = Number(v.rating) || 0;
      // Highly rated vendors are in higher demand
      const demandPenalty = rating >= 4.5 ? 0.85 : rating >= 4 ? 0.92 : 1;
      const p = clamp(leadFactor * seasonFactor * demandPenalty, 0.05, 0.98);
      return { vendorId: v.id || v._id, name: v.name || v.businessName, category: v.category, probability: Math.round(p * 100) / 100 };
    });
  },

  async generateDynamicAdjustments(eventDate) {
    const weeks = weeksUntil(eventDate);
    if (weeks === null) return null;
    if (weeks < 4) return { mode: "compressed", actions: ["Book remaining vendors this week", "Use vendors with confirmed availability", "Simplify custom décor"] };
    if (weeks < 12) return { mode: "accelerated", actions: ["Book critical vendors within 2 weeks", "Send save-the-dates now"] };
    return { mode: "standard", actions: ["Follow the standard phase schedule", "Review progress every 2 weeks"] };
  },

  async generateScenarioPlanning(eventDate) {
    const season = seasonOf(eventDate);
    const scenarios = [
      { scenario: "Key vendor cancels", plan: "Keep the second-ranked vendor in each category on standby" },
      { scenario: "Guest count changes ±20%", plan: "Agree per-head pricing and a final-count deadline with caterer" },
      { scenario: "Power outage", plan: "Confirm generator backup and fuel with the venue" },
    ];
    if (season.rainy) scenarios.push({ scenario: "Heavy rain", plan: "Book tents or an indoor alternative" });
    return scenarios;
  },

  async generateIntelligentAlerts(eventDate, eventType) {
    const date = toDate(eventDate);
    if (!date) return [];
    const alerts = [
      { weeksBefore: 12, message: "Book core vendors (venue, catering, photography)" },
      { weeksBefore: 6, message: "Send invitations and request RSVPs" },
      { weeksBefore: 2, message: "Confirm final headcount with caterer" },
      { weeksBefore: 0.43, message: "Share run-of-show with all vendors" }, // 3 days
    ];
    const now = Date.now();
    return alerts.map((a) => {
      const at = new Date(date - a.weeksBefore * 7 * DAY);
      return { ...a, alertAt: at, status: at < now ? "due" : "scheduled" };
    });
  },

  // ── Personalisation ───────────────────────────────────────────────────────

  async generatePersonalizedRecommendations({ userHistory = [], learningModel, clientAnalysis } = {}) {
    const recs = [];
    if (!userHistory.length) {
      recs.push("Save your plans so recommendations can learn from your events");
    } else {
      const types = userHistory.map((h) => h.eventType).filter(Boolean);
      const top = types.sort((a, b) => types.filter((t) => t === b).length - types.filter((t) => t === a).length)[0];
      if (top) recs.push(`You plan mostly ${top} events — start from your previous ${top} plan as a template`);
      const budgets = userHistory.map((h) => h.budget).filter((b) => b > 0);
      if (budgets.length >= 2) {
        const avg = budgets.reduce((s, b) => s + b, 0) / budgets.length;
        recs.push(`Your typical budget is about ${Math.round(avg).toLocaleString()} — compare new quotes against it`);
      }
      const cancelled = userHistory.filter((h) => h.status === "cancelled").length;
      if (cancelled) recs.push("Some past events were cancelled — confirm deposits are refundable");
    }
    const prefs = learningModel?.learningData?.preferences;
    if (prefs?.preferredEventTypes?.length) recs.push(`Preferred styles noted: ${prefs.preferredEventTypes.slice(0, 3).join(", ")}`);
    if (clientAnalysis?.personalizationOpportunities?.length) recs.push(...clientAnalysis.personalizationOpportunities.slice(0, 2));
    return recs;
  },

  async analyzeUserStylePreferences(userHistory = []) {
    if (!userHistory.length) return { detected: null, basedOnEvents: 0 };
    const count = (key) =>
      Object.entries(
        userHistory.reduce((acc, h) => {
          if (h[key]) acc[h[key]] = (acc[h[key]] || 0) + 1;
          return acc;
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .map(([value, n]) => ({ value, count: n }));
    const guests = userHistory.map((h) => Number(h.guestCount)).filter((g) => g > 0);
    const avgGuests = guests.length ? Math.round(guests.reduce((s, g) => s + g, 0) / guests.length) : null;
    return {
      detected: count("theme")[0]?.value || null,
      eventTypes: count("eventType"),
      themes: count("theme"),
      locations: count("location").slice(0, 5),
      typicalScale: avgGuests === null ? null : avgGuests > 200 ? "large" : avgGuests > 60 ? "medium" : "intimate",
      averageGuestCount: avgGuests,
      basedOnEvents: userHistory.length,
    };
  },

  async identifySuccessPatterns(userHistory = []) {
    const done = userHistory.filter((h) => ["completed", "published", "confirmed", "active"].includes(h.status));
    if (!done.length) return [];
    const patterns = [];
    const leadTimes = done
      .map((h) => (h.date && h.createdAt ? (new Date(h.date) - new Date(h.createdAt)) / (7 * DAY) : null))
      .filter((w) => w !== null && w > 0);
    if (leadTimes.length) {
      const avg = Math.round(leadTimes.reduce((s, w) => s + w, 0) / leadTimes.length);
      patterns.push({ pattern: "Lead time", detail: `Your successful events were planned about ${avg} weeks ahead` });
    }
    const types = [...new Set(done.map((h) => h.eventType).filter(Boolean))];
    if (types.length) patterns.push({ pattern: "Strength", detail: `Completed ${types.join(", ")} events` });
    return patterns;
  },

  async identifyImprovementAreas(userHistory = []) {
    const areas = [];
    const cancelled = userHistory.filter((h) => h.status === "cancelled").length;
    if (cancelled) areas.push({ area: "Cancellations", detail: `${cancelled} past event(s) cancelled — build in go/no-go checkpoints` });
    const shortLead = userHistory.filter(
      (h) => h.date && h.createdAt && (new Date(h.date) - new Date(h.createdAt)) / (7 * DAY) < 6
    ).length;
    if (shortLead) areas.push({ area: "Lead time", detail: `${shortLead} event(s) planned with under 6 weeks notice` });
    const noBudget = userHistory.filter((h) => !h.budget).length;
    if (noBudget) areas.push({ area: "Budgeting", detail: `${noBudget} plan(s) had no budget set` });
    return areas;
  },

  async generateAIPersonalityProfile(userContext) {
    const history = await this.getUserHistory(userContext);
    const style = await this.analyzeUserStylePreferences(history);
    const budgets = history.map((h) => h.budget).filter((b) => b > 0);
    const spread = budgets.length > 1 ? (Math.max(...budgets) - Math.min(...budgets)) / Math.max(...budgets) : 0;
    return {
      planningStyle: history.length >= 5 ? "experienced" : history.length ? "developing" : "new",
      budgetBehaviour: !budgets.length ? "unknown" : spread > 0.6 ? "flexible" : "consistent",
      preferredScale: style.typicalScale,
      preferredEventType: style.eventTypes?.[0]?.value || null,
      basedOnEvents: history.length,
    };
  },

  async generatePredictiveInsights(userContext) {
    const history = await this.getUserHistory(userContext);
    if (history.length < 2) return { available: false, reason: "Needs at least 2 past plans" };
    const months = history.map((h) => toDate(h.date)?.getMonth()).filter((m) => m !== undefined && m !== null);
    const busiest = months.length
      ? months.sort((a, b) => months.filter((m) => m === b).length - months.filter((m) => m === a).length)[0]
      : null;
    const budgets = history.map((h) => ({ b: h.budget, t: new Date(h.createdAt) })).filter((x) => x.b > 0).sort((a, b) => a.t - b.t);
    const budgetTrend =
      budgets.length >= 2 ? (budgets[budgets.length - 1].b > budgets[0].b ? "increasing" : budgets[budgets.length - 1].b < budgets[0].b ? "decreasing" : "stable") : "unknown";
    return {
      available: true,
      busiestMonth: busiest === null ? null : new Date(2000, busiest, 1).toLocaleString("en", { month: "long" }),
      budgetTrend,
      nextLikelyEventType: history[0]?.eventType || null,
    };
  },

  // ── Risk ──────────────────────────────────────────────────────────────────

  async assessFinancialRisks(budget, marketInsights, guestCount) {
    const amount = budgetAmount(budget);
    const factors = [];
    let score = 0.15;
    if (!amount) {
      score += 0.35;
      factors.push("No budget specified");
    }
    if (trendDirection(marketInsights?.pricingTrends) === "rising") {
      score += 0.2;
      factors.push("Vendor prices are rising");
    }
    if (amount && Number(guestCount) > 0 && amount / Number(guestCount) < 5000) {
      score += 0.25;
      factors.push("Low budget per guest");
    }
    score = clamp(score);
    return { score: Math.round(score * 100) / 100, level: riskLevel(score), factors };
  },

  async assessOperationalRisks(timeline, eventType) {
    const weeks = weeksUntil(timeline?.eventDate ?? timeline?.date);
    const phases = timeline?.phases || [];
    const urgent = phases.filter((p) => p.status === "urgent").length;
    const factors = [];
    let score = 0.15;
    if (weeks !== null && weeks < 4) {
      score += 0.45;
      factors.push("Less than 4 weeks to the event");
    } else if (weeks !== null && weeks < 8) {
      score += 0.25;
      factors.push("Less than 8 weeks to the event");
    }
    if (urgent) {
      score += 0.1 * Math.min(urgent, 3);
      factors.push(`${urgent} phase(s) already behind schedule`);
    }
    if ((timeline?.riskFactors || []).length) factors.push(...timeline.riskFactors.map((r) => r.risk || r).slice(0, 3));
    score = clamp(score);
    return { score: Math.round(score * 100) / 100, level: riskLevel(score), factors };
  },

  async assessMarketRisks(marketInsights) {
    if (!marketInsights || marketInsights.available === false) return { score: 0.3, level: "low", factors: ["No market data for this plan level"] };
    const demand = trendDirection(marketInsights.demandTrends);
    const pricing = trendDirection(marketInsights.pricingTrends);
    const factors = [];
    let score = 0.2;
    if (demand === "rising") {
      score += 0.2;
      factors.push("Demand is rising — availability may tighten");
    }
    if (pricing === "rising") {
      score += 0.2;
      factors.push("Prices are rising");
    }
    score = clamp(score);
    return { score: Math.round(score * 100) / 100, level: riskLevel(score), factors };
  },

  async assessSeasonalRisks(eventDate, eventType) {
    const season = seasonOf(eventDate);
    if (season.label === "unknown") return null;
    const score = season.label === "peak" ? 0.55 : season.rainy ? 0.45 : season.label === "high" ? 0.35 : 0.15;
    return {
      score,
      level: riskLevel(score),
      season: season.label,
      factors: season.rainy ? ["Rain can disrupt outdoor setups and travel"] : season.label === "peak" ? ["Peak demand for vendors and venues"] : [],
    };
  },

  async assessVendorRisks(vendorRecommendations) {
    const recs = vendorRecommendations?.recommendations || [];
    if (!recs.length) return { score: 0.6, level: "high", factors: ["No matching vendors found"] };
    const lowRated = recs.filter((r) => Number((r.vendor || r).rating) > 0 && Number((r.vendor || r).rating) < 3.5).length;
    const categories = new Set(recs.map((r) => (r.vendor || r).category).filter(Boolean));
    const factors = [];
    let score = 0.15;
    if (recs.length < 3) {
      score += 0.2;
      factors.push("Few vendor options");
    }
    if (lowRated) {
      score += 0.15;
      factors.push(`${lowRated} low-rated vendor(s) in the shortlist`);
    }
    if (categories.size < 3) {
      score += 0.1;
      factors.push("Vendor coverage limited to few categories");
    }
    score = clamp(score);
    return { score: Math.round(score * 100) / 100, level: riskLevel(score), factors };
  },

  async calculateOverallRiskScore(params) {
    const parts = await Promise.all([
      this.assessFinancialRisks(params.budget, params.marketInsights, params.guestCount),
      this.assessOperationalRisks(params.timeline, params.eventType),
      this.assessMarketRisks(params.marketInsights),
      this.assessSeasonalRisks(params.timeline?.eventDate ?? params.eventDate, params.eventType),
    ]);
    const scores = parts.filter(Boolean).map((p) => p.score);
    // Weighted towards the worst category so one severe risk isn't averaged away
    const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
    return Math.round(clamp(0.6 * avg + 0.4 * Math.max(...scores)) * 100) / 100;
  },

  async generateMitigationStrategies(params) {
    const [fin, ops, market] = await Promise.all([
      this.assessFinancialRisks(params.budget, params.marketInsights, params.guestCount),
      this.assessOperationalRisks(params.timeline, params.eventType),
      this.assessMarketRisks(params.marketInsights),
    ]);
    const strategies = ["Keep a 10–15% contingency budget", "Get every vendor agreement in writing"];
    if (fin.level !== "low") strategies.push("Prioritise must-have categories and trim optional extras first");
    if (ops.level !== "low") strategies.push("Book critical vendors immediately and consolidate suppliers");
    if (market.level !== "low") strategies.push("Lock prices with early deposits");
    return strategies;
  },

  async generateContingencyPlans(params) {
    const amount = budgetAmount(params.budget);
    return {
      reserve: amount ? { amount: round(amount * 0.1, 100), currency: budgetCurrency(params.budget) } : null,
      plans: await this.generateScenarioPlanning(params.timeline?.eventDate ?? params.eventDate),
    };
  },

  /** Deterministic sensitivity analysis: what total cost looks like under combined shocks. */
  async generateRiskSimulation(params) {
    const amount = budgetAmount(params.budget);
    if (!amount) return null;
    const shocks = [
      { name: "Best case", price: -0.05, guests: 0 },
      { name: "Expected", price: 0, guests: 0 },
      { name: "Price rise", price: 0.1, guests: 0 },
      { name: "Price rise + 15% more guests", price: 0.1, guests: 0.15 },
    ];
    const catering = sharesFor(params.eventType).catering || 0.3;
    return shocks.map((s) => {
      const total = amount * (1 + s.price) + amount * catering * s.guests;
      return { scenario: s.name, estimatedTotal: round(total, 100), overBudget: total > amount * 1.1 };
    });
  },

  async generatePredictiveRiskModeling(params) {
    const overall = await this.calculateOverallRiskScore(params);
    const weeks = weeksUntil(params.timeline?.eventDate ?? params.eventDate);
    return {
      currentRisk: overall,
      // Risk falls as bookings are confirmed; model a linear decline to the event date
      projection:
        weeks === null
          ? []
          : [0.75, 0.5, 0.25].map((f) => ({ weeksBeforeEvent: Math.max(0, Math.round(weeks * f)), expectedRisk: Math.round(overall * (0.5 + f / 2) * 100) / 100 })),
    };
  },

  // ── Learning model ────────────────────────────────────────────────────────

  async updateUserPreferences(learningModel, eventData, userContext) {
    const prefs = learningModel.learningData.preferences || {};
    const add = (list, value, max = 10) => {
      if (!value) return list || [];
      return [value, ...(list || []).filter((v) => v !== value)].slice(0, max);
    };
    prefs.preferredEventTypes = add(prefs.preferredEventTypes, eventData.eventType);
    if (eventData.theme) prefs.preferredThemes = add(prefs.preferredThemes, eventData.theme);
    const city = eventData.location?.city || (typeof eventData.location === "string" ? eventData.location : null);
    if (city) prefs.preferredLocations = add(prefs.preferredLocations, city);
    const amount = budgetAmount(eventData.budget);
    if (amount) {
      const n = learningModel.learningData.interactions.length;
      const prevAvg = Number(prefs.averageBudget) || amount;
      prefs.averageBudget = Math.round(prevAvg + (amount - prevAvg) / Math.max(n, 1));
    }
    learningModel.learningData.preferences = prefs;
    learningModel.markModified("learningData.preferences");
    learningModel.learningData.totalInteractions = learningModel.learningData.interactions.length;
    learningModel.learningData.lastTrainingDate = new Date();
  },

  /**
   * Confidence in the user's preference profile: grows with the number of
   * interactions and with how consistent they are (same event types / budgets).
   */
  async calculateModelAccuracy(learningModel) {
    const interactions = learningModel.learningData.interactions || [];
    const n = interactions.length;
    if (!n) return 0.5;
    const types = interactions.map((i) => i.eventType).filter(Boolean);
    const topShare = types.length ? Math.max(...Object.values(types.reduce((a, t) => ((a[t] = (a[t] || 0) + 1), a), {}))) / types.length : 0.5;
    const volume = 1 - Math.exp(-n / 10); // saturates around 30 interactions
    return Math.round(clamp(0.5 + 0.35 * volume + 0.1 * topShare, 0.5, 0.95) * 100) / 100;
  },

  // ── Vendors ───────────────────────────────────────────────────────────────

  categorizeRecommendations(recommendations = []) {
    const byCategory = recommendations.reduce((acc, r) => {
      const v = r.vendor || r;
      const cat = v.category || "other";
      acc[cat] ||= { count: 0, averageMatchScore: 0, vendors: [] };
      acc[cat].count += 1;
      acc[cat].vendors.push(v.name || v.businessName);
      acc[cat]._scoreSum = (acc[cat]._scoreSum || 0) + (Number(r.matchScore) || 0);
      acc[cat].averageMatchScore = Math.round((acc[cat]._scoreSum / acc[cat].count) * 100) / 100;
      return acc;
    }, {});
    for (const info of Object.values(byCategory)) delete info._scoreSum;
    return byCategory;
  },

  async generateCollaborationSuggestions(recommendations = []) {
    const byCat = this.categorizeRecommendations(recommendations);
    const pairs = [
      ["venue", "catering", "Venue-approved caterers simplify logistics and often come with package pricing"],
      ["photography", "videography", "Book photo and video from the same studio for consistent style"],
      ["decoration", "lighting", "Coordinate décor and lighting teams on one mood board"],
      ["entertainment", "audio-visual", "Have the DJ/band share the AV rider with the venue early"],
    ];
    const suggestions = pairs
      .filter(([a, b]) => byCat[a] && byCat[b])
      .map(([a, b, tip]) => ({ categories: [a, b], suggestion: tip }));
    for (const [cat, info] of Object.entries(byCat)) {
      if (info.count > 1) {
        suggestions.push({ categories: [cat], suggestion: `Compare ${info.count} ${cat} options side by side before booking` });
      }
    }
    return suggestions;
  },

  /** Next-best vendors per category that were analysed but not recommended. */
  async generateAlternativeOptions(vendors = [], recommendations = []) {
    const chosen = new Set(recommendations.map((r) => String((r.vendor || r).id || (r.vendor || r)._id)));
    const alternatives = {};
    for (const v of vendors) {
      if (chosen.has(String(v._id || v.id))) continue;
      const cat = v.category || "other";
      (alternatives[cat] ||= []).push({
        id: v._id || v.id,
        name: v.name || v.businessName,
        rating: v.rating,
        averagePrice: v.averagePrice,
      });
    }
    for (const cat of Object.keys(alternatives)) {
      alternatives[cat] = alternatives[cat].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
    }
    return alternatives;
  },

  // ── Trends ────────────────────────────────────────────────────────────────

  async generateTrendPredictionsForUser(params) {
    const city = params.location?.city || (typeof params.location === "string" ? params.location : null);
    const filter = { eventType: params.eventType };
    if (city) filter["location.city"] = new RegExp(`^${String(city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    const insight = await MarketInsight.findOne(filter).sort({ "timeframe.endDate": -1 }).lean().catch(() => null);

    const predictions = (insight?.aiInsights?.predictions || []).slice(0, 5);
    const since = new Date(Date.now() - 90 * DAY);
    const [recent, previous] = await Promise.all([
      Event.countDocuments({ eventType: params.eventType, createdAt: { $gte: since } }),
      Event.countDocuments({ eventType: params.eventType, createdAt: { $gte: new Date(since - 90 * DAY), $lt: since } }),
    ]).catch(() => [0, 0]);
    const change = previous ? Math.round(((recent - previous) / previous) * 100) : null;

    return {
      eventType: params.eventType,
      location: city,
      platformDemand: {
        eventsLast90Days: recent,
        previous90Days: previous,
        changePercent: change,
        direction: change === null ? "insufficient data" : change > 10 ? "rising" : change < -10 ? "falling" : "stable",
      },
      marketPredictions: predictions,
      source: insight ? "market_insights" : "platform_activity",
      generatedAt: new Date(),
    };
  },
};

export default aiPlannerIntelligence;
