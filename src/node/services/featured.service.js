import mongoose from "mongoose";
import FeaturedBoost from "../models/featured-boost.model.js";
import Vendor from "../models/vendor.model.js";
import Payment from "../models/payment.model.js";
import Subscription from "../models/subscription.model.js";
import Notification from "../models/notification.model.js";
import { FEATURED_BOOST } from "../config/plans.js";
import { AppError } from "../utils/AppError.js";
import { getActivePlan } from "./plan-access.service.js";

/**
 * Featured placement for vendors (roadmap Phase 6).
 * - Boosts: ₦5,000 a week (1–4 weeks), or a week from the plan's monthly credits
 *   (Business 1, Venue 2). A vendor's boosts run back to back.
 * - Each category has a fixed number of slots at any time, so search stays fair.
 * - Venue-plan vendors are always eligible for featured spots in venue searches.
 * - Search shows up to FEATURED_BOOST.slotsPerPage featured vendors on the first page,
 *   rotated at random among those eligible.
 */

const WEEK = 7 * 86400000;
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthEnd = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

const vendorFor = async (user) => {
  const vendor = await Vendor.findOne({ owner: user._id }).select("_id category status isActive isFeatured featuredUntil businessName name");
  if (!vendor) throw new AppError("Vendor profile not found", 404);
  return vendor;
};

class FeaturedService {
  /** When a new boost for this vendor would start: now, or when their current boosts end */
  async nextStart(vendorId) {
    const latest = await FeaturedBoost.findOne({ vendor: vendorId, status: "active", endsAt: { $gt: new Date() } })
      .sort({ endsAt: -1 })
      .select("endsAt")
      .lean();
    return latest ? latest.endsAt : new Date();
  }

  /** Slots in a category over [start, end): other vendors' boosts count, not this vendor's own */
  async slotInfo(category, start, end, vendorId) {
    const overlapping = await FeaturedBoost.find({
      category,
      status: "active",
      startsAt: { $lt: end },
      endsAt: { $gt: start },
      ...(vendorId ? { vendor: { $ne: vendorId } } : {}),
    })
      .select("vendor endsAt")
      .lean();
    const vendors = new Set(overlapping.map((b) => String(b.vendor)));
    const inUse = vendors.size;
    const cap = FEATURED_BOOST.slotsPerCategory;
    const soonest = overlapping.map((b) => b.endsAt).sort((a, b) => a - b)[0];
    return { category, cap, inUse, available: Math.max(cap - inUse, 0), soldOut: inUse >= cap, nextAvailableAt: inUse >= cap ? soonest : null };
  }

  /** Monthly credits from the plan (weeks), used this month, and when they expire */
  async credits(user) {
    const { plan } = await getActivePlan(user);
    const perMonth = plan?.limits?.featuredCreditsPerMonth || 0;
    const vendor = await Vendor.findOne({ owner: user._id }).select("_id").lean();
    const used = vendor
      ? await FeaturedBoost.countDocuments({ vendor: vendor._id, kind: "credit", creditMonth: monthKey(), status: "active" })
      : 0;
    return { perMonth, used, remaining: Math.max(perMonth - used, 0), expiresAt: monthEnd(), plan: plan?.key };
  }

  /** Everything the "Boost my listing" screen needs */
  async overview(user) {
    const vendor = await vendorFor(user);
    const start = await this.nextStart(vendor._id);
    const boosts = await FeaturedBoost.find({ vendor: vendor._id, status: "active" }).sort({ startsAt: -1 }).limit(20).lean();
    const now = new Date();
    const { plan } = await getActivePlan(user);
    return {
      category: vendor.category,
      eligible: vendor.status === "approved" && vendor.isActive !== false,
      featuredNow: boosts.some((b) => b.startsAt <= now && b.endsAt > now) || (vendor.isFeatured && vendor.featuredUntil > now),
      featuredUntil: boosts.length ? boosts.reduce((max, b) => (b.endsAt > max ? b.endsAt : max), boosts[0].endsAt) : vendor.featuredUntil,
      venueListing: !!plan?.features?.featuredVenueListing && vendor.category === "venue",
      price: { weekly: FEATURED_BOOST.weeklyPrice.NGN, currency: "NGN", maxWeeks: FEATURED_BOOST.maxWeeks },
      credits: await this.credits(user),
      slots: await this.slotInfo(vendor.category, start, new Date(start.getTime() + WEEK), vendor._id),
      nextStart: start,
      boosts: boosts.map((b) => ({ _id: b._id, kind: b.kind, weeks: b.weeks, startsAt: b.startsAt, endsAt: b.endsAt, amount: b.amount / 100 })),
    };
  }

