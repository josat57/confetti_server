/**
 * Nigerian Vendor + Subscription Seeder
 * Seeds 700 vendors across major Nigerian cities with realistic data,
 * subscription plans, and active subscriptions.
 *
 * Usage (inside container):
 *   node src/node/scripts/seed-nigeria-vendors.js
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

// ─── Models ──────────────────────────────────────────────────────────────────
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";

// ─── Config ──────────────────────────────────────────────────────────────────
const TOTAL_VENDORS = 700;
const VENDOR_PASSWORD = "Vendor@2024!";
const PLANNER_PASSWORD = "Planner@2024!";

// ─── Nigerian Cities ──────────────────────────────────────────────────────────
const CITIES = [
  { name: "Lagos", state: "Lagos", coords: [3.3792, 6.5244], weight: 28 },
  { name: "Abuja", state: "FCT", coords: [7.3986, 9.0765], weight: 18 },
  { name: "Port Harcourt", state: "Rivers", coords: [7.0498, 4.8156], weight: 11 },
  { name: "Kano", state: "Kano", coords: [8.5920, 12.0022], weight: 7 },
  { name: "Ibadan", state: "Oyo", coords: [3.9470, 7.3775], weight: 7 },
  { name: "Enugu", state: "Enugu", coords: [7.5086, 6.5244], weight: 5 },
  { name: "Benin City", state: "Edo", coords: [5.6037, 6.3350], weight: 4 },
  { name: "Uyo", state: "Akwa Ibom", coords: [7.9333, 5.0333], weight: 4 },
  { name: "Calabar", state: "Cross River", coords: [8.3333, 4.9583], weight: 3 },
  { name: "Warri", state: "Delta", coords: [5.7500, 5.5167], weight: 3 },
  { name: "Aba", state: "Abia", coords: [7.3667, 5.1070], weight: 2 },
  { name: "Owerri", state: "Imo", coords: [7.0328, 5.4836], weight: 2 },
  { name: "Abeokuta", state: "Ogun", coords: [3.3451, 7.1557], weight: 2 },
  { name: "Ilorin", state: "Kwara", coords: [4.5426, 8.4966], weight: 1 },
  { name: "Onitsha", state: "Anambra", coords: [6.7667, 6.1333], weight: 1 },
  { name: "Kaduna", state: "Kaduna", coords: [7.4396, 10.5272], weight: 1 },
  { name: "Jos", state: "Plateau", coords: [8.8583, 9.8965], weight: 1 },
  { name: "Asaba", state: "Delta", coords: [6.7482, 6.2028], weight: 1 },
  { name: "Akure", state: "Ondo", coords: [5.1961, 7.2526], weight: 1 },
  { name: "Makurdi", state: "Benue", coords: [8.5422, 7.7342], weight: 1 },
  { name: "Awka", state: "Anambra", coords: [7.0707, 6.2109], weight: 1 },
  { name: "Sokoto", state: "Sokoto", coords: [5.2476, 13.0059], weight: 1 },
  { name: "Lafia", state: "Nasarawa", coords: [8.5122, 8.4942], weight: 1 },
  { name: "Sapele", state: "Delta", coords: [5.6833, 5.9000], weight: 1 },
];

// ─── Category Config ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { category: "catering", businessType: "catering", weight: 13 },
  { category: "venue", businessType: "venue", weight: 11 },
  { category: "photography", businessType: "photography", weight: 11 },
  { category: "videography", businessType: "photography", weight: 8 },
  { category: "decoration", businessType: "decoration", weight: 9 },
  { category: "entertainment", businessType: "music", weight: 7 },
  { category: "florals", businessType: "decoration", weight: 6 },
  { category: "cake_desserts", businessType: "catering", weight: 6 },
  { category: "bar_services", businessType: "catering", weight: 5 },
  { category: "transportation", businessType: "other", weight: 5 },
  { category: "audio_visual", businessType: "other", weight: 4 },
  { category: "lighting", businessType: "other", weight: 4 },
  { category: "event_planning", businessType: "other", weight: 4 },
  { category: "rentals", businessType: "other", weight: 3 },
  { category: "security", businessType: "other", weight: 2 },
  { category: "invitations", businessType: "other", weight: 1 },
  { category: "favors_gifts", businessType: "other", weight: 1 },
];

// ─── Name Parts ───────────────────────────────────────────────────────────────
const BUSINESS_PREFIXES = [
  "Royal", "Elite", "Premium", "Grand", "Classic", "Luxury", "Divine",
  "Heritage", "Golden", "Silver", "Star", "Prestige", "Prime", "Top",
  "First", "Best", "Unique", "Modern", "Elegant", "Grace", "Glory",
  "Triumph", "Victory", "Noble", "Regal", "Majestic", "Excel", "Apex",
  "Zenith", "Crown", "Diamond", "Pearl", "Emerald", "Sapphire", "Crystal",
  "Brilliant", "Radiant", "Vibrant", "Dynamic", "Creative", "Iconic",
  "Signature", "Exclusive", "Ultimate", "Perfect", "Supreme", "Infinite",
  "Blessed", "Favour", "Grace", "Hope", "Faith", "Joy", "Miracle",
];

const NIGERIAN_NAMES = [
  "Adeyemi", "Okonkwo", "Babatunde", "Chukwuemeka", "Oluwaseun", "Nwosu",
  "Afolabi", "Eze", "Adeleke", "Chidi", "Okafor", "Nnamdi", "Adewale",
  "Emeka", "Obi", "Taiwo", "Kehinde", "Chioma", "Ngozi", "Amaka",
  "Ifeanyi", "Obiora", "Uche", "Kelechi", "Chinonso", "Tunde", "Sola",
  "Yemi", "Femi", "Gbenga", "Segun", "Lanre", "Bayo", "Kunle",
  "Wale", "Dele", "Remi", "Nike", "Shade", "Toyin", "Funmi",
  "Bisi", "Damilola", "Tolani", "Kolade", "Rotimi", "Biodun", "Dayo",
];

const CATEGORY_NOUNS = {
  catering: ["Catering", "Kitchen", "Cuisine", "Foods", "Caterers", "Chefs", "Buffet", "Culinary"],
  venue: ["Events Centre", "Hall", "Venue", "Gardens", "Plaza", "Arena", "Pavilion", "Manor"],
  photography: ["Photography", "Studios", "Photos", "Captures", "Lens", "Clicks", "Visuals", "Shoots"],
  videography: ["Films", "Productions", "Visuals", "Cinematics", "Media", "Videos", "Reels", "Shots"],
  decoration: ["Decor", "Decorations", "Events", "Designs", "Styling", "Interiors", "Artistry", "Themes"],
  entertainment: ["Entertainment", "Music", "Band", "DJ Services", "Artists", "Performers", "Live Events"],
  florals: ["Florals", "Flowers", "Bouquets", "Blooms", "Gardens", "Petals", "Floral Design"],
  cake_desserts: ["Cakes", "Bakery", "Confections", "Pastry", "Desserts", "Sweets", "Bakes"],
  bar_services: ["Bar Services", "Cocktails", "Mixology", "Bartending", "Drinks", "Beverages"],
  transportation: ["Transport", "Logistics", "Rides", "Chauffeur", "Fleet", "Travel", "Mobility"],
  audio_visual: ["Audio Visual", "AV Solutions", "Sound & Light", "Tech Events", "AV Pro"],
  lighting: ["Lighting", "Lights", "Illuminations", "Glow", "Luminary", "Bright Events"],
  event_planning: ["Events", "Planning Co.", "Concepts", "Coordination", "Management", "Productions"],
  security: ["Security", "Guard Services", "Safety", "Protection", "Shield", "Secure Events"],
  rentals: ["Rentals", "Hire", "Equipment", "Supplies", "Lease", "Furniture Hire"],
  invitations: ["Invitations", "Cards", "Stationery", "Prints", "Design Studio", "Printing"],
  favors_gifts: ["Gifts", "Favors", "Souvenirs", "Tokens", "Keepsakes", "Mementos"],
};

const STREETS = [
  "Ahmadu Bello Way", "Adeola Odeku Street", "Broad Street", "Herbert Macaulay Way",
  "Awolowo Road", "Akin Adesola Street", "Ozumba Mbadiwe Avenue", "Bishop Oluwole Street",
  "Bank Road", "Lagos Street", "Abuja Road", "Marina Drive", "Freedom Way",
  "Wuse Zone", "Garki District", "Maitama Avenue", "Asokoro Boulevard",
  "GRA Road", "New Layout", "Old GRA", "Trans Amadi Road", "Rumuola Road",
  "Ikwerre Road", "Elelenwo Street", "Rumuibekwe Road", "Woji Street",
  "Nnamdi Azikiwe Street", "Adeola Hopewell Street", "Acme Road",
  "Ikorodu Road", "Lagos-Ibadan Expressway", "Lekki-Epe Expressway",
  "Ring Road", "Mission Road", "Sapele Road", "Upper Siluko Road",
  "Ugbovo Street", "Sakponba Road", "Urubi Street", "Benin-Agbor Road",
  "Oron Road", "Abak Road", "Ikot Ekpene Road", "Aba Road",
  "Industry Road", "Oshodi-Apapa Expressway", "Bode Thomas Street",
];

const EVENT_TYPE_POOLS = [
  ["wedding", "birthday", "corporate"],
  ["wedding", "graduation", "birthday"],
  ["corporate", "conference", "other"],
  ["wedding", "corporate", "conference"],
  ["birthday", "graduation", "other"],
  ["wedding", "birthday", "graduation", "corporate"],
];

const FEATURES_BY_CATEGORY = {
  catering: ["Buffet Setup", "Finger Foods", "Continental Cuisine", "Nigerian Dishes", "Barbecue", "Live Cooking", "Waiter Service", "Halal Options", "Vegetarian Options"],
  venue: ["AC Hall", "Open Garden", "Indoor", "Outdoor", "Parking Space", "Stage", "Dressing Room", "Generator Backup", "Catering Kitchen", "Bridal Suite"],
  photography: ["Same-Day Edit", "HD Cameras", "Drone Shots", "Candid", "Studio Setup", "Fast Delivery", "Online Gallery", "Print Packages"],
  videography: ["4K Video", "Drone Footage", "Cinematic Edit", "Live Streaming", "Same-Day Highlight", "Blu-ray Delivery"],
  decoration: ["Theme Setup", "Balloon Decor", "Fabric Draping", "Centerpieces", "Backdrop", "Arch Setup", "Table Settings"],
  entertainment: ["Live Band", "MC Services", "DJ", "Cultural Dance", "Comedy", "Photo Booth"],
  florals: ["Fresh Flowers", "Artificial Flowers", "Bridal Bouquet", "Table Arrangements", "Aisle Flowers", "Arch Flowers"],
  cake_desserts: ["Custom Cakes", "Wedding Cakes", "Cupcakes", "Dessert Table", "Fondant", "Sugar Flowers"],
  bar_services: ["Open Bar", "Cocktail Making", "Beer", "Wine", "Mocktails", "Custom Drinks"],
  transportation: ["Luxury Cars", "Bus Hire", "Airport Pickup", "Wedding Cars", "Limousine", "Minivan"],
  audio_visual: ["PA System", "Projector", "LED Screen", "Microphones", "Mixer", "Lighting Rig"],
  lighting: ["LED Lighting", "Fairy Lights", "Uplighting", "Stage Lighting", "Intelligent Lights", "Custom Colors"],
  event_planning: ["Full Planning", "Day-of Coordination", "Vendor Management", "Budget Planning", "Venue Sourcing"],
  security: ["Uniformed Guards", "CCTV", "Access Control", "Crowd Management", "Metal Detection"],
  rentals: ["Tables & Chairs", "Tents", "Generators", "Canopies", "Linens", "Crockery"],
  invitations: ["Custom Design", "Digital Invites", "Print", "RSVP Management", "Thank You Cards"],
  favors_gifts: ["Custom Gifts", "Branded Souvenirs", "Gift Boxes", "Personalized Items"],
};

// ─── Subscription Plans Data ──────────────────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  // ── VENDOR PLANS ──
  {
    planType: "vendor",
    planName: "Basic",
    displayName: "Basic",
    description: "Perfect for vendors just starting out",
    pricing: [
      { currency: "NGN", amount: 0, amountInMinorUnits: 0 },
      { currency: "USD", amount: 0, amountInMinorUnits: 0 },
    ],
    features: [
      "Basic profile listing",
      "Up to 5 event listings per month",
      "Basic analytics",
      "Photo gallery (up to 10 images)",
      "Customer reviews and ratings",
      "Email support",
      "Mobile app access",
    ],
    limitations: ["No featured listings", "No booking calendar", "Limited analytics"],
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
      { currency: "NGN", amount: 7900, amountInMinorUnits: 790000 },
      { currency: "USD", amount: 14.99, amountInMinorUnits: 1499 },
    ],
    features: [
      "Everything in Basic",
      "Up to 30 event listings per month",
      "Advanced analytics dashboard",
      "Photo gallery (up to 50 images)",
      "Video portfolio (up to 5 videos)",
      "Booking calendar & management",
      "Priority email support (24-hour)",
      "Featured in category listings",
      "Lead generation tools",
      "Custom business URL",
    ],
    limitations: ["No dedicated account manager", "No API access"],
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
      { currency: "NGN", amount: 14900, amountInMinorUnits: 1490000 },
      { currency: "USD", amount: 24.99, amountInMinorUnits: 2499 },
    ],
    features: [
      "Everything in Professional",
      "Unlimited event listings",
      "Full analytics & reporting",
      "Unlimited photos & videos",
      "Priority search placement",
      "Dedicated phone support",
      "Custom branding options",
      "Multiple staff accounts",
      "CRM integration",
      "Automated quote responses",
    ],
    limitations: [],
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
      { currency: "NGN", amount: 29900, amountInMinorUnits: 2990000 },
      { currency: "USD", amount: 49.99, amountInMinorUnits: 4999 },
    ],
    features: [
      "Everything in Business",
      "Dedicated account manager",
      "API access",
      "White-label options",
      "Bulk booking discounts",
      "SLA guarantee",
      "Custom integrations",
      "Priority platform features",
    ],
    limitations: [],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 4,
  },
  // ── PLANNER PLANS ──
  {
    planType: "planner",
    planName: "Starter",
    displayName: "Starter",
    description: "For individual event planners just getting started",
    pricing: [
      { currency: "NGN", amount: 0, amountInMinorUnits: 0 },
      { currency: "USD", amount: 0, amountInMinorUnits: 0 },
    ],
    features: [
      "Manage up to 3 events",
      "Basic vendor directory access",
      "Event timeline tool",
      "Guest list (up to 50)",
      "Email support",
    ],
    limitations: ["3 event limit", "No budget tools", "No client portal"],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 1,
  },
  {
    planType: "planner",
    planName: "Professional",
    displayName: "Professional",
    description: "For professional event planners and freelancers",
    pricing: [
      { currency: "NGN", amount: 5900, amountInMinorUnits: 590000 },
      { currency: "USD", amount: 9.99, amountInMinorUnits: 999 },
    ],
    features: [
      "Manage up to 20 events",
      "Full vendor directory",
      "Budget management tools",
      "Guest list (up to 500)",
      "Client portal",
      "Event timeline & checklist",
      "Vendor contract management",
      "Priority support",
    ],
    limitations: ["20 event limit", "No team accounts"],
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
      { currency: "NGN", amount: 12900, amountInMinorUnits: 1290000 },
      { currency: "USD", amount: 19.99, amountInMinorUnits: 1999 },
    ],
    features: [
      "Unlimited events",
      "Team accounts (up to 5)",
      "Advanced analytics",
      "Unlimited guest lists",
      "CRM for clients",
      "Branded client portal",
      "API access",
      "Priority support",
    ],
    limitations: [],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 3,
  },
  {
    planType: "planner",
    planName: "Enterprise",
    displayName: "Enterprise",
    description: "For large event planning agencies",
    pricing: [
      { currency: "NGN", amount: 24900, amountInMinorUnits: 2490000 },
      { currency: "USD", amount: 49.99, amountInMinorUnits: 4999 },
    ],
    features: [
      "Everything in Business",
      "Unlimited team accounts",
      "Dedicated account manager",
      "White-label portal",
      "Custom reporting",
      "SLA guarantee",
    ],
    limitations: [],
    billingCycle: "monthly",
    isPopular: false,
    sortOrder: 4,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const jitter = (n, pct = 0.05) => n + (Math.random() - 0.5) * n * pct * 2;

function weightedRand(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function buildCity() {
  const city = weightedRand(CITIES);
  const [lng, lat] = city.coords;
  return {
    city,
    coordinates: [
      +(lng + (Math.random() - 0.5) * 0.08).toFixed(6),
      +(lat + (Math.random() - 0.5) * 0.08).toFixed(6),
    ],
  };
}

function buildCategoryEntry() {
  return weightedRand(CATEGORIES);
}

function businessName(cat, nameSuffix) {
  const prefix = rand(BUSINESS_PREFIXES);
  const nouns = CATEGORY_NOUNS[cat] || ["Services", "Solutions", "Group"];
  const noun = rand(nouns);
  const style = Math.random();
  if (style < 0.33) return `${prefix} ${noun}`;
  if (style < 0.66) return `${nameSuffix} ${noun}`;
  return `${prefix} ${nameSuffix} ${noun}`;
}

function phone(i) {
  const prefixes = ["0803", "0806", "0810", "0813", "0815", "0816", "0817", "0818",
                    "0901", "0902", "0903", "0704", "0705", "0706", "0708", "0709"];
  const p = rand(prefixes);
  const n = String(i).padStart(7, "0").slice(-7);
  return `${p}${n}`;
}

function avgPriceForCategory(cat) {
  const base = {
    venue: 250000, catering: 80000, photography: 60000, videography: 70000,
    decoration: 50000, entertainment: 100000, florals: 35000,
    cake_desserts: 25000, bar_services: 40000, transportation: 45000,
    audio_visual: 55000, lighting: 45000, event_planning: 120000,
    security: 30000, rentals: 20000, invitations: 15000, favors_gifts: 12000,
    other: 30000,
  };
  const b = base[cat] || 30000;
  return Math.round(jitter(b, 0.3) / 1000) * 1000;
}

function selectPlanForVendor(plans, i) {
  // Distribution: 30% Basic, 40% Professional, 20% Business, 10% Enterprise
  const r = Math.random();
  if (r < 0.30) return plans.find(p => p.planType === "vendor" && p.planName === "Basic");
  if (r < 0.70) return plans.find(p => p.planType === "vendor" && p.planName === "Professional");
  if (r < 0.90) return plans.find(p => p.planType === "vendor" && p.planName === "Business");
  return plans.find(p => p.planType === "vendor" && p.planName === "Enterprise");
}

function subscriptionStatus(plan) {
  if (plan.planName === "Basic") return "active"; // free = always active
  const r = Math.random();
  if (r < 0.70) return "active";
  if (r < 0.85) return "trial";
  return "active";
}

function datesForSub(status) {
  const now = new Date();
  const monthsAgo = randInt(1, 12);
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - monthsAgo);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 12); // annual subscription
  const trialEndDate = status === "trial"
    ? new Date(now.getTime() + randInt(3, 14) * 24 * 60 * 60 * 1000)
    : undefined;
  return { startDate, endDate, trialEndDate };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/confetti");
  console.log("Connected.\n");

  // ── 1. Upsert subscription plans ──────────────────────────────────────────
  console.log("Seeding subscription plans...");
  const planDocs = [];
  for (const plan of SUBSCRIPTION_PLANS) {
    const doc = await SubscriptionPlan.findOneAndUpdate(
      { planType: plan.planType, planName: plan.planName, billingCycle: plan.billingCycle },
      { $set: plan },
      { upsert: true, new: true }
    );
    planDocs.push(doc);
    console.log(`  ✓ ${doc.planType}/${doc.planName}`);
  }
  console.log(`Subscription plans ready: ${planDocs.length}\n`);

  // ── 2. Pre-hash passwords ─────────────────────────────────────────────────
  console.log("Hashing passwords...");
  const vendorHash = await bcrypt.hash(VENDOR_PASSWORD, 10);
  console.log("  ✓ Vendor password hashed\n");

  // ── 3. Generate vendor user + vendor + subscription records ───────────────
  console.log(`Generating ${TOTAL_VENDORS} vendor records...`);

  // Check existing vendor emails to avoid duplicates
  const existingEmails = new Set(
    (await User.find({ role: "vendor" }, "email").lean()).map(u => u.email)
  );
  console.log(`  Found ${existingEmails.size} existing vendor users.\n`);

  const userDocs = [];
  const vendorDocs = [];
  const subscriptionDocs = [];

  let idx = 1;

  while (userDocs.length < TOTAL_VENDORS) {
    const catEntry = buildCategoryEntry();
    const { city, coordinates } = buildCity();
    const nameSuffix = rand(NIGERIAN_NAMES);
    const bName = businessName(catEntry.category, nameSuffix);
    const slug = bName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) + idx;
    const email = `vendor.${slug}@confetti-ng.com`;

    if (existingEmails.has(email)) { idx++; continue; }
    existingEmails.add(email);

    const firstName = rand(NIGERIAN_NAMES);
    const lastName = rand(NIGERIAN_NAMES);
    const userPhone = phone(1000000 + idx);
    const avg = avgPriceForCategory(catEntry.category);
    const eventTypes = rand(EVENT_TYPE_POOLS);
    const feats = (FEATURES_BY_CATEGORY[catEntry.category] || [])
      .sort(() => Math.random() - 0.5)
      .slice(0, randInt(3, 6));
    const street = rand(STREETS);
    const plan = selectPlanForVendor(planDocs, idx);
    const status = subscriptionStatus(plan);
    const { startDate, endDate, trialEndDate } = datesForSub(status);
    const isApproved = Math.random() > 0.10; // 90% approved

    userDocs.push({
      username: `vendor_${slug}`,
      email,
      password: vendorHash,
      firstName,
      lastName,
      role: "vendor",
      status: "active",
      isEmailVerified: true,
      emailVerifiedAt: startDate,
      isActive: true,
      phone: userPhone,
      address: {
        street,
        city: city.name,
        state: city.state,
        country: "Nigeria",
      },
      _planRef: plan._id,
      _planName: plan.planName,
      _planAmount: plan.pricing.find(p => p.currency === "NGN")?.amount || 0,
      _catEntry: catEntry,
      _city: city,
      _coordinates: coordinates,
      _bName: bName,
      _firstName: firstName,
      _lastName: lastName,
      _userPhone: userPhone,
      _avg: avg,
      _eventTypes: eventTypes,
      _feats: feats,
      _street: street,
      _status: status,
      _startDate: startDate,
      _endDate: endDate,
      _trialEndDate: trialEndDate,
      _isApproved: isApproved,
    });

    idx++;
  }

  // ── 4. Batch insert users ─────────────────────────────────────────────────
  console.log(`Inserting ${userDocs.length} users...`);
  const BATCH = 50;
  const createdUsers = [];

  for (let i = 0; i < userDocs.length; i += BATCH) {
    const batch = userDocs.slice(i, i + BATCH);
    const toInsert = batch.map(({ _planRef, _planName, _planAmount, _catEntry, _city, _coordinates,
      _bName, _firstName, _lastName, _userPhone, _avg, _eventTypes, _feats, _street, _status,
      _startDate, _endDate, _trialEndDate, _isApproved, ...u }) => u);

    // Use insertMany to bypass pre-save hooks (password already hashed)
    let inserted;
    try {
      inserted = await User.insertMany(toInsert, { ordered: false });
    } catch (err) {
      // Handle partial success on duplicate key
      inserted = err.insertedDocs || [];
      console.warn(`  Batch ${i}-${i + BATCH}: ${err.message?.slice(0, 80)}`);
    }

    // Map back metadata by index
    for (let j = 0; j < inserted.length; j++) {
      const meta = batch[j];
      createdUsers.push({ user: inserted[j], meta });
    }

    process.stdout.write(`\r  Inserted ${createdUsers.length}/${userDocs.length} users...`);
  }
  console.log(`\n  ✓ ${createdUsers.length} users created\n`);

  // ── 5. Build subscriptions & vendors ─────────────────────────────────────
  console.log("Creating subscriptions and vendor profiles...");

  const subInserts = [];
  const vendorInserts = [];

  for (const { user, meta } of createdUsers) {
    // Build subscription
    const sub = {
      user: user._id,
      planType: "vendor",
      planName: meta._planName,
      status: meta._status,
      startDate: meta._startDate,
      endDate: meta._endDate,
      trialEndDate: meta._trialEndDate,
      paymentProvider: meta._planAmount === 0 ? "none" : "paystack",
      paymentId: meta._planAmount > 0 ? `seed_${user._id}` : undefined,
      amount: meta._planAmount,
      currency: "NGN",
      billingCycle: "monthly",
      autoRenew: true,
      history: [{
        planName: meta._planName,
        status: meta._status,
        startDate: meta._startDate,
        endDate: meta._endDate,
        amount: meta._planAmount,
        changeType: "created",
        createdAt: meta._startDate,
      }],
    };
    subInserts.push(sub);

    // Build vendor
    const catEntry = meta._catEntry;
    const avg = meta._avg;
    vendorInserts.push({
      owner: user._id,
      name: meta._bName,
      businessName: meta._bName,
      displayName: meta._bName,
      email: user.email,
      phone: meta._userPhone,
      businessType: catEntry.businessType,
      category: catEntry.category,
      eventTypes: meta._eventTypes,
      averagePrice: avg,
      priceRange: { min: Math.round(avg * 0.6), max: Math.round(avg * 1.8) },
      capacity: catEntry.category === "venue" ? randInt(50, 2000) : randInt(20, 500),
      availabilityStatus: rand(["high", "medium", "low"]),
      description: `${meta._bName} is a trusted ${catEntry.category.replace(/_/g, " ")} provider based in ${meta._city.name}, ${meta._city.state}. We specialise in delivering world-class services for ${meta._eventTypes.join(", ")} events.`,
      address: {
        street: meta._street,
        city: meta._city.name,
        state: meta._city.state,
        country: "Nigeria",
      },
      location: {
        type: "Point",
        coordinates: meta._coordinates,
      },
      status: meta._isApproved ? "approved" : "pending",
      isActive: true,
      isVerified: meta._isApproved,
      isFeatured: Math.random() < 0.08,
      features: meta._feats,
      rating: meta._isApproved ? +(Math.random() * 2 + 3).toFixed(1) : 0,
      reviewCount: meta._isApproved ? randInt(0, 120) : 0,
      serviceArea: {
        cities: [meta._city.name],
        states: [meta._city.state],
        radius: randInt(10, 50),
      },
      socialMedia: {
        instagram: `@${meta._bName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15)}`,
        facebook: meta._bName.replace(/\s+/g, ""),
        website: `https://${meta._bName.toLowerCase().replace(/[^a-z0-9]/g, "")}.ng`,
      },
      branding: {
        primaryColor: rand(["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899"]),
        secondaryColor: rand(["#10B981", "#6366F1", "#F59E0B", "#3B82F6", "#8B5CF6"]),
        font: rand(["Inter", "Poppins", "Roboto", "Montserrat", "Lato"]),
      },
      stats: {
        profileViews: randInt(0, 5000),
        totalBookings: meta._isApproved ? randInt(0, 200) : 0,
        totalReviews: meta._isApproved ? randInt(0, 120) : 0,
        averageRating: meta._isApproved ? +(Math.random() * 2 + 3).toFixed(1) : 0,
        responseTime: randInt(1, 48),
        responseRate: randInt(60, 100),
        totalRevenue: meta._isApproved ? randInt(0, 5000000) : 0,
      },
    });
  }

  // ── 6. Insert subscriptions ───────────────────────────────────────────────
  console.log(`Inserting ${subInserts.length} subscriptions...`);
  let insertedSubs = [];
  for (let i = 0; i < subInserts.length; i += BATCH) {
    const batch = subInserts.slice(i, i + BATCH);
    const docs = await Subscription.insertMany(batch, { ordered: false });
    insertedSubs.push(...docs);
    process.stdout.write(`\r  ${insertedSubs.length}/${subInserts.length} subscriptions...`);
  }
  console.log(`\n  ✓ ${insertedSubs.length} subscriptions created\n`);

  // ── 7. Insert vendors ─────────────────────────────────────────────────────
  console.log(`Inserting ${vendorInserts.length} vendor profiles...`);
  // Attach subscription IDs to vendors
  for (let i = 0; i < vendorInserts.length; i++) {
    vendorInserts[i].subscription = insertedSubs[i]?._id;
  }

  let insertedVendors = [];
  for (let i = 0; i < vendorInserts.length; i += BATCH) {
    const batch = vendorInserts.slice(i, i + BATCH);
    const docs = await Vendor.insertMany(batch, { ordered: false });
    insertedVendors.push(...docs);
    process.stdout.write(`\r  ${insertedVendors.length}/${vendorInserts.length} vendors...`);
  }
  console.log(`\n  ✓ ${insertedVendors.length} vendor profiles created\n`);

  // ── 8. Back-update users with subscription refs ───────────────────────────
  console.log("Linking subscriptions to user accounts...");
  const bulkOps = [];
  for (let i = 0; i < createdUsers.length; i++) {
    const uid = createdUsers[i].user._id;
    const sid = insertedSubs[i]?._id;
    if (!sid) continue;
    bulkOps.push({
      updateOne: { filter: { _id: uid }, update: { $set: { subscription: sid } } },
    });
  }
  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
    console.log(`  ✓ Linked ${bulkOps.length} users\n`);
  }

  // ── 9. Summary ─────────────────────────────────────────────────────────────
  const [totalVendors, totalSubs, totalPlans] = await Promise.all([
    Vendor.countDocuments(),
    Subscription.countDocuments({ planType: "vendor" }),
    SubscriptionPlan.countDocuments(),
  ]);

  // Category breakdown
  const catBreakdown = await Vendor.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // City breakdown
  const cityBreakdown = await Vendor.aggregate([
    { $group: { _id: "$address.city", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  // Plan breakdown
  const planBreakdown = await Subscription.aggregate([
    { $match: { planType: "vendor" } },
    { $group: { _id: "$planName", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log("══════════════════════════════════════════════════");
  console.log(`SEED COMPLETE`);
  console.log("══════════════════════════════════════════════════");
  console.log(`Subscription Plans : ${totalPlans}`);
  console.log(`Vendor Profiles    : ${totalVendors}`);
  console.log(`Subscriptions      : ${totalSubs}`);
  console.log("\nBy Category:");
  catBreakdown.forEach(c => console.log(`  ${c._id.padEnd(20)} ${c.count}`));
  console.log("\nTop Cities:");
  cityBreakdown.forEach(c => console.log(`  ${c._id.padEnd(20)} ${c.count}`));
  console.log("\nBy Subscription Plan:");
  planBreakdown.forEach(p => console.log(`  ${p._id.padEnd(15)} ${p.count}`));
  console.log("══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

run().catch(err => {
  console.error("Seed failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
