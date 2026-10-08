/**
 * Subscription plan catalogue: the single source of truth for what each plan
 * includes (levels, limits, features). Prices live in the SubscriptionPlan
 * collection so admins can change them; the defaults below seed it once
 * (see services/plan-catalogue.service.js ensurePlans).
 *
 * Limits: a number is the cap, `null` means unlimited, 0 means not included.
 * `planName` stored on Subscription documents may be an old name (Basic,
 * Professional, Starter, Enterprise …); `aliases` map those to these plans.
 */

/** Yearly billing charges this many months (2 months free) */
export const YEARLY_MONTHS_CHARGED = 10;

export const PLAN_CATALOGUE = {
  vendor: [
    {
      key: "Listing",
      displayName: "Listing",
      level: 1,
      aiLevel: 2,
      aiModels: ["local"],
      commissionRate: 0.05,
      prices: { NGN: 0, USD: 0, GBP: 0, EUR: 0 },
      description: "Get listed and start receiving enquiries",
      limits: { portfolioPhotos: 10, leadRepliesPerMonth: 5, teamMembers: 0 },
      features: { reviews: true },
      featureList: ["Profile and 10 portfolio photos", "5 lead replies a month", "Reviews", "5% per booking"],
      aliases: ["basic", "free"],
      sortOrder: 1,
    },
    {
      key: "Pro",
      displayName: "Pro",
      level: 2,
      aiLevel: 2,
      commissionRate: 0.03,
      prices: { NGN: 7500, USD: 9.99, GBP: 7.99, EUR: 8.99 },
      description: "For vendors taking bookings every month",
      limits: { portfolioPhotos: null, leadRepliesPerMonth: null, teamMembers: 0 },
      features: {
        reviews: true,
        leadsQuotesInvoices: true,
        availabilityCalendar: true,
        crm: true,
        verifiedBadge: true,
        basicAnalytics: true,
      },
      featureList: [
        "Unlimited leads, quotes and invoices",
        "Availability calendar and CRM",
        "Verified badge after an ID check",
        "Basic analytics",
        "3% per booking",
      ],
      aliases: ["professional"],
      isPopular: true,
      sortOrder: 2,
    },
    {
      key: "Business",
      displayName: "Business",
      level: 3,
      aiLevel: 3,
      commissionRate: 0.02,
      prices: { NGN: 20000, USD: 24.99, GBP: 19.99, EUR: 21.99 },
      description: "For teams that want more visibility",
      limits: { portfolioPhotos: null, leadRepliesPerMonth: null, teamMembers: 5, featuredCreditsPerMonth: 1 },
      features: {
        reviews: true,
        leadsQuotesInvoices: true,
        availabilityCalendar: true,
        crm: true,
        verifiedBadge: true,
        basicAnalytics: true,
        advancedAnalytics: true,
        aiProposal: true,
        vendorAI: true,
        featuredCredits: true,
      },
      featureList: [
        "Everything in Pro",
        "Team of up to 5",
        "Featured placement credits",
        "AI proposal writer, advanced analytics",
        "2% per booking",
      ],
      aliases: ["business"],
      sortOrder: 3,
    },
    {
      key: "Venue",
      displayName: "Venue",
      level: 4,
      aiLevel: 3,
      commissionRate: 0.02,
      prices: { NGN: 30000, USD: 39.99, GBP: 29.99, EUR: 34.99 },
      description: "For venues managing halls, holds and deposits",
      limits: { portfolioPhotos: null, leadRepliesPerMonth: null, teamMembers: 5, featuredCreditsPerMonth: 2 },
      features: {
        reviews: true,
        leadsQuotesInvoices: true,
        availabilityCalendar: true,
        crm: true,
        verifiedBadge: true,
        basicAnalytics: true,
        advancedAnalytics: true,
        aiProposal: true,
        vendorAI: true,
        featuredCredits: true,
        venueTools: true,
        featuredVenueListing: true,
        // Kept for vendors moved here from the old Enterprise plan
        apiAccess: true,
      },
      featureList: [
        "Everything in Business",
        "Venue calendar and booking management",
        "Featured venue listing",
        "Holds and deposit tracking",
        "2% per booking",
      ],
      aliases: ["enterprise"],
      sortOrder: 4,
    },
  ],
  planner: [
    {
      key: "Solo",
      displayName: "Solo",
      level: 1,
      aiLevel: 2,
      aiModels: ["local"],
      prices: { NGN: 0, USD: 0, GBP: 0, EUR: 0 },
      description: "Plan your first events for free",
      limits: { activeEvents: 2, teamMembers: 0 },
      features: { clientLists: true, guestLists: true },
      featureList: ["2 active events", "AI planner (local data)", "Client and guest lists"],
      aliases: ["starter", "basic", "free"],
      sortOrder: 1,
    },
    {
      key: "Studio",
      displayName: "Studio",
      level: 2,
      aiLevel: 3,
      prices: { NGN: 15000, USD: 19.99, GBP: 15.99, EUR: 17.99 },
      description: "For working planners with several clients",
      limits: { activeEvents: 15, teamMembers: 3 },
      features: {
        clientLists: true,
        guestLists: true,
        clientPortal: true,
        budgets: true,
        vendorCRM: true,
        fullAI: true,
        aiProposal: true,
      },
      featureList: ["15 active events, team of 3", "Client portal, budgets, vendor CRM", "Full AI planning and refinement"],
      aliases: ["professional", "business"],
      isPopular: true,
      sortOrder: 2,
    },
    {
      key: "Agency",
      displayName: "Agency",
      level: 3,
      aiLevel: 4,
      prices: { NGN: 40000, USD: 49.99, GBP: 39.99, EUR: 44.99 },
      description: "For agencies running many events at once",
      limits: { activeEvents: null, teamMembers: 15 },
      features: {
        clientLists: true,
        guestLists: true,
        clientPortal: true,
        budgets: true,
        vendorCRM: true,
        fullAI: true,
        aiProposal: true,
        brandedExports: true,
        apiAccess: true,
        prioritySupport: true,
      },
      featureList: ["Unlimited events, team of 15", "Branded proposals and exports", "API access, priority support"],
      aliases: ["enterprise"],
      sortOrder: 3,
    },
  ],
  // People planning their own event (role "user"). Per-event passes come in Phase 3.
  client: [
    {
      key: "Free",
      displayName: "Free",
      level: 1,
      aiLevel: 2,
      aiModels: ["local"],
      prices: { NGN: 0 },
      description: "Plan one event for free",
      limits: { events: 1, guestsPerEvent: 100 },
      features: { checklist: true, budgetOverview: true },
      featureList: ["1 event, AI plan from local data", "Guest list up to 100", "Vendor search and messaging", "Checklist and budget overview"],
      aliases: [],
      sortOrder: 1,
    },
  ],
};