  async assertCanBoost(vendor, weeks) {
    if (vendor.status !== "approved" || vendor.isActive === false) {
      throw new AppError("Your profile needs to be approved before it can be featured", 400);
    }
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > FEATURED_BOOST.maxWeeks) {
      throw new AppError(`Choose 1 to ${FEATURED_BOOST.maxWeeks} weeks`, 400);
    }
    const start = await this.nextStart(vendor._id);
    const end = new Date(start.getTime() + weeks * WEEK);
    const slots = await this.slotInfo(vendor.category, start, end, vendor._id);
    if (slots.soldOut) {
      const when = slots.nextAvailableAt ? ` A slot opens on ${new Date(slots.nextAvailableAt).toDateString()}.` : "";
      const error = new AppError(`Featured spots in your category are sold out for those dates.${when}`, 409);
      error.code = "FEATURED_SOLD_OUT";
      error.details = { nextAvailableAt: slots.nextAvailableAt };
      throw error;
    }
    return { start, end };
  }

  /** Pay for a boost: returns { paymentUrl } */
  async checkout(user, { weeks, paymentProvider = "flutterwave" }) {
    if (!["flutterwave", "paystack"].includes(paymentProvider)) throw new AppError("Invalid payment provider", 400);
    const vendor = await vendorFor(user);
    const w = Number(weeks);
    const { start, end } = await this.assertCanBoost(vendor, w);
    const amountMinor = FEATURED_BOOST.weeklyPrice.NGN * w * 100;
    const reference = `BOOST-${Date.now()}-${vendor._id}`;

    const boost = await FeaturedBoost.create({
      vendor: vendor._id,
      vendorUser: user._id,
      category: vendor.category,
      kind: "paid",
      weeks: w,
      startsAt: start,
      endsAt: end,
      status: "pending_payment",
      amount: amountMinor,
      currency: "NGN",
      reference,
    });
    const payment = await Payment.create({
      user: user._id,
      featuredBoost: boost._id,
      paymentType: "boost",
      amount: amountMinor,
      currency: "NGN",
      status: "pending",
      paymentMethod: paymentProvider,
      reference,
      transactionId: reference,
    });
    boost.payment = payment._id;
    await boost.save();

    const paymentService = (await import("./payment.service.js")).default;
    const paymentUrl = await paymentService.startProviderCheckout({
      provider: paymentProvider,
      amountMinor,
      currency: "NGN",
      reference,
      email: user.email,
      name: vendor.businessName || vendor.name,
      redirectUrl: `${paymentService.publicApiUrl()}/api/v1/featured/callback`,
      title: "Confetti featured listing",
      description: `${w} week${w > 1 ? "s" : ""} featured in ${vendor.category}`,
      meta: { kind: "boost", paymentId: payment._id.toString(), boostId: boost._id.toString() },
    });
    return { paymentUrl, reference, amount: amountMinor };
  }

  /** Payment arrived: start the boost (once per payment). Dates move if the vendor's earlier boosts ran on. */
  async activateFromPayment(paymentId) {
    const payment = await Payment.findById(paymentId);
    if (!payment?.featuredBoost) return null;
    const boost = await FeaturedBoost.findById(payment.featuredBoost);
    if (!boost || boost.status !== "pending_payment") return boost;
    const start = await this.nextStart(boost.vendor);
    boost.startsAt = start;
    boost.endsAt = new Date(start.getTime() + boost.weeks * WEEK);
    boost.status = "active";
    await boost.save();
    await this.syncVendor(boost.vendor);
    await Notification.createNotification({
      recipient: boost.vendorUser,
      type: "success",
      category: "payment",
      title: "Your listing is featured",
      message: `Featured until ${boost.endsAt.toDateString()}.`,
      actionUrl: "/vendor/dashboard/boost",
    }).catch(() => {});
    return boost;
  }

  /** Use one week of the plan's monthly credits */
  async useCredit(user) {
    const vendor = await vendorFor(user);
    const credits = await this.credits(user);
    if (credits.perMonth === 0) {
      const error = new AppError("Featured credits come with the Business and Venue plans", 403);
      error.code = "PLAN_FEATURE_REQUIRED";
      error.details = { feature: "featuredCredits", upgradeTo: "Business" };
      throw error;
    }
    if (credits.remaining === 0) throw new AppError("You've used this month's featured credits", 400);
    const { start, end } = await this.assertCanBoost(vendor, 1);
    const boost = await FeaturedBoost.create({
      vendor: vendor._id,
      vendorUser: user._id,
      category: vendor.category,
      kind: "credit",
      weeks: 1,
      startsAt: start,
      endsAt: end,
      status: "active",
      creditMonth: monthKey(),
    });
    await this.syncVendor(vendor._id);
    return boost;
  }

  /** Mirror the latest boost on Vendor.isFeatured/featuredUntil (keeps an admin's longer feature) */
  async syncVendor(vendorId) {
    const latest = await FeaturedBoost.findOne({ vendor: vendorId, status: "active" }).sort({ endsAt: -1 }).select("endsAt").lean();
    if (!latest) return;
    const vendor = await Vendor.findById(vendorId).select("isFeatured featuredUntil");
    if (!vendor) return;
    if (!vendor.featuredUntil || vendor.featuredUntil < latest.endsAt || !vendor.isFeatured) {
      await Vendor.updateOne({ _id: vendorId }, { $set: { isFeatured: true, featuredUntil: latest.endsAt } });
    }
  }

  /** Owners of vendors on the Venue plan (featured venue listing) */
  async venuePlanOwners() {
    return Subscription.distinct("user", {
      planType: "vendor",
      planName: { $in: [/^venue$/i, /^enterprise$/i] },
      status: { $in: ["active", "trial", "cancelled"] },
      endDate: { $gt: new Date() },
    });
  }

  /**
   * Featured vendors for a search: those matching `query` that are featured now (boost or admin)
   * or Venue-plan venues, shuffled, up to the page's featured slots.
   */
  async featuredForSearch(query, select) {
    const now = new Date();
    const venueOwners = await this.venuePlanOwners();
    const eligible = {
      $or: [
        { isFeatured: true, featuredUntil: { $gt: now } },
        ...(venueOwners.length ? [{ category: "venue", owner: { $in: venueOwners } }] : []),
      ],
    };
    const candidates = await Vendor.find({ $and: [query, eligible] })
      .select(select)
      .limit(100);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, FEATURED_BOOST.slotsPerPage);
  }

  /** Redirect back from the payment page */
  async verifyAndComplete(id, provider) {
    const paymentService = (await import("./payment.service.js")).default;
    const data = await paymentService.verifyProviderTransaction(id, provider);
    const meta = data.meta || data.metadata || {};
    const reference = data.tx_ref || data.reference;
    let payment = null;
    if (meta.paymentId && mongoose.isValidObjectId(meta.paymentId)) payment = await Payment.findById(meta.paymentId);
    if (!payment && reference) payment = await Payment.findOne({ reference });
    if (!payment?.featuredBoost) throw new AppError("Payment record not found", 404);
    await paymentService.completeSubscriptionPayment(payment._id, { provider, data });
    return FeaturedBoost.findById(payment.featuredBoost).lean();
  }
}

const featuredService = new FeaturedService();
export default featuredService;
