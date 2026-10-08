import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import { PLAN_CATALOGUE, YEARLY_MONTHS_CHARGED } from "../config/plans.js";
import { logger } from "../utils/logger.js";

/**
 * Keeps the SubscriptionPlan collection (prices admins can edit) in step with
 * config/plans.js. Bump CATALOGUE_VERSION when the catalogue's plans change:
 * documents from an older version are reset to the new defaults once, then
 * left alone so admin price edits survive restarts.
 */
export const CATALOGUE_VERSION = 2;

const toMinor = (amount) => Math.round(amount * 100);

const planDocFor = (planType, plan) => ({
  planType,
  planName: plan.key,
  displayName: plan.displayName,
  description: plan.description,
  pricing: Object.entries(plan.prices).map(([currency, amount]) => ({
    currency,
    amount,
    amountInMinorUnits: toMinor(amount),
  })),
  features: plan.featureList,
  limitations: [],
  billingCycle: "monthly",
  isActive: true,
  isPopular: !!plan.isPopular,
  sortOrder: plan.sortOrder,
});

const versionOf = (doc) => Number(doc.metadata?.get?.("catalogueVersion") ?? doc.metadata?.catalogueVersion ?? 0);

/**
 * Create missing catalogue plans, update plans written by an older catalogue,
 * and retire the old plan names (Basic, Starter, Professional, Enterprise …).
 * `force` resets every catalogue plan to its default price (used by the seed script).
 */
export const ensurePlans = async ({ force = false } = {}) => {
  const summary = { created: [], updated: [], retired: [] };

  for (const planType of ["vendor", "planner"]) {
    const plans = PLAN_CATALOGUE[planType];
    const keys = new Set(plans.map((p) => p.key));

    for (const plan of plans) {
      const doc = await SubscriptionPlan.findOne({ planType, planName: plan.key });
      if (!doc) {
        await SubscriptionPlan.create({ ...planDocFor(planType, plan), metadata: { catalogueVersion: CATALOGUE_VERSION } });
        summary.created.push(`${planType}/${plan.key}`);
      } else if (force || versionOf(doc) < CATALOGUE_VERSION) {
        doc.set(planDocFor(planType, plan));
        doc.set("metadata.catalogueVersion", CATALOGUE_VERSION);
        await doc.save();
        summary.updated.push(`${planType}/${plan.key}`);
      }
    }

    // Old names now served by a catalogue plan through its aliases
    const aliasNames = plans.flatMap((p) => p.aliases);
    const legacy = await SubscriptionPlan.find({ planType, isActive: true });
    for (const doc of legacy) {
      const name = doc.planName.toLowerCase();
      if (!keys.has(doc.planName) && aliasNames.includes(name) && versionOf(doc) < CATALOGUE_VERSION) {
        doc.isActive = false;
        doc.set("metadata.catalogueVersion", CATALOGUE_VERSION);
        await doc.save();
        summary.retired.push(`${planType}/${doc.planName}`);
      }
    }
  }

  if (summary.created.length || summary.updated.length || summary.retired.length) {
    logger.info("Subscription plans synced with catalogue", summary);
  }
  return summary;
};

/**
 * Price of a plan document for a currency and billing cycle, in major and minor units.
 * Yearly = YEARLY_MONTHS_CHARGED × monthly (2 months free).
 */
export const priceFor = (planDoc, currency = "NGN", billingCycle = "monthly") => {
  const monthly = planDoc.getPriceForCurrency
    ? planDoc.getPriceForCurrency(currency)
    : planDoc.pricing?.find((p) => p.currency === currency);
  if (!monthly) return null;
  const months = billingCycle === "yearly" ? YEARLY_MONTHS_CHARGED : 1;
  return {
    currency,
    billingCycle: billingCycle === "yearly" ? "yearly" : "monthly",
    amount: Math.round(monthly.amount * months * 100) / 100,
    amountInMinorUnits: monthly.amountInMinorUnits * months,
  };
};

/** End date for a period starting at `from` */
export const periodEnd = (billingCycle, from = new Date()) => {
  const end = new Date(from);
  end.setMonth(end.getMonth() + (billingCycle === "yearly" ? 12 : 1));
  return end;
};
