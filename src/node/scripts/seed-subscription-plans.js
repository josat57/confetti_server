import mongoose from "mongoose";
import dotenv from "dotenv";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import { ensurePlans } from "../services/plan-catalogue.service.js";

dotenv.config();

/**
 * Reset subscription plans to the catalogue defaults (config/plans.js).
 *
 * The API already creates missing plans at startup without touching prices
 * admins have changed. Run this only to put every catalogue plan back to its
 * default price and features. Old plan names are retired, not deleted, so
 * existing subscriptions keep their history.
 *
 * Usage:
 *   node scripts/seed-subscription-plans.js
 */
async function seedPlans() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const summary = await ensurePlans({ force: true });
    console.log("Plans reset to catalogue defaults:", summary);

    const plans = await SubscriptionPlan.find({}).sort({ planType: 1, sortOrder: 1 }).lean();
    for (const plan of plans) {
      const ngn = plan.pricing.find((p) => p.currency === "NGN");
      console.log(
        `${plan.isActive ? "active " : "retired"}  ${plan.planType.padEnd(8)} ${plan.planName.padEnd(14)} ₦${(ngn?.amount ?? 0).toLocaleString()}/month`
      );
    }
    process.exitCode = 0;
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

seedPlans();
