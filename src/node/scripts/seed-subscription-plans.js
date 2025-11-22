import mongoose from "mongoose";
import dotenv from "dotenv";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";

dotenv.config();

/**
 * Seed Subscription Plans
 *
 * This script populates the database with initial subscription plans
 *
 * Usage:
 *   node scripts/seed-subscription-plans.js
 */

const plans = [
  // Vendor Plans
  {
    planType: "vendor",
    planName: "Basic",
    displayName: "Basic",
    description: "Perfect for vendors just starting out",
    pricing: [
      { currency: "NGN", amount: 0, amountInMinorUnits: 0 },
      { currency: "USD", amount: 0, amountInMinorUnits: 0 },
      { currency: "GBP", amount: 0, amountInMinorUnits: 0 },
      { currency: "EUR", amount: 0, amountInMinorUnits: 0 },
    ],
    features: [
      "Basic profile listing",
      "Up to 5 event listings per month",
      "Basic analytics dashboard",
      "Photo gallery (up to 10 images)",
      "Customer reviews and ratings",
      "Email support (48-hour response)",
      "Standard search visibility",
      "Mobile app access",
    ],
    limitations: [
      "No featured listings",
      "No booking calendar",
      "No priority support",
      "Limited analytics",
    ],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 1,
  },
  {
    planType: "vendor",
    planName: "Professional",
    displayName: "Professional",
    description: "Ideal for growing vendors and small businesses",
    pricing: [
      { currency: "NGN", amount: 7900, amountInMinorUnits: 790000 }, // ₦7,900
      { currency: "USD", amount: 14.99, amountInMinorUnits: 1499 }, // $14.99
      { currency: "GBP", amount: 11.99, amountInMinorUnits: 1199 }, // £11.99
      { currency: "EUR", amount: 12.99, amountInMinorUnits: 1299 }, // €12.99
    ],
    features: [
      "Enhanced profile listing with custom branding",
      "Unlimited event listings",
      "Featured in search results",
      "Photo gallery (up to 100 images)",
      "Video showcase (up to 5 videos)",
      "Advanced analytics and insights",
      "Customer review management",
      "Booking calendar with availability management",
      "Quote and proposal builder",
      "Lead management system",
      "Email notifications for inquiries",
      "Priority email support (24-hour response)",
      "Social media integration",
      "Portfolio showcase",
      "Client testimonials section",
    ],
    limitations: ["No API access", "No white-label options"],
    billingCycle: "monthly",
    isPopular: true,
    sortOrder: 2,
  },
  {
    planType: "vendor",
    planName: "Business",
    displayName: "Business",
    description: "For established vendors and growing businesses",
    pricing: [
      { currency: "NGN", amount: 14900, amountInMinorUnits: 1490000 }, // ₦14,900
      { currency: "USD", amount: 24.99, amountInMinorUnits: 2499 }, // $24.99
      { currency: "GBP", amount: 19.99, amountInMinorUnits: 1999 }, // £19.99
      { currency: "EUR", amount: 21.99, amountInMinorUnits: 2199 }, // €21.99
    ],
    features: [
      "Everything in Professional, plus:",
      "Premium profile listing with top placement",
      "Unlimited photo and video gallery",
      "Advanced booking system with contracts",
      "Payment processing integration",
      "Invoice and receipt generation",
      "Team member accounts (up to 5)",
      "Advanced analytics and reporting",
      "Customer relationship management (CRM)",
      "Email marketing tools",
      "Automated follow-ups",
      "Custom packages and pricing tiers",
      "Promotional campaigns",
      "Featured vendor badge",
      "Priority phone and email support (12-hour response)",
      "Integration with calendar apps",
      "Document storage (10GB)",
    ],
    limitations: ["No API access", "No dedicated account manager"],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 3,
  },
  {
    planType: "vendor",
    planName: "Enterprise",
    displayName: "Enterprise",
    description: "For large vendors and enterprise businesses",
    pricing: [
      { currency: "NGN", amount: 29900, amountInMinorUnits: 2990000 }, // ₦29,900
      { currency: "USD", amount: 49.99, amountInMinorUnits: 4999 }, // $49.99
      { currency: "GBP", amount: 39.99, amountInMinorUnits: 3999 }, // £39.99
      { currency: "EUR", amount: 44.99, amountInMinorUnits: 4499 }, // €44.99
    ],
    features: [
      "Everything in Business, plus:",
      "Unlimited team member accounts",
      "API access for custom integrations",
      "White-label options",
      "Custom branding throughout platform",
      "Dedicated account manager",
      "24/7 priority support (phone, email, chat)",
      "Advanced security features (SSO, 2FA)",
      "Multi-location management",
      "Advanced financial reporting",
      "Custom feature development",
      "Priority feature requests",
      "Vendor network access",
      "Exclusive partnership opportunities",
      "Marketing and promotion support",
      "Quarterly business reviews",
      "Custom training for your team",
      "Data migration assistance",
      "Unlimited storage",
    ],
    limitations: [],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 4,
  },

  // Event Planner Plans
  {
    planType: "planner",
    planName: "Starter",
    displayName: "Starter",
    description: "Perfect for personal events and first-time planners",
    pricing: [
      { currency: "NGN", amount: 0, amountInMinorUnits: 0 },
      { currency: "USD", amount: 0, amountInMinorUnits: 0 },
      { currency: "GBP", amount: 0, amountInMinorUnits: 0 },
      { currency: "EUR", amount: 0, amountInMinorUnits: 0 },
    ],
    features: [
      "Create up to 3 active events",
      "Basic event planning dashboard",
      "Guest list management (up to 50 guests per event)",
      "Simple budget tracker",
      "Basic vendor search and discovery",
      "Event timeline and checklist",
      "Email notifications",
      "5 event templates",
      "Mobile app access",
      "Email support (48-hour response)",
    ],
    limitations: [
      "No AI-powered recommendations",
      "No team collaboration",
      "No custom branding",
      "Limited analytics",
      "No document storage",
    ],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 1,
  },
  {
    planType: "planner",
    planName: "Professional",
    displayName: "Professional",
    description: "Ideal for professional event planners and small agencies",
    pricing: [
      { currency: "NGN", amount: 5900, amountInMinorUnits: 590000 }, // ₦5,900
      { currency: "USD", amount: 9.99, amountInMinorUnits: 999 }, // $9.99
      { currency: "GBP", amount: 7.99, amountInMinorUnits: 799 }, // £7.99
      { currency: "EUR", amount: 8.99, amountInMinorUnits: 899 }, // €8.99
    ],
    features: [
      "Unlimited active events",
      "Advanced event planning dashboard",
      "Unlimited guest management with RSVP tracking",
      "Advanced budget tracking with expense categories",
      "AI-powered vendor recommendations",
      "Vendor comparison and booking tools",
      "Seating chart designer",
      "Custom event timeline and milestones",
      "Task assignment and reminders",
      "Document storage (5GB)",
      "20+ premium event templates",
      "Event website builder",
      "QR code check-in system",
      "Real-time collaboration (up to 3 team members)",
      "Advanced analytics and reports",
      "Email and SMS notifications",
      "Priority email support (24-hour response)",
      "Mobile app with offline mode",
    ],
    limitations: [
      "Team size limited to 3 members",
      "No white-label options",
      "No API access",
    ],
    billingCycle: "monthly",
    isPopular: true,
    sortOrder: 2,
  },
  {
    planType: "planner",
    planName: "Business",
    displayName: "Business",
    description: "For growing event planning businesses and agencies",
    pricing: [
      { currency: "NGN", amount: 12900, amountInMinorUnits: 1290000 }, // ₦12,900
      { currency: "USD", amount: 19.99, amountInMinorUnits: 1999 }, // $19.99
      { currency: "GBP", amount: 15.99, amountInMinorUnits: 1599 }, // £15.99
      { currency: "EUR", amount: 17.99, amountInMinorUnits: 1799 }, // €17.99
    ],
    features: [
      "Everything in Professional, plus:",
      "Unlimited team members",
      "Advanced team collaboration with role-based permissions",
      "Client portal for event sharing",
      "Custom branding and white-label options",
      "Multi-event dashboard",
      "Advanced vendor management with contracts",
      "Payment tracking and invoicing",
      "Document storage (50GB)",
      "Unlimited event templates with custom builder",
      "Advanced seating chart with drag-and-drop",
      "Guest communication hub (email & SMS campaigns)",
      "Event registration and ticketing",
      "Sponsor and exhibitor management",
      "Custom forms and surveys",
      "Integration with calendar apps (Google, Outlook)",
      "CRM integration capabilities",
      "Advanced reporting and analytics",
      "Export data to Excel/PDF",
      "Priority phone and email support (12-hour response)",
      "Onboarding and training session",
    ],
    limitations: ["No dedicated account manager", "No API access"],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 3,
  },
  {
    planType: "planner",
    planName: "Enterprise",
    displayName: "Enterprise",
    description: "For large event planning agencies and corporate event teams",
    pricing: [
      { currency: "NGN", amount: 24900, amountInMinorUnits: 2490000 }, // ₦24,900
      { currency: "USD", amount: 49.99, amountInMinorUnits: 4999 }, // $49.99
      { currency: "GBP", amount: 39.99, amountInMinorUnits: 3999 }, // £39.99
      { currency: "EUR", amount: 44.99, amountInMinorUnits: 4499 }, // €44.99
    ],
    features: [
      "Everything in Business, plus:",
      "Unlimited storage",
      "Dedicated account manager",
      "24/7 priority support (phone, email, chat)",
      "Custom feature development",
      "API access for integrations",
      "Advanced security features (SSO, 2FA)",
      "Custom SLA agreements",
      "Multi-location event management",
      "Advanced financial reporting",
      "Custom integrations with your tools",
      "Vendor network access",
      "Event marketing tools",
      "Social media integration",
      "Live streaming integration",
      "Virtual and hybrid event support",
      "Advanced attendee engagement tools",
      "Post-event analytics and feedback",
      "Quarterly business reviews",
      "Priority feature requests",
      "Custom training for your team",
      "Data migration assistance",
    ],
    limitations: [],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 4,
  },
];