/** Sold by the sales team (Phase 11); shown on pricing pages, no self-serve checkout */
export const CORPORATE_PLAN = {
  key: "Corporate",
  displayName: "Corporate",
  priceFrom: { NGN: 500000 },
  period: "year",
  featureList: ["Multiple events and budgets", "Vendor procurement and approvals", "Invoices in the company's name, reports"],
};

/** Which catalogue a user's role uses */
export const planTypeForRole = (role) =>
  role === "vendor" ? "vendor" : role === "user" ? "client" : "planner";

const byType = (planType) => PLAN_CATALOGUE[planType] || [];

/** Find a catalogue plan by its key or an old alias, case-insensitively */
export const resolvePlan = (planType, planName) => {
  const plans = byType(planType);
  if (!planName) return null;
  const name = String(planName).trim().toLowerCase();
  return (
    plans.find((p) => p.key.toLowerCase() === name) ||
    plans.find((p) => p.aliases.includes(name)) ||
    null
  );
};

export const freePlan = (planType) => byType(planType)[0] || null;

/** The cheapest plan of a type where `test(plan)` holds (for "upgrade to …" hints) */
export const cheapestPlanWhere = (planType, test) =>
  byType(planType).find((p) => test(p)) || null;

export const listPlans = (planType) => byType(planType);
