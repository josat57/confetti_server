import mongoose from "mongoose";
import Subscription from "../models/subscription.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import {
  cheapestPlanWhere,
  freePlan,
  planTypeForRole,
  resolvePlan,
} from "../config/plans.js";

/**
 * What a user's plan allows, and how much of it they've used.
 * Usage is counted from the data itself (photos, events, team members …),
 * so it can't drift from reality the way stored counters do.
 */

// Cancelled subscriptions keep their plan until endDate (the query also requires endDate > now)
const ACTIVE_STATUSES = ["active", "trial", "cancelled"];
const oid = (v) => new mongoose.Types.ObjectId((v?._id || v).toString());
const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/** Human labels for limit messages */
const RESOURCE_LABELS = {
  portfolioPhotos: "portfolio photos",
  leadRepliesPerMonth: "lead replies this month",
  teamMembers: "team members",
  activeEvents: "active events",
  events: "events",
  guestsPerEvent: "guests for this event",
};

export class PlanLimitError extends AppError {
  constructor({ resource, limit, used, plan, planType }) {
    const upgrade = cheapestPlanWhere(
      planType,
      (p) => p.level > plan.level && (p.limits[resource] === null || p.limits[resource] > limit)
    );
    const label = RESOURCE_LABELS[resource] || resource;
    const message =
      limit === 0
        ? `Your ${plan.displayName} plan doesn't include ${label}.${upgrade ? ` Upgrade to ${upgrade.displayName} to add them.` : ""}`
        : `You've reached the ${limit} ${label} included in your ${plan.displayName} plan.${upgrade ? ` Upgrade to ${upgrade.displayName} for more.` : ""}`;
    super(message, 403);
    this.code = "PLAN_LIMIT_REACHED";
    this.details = { resource, limit, used, plan: plan.key, planType, upgradeTo: upgrade?.key || null };
  }
}

export class PlanFeatureError extends AppError {
  constructor({ feature, plan, planType, label }) {
    const upgrade = cheapestPlanWhere(planType, (p) => p.features[feature]);
    super(
      upgrade
        ? `${label || "This feature"} is available on the ${upgrade.displayName} plan and above.`
        : `${label || "This feature"} isn't available on your plan.`,
      403
    );
    this.code = "PLAN_FEATURE_REQUIRED";
    this.details = { feature, plan: plan?.key || null, planType, upgradeTo: upgrade?.key || null };
  }
}

/**
 * The user's current plan. Expired or unpaid subscriptions fall back to the free plan.
 * Returns { plan, planType, subscription }.
 */