async function seedPlans() {
  console.log("\n" + "=".repeat(70));
  console.log("Seeding Subscription Plans");
  console.log("=".repeat(70));

  try {
    // Connect to MongoDB
    console.log("\n🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing plans (optional - comment out if you want to keep existing)
    console.log("\n🗑️  Clearing existing plans...");
    await SubscriptionPlan.deleteMany({});
    console.log("✅ Existing plans cleared");

    // Insert new plans
    console.log("\n📝 Inserting subscription plans...");
    const createdPlans = await SubscriptionPlan.insertMany(plans);
    console.log(`✅ Inserted ${createdPlans.length} plans`);

    // Display created plans
    console.log("\n📋 Created Plans:");
    console.log("=".repeat(70));

    for (const plan of createdPlans) {
      console.log(`\n${plan.planType.toUpperCase()} - ${plan.planName}`);
      console.log(`  Description: ${plan.description}`);
      console.log(`  Pricing:`);
      plan.pricing.forEach((p) => {
        const formatted =
          p.currency === "NGN"
            ? `₦${p.amount.toLocaleString()}`
            : `$${p.amount.toFixed(2)}`;
        console.log(
          `    ${p.currency}: ${formatted} (${p.amountInMinorUnits} minor units)`
        );
      });
      console.log(`  Features: ${plan.features.length}`);
      console.log(`  Popular: ${plan.isPopular ? "Yes" : "No"}`);
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅ Seeding completed successfully!");
    console.log("=".repeat(70));

    console.log("\n📝 Next Steps:");
    console.log("1. Restart your application to use the new plans");
    console.log("2. Test registration with different plans");
    console.log("3. Use admin endpoints to manage plans:");
    console.log("   - GET /api/v1/subscription-plans");
    console.log("   - POST /api/v1/subscription-plans (admin)");
    console.log("   - PATCH /api/v1/subscription-plans/:id (admin)");
    console.log("   - PATCH /api/v1/subscription-plans/:id/pricing (admin)");
    console.log("=".repeat(70) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run seeding
seedPlans();