export const getActivePlan = async (user) => {
  const planType = planTypeForRole(user?.role);
  if (planType === "client" || !user?._id && !user?.id) {
    return { plan: freePlan(planType), planType, subscription: null };
  }

  const subscription = await Subscription.findOne({
    user: user._id || user.id,
    planType,
    status: { $in: ACTIVE_STATUSES },
    endDate: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  let plan = subscription ? resolvePlan(planType, subscription.planName) : null;
  if (subscription && !plan) {
    // A custom plan created by an admin: inherit limits from metadata.basePlan if set
    const SubscriptionPlan = (await import("../models/subscriptionPlan.model.js")).default;
    const custom = await SubscriptionPlan.findOne({ planType, planName: subscription.planName }).lean();
    const basePlan = custom?.metadata?.basePlan || custom?.metadata?.get?.("basePlan");
    plan = resolvePlan(planType, basePlan);
    if (!plan) {
      logger.warn("Subscription plan not in catalogue; using free plan limits", {
        planType,
        planName: subscription.planName,
      });
    }
  }
  return { plan: plan || freePlan(planType), planType, subscription };
};

/** getActivePlan, cached for the request */
export const getRequestPlan = async (req) => {
  if (!req._planAccess) req._planAccess = await getActivePlan(req.user);
  return req._planAccess;
};

// ---------------------------------------------------------------------------
// Usage counters
// ---------------------------------------------------------------------------

const vendorFor = async (user) => {
  const Vendor = (await import("../models/vendor.model.js")).default;
  return Vendor.findOne({ owner: user._id || user.id }).select("_id photos").lean();
};

const countUsage = {
  /** Photos across portfolio items and the profile gallery */
  async portfolioPhotos(user) {
    const vendor = await vendorFor(user);
    if (!vendor) return 0;
    const Portfolio = (await import("../models/portfolio.model.js")).default;
    const [row] = await Portfolio.aggregate([
      { $match: { vendor: vendor._id } },
      { $group: { _id: null, n: { $sum: { $size: { $ifNull: ["$photos", []] } } } } },
    ]);
    return (row?.n || 0) + (vendor.photos?.length || 0);
  },

  /**
   * Distinct enquiries the vendor answered this month: conversations they wrote in,
   * plus quotes they sent.
   */
  async leadRepliesPerMonth(user) {
    const since = startOfMonth();
    const Message = (await import("../models/message.model.js")).default;
    const conversations = await Message.distinct("conversation", {
      sender: oid(user),
      createdAt: { $gte: since },
      conversation: { $exists: true },
    });
    const vendor = await vendorFor(user);
    let quotes = 0;
    if (vendor) {
      const Quote = (await import("../models/quote.model.js")).default;
      quotes = await Quote.countDocuments({ vendor: vendor._id, sentAt: { $gte: since } });
    }
    return conversations.length + quotes;
  },

  /** Members and open invitations, excluding the owner */
  async teamMembers(user, planType) {
    if (planType === "vendor") {
      const vendor = await vendorFor(user);
      if (!vendor) return 0;
      const VendorTeamMember = (await import("../models/vendor-team-member.model.js")).default;
      return VendorTeamMember.countDocuments({
        vendor: vendor._id,
        role: { $ne: "owner" },
        status: { $in: ["pending", "active"] },
      });
    }
    const TeamMember = (await import("../models/team-member.model.js")).default;
    const TeamInvitation = (await import("../models/team-invitation.model.js")).default;
    const plannerId = oid(user);
    const [members, invitations] = await Promise.all([
      TeamMember.countDocuments({ planner: plannerId, status: "active" }),
      TeamInvitation.countDocuments({ planner: plannerId, status: "pending", expiresAt: { $gt: new Date() } }),
    ]);
    return members + invitations;
  },

  /** Events that aren't finished: not cancelled/completed, and not in the past */
  async activeEvents(user) {
    const Event = (await import("../models/event.model.js")).default;
    const me = oid(user);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Event.countDocuments({
      $and: [
        { $or: [{ createdBy: me }, { planner: me }] },
        { status: { $in: ["draft", "published"] } },
        {
          $or: [
            { endDate: { $gte: now } },
            { endDate: null, startDate: { $gte: today } },
            { endDate: null, startDate: null },
          ],
        },
      ],
    });
  },

  /** All events the user created that weren't cancelled */
  async events(user) {
    const Event = (await import("../models/event.model.js")).default;
    return Event.countDocuments({ createdBy: oid(user), status: { $ne: "cancelled" } });
  },

  /** Guest list entries plus registered users invited on the event itself */
  async guestsPerEvent(user, planType, { eventId } = {}) {
    if (!eventId || !mongoose.isValidObjectId(eventId)) return 0;
    const Guest = (await import("../models/guest.model.js")).default;
    const Event = (await import("../models/event.model.js")).default;
    const [listed, event] = await Promise.all([
      Guest.countDocuments({ event: oid(eventId) }),
      Event.findById(eventId).select("guests").lean(),
    ]);
    return listed + (event?.guests?.length || 0);
  },
};

export const countResourceUsage = (resource, user, planType, opts) =>
  countUsage[resource](user, planType, opts);

/**
 * Throw PlanLimitError if adding `adding` more of `resource` would go over the plan.
 * No-op for resources the plan doesn't limit.
 */
export const assertWithinLimit = async (req, resource, { adding = 1, eventId } = {}) => {
  const { plan, planType } = await getRequestPlan(req);
  if (!plan || !(resource in plan.limits)) return;
  const limit = plan.limits[resource];
  if (limit === null || limit === undefined) return;

  const used = await countUsage[resource](req.user, planType, { eventId });
  if (used + adding > limit) {
    throw new PlanLimitError({ resource, limit, used, plan, planType });
  }
};

/** Middleware form of assertWithinLimit. `options(req)` can supply { adding, eventId }. */
export const enforcePlanLimit = (resource, options = () => ({})) => async (req, res, next) => {
  try {
    await assertWithinLimit(req, resource, options(req) || {});
    next();
  } catch (error) {
    next(error);
  }
};

/** Throw PlanFeatureError unless the user's plan includes `feature` */
export const assertFeature = async (req, feature, { label } = {}) => {
  const { plan, planType } = await getRequestPlan(req);
  if (!plan?.features?.[feature]) {
    throw new PlanFeatureError({ feature, plan, planType, label });
  }
};

/** Middleware: the user's plan must include `feature` */
export const requirePlanFeature = (feature, { label } = {}) => async (req, res, next) => {
  try {
    await assertFeature(req, feature, { label });
    next();
  } catch (error) {
    next(error);
  }
};

/** Plan, limits and current usage for the subscription page and usage meters */
export const getUsageSummary = async (user) => {
  const { plan, planType, subscription } = await getActivePlan(user);
  const usage = {};
  for (const [resource, limit] of Object.entries(plan?.limits || {})) {
    if (!countUsage[resource] || resource === "guestsPerEvent") continue; // per event, not per account
    usage[resource] = {
      used: await countUsage[resource](user, planType),
      limit,
      label: RESOURCE_LABELS[resource] || resource,
    };
  }
  return {
    planType,
    plan: plan
      ? { key: plan.key, displayName: plan.displayName, level: plan.level, features: plan.features }
      : null,
    subscription: subscription
      ? {
          _id: subscription._id,
          planName: subscription.planName,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          endDate: subscription.endDate,
        }
      : null,
    usage,
  };
};

/**
 * Vendors on plans with a monthly lead-reply allowance: writing in a conversation
 * uses one reply the first time that month; later messages in it are free.
 */
export const assertLeadReplyAllowed = async (req, conversationId) => {
  if (req.user?.role !== "vendor") return;
  if (conversationId) {
    const Message = (await import("../models/message.model.js")).default;
    const repliedThisMonth = await Message.exists({
      conversation: oid(conversationId),
      sender: oid(req.user),
      createdAt: { $gte: startOfMonth() },
    });
    if (repliedThisMonth) return;
  }
  await assertWithinLimit(req, "leadRepliesPerMonth");
};

/** Creating an event: planners are limited by active events, clients by events in total */
export const assertCanCreateEvent = async (req) => {
  const { plan } = await getRequestPlan(req);
  if (!plan) return;
  const resource = "activeEvents" in plan.limits ? "activeEvents" : "events";
  await assertWithinLimit(req, resource);
};
