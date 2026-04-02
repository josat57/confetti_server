/**
 * Extended vendor seed — covers all AI budget categories across major Nigerian cities.
 * Run: node seed-vendors-extended.js
 *
 * Categories covered: venue, catering, photography, videography, decoration,
 * entertainment, florals, cake_desserts, transportation, audio_visual,
 * security, lighting, invitations, rentals, event_planning
 *
 * Cities covered: Lagos, Abuja, Port Harcourt, Ibadan, Kano, Enugu, Benin City
 */

import mongoose from "./src/node/node_modules/mongoose/index.js";
import bcrypt from "bcryptjs";
import User from "./src/node/models/user.model.js";
import Vendor from "./src/node/models/vendor.model.js";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ MongoDB connected");
};

// -------------------------------------------------------------------
// Helper to generate consistent user email
// -------------------------------------------------------------------
const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20);

// -------------------------------------------------------------------
// CITY COORDINATES (longitude, latitude) — GeoJSON order
// -------------------------------------------------------------------
const CITIES = {
  Lagos: {
    state: "Lagos",
    coords: (offset = 0) => [3.3792 + offset * 0.02, 6.5244 + offset * 0.01],
  },
  Abuja: {
    state: "FCT",
    coords: (offset = 0) => [7.4951 + offset * 0.02, 9.0579 + offset * 0.01],
  },
  "Port Harcourt": {
    state: "Rivers",
    coords: (offset = 0) => [7.0134 + offset * 0.02, 4.8156 + offset * 0.01],
  },
  Ibadan: {
    state: "Oyo",
    coords: (offset = 0) => [3.9177 + offset * 0.02, 7.3775 + offset * 0.01],
  },
  Kano: {
    state: "Kano",
    coords: (offset = 0) => [8.5167 + offset * 0.02, 12.0 + offset * 0.01],
  },
  Enugu: {
    state: "Enugu",
    coords: (offset = 0) => [7.4951 + offset * 0.02, 6.5244 + offset * 0.01],
  },
  "Benin City": {
    state: "Edo",
    coords: (offset = 0) => [5.6037 + offset * 0.02, 6.338 + offset * 0.01],
  },
};

// businessType map (vendor model enum is limited)
const BIZ_TYPE = {
  venue: "venue",
  catering: "catering",
  photography: "photography",
  videography: "photography",
  decoration: "decoration",
  entertainment: "music",
  florals: "other",
  cake_desserts: "other",
  transportation: "other",
  audio_visual: "other",
  security: "other",
  lighting: "other",
  invitations: "other",
  rentals: "other",
  event_planning: "other",
};

// -------------------------------------------------------------------
// VENDOR DATA — arrays per category, each vendor has a `cities` array
// -------------------------------------------------------------------
const VENDORS = [
  // ================================================================
  // VENUE
  // ================================================================
  {
    category: "venue",
    cities: ["Lagos"],
    offset: 0,
    name: "Grand Ballroom Lagos",
    businessName: "Grand Ballroom Events Center",
    email: "info@grandballroom.ng",
    phone: "+234-801-234-5678",
    tagline: "Elegant venues for unforgettable celebrations",
    description:
      "Premier event venue in Victoria Island with stunning waterfront views, accommodating 50–500 guests. Features in-house catering, AV equipment, and professional event coordination.",
    capacity: 500,
    averagePrice: 300000,
    priceRange: { min: 150000, max: 500000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Hall Rental (8 hours)", price: { amount: 280000, currency: "NGN" } },
      { name: "Setup & Cleanup", price: { amount: 50000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 127,
  },
  {
    category: "venue",
    cities: ["Lagos"],
    offset: 1,
    name: "Emerald Gardens",
    businessName: "Emerald Gardens Event Center",
    email: "bookings@emeraldgardens.ng",
    phone: "+234-802-345-6789",
    tagline: "Beautiful outdoor and indoor event spaces",
    description:
      "Versatile event center with lush gardens and modern indoor facilities. Perfect for weddings, corporate events, and social gatherings. Capacity 100–300 guests.",
    capacity: 300,
    averagePrice: 180000,
    priceRange: { min: 120000, max: 280000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Garden Venue (6 hours)", price: { amount: 160000, currency: "NGN" } },
      { name: "Indoor Hall", price: { amount: 130000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 89,
  },
  {
    category: "venue",
    cities: ["Lagos"],
    offset: 2,
    name: "Royal Palace Events",
    businessName: "Royal Palace Event Center",
    email: "events@royalpalace.ng",
    phone: "+234-803-456-7890",
    tagline: "Luxury venues fit for royalty",
    description:
      "Luxurious event center with opulent decor and world-class amenities. Specialising in high-end weddings and corporate events. Capacity 200–800 guests.",
    capacity: 800,
    averagePrice: 550000,
    priceRange: { min: 320000, max: 850000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Grand Hall (10 hours)", price: { amount: 500000, currency: "NGN" } },
      { name: "VIP Lounge add-on", price: { amount: 100000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 156,
  },
  {
    category: "venue",
    cities: ["Lagos"],
    offset: 3,
    name: "Lekki Shoreline Suites",
    businessName: "Shoreline Event Suites",
    email: "info@shorelinesuits.ng",
    phone: "+234-804-567-1234",
    tagline: "Oceanfront elegance for every occasion",
    description:
      "Oceanfront venue in Lekki with panoramic sea views. Modern facilities for 50–400 guests, with dedicated bridal suites and state-of-the-art sound.",
    capacity: 400,
    averagePrice: 380000,
    priceRange: { min: 200000, max: 600000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Beachfront Hall (8 hrs)", price: { amount: 360000, currency: "NGN" } },
      { name: "Terrace Package", price: { amount: 220000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 98,
  },
  {
    category: "venue",
    cities: ["Lagos"],
    offset: 4,
    name: "Ikeja City Hall",
    businessName: "Ikeja Event Management",
    email: "hall@ikejacityhall.ng",
    phone: "+234-805-678-2345",
    tagline: "Affordable excellence in the heart of Lagos",
    description:
      "Budget-friendly event hall in Ikeja, accommodating 80–350 guests. Ideal for corporate seminars, birthdays and informal weddings.",
    capacity: 350,
    averagePrice: 120000,
    priceRange: { min: 80000, max: 180000 },
    eventTypes: ["corporate", "birthday", "graduation"],
    services: [
      { name: "Full Hall (6 hrs)", price: { amount: 110000, currency: "NGN" } },
      { name: "Conference Setup", price: { amount: 90000, currency: "NGN" } },
    ],
    rating: 4.0,
    reviewCount: 61,
  },

  // Abuja venues
  {
    category: "venue",
    cities: ["Abuja"],
    offset: 0,
    name: "Transcorp Hilton Ballroom",
    businessName: "Transcorp Events Abuja",
    email: "events@transcorpabuja.ng",
    phone: "+234-806-789-3456",
    tagline: "5-star event experiences in the capital",
    description:
      "Premium event spaces within a 5-star hotel property in Maitama, Abuja. Capacity 100–1,000 guests with dedicated event coordinators.",
    capacity: 1000,
    averagePrice: 600000,
    priceRange: { min: 300000, max: 1200000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Grand Ballroom (12 hrs)", price: { amount: 800000, currency: "NGN" } },
      { name: "Conference Suite", price: { amount: 300000, currency: "NGN" } },
    ],
    rating: 4.9,
    reviewCount: 212,
  },
  {
    category: "venue",
    cities: ["Abuja"],
    offset: 1,
    name: "Nicon Luxury Hall",
    businessName: "Nicon Luxury Events",
    email: "venue@niconluxury.ng",
    phone: "+234-807-890-4567",
    tagline: "Where luxury meets celebration",
    description:
      "Sophisticated event halls in Abuja's Central Business District. Modern facilities for 50–600 guests.",
    capacity: 600,
    averagePrice: 420000,
    priceRange: { min: 220000, max: 700000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Main Hall (8 hrs)", price: { amount: 400000, currency: "NGN" } },
      { name: "Garden Terrace", price: { amount: 200000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 143,
  },
  {
    category: "venue",
    cities: ["Abuja"],
    offset: 2,
    name: "Wuse2 Events Arena",
    businessName: "Wuse2 Events Ltd",
    email: "bookings@wuse2events.ng",
    phone: "+234-808-901-5678",
    tagline: "Affordable Abuja event spaces",
    description:
      "Contemporary event space in Wuse 2 with flexible room configurations. Capacity 80–400 guests.",
    capacity: 400,
    averagePrice: 220000,
    priceRange: { min: 120000, max: 380000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Full Hall (7 hrs)", price: { amount: 210000, currency: "NGN" } },
      { name: "VIP Room Add-on", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 77,
  },

  // Port Harcourt venues
  {
    category: "venue",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "Mövenpick Event Hall",
    businessName: "Mövenpick PH Events",
    email: "events@movenpickph.ng",
    phone: "+234-809-012-6789",
    tagline: "International standards in Port Harcourt",
    description:
      "Premium event facilities in Port Harcourt's GRA. Capacity 100–800 guests, fully air-conditioned with world-class catering.",
    capacity: 800,
    averagePrice: 500000,
    priceRange: { min: 250000, max: 900000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Grand Hall (10 hrs)", price: { amount: 480000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 104,
  },
  {
    category: "venue",
    cities: ["Port Harcourt"],
    offset: 1,
    name: "GRA Event Garden",
    businessName: "GRA Event Garden Ltd",
    email: "info@graeventgarden.ng",
    phone: "+234-810-123-7890",
    tagline: "Garden beauty meets PH hospitality",
    description:
      "Lush garden and indoor event space in PH GRA. Perfect for weddings and social gatherings. Capacity 80–350 guests.",
    capacity: 350,
    averagePrice: 200000,
    priceRange: { min: 100000, max: 320000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Garden Package (6 hrs)", price: { amount: 190000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 68,
  },
  {
    category: "venue",
    cities: ["Ibadan"],
    offset: 0,
    name: "Premier Hotel Ibadan Hall",
    businessName: "Premier Hotel Events",
    email: "events@premierhotel.ng",
    phone: "+234-811-234-8901",
    tagline: "Ibadan's landmark event destination",
    description:
      "Iconic hotel venue in the heart of Ibadan. Capacity 100–600 guests.",
    capacity: 600,
    averagePrice: 200000,
    priceRange: { min: 100000, max: 350000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Ballroom (8 hrs)", price: { amount: 190000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 55,
  },
  {
    category: "venue",
    cities: ["Kano"],
    offset: 0,
    name: "Tahir Guest Palace",
    businessName: "Tahir Palace Events",
    email: "events@tahirpalace.ng",
    phone: "+234-812-345-9012",
    tagline: "Northern elegance for grand celebrations",
    description:
      "Spacious event facilities in Kano, accommodating 200–1,200 guests. Ideal for cultural and traditional ceremonies.",
    capacity: 1200,
    averagePrice: 280000,
    priceRange: { min: 150000, max: 500000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Grand Hall (10 hrs)", price: { amount: 260000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 87,
  },

  // ================================================================
  // CATERING
  // ================================================================
  {
    category: "catering",
    cities: ["Lagos"],
    offset: 0,
    name: "Delicious Delights Catering",
    businessName: "Delicious Delights Ltd",
    email: "orders@deliciousdelights.ng",
    phone: "+234-813-456-1234",
    tagline: "Exquisite cuisine for every occasion",
    description:
      "Premium catering service specialising in Nigerian and continental cuisine. From intimate gatherings to large celebrations.",
    capacity: 1000,
    averagePrice: 4500,
    priceRange: { min: 2500, max: 9000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Nigerian Buffet (per head)", price: { amount: 3500, currency: "NGN" } },
      { name: "Continental (per head)", price: { amount: 5000, currency: "NGN" } },
      { name: "Drinks Package", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 203,
  },
  {
    category: "catering",
    cities: ["Lagos"],
    offset: 1,
    name: "Mama's Kitchen Catering",
    businessName: "Mama's Kitchen Services",
    email: "info@mamaskitchen.ng",
    phone: "+234-814-567-2345",
    tagline: "Authentic Nigerian flavors with love",
    description:
      "Traditional Nigerian catering with authentic recipes passed through generations. Cultural events and traditional ceremonies are our specialty.",
    capacity: 500,
    averagePrice: 2800,
    priceRange: { min: 1800, max: 4500 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "Traditional Nigerian (per head)", price: { amount: 2500, currency: "NGN" } },
      { name: "Small Chops Platter", price: { amount: 30000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 145,
  },
  {
    category: "catering",
    cities: ["Lagos"],
    offset: 2,
    name: "Elite Culinary Services",
    businessName: "Elite Culinary Ltd",
    email: "bookings@eliteculinary.ng",
    phone: "+234-815-678-3456",
    tagline: "Gourmet experiences for discerning palates",
    description:
      "High-end catering with international cuisine and innovative presentations. Perfect for luxury weddings and corporate galas.",
    capacity: 300,
    averagePrice: 9000,
    priceRange: { min: 5500, max: 18000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Gourmet Menu (per head)", price: { amount: 8500, currency: "NGN" } },
      { name: "Cocktail Reception", price: { amount: 150000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 167,
  },
  {
    category: "catering",
    cities: ["Lagos"],
    offset: 3,
    name: "Spice Island Catering",
    businessName: "Spice Island Foods",
    email: "spiceisland@catering.ng",
    phone: "+234-816-789-4567",
    tagline: "Bold flavors, beautiful presentation",
    description:
      "Mid-range catering service offering Nigerian and continental menus. Reliable, affordable, and consistently tasty.",
    capacity: 700,
    averagePrice: 3200,
    priceRange: { min: 2000, max: 5500 },
    eventTypes: ["wedding", "birthday", "corporate", "graduation"],
    services: [
      { name: "Mixed Menu (per head)", price: { amount: 3000, currency: "NGN" } },
      { name: "Bar Service (flat fee)", price: { amount: 60000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 112,
  },
  {
    category: "catering",
    cities: ["Lagos"],
    offset: 4,
    name: "Yum & Yums Catering",
    businessName: "Yum & Yums Ltd",
    email: "yumyums@catering.ng",
    phone: "+234-817-890-5678",
    tagline: "Budget-friendly, flavourful food for all",
    description:
      "Affordable catering for events on a tight budget. Great for birthday parties, graduations, and school events.",
    capacity: 800,
    averagePrice: 2000,
    priceRange: { min: 1200, max: 3000 },
    eventTypes: ["birthday", "graduation", "corporate"],
    services: [
      { name: "Budget Package (per head)", price: { amount: 1800, currency: "NGN" } },
    ],
    rating: 4.0,
    reviewCount: 89,
  },
  {
    category: "catering",
    cities: ["Abuja"],
    offset: 0,
    name: "Savanna Catering Abuja",
    businessName: "Savanna Catering Ltd",
    email: "info@savannacatering.ng",
    phone: "+234-818-901-6789",
    tagline: "Abuja's top catering choice",
    description:
      "Leading catering company in Abuja with experience in state functions, corporate events, and weddings. Capacity 50–1,500 guests.",
    capacity: 1500,
    averagePrice: 5000,
    priceRange: { min: 3000, max: 10000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Full Service (per head)", price: { amount: 4800, currency: "NGN" } },
      { name: "Cocktail Menu", price: { amount: 120000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 188,
  },
  {
    category: "catering",
    cities: ["Abuja"],
    offset: 1,
    name: "Capitol Kitchen Abuja",
    businessName: "Capitol Kitchen Services",
    email: "capitol@catering.ng",
    phone: "+234-819-012-7890",
    tagline: "Parliamentary quality, family warmth",
    description:
      "Family-run catering business with a focus on Nigerian cuisine and cultural dishes. Abuja-based, serving 100–800 guests.",
    capacity: 800,
    averagePrice: 3500,
    priceRange: { min: 2200, max: 6000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Nigerian Spread (per head)", price: { amount: 3200, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 94,
  },
  {
    category: "catering",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "Riviera Catering PH",
    businessName: "Riviera Catering Services",
    email: "info@rivieracatering.ng",
    phone: "+234-820-123-8901",
    tagline: "Fresh from the Niger Delta",
    description:
      "Premium catering with a focus on fresh, locally sourced ingredients. Specialising in Rivers State traditional dishes and continental cuisine.",
    capacity: 600,
    averagePrice: 4000,
    priceRange: { min: 2500, max: 7000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Delta Cuisine (per head)", price: { amount: 3800, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 76,
  },
  {
    category: "catering",
    cities: ["Port Harcourt"],
    offset: 1,
    name: "Garden Fresh Catering",
    businessName: "Garden Fresh PH",
    email: "info@gardenfreshph.ng",
    phone: "+234-821-234-9012",
    tagline: "Garden fresh, event ready",
    description:
      "Modern catering with healthy menu options. Serves 50–500 guests for corporate and social events in PH.",
    capacity: 500,
    averagePrice: 3200,
    priceRange: { min: 2000, max: 5500 },
    eventTypes: ["corporate", "birthday", "wedding"],
    services: [
      { name: "Healthy Mix (per head)", price: { amount: 3000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 52,
  },
  {
    category: "catering",
    cities: ["Ibadan"],
    offset: 0,
    name: "Ibadan Heritage Catering",
    businessName: "Heritage Kitchen Ltd",
    email: "heritage@catering.ng",
    phone: "+234-822-345-0123",
    tagline: "Authentic Yoruba cuisine and more",
    description:
      "Serving authentic Yoruba dishes and continental cuisine for all events. Ibadan's most trusted catering brand.",
    capacity: 800,
    averagePrice: 2500,
    priceRange: { min: 1500, max: 4000 },
    eventTypes: ["wedding", "birthday", "corporate", "graduation"],
    services: [
      { name: "Yoruba Buffet (per head)", price: { amount: 2300, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 60,
  },
  {
    category: "catering",
    cities: ["Kano"],
    offset: 0,
    name: "Northern Spice Catering",
    businessName: "Northern Spice Ltd",
    email: "info@northernspice.ng",
    phone: "+234-823-456-1234",
    tagline: "The taste of the North",
    description:
      "Specialising in northern Nigerian cuisine including suya, kilishi, and tuwo. Also serves continental and international menus.",
    capacity: 1000,
    averagePrice: 2000,
    priceRange: { min: 1200, max: 3500 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Northern Menu (per head)", price: { amount: 1900, currency: "NGN" } },
    ],
    rating: 4.2,
    reviewCount: 48,
  },

  // ================================================================
  // PHOTOGRAPHY
  // ================================================================
  {
    category: "photography",
    cities: ["Lagos"],
    offset: 0,
    name: "CaptureMax Photography",
    businessName: "CaptureMax Studio",
    email: "info@capturemaxstudio.ng",
    phone: "+234-824-567-2345",
    tagline: "Every moment tells a story",
    description:
      "Award-winning photography studio in Lagos. Specialises in wedding, corporate, and portrait photography with same-week delivery.",
    capacity: 200,
    averagePrice: 180000,
    priceRange: { min: 80000, max: 350000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Wedding Full Coverage (8 hrs)", price: { amount: 200000, currency: "NGN" } },
      { name: "Corporate Event (4 hrs)", price: { amount: 100000, currency: "NGN" } },
      { name: "Pre-wedding Shoot", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 234,
  },
  {
    category: "photography",
    cities: ["Lagos"],
    offset: 1,
    name: "Pixel Perfect Studios",
    businessName: "Pixel Perfect Ltd",
    email: "shoot@pixelperfect.ng",
    phone: "+234-825-678-3456",
    tagline: "Flawless photography, unforgettable memories",
    description:
      "Professional photography team with 10+ years experience. Covering weddings, birthdays, graduations, and corporate events.",
    capacity: 500,
    averagePrice: 130000,
    priceRange: { min: 60000, max: 250000 },
    eventTypes: ["wedding", "birthday", "corporate", "graduation"],
    services: [
      { name: "Event Photography (6 hrs)", price: { amount: 120000, currency: "NGN" } },
      { name: "Photo Album (100 prints)", price: { amount: 40000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 178,
  },
  {
    category: "photography",
    cities: ["Lagos"],
    offset: 2,
    name: "LensCraft Photography",
    businessName: "LensCraft Productions",
    email: "info@lenscraft.ng",
    phone: "+234-826-789-4567",
    tagline: "Artistry in every frame",
    description:
      "Creative photography with an artistic flair. Specialises in editorial-style wedding photography and lifestyle portraits.",
    capacity: 200,
    averagePrice: 250000,
    priceRange: { min: 150000, max: 450000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Full-Day Wedding (10 hrs)", price: { amount: 280000, currency: "NGN" } },
      { name: "Engagement Shoot", price: { amount: 120000, currency: "NGN" } },
    ],
    rating: 4.9,
    reviewCount: 112,
  },
  {
    category: "photography",
    cities: ["Lagos"],
    offset: 3,
    name: "Shutterclick Moments",
    businessName: "Shutterclick Media",
    email: "book@shuttercklick.ng",
    phone: "+234-827-890-5678",
    tagline: "Budget photography, premium results",
    description:
      "Affordable photography packages without compromising quality. Great for birthdays, graduations, and small weddings.",
    capacity: 300,
    averagePrice: 70000,
    priceRange: { min: 40000, max: 120000 },
    eventTypes: ["birthday", "graduation", "corporate"],
    services: [
      { name: "Basic Event Coverage (4 hrs)", price: { amount: 65000, currency: "NGN" } },
    ],
    rating: 4.2,
    reviewCount: 88,
  },
  {
    category: "photography",
    cities: ["Abuja"],
    offset: 0,
    name: "Abuja Lens Studio",
    businessName: "Abuja Lens Ltd",
    email: "studio@abulens.ng",
    phone: "+234-828-901-6789",
    tagline: "Capital city's finest photographers",
    description:
      "Professional photography studio in Abuja. Covering state events, weddings, and corporate functions with a team of 4 photographers.",
    capacity: 800,
    averagePrice: 200000,
    priceRange: { min: 100000, max: 380000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Full Event Coverage", price: { amount: 200000, currency: "NGN" } },
      { name: "Passport & ID Photos", price: { amount: 15000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 143,
  },
  {
    category: "photography",
    cities: ["Abuja"],
    offset: 1,
    name: "Flashpoint Photography",
    businessName: "Flashpoint Media Abuja",
    email: "info@flashpointabuja.ng",
    phone: "+234-829-012-7890",
    tagline: "Capturing Abuja's finest moments",
    description:
      "Dynamic photography team in Abuja specialising in weddings and corporate events. Quick turnaround on edited images.",
    capacity: 600,
    averagePrice: 150000,
    priceRange: { min: 80000, max: 280000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Wedding Package (8 hrs)", price: { amount: 160000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 97,
  },
  {
    category: "photography",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "Delta Shots PH",
    businessName: "Delta Shots Photography",
    email: "info@deltashots.ng",
    phone: "+234-830-123-8901",
    tagline: "PH's premier event photographers",
    description:
      "Top photography studio in Port Harcourt. Known for vibrant wedding photos and slick corporate coverage.",
    capacity: 400,
    averagePrice: 160000,
    priceRange: { min: 80000, max: 300000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Wedding Coverage (8 hrs)", price: { amount: 170000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 81,
  },
  {
    category: "photography",
    cities: ["Ibadan"],
    offset: 0,
    name: "Ibadan Clicks Photography",
    businessName: "Ibadan Clicks Studio",
    email: "info@ibadanclicks.ng",
    phone: "+234-831-234-9012",
    tagline: "Ibadan's picture-perfect moments",
    description:
      "Established photography studio in Ibadan covering weddings, birthdays, and corporate functions.",
    capacity: 400,
    averagePrice: 100000,
    priceRange: { min: 50000, max: 200000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Event Coverage (6 hrs)", price: { amount: 95000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 55,
  },

  // ================================================================
  // VIDEOGRAPHY
  // ================================================================
  {
    category: "videography",
    cities: ["Lagos"],
    offset: 0,
    name: "ReelMoments Lagos",
    businessName: "ReelMoments Productions",
    email: "reel@reelmoments.ng",
    phone: "+234-832-345-0123",
    tagline: "Cinematic stories of your special day",
    description:
      "Award-winning videography studio in Lagos. Specialises in cinematic wedding films and corporate highlight reels.",
    capacity: 500,
    averagePrice: 200000,
    priceRange: { min: 100000, max: 400000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Cinematic Wedding Film (8 hrs)", price: { amount: 220000, currency: "NGN" } },
      { name: "Highlight Reel (3–5 min)", price: { amount: 80000, currency: "NGN" } },
      { name: "Live Streaming Add-on", price: { amount: 60000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 154,
  },
  {
    category: "videography",
    cities: ["Lagos"],
    offset: 1,
    name: "CineLine Studios",
    businessName: "CineLine Media",
    email: "info@cinelinestudios.ng",
    phone: "+234-833-456-1234",
    tagline: "Your love story in motion",
    description:
      "Professional wedding and event videography with drone coverage available. Editing turnaround within 3 weeks.",
    capacity: 500,
    averagePrice: 160000,
    priceRange: { min: 80000, max: 300000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Wedding Package", price: { amount: 180000, currency: "NGN" } },
      { name: "Drone Footage Add-on", price: { amount: 50000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 120,
  },
  {
    category: "videography",
    cities: ["Lagos"],
    offset: 2,
    name: "FrameForward Videography",
    businessName: "FrameForward Productions",
    email: "info@frameforward.ng",
    phone: "+234-834-567-2345",
    tagline: "Every second worth keeping",
    description:
      "Modern videography team delivering 4K quality films for weddings and events. Competitive pricing.",
    capacity: 400,
    averagePrice: 120000,
    priceRange: { min: 60000, max: 220000 },
    eventTypes: ["wedding", "birthday", "graduation"],
    services: [
      { name: "Full Event Video (8 hrs)", price: { amount: 130000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 89,
  },
  {
    category: "videography",
    cities: ["Abuja"],
    offset: 0,
    name: "Abuja FilmHouse",
    businessName: "FilmHouse Productions Abuja",
    email: "info@abujafilmhouse.ng",
    phone: "+234-835-678-3456",
    tagline: "Abuja's cinematic memory makers",
    description:
      "Professional videography company in Abuja. Serving weddings, government functions, and corporate events.",
    capacity: 600,
    averagePrice: 180000,
    priceRange: { min: 90000, max: 350000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Full Wedding Film", price: { amount: 200000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 98,
  },
  {
    category: "videography",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "PH Cinematic Studios",
    businessName: "PH Cinematic Ltd",
    email: "info@phcinematic.ng",
    phone: "+234-836-789-4567",
    tagline: "Oil city, silver screen quality",
    description:
      "High-quality videography services in Port Harcourt. Drone and multi-camera wedding coverage.",
    capacity: 400,
    averagePrice: 170000,
    priceRange: { min: 90000, max: 320000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Wedding Package", price: { amount: 180000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 62,
  },
  {
    category: "videography",
    cities: ["Ibadan"],
    offset: 0,
    name: "Ibadan Video Productions",
    businessName: "IBD Video Productions",
    email: "info@ibdvideo.ng",
    phone: "+234-837-890-5678",
    tagline: "Ibadan memories, world-class film",
    description:
      "Affordable videography for Ibadan events. Wedding and birthday coverage with quick editing.",
    capacity: 300,
    averagePrice: 90000,
    priceRange: { min: 50000, max: 160000 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "Event Video (6 hrs)", price: { amount: 90000, currency: "NGN" } },
    ],
    rating: 4.2,
    reviewCount: 43,
  },

  // ================================================================
  // DECORATION
  // ================================================================
  {
    category: "decoration",
    cities: ["Lagos"],
    offset: 0,
    name: "Sparkle Decor Lagos",
    businessName: "Sparkle Decor Ltd",
    email: "design@sparkledecor.ng",
    phone: "+234-838-901-6789",
    tagline: "We transform spaces into magical experiences",
    description:
      "Full-service event décor company in Lagos. Specialising in luxury wedding setups, balloon art, and themed decorations.",
    capacity: 800,
    averagePrice: 200000,
    priceRange: { min: 80000, max: 500000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Full Venue Decoration", price: { amount: 250000, currency: "NGN" } },
      { name: "Balloon Art & Backdrop", price: { amount: 80000, currency: "NGN" } },
      { name: "Table Centrepieces (10 tables)", price: { amount: 60000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 201,
  },
  {
    category: "decoration",
    cities: ["Lagos"],
    offset: 1,
    name: "EventStyle Interiors",
    businessName: "EventStyle Ltd",
    email: "events@eventstyle.ng",
    phone: "+234-839-012-7890",
    tagline: "Style meets celebration",
    description:
      "Creative décor and event styling team. Known for minimalist elegance and modern rustic designs for weddings.",
    capacity: 500,
    averagePrice: 150000,
    priceRange: { min: 60000, max: 300000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Wedding Decor Package", price: { amount: 170000, currency: "NGN" } },
      { name: "Corporate Setup", price: { amount: 90000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 155,
  },
  {
    category: "decoration",
    cities: ["Lagos"],
    offset: 2,
    name: "Glam & Glitter Decor",
    businessName: "Glam Glitter Events",
    email: "info@glamglitter.ng",
    phone: "+234-840-123-8901",
    tagline: "Add sparkle to your special day",
    description:
      "Specialises in luxurious and glamorous event décor. Known for crystal installations, draping, and LED setups.",
    capacity: 600,
    averagePrice: 300000,
    priceRange: { min: 150000, max: 700000 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "Crystal & LED Package", price: { amount: 350000, currency: "NGN" } },
      { name: "Draping Package", price: { amount: 120000, currency: "NGN" } },
    ],
    rating: 4.9,
    reviewCount: 133,
  },
  {
    category: "decoration",
    cities: ["Lagos"],
    offset: 3,
    name: "Budget Blooms Decor",
    businessName: "Budget Blooms Ltd",
    email: "info@budgetblooms.ng",
    phone: "+234-841-234-9012",
    tagline: "Beautiful decorations without the big price tag",
    description:
      "Affordable event decoration for budget-conscious couples and families. Clean, tasteful setups at competitive rates.",
    capacity: 400,
    averagePrice: 70000,
    priceRange: { min: 40000, max: 120000 },
    eventTypes: ["birthday", "graduation", "wedding"],
    services: [
      { name: "Basic Decoration", price: { amount: 65000, currency: "NGN" } },
    ],
    rating: 4.1,
    reviewCount: 78,
  },
  {
    category: "decoration",
    cities: ["Abuja"],
    offset: 0,
    name: "Royal Decor Abuja",
    businessName: "Royal Decor Ltd Abuja",
    email: "info@royaldecor.ng",
    phone: "+234-842-345-0123",
    tagline: "Décor worthy of the capital",
    description:
      "Top-tier decoration company in Abuja. Serving weddings, diplomatic events, and high-end corporate functions.",
    capacity: 1000,
    averagePrice: 280000,
    priceRange: { min: 120000, max: 600000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Full Wedding Décor", price: { amount: 300000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 122,
  },
  {
    category: "decoration",
    cities: ["Abuja"],
    offset: 1,
    name: "Chic Events Abuja",
    businessName: "Chic Events Ltd",
    email: "chic@abujadecor.ng",
    phone: "+234-843-456-1234",
    tagline: "Chic, modern, unforgettable",
    description:
      "Contemporary event decoration in Abuja. Modern aesthetics with clean lines and statement pieces.",
    capacity: 500,
    averagePrice: 160000,
    priceRange: { min: 80000, max: 320000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Modern Décor Package", price: { amount: 170000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 86,
  },
  {
    category: "decoration",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "PH Creative Decor",
    businessName: "Creative Décor PH",
    email: "info@phdecor.ng",
    phone: "+234-844-567-2345",
    tagline: "Creating dream events in PH",
    description:
      "Event decoration company in Port Harcourt. Specialises in wedding decorations and birthday party setups.",
    capacity: 500,
    averagePrice: 180000,
    priceRange: { min: 80000, max: 380000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Full Wedding Décor", price: { amount: 200000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 69,
  },

  // ================================================================
  // ENTERTAINMENT (DJ / Live Band)
  // ================================================================
  {
    category: "entertainment",
    cities: ["Lagos"],
    offset: 0,
    name: "DJ Mixmaster Lagos",
    businessName: "Mixmaster Entertainment",
    email: "dj@mixmaster.ng",
    phone: "+234-845-678-3456",
    tagline: "Keep the party going all night long",
    description:
      "Professional DJ services for all types of events. Multi-genre library, professional equipment, and MC services included.",
    capacity: 1000,
    averagePrice: 100000,
    priceRange: { min: 50000, max: 200000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "DJ (6 hrs) + MC", price: { amount: 100000, currency: "NGN" } },
      { name: "DJ Only (4 hrs)", price: { amount: 60000, currency: "NGN" } },
      { name: "Extra Hour", price: { amount: 15000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 245,
  },
  {
    category: "entertainment",
    cities: ["Lagos"],
    offset: 1,
    name: "The Groove Band",
    businessName: "Groove Live Entertainment",
    email: "book@groovelive.ng",
    phone: "+234-846-789-4567",
    tagline: "Live music that moves the crowd",
    description:
      "5-piece live band covering afrobeats, highlife, jazz, and contemporary hits. Perfect for weddings and high-end corporate events.",
    capacity: 800,
    averagePrice: 180000,
    priceRange: { min: 100000, max: 350000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Live Performance (4 hrs)", price: { amount: 200000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 112,
  },
  {
    category: "entertainment",
    cities: ["Lagos"],
    offset: 2,
    name: "BeatBox DJ Services",
    businessName: "BeatBox Entertainment",
    email: "info@beatboxdj.ng",
    phone: "+234-847-890-5678",
    tagline: "Affordable DJ, premium sound",
    description:
      "Budget-friendly DJ and sound equipment packages for parties, birthdays, and casual events.",
    capacity: 500,
    averagePrice: 55000,
    priceRange: { min: 30000, max: 100000 },
    eventTypes: ["birthday", "graduation", "corporate"],
    services: [
      { name: "DJ Package (4 hrs)", price: { amount: 50000, currency: "NGN" } },
    ],
    rating: 4.2,
    reviewCount: 88,
  },
  {
    category: "entertainment",
    cities: ["Abuja"],
    offset: 0,
    name: "Capital Sounds DJ",
    businessName: "Capital Sounds Entertainment",
    email: "info@capitalsounds.ng",
    phone: "+234-848-901-6789",
    tagline: "Abuja's entertainment powerhouse",
    description:
      "Professional DJ and band management in Abuja. Serving diplomatic events, weddings, and galas.",
    capacity: 1200,
    averagePrice: 130000,
    priceRange: { min: 70000, max: 250000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "DJ Set (6 hrs)", price: { amount: 130000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 104,
  },
  {
    category: "entertainment",
    cities: ["Abuja"],
    offset: 1,
    name: "Fusion Live Band Abuja",
    businessName: "Fusion Band Abuja",
    email: "book@fusionband.ng",
    phone: "+234-849-012-7890",
    tagline: "Fusing rhythms for unforgettable nights",
    description:
      "High-energy live band in Abuja covering diverse genres. Ideal for luxury weddings and high-profile corporate events.",
    capacity: 600,
    averagePrice: 200000,
    priceRange: { min: 120000, max: 380000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Live Show (4 hrs)", price: { amount: 220000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 77,
  },
  {
    category: "entertainment",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "PH Party DJ",
    businessName: "PH Party Entertainment",
    email: "dj@phparty.ng",
    phone: "+234-850-123-8901",
    tagline: "Keeping PH dancing",
    description:
      "Popular DJ service in Port Harcourt. Covering weddings, oil-sector parties, and birthdays.",
    capacity: 800,
    averagePrice: 90000,
    priceRange: { min: 50000, max: 180000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "DJ (5 hrs)", price: { amount: 90000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 67,
  },

  // ================================================================
  // AUDIO VISUAL (AV EQUIPMENT)
  // ================================================================
  {
    category: "audio_visual",
    cities: ["Lagos"],
    offset: 0,
    name: "SoundPro AV Lagos",
    businessName: "SoundPro AV Services",
    email: "av@soundprolagos.ng",
    phone: "+234-851-234-9012",
    tagline: "Crystal clear sound and vision",
    description:
      "Full AV rental and setup for events. PA systems, projectors, LED screens, microphones, and staging.",
    capacity: 1000,
    averagePrice: 120000,
    priceRange: { min: 50000, max: 300000 },
    eventTypes: ["corporate", "conference", "wedding"],
    services: [
      { name: "PA System + Mics (1 day)", price: { amount: 80000, currency: "NGN" } },
      { name: "LED Screen (10x6 ft)", price: { amount: 100000, currency: "NGN" } },
      { name: "Projector & Screen", price: { amount: 50000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 145,
  },
  {
    category: "audio_visual",
    cities: ["Lagos"],
    offset: 1,
    name: "TechStage Solutions",
    businessName: "TechStage Events",
    email: "info@techstage.ng",
    phone: "+234-852-345-0123",
    tagline: "Pro staging and AV for every event",
    description:
      "Stage design and AV packages for concerts, conferences, and weddings. LED walls, staging, and lighting combined.",
    capacity: 2000,
    averagePrice: 200000,
    priceRange: { min: 100000, max: 500000 },
    eventTypes: ["corporate", "conference", "wedding"],
    services: [
      { name: "Full AV Package", price: { amount: 220000, currency: "NGN" } },
      { name: "Stage + Sound Bundle", price: { amount: 350000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 88,
  },
  {
    category: "audio_visual",
    cities: ["Lagos"],
    offset: 2,
    name: "Micro Sound Rentals",
    businessName: "Micro Sound Ltd",
    email: "hire@microsound.ng",
    phone: "+234-853-456-1234",
    tagline: "Small budget, big sound",
    description:
      "Affordable PA system and microphone rentals for small events and churches. Quick setup, professional equipment.",
    capacity: 300,
    averagePrice: 40000,
    priceRange: { min: 20000, max: 80000 },
    eventTypes: ["corporate", "birthday", "graduation"],
    services: [
      { name: "Mini PA (1 day)", price: { amount: 35000, currency: "NGN" } },
      { name: "Wireless Mic x2", price: { amount: 15000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 76,
  },
  {
    category: "audio_visual",
    cities: ["Abuja"],
    offset: 0,
    name: "Capitol AV Services",
    businessName: "Capitol AV Abuja",
    email: "info@capitolav.ng",
    phone: "+234-854-567-2345",
    tagline: "Professional AV for Abuja events",
    description:
      "Premium AV rental and production in Abuja. Serving government conferences, corporate events, and gala dinners.",
    capacity: 2000,
    averagePrice: 180000,
    priceRange: { min: 80000, max: 450000 },
    eventTypes: ["corporate", "conference", "wedding"],
    services: [
      { name: "Conference AV Package", price: { amount: 200000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 94,
  },
  {
    category: "audio_visual",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "GRA Sound & Vision PH",
    businessName: "GRA Sound Vision",
    email: "info@grasound.ng",
    phone: "+234-855-678-3456",
    tagline: "PH's AV professionals",
    description:
      "Full-service AV company in Port Harcourt. PA systems, screens, and lighting for all events.",
    capacity: 800,
    averagePrice: 100000,
    priceRange: { min: 50000, max: 250000 },
    eventTypes: ["corporate", "wedding", "conference"],
    services: [
      { name: "PA + Screen Package", price: { amount: 120000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 58,
  },

  // ================================================================
  // LIGHTING
  // ================================================================
  {
    category: "lighting",
    cities: ["Lagos"],
    offset: 0,
    name: "LumiGlow Lighting Lagos",
    businessName: "LumiGlow Event Lighting",
    email: "info@lumiglow.ng",
    phone: "+234-856-789-4567",
    tagline: "Set the perfect mood with light",
    description:
      "Professional event lighting design and rental. LED uplighting, fairy lights, gobo projectors, and stage wash.",
    capacity: 800,
    averagePrice: 120000,
    priceRange: { min: 50000, max: 300000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Venue Uplighting (full)", price: { amount: 100000, currency: "NGN" } },
      { name: "Fairy Light Canopy", price: { amount: 80000, currency: "NGN" } },
      { name: "Stage Wash Lights", price: { amount: 60000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 132,
  },
  {
    category: "lighting",
    cities: ["Lagos"],
    offset: 1,
    name: "Neon Nights Lagos",
    businessName: "Neon Nights Events",
    email: "glow@neonnights.ng",
    phone: "+234-857-890-5678",
    tagline: "Light up your night",
    description:
      "Trendy neon sign rentals, LED dance floors, and uplighting packages for parties and weddings.",
    capacity: 500,
    averagePrice: 90000,
    priceRange: { min: 40000, max: 200000 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "LED Dance Floor (20x20)", price: { amount: 120000, currency: "NGN" } },
      { name: "Neon Sign (custom)", price: { amount: 50000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 98,
  },
  {
    category: "lighting",
    cities: ["Lagos"],
    offset: 2,
    name: "BrightDay Lighting",
    businessName: "BrightDay Rentals",
    email: "hire@brightday.ng",
    phone: "+234-858-901-6789",
    tagline: "Affordable lighting for every event",
    description:
      "Budget-friendly lighting hire. Good for small weddings, birthday parties, and outdoor events.",
    capacity: 400,
    averagePrice: 45000,
    priceRange: { min: 20000, max: 90000 },
    eventTypes: ["birthday", "graduation", "wedding"],
    services: [
      { name: "Basic Lighting Package", price: { amount: 45000, currency: "NGN" } },
    ],
    rating: 4.1,
    reviewCount: 66,
  },
  {
    category: "lighting",
    cities: ["Abuja"],
    offset: 0,
    name: "Luminary Abuja",
    businessName: "Luminary Events Abuja",
    email: "info@luminaryabuja.ng",
    phone: "+234-859-012-7890",
    tagline: "Illuminate every celebration",
    description:
      "Premium lighting design and installation in Abuja. Specialises in government galas and luxury weddings.",
    capacity: 1000,
    averagePrice: 150000,
    priceRange: { min: 70000, max: 350000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Full Lighting Design", price: { amount: 160000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 82,
  },
  {
    category: "lighting",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "Delta Lights PH",
    businessName: "Delta Event Lighting PH",
    email: "info@deltalights.ng",
    phone: "+234-860-123-8901",
    tagline: "PH events shining bright",
    description:
      "Lighting hire and design for weddings and corporate events in Port Harcourt.",
    capacity: 600,
    averagePrice: 95000,
    priceRange: { min: 45000, max: 220000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Venue Lighting Package", price: { amount: 100000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 49,
  },

  // ================================================================
  // TRANSPORTATION
  // ================================================================
  {
    category: "transportation",
    cities: ["Lagos"],
    offset: 0,
    name: "GlideRide Event Transport",
    businessName: "GlideRide Transport Ltd",
    email: "bookings@glideride.ng",
    phone: "+234-861-234-9012",
    tagline: "Arrive in style, leave in comfort",
    description:
      "Luxury vehicle rentals for weddings and corporate events. Fleet includes wedding cars, luxury SUVs, and shuttles.",
    capacity: 200,
    averagePrice: 100000,
    priceRange: { min: 50000, max: 250000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Wedding Car (1 day)", price: { amount: 80000, currency: "NGN" } },
      { name: "Shuttle Bus (20-seater)", price: { amount: 60000, currency: "NGN" } },
      { name: "VIP SUV (1 day)", price: { amount: 120000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 118,
  },
  {
    category: "transportation",
    cities: ["Lagos"],
    offset: 1,
    name: "ElegantRides Lagos",
    businessName: "ElegantRides Nigeria",
    email: "info@elegantrides.ng",
    phone: "+234-862-345-0123",
    tagline: "Luxury transport for your big day",
    description:
      "Prestige car hire specialising in Rolls Royce, Mercedes-Benz, and Range Rover for weddings and VIP events.",
    capacity: 50,
    averagePrice: 180000,
    priceRange: { min: 100000, max: 400000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Rolls Royce (1 day)", price: { amount: 350000, currency: "NGN" } },
      { name: "Mercedes S-Class (1 day)", price: { amount: 200000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 76,
  },
  {
    category: "transportation",
    cities: ["Lagos"],
    offset: 2,
    name: "BudgetShuttle Lagos",
    businessName: "BudgetShuttle Services",
    email: "info@budgetshuttle.ng",
    phone: "+234-863-456-1234",
    tagline: "Get guests there on time, on budget",
    description:
      "Affordable guest shuttle service for events. Mini-buses and buses available for 20–60 passengers.",
    capacity: 300,
    averagePrice: 50000,
    priceRange: { min: 30000, max: 90000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Mini-bus (20-seater, 1 day)", price: { amount: 45000, currency: "NGN" } },
    ],
    rating: 4.2,
    reviewCount: 55,
  },
  {
    category: "transportation",
    cities: ["Abuja"],
    offset: 0,
    name: "Capital Cars Abuja",
    businessName: "Capital Cars Ltd",
    email: "hire@capitalcars.ng",
    phone: "+234-864-567-2345",
    tagline: "Prestige transport in the FCT",
    description:
      "Luxury car hire in Abuja. Serving weddings, diplomatic functions, and corporate events.",
    capacity: 100,
    averagePrice: 150000,
    priceRange: { min: 80000, max: 350000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Luxury Car (1 day)", price: { amount: 160000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 89,
  },
  {
    category: "transportation",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "PH Event Transport",
    businessName: "PH Event Transport Ltd",
    email: "transport@pheventtransport.ng",
    phone: "+234-865-678-3456",
    tagline: "PH premium event logistics",
    description:
      "Wedding cars and guest shuttles in Port Harcourt. Luxury and affordable options.",
    capacity: 200,
    averagePrice: 90000,
    priceRange: { min: 50000, max: 200000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Wedding Car (1 day)", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 51,
  },

  // ================================================================
  // SECURITY
  // ================================================================
  {
    category: "security",
    cities: ["Lagos"],
    offset: 0,
    name: "SecureGuard Event Security",
    businessName: "SecureGuard Ltd",
    email: "events@secureguard.ng",
    phone: "+234-866-789-4567",
    tagline: "Your guests' safety is our priority",
    description:
      "Professional event security services for Lagos. Trained guards, crowd control, VIP protection, and access management.",
    capacity: 2000,
    averagePrice: 60000,
    priceRange: { min: 30000, max: 150000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Security Team (4 guards, 8 hrs)", price: { amount: 60000, currency: "NGN" } },
      { name: "VIP Protection (2 guards)", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 124,
  },
  {
    category: "security",
    cities: ["Lagos"],
    offset: 1,
    name: "Eagle Eye Security",
    businessName: "Eagle Eye Security Services",
    email: "info@eagleeye.ng",
    phone: "+234-867-890-5678",
    tagline: "Watchful, reliable, professional",
    description:
      "Comprehensive event security solutions. Unarmed and armed options available for private and corporate events.",
    capacity: 5000,
    averagePrice: 90000,
    priceRange: { min: 50000, max: 200000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Guard Team (6 guards, 8 hrs)", price: { amount: 90000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 98,
  },
  {
    category: "security",
    cities: ["Lagos"],
    offset: 2,
    name: "Budget Guard Services",
    businessName: "Budget Guard Ltd",
    email: "info@budgetguard.ng",
    phone: "+234-868-901-6789",
    tagline: "Reliable security on a budget",
    description:
      "Cost-effective security for small and medium events. Good for birthday parties, graduations, and small corporate gatherings.",
    capacity: 500,
    averagePrice: 30000,
    priceRange: { min: 20000, max: 60000 },
    eventTypes: ["birthday", "graduation", "corporate"],
    services: [
      { name: "Security (2 guards, 6 hrs)", price: { amount: 28000, currency: "NGN" } },
    ],
    rating: 4.1,
    reviewCount: 67,
  },
  {
    category: "security",
    cities: ["Abuja"],
    offset: 0,
    name: "Capitol Shield Security",
    businessName: "Capitol Shield Ltd",
    email: "info@capitolshield.ng",
    phone: "+234-869-012-7890",
    tagline: "Securing Abuja's finest events",
    description:
      "Elite security services in Abuja. Serving diplomatic functions, weddings, and high-profile corporate events.",
    capacity: 3000,
    averagePrice: 100000,
    priceRange: { min: 60000, max: 280000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Event Security Package", price: { amount: 120000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 72,
  },
  {
    category: "security",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "Fortress Security PH",
    businessName: "Fortress Security Services",
    email: "info@fortresssecurity.ng",
    phone: "+234-870-123-8901",
    tagline: "PH's trusted event security",
    description:
      "Professional security for weddings, corporate events, and VIP gatherings in Port Harcourt.",
    capacity: 1500,
    averagePrice: 55000,
    priceRange: { min: 30000, max: 150000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Event Security (4 guards)", price: { amount: 55000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 48,
  },

  // ================================================================
  // FLORALS
  // ================================================================
  {
    category: "florals",
    cities: ["Lagos"],
    offset: 0,
    name: "Bloom & Blossom Florals",
    businessName: "Bloom & Blossom Ltd",
    email: "flowers@bloomblossom.ng",
    phone: "+234-871-234-9012",
    tagline: "Fresh flowers for every celebration",
    description:
      "Premium floral design for weddings and events. Bridal bouquets, centrepieces, and venue floral installations.",
    capacity: 300,
    averagePrice: 70000,
    priceRange: { min: 30000, max: 250000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Bridal Bouquet", price: { amount: 30000, currency: "NGN" } },
      { name: "Centrepieces x10", price: { amount: 90000, currency: "NGN" } },
      { name: "Ceremony Arch", price: { amount: 150000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 145,
  },
  {
    category: "florals",
    cities: ["Lagos"],
    offset: 1,
    name: "Garden of Eden Florist",
    businessName: "Garden of Eden Florals",
    email: "blooms@gardenofeden.ng",
    phone: "+234-872-345-0123",
    tagline: "Turning venues into floral paradise",
    description:
      "Luxury floral installations and arrangements. Known for large statement arches and cascading floral walls.",
    capacity: 500,
    averagePrice: 120000,
    priceRange: { min: 60000, max: 400000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Floral Wall (6x8 ft)", price: { amount: 180000, currency: "NGN" } },
      { name: "Full Venue Florals", price: { amount: 350000, currency: "NGN" } },
    ],
    rating: 4.9,
    reviewCount: 88,
  },
  {
    category: "florals",
    cities: ["Lagos"],
    offset: 2,
    name: "Petals & Stems Lagos",
    businessName: "Petals & Stems",
    email: "info@petalsstems.ng",
    phone: "+234-873-456-1234",
    tagline: "Beautiful blooms for every budget",
    description:
      "Affordable fresh flower arrangements. Ideal for smaller weddings, birthday parties, and office events.",
    capacity: 200,
    averagePrice: 45000,
    priceRange: { min: 20000, max: 100000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Small Floral Package", price: { amount: 40000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 72,
  },
  {
    category: "florals",
    cities: ["Abuja"],
    offset: 0,
    name: "Rose & Reed Abuja",
    businessName: "Rose & Reed Florals",
    email: "info@rosereed.ng",
    phone: "+234-874-567-2345",
    tagline: "Capital city's finest florals",
    description:
      "Premium floral design in Abuja. Covering weddings, state events, and corporate dinners.",
    capacity: 500,
    averagePrice: 90000,
    priceRange: { min: 40000, max: 300000 },
    eventTypes: ["wedding", "corporate"],
    services: [
      { name: "Wedding Florals Package", price: { amount: 100000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 66,
  },
  {
    category: "florals",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "Tropical Blooms PH",
    businessName: "Tropical Blooms Florist",
    email: "info@tropicalblooms.ng",
    phone: "+234-875-678-3456",
    tagline: "Tropical beauty for PH celebrations",
    description:
      "Tropical and exotic floral arrangements for events in Port Harcourt. Specialises in bold, statement displays.",
    capacity: 300,
    averagePrice: 65000,
    priceRange: { min: 30000, max: 200000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Floral Package", price: { amount: 70000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 44,
  },

  // ================================================================
  // CAKE & DESSERTS
  // ================================================================
  {
    category: "cake_desserts",
    cities: ["Lagos"],
    offset: 0,
    name: "Sweet Sensations Cakes",
    businessName: "Sweet Sensations Ltd",
    email: "orders@sweetsensations.ng",
    phone: "+234-876-789-4567",
    tagline: "Creating sweet memories one cake at a time",
    description:
      "Custom cake design and dessert catering for weddings and events. Multi-tier wedding cakes and elaborate dessert tables.",
    capacity: 500,
    averagePrice: 55000,
    priceRange: { min: 25000, max: 200000 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "3-Tier Wedding Cake", price: { amount: 90000, currency: "NGN" } },
      { name: "Birthday Cake (custom)", price: { amount: 40000, currency: "NGN" } },
      { name: "Dessert Table Setup", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 178,
  },
  {
    category: "cake_desserts",
    cities: ["Lagos"],
    offset: 1,
    name: "Cake Palace Lagos",
    businessName: "Cake Palace Nigeria",
    email: "info@cakepalace.ng",
    phone: "+234-877-890-5678",
    tagline: "Luxury cakes for luxury moments",
    description:
      "Premium wedding and celebration cakes. Fondant art, sugar flowers, and multi-tier designs for discerning clients.",
    capacity: 300,
    averagePrice: 100000,
    priceRange: { min: 60000, max: 350000 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "Luxury Wedding Cake (5-tier)", price: { amount: 200000, currency: "NGN" } },
      { name: "Cupcake Tower (100 pcs)", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.9,
    reviewCount: 134,
  },
  {
    category: "cake_desserts",
    cities: ["Lagos"],
    offset: 2,
    name: "Sprinkles Bakery",
    businessName: "Sprinkles Bakery Ltd",
    email: "info@sprinklesbakery.ng",
    phone: "+234-878-901-6789",
    tagline: "Affordable cakes for everyone",
    description:
      "Budget-friendly cake shop in Lagos. Covering birthday cakes, small wedding cakes, and cupcakes.",
    capacity: 200,
    averagePrice: 25000,
    priceRange: { min: 10000, max: 60000 },
    eventTypes: ["birthday", "graduation", "wedding"],
    services: [
      { name: "2-Tier Cake", price: { amount: 30000, currency: "NGN" } },
      { name: "Sheet Cake (50 servings)", price: { amount: 18000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 95,
  },
  {
    category: "cake_desserts",
    cities: ["Abuja"],
    offset: 0,
    name: "Fondant Dreams Abuja",
    businessName: "Fondant Dreams Ltd",
    email: "cakes@fondantdreams.ng",
    phone: "+234-879-012-7890",
    tagline: "Edible art for Abuja celebrations",
    description:
      "Artisan cake studio in Abuja. Fondant art, sugar work, and bespoke wedding cakes for high-end clients.",
    capacity: 300,
    averagePrice: 80000,
    priceRange: { min: 40000, max: 250000 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "Bespoke Wedding Cake", price: { amount: 100000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 88,
  },
  {
    category: "cake_desserts",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "Velvet Cakes PH",
    businessName: "Velvet Cakes Nigeria",
    email: "info@velvetcakes.ng",
    phone: "+234-880-123-8901",
    tagline: "PH's cake queen",
    description:
      "Beautiful custom cakes for weddings and celebrations in Port Harcourt. Red velvet speciality.",
    capacity: 200,
    averagePrice: 50000,
    priceRange: { min: 25000, max: 150000 },
    eventTypes: ["wedding", "birthday"],
    services: [
      { name: "Wedding Cake (3-tier)", price: { amount: 70000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 62,
  },

  // ================================================================
  // INVITATIONS & STATIONERY
  // ================================================================
  {
    category: "invitations",
    cities: ["Lagos"],
    offset: 0,
    name: "Elegant Invites Lagos",
    businessName: "Elegant Invites Ltd",
    email: "info@elegantinvites.ng",
    phone: "+234-881-234-9012",
    tagline: "First impressions that last forever",
    description:
      "Premium wedding and event invitations. Letterpress, foil, and digital invitation design and printing.",
    capacity: 1000,
    averagePrice: 45000,
    priceRange: { min: 20000, max: 120000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Wedding Suite (100 sets)", price: { amount: 60000, currency: "NGN" } },
      { name: "Digital Invite Design", price: { amount: 20000, currency: "NGN" } },
      { name: "RSVP Cards (100)", price: { amount: 15000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 112,
  },
  {
    category: "invitations",
    cities: ["Lagos"],
    offset: 1,
    name: "PrintGlam Nigeria",
    businessName: "PrintGlam Studios",
    email: "print@printglam.ng",
    phone: "+234-882-345-0123",
    tagline: "Your invitations, your style",
    description:
      "Custom invitation printing and design. Wide range of styles from classic to contemporary.",
    capacity: 2000,
    averagePrice: 30000,
    priceRange: { min: 15000, max: 80000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Invitations x100", price: { amount: 30000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 89,
  },
  {
    category: "invitations",
    cities: ["Lagos"],
    offset: 2,
    name: "BudgetPrint Invites",
    businessName: "BudgetPrint Ltd",
    email: "info@budgetprint.ng",
    phone: "+234-883-456-1234",
    tagline: "Affordable, quality printing",
    description:
      "Low-cost invitation and stationery printing for all event types.",
    capacity: 5000,
    averagePrice: 12000,
    priceRange: { min: 5000, max: 30000 },
    eventTypes: ["birthday", "graduation", "wedding"],
    services: [
      { name: "Invitations x50", price: { amount: 8000, currency: "NGN" } },
    ],
    rating: 4.1,
    reviewCount: 76,
  },
  {
    category: "invitations",
    cities: ["Abuja"],
    offset: 0,
    name: "Prestige Prints Abuja",
    businessName: "Prestige Prints",
    email: "info@prestigeprints.ng",
    phone: "+234-884-567-2345",
    tagline: "Capital city stationery excellence",
    description:
      "High-quality event stationery and invitations in Abuja. Catering to diplomatic events, weddings, and state functions.",
    capacity: 3000,
    averagePrice: 55000,
    priceRange: { min: 25000, max: 150000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Premium Suite (100 sets)", price: { amount: 70000, currency: "NGN" } },
    ],
    rating: 4.7,
    reviewCount: 67,
  },
  {
    category: "invitations",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "PH Invites Studio",
    businessName: "PH Invites",
    email: "info@phinvites.ng",
    phone: "+234-885-678-3456",
    tagline: "Invitations that set the tone",
    description:
      "Custom wedding and event invitation studio in Port Harcourt.",
    capacity: 1000,
    averagePrice: 35000,
    priceRange: { min: 15000, max: 90000 },
    eventTypes: ["wedding", "birthday", "corporate"],
    services: [
      { name: "Invitation Set (100)", price: { amount: 38000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 44,
  },

  // ================================================================
  // RENTALS (equipment, furniture, tents)
  // ================================================================
  {
    category: "rentals",
    cities: ["Lagos"],
    offset: 0,
    name: "Party Rentals Plus",
    businessName: "Party Rentals Plus Ltd",
    email: "rentals@partyrentals.ng",
    phone: "+234-886-789-4567",
    tagline: "Everything you need for the perfect event",
    description:
      "Complete party rental service. Tables, chairs, linens, tents, and more. Quality equipment for events of all sizes.",
    capacity: 1000,
    averagePrice: 60000,
    priceRange: { min: 30000, max: 150000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Table & Chair Package (50 pax)", price: { amount: 50000, currency: "NGN" } },
      { name: "Tent (20x30 ft)", price: { amount: 55000, currency: "NGN" } },
      { name: "Linen Set (50 pax)", price: { amount: 30000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 203,
  },
  {
    category: "rentals",
    cities: ["Lagos"],
    offset: 1,
    name: "EventFurniture Lagos",
    businessName: "EventFurniture Ltd",
    email: "hire@eventfurniture.ng",
    phone: "+234-887-890-5678",
    tagline: "Quality furniture for quality events",
    description:
      "Premium furniture hire. Chiavari chairs, round tables, cocktail tables, LED furniture, and lounge sets.",
    capacity: 2000,
    averagePrice: 80000,
    priceRange: { min: 40000, max: 200000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Chiavari Chairs x100", price: { amount: 80000, currency: "NGN" } },
      { name: "LED Cocktail Tables x10", price: { amount: 100000, currency: "NGN" } },
    ],
    rating: 4.6,
    reviewCount: 134,
  },
  {
    category: "rentals",
    cities: ["Lagos"],
    offset: 2,
    name: "Budget Tents & Chairs",
    businessName: "Budget Rentals Nigeria",
    email: "info@budgetrentals.ng",
    phone: "+234-888-901-6789",
    tagline: "Affordable equipment hire for every event",
    description:
      "Low-cost tent, table, and chair hire. Perfect for outdoor parties, funerals, and community events.",
    capacity: 3000,
    averagePrice: 30000,
    priceRange: { min: 15000, max: 70000 },
    eventTypes: ["birthday", "graduation", "corporate", "wedding"],
    services: [
      { name: "Table + Chairs (20 pax)", price: { amount: 20000, currency: "NGN" } },
    ],
    rating: 4.0,
    reviewCount: 88,
  },
  {
    category: "rentals",
    cities: ["Abuja"],
    offset: 0,
    name: "Capitol Rentals Abuja",
    businessName: "Capitol Rentals Ltd",
    email: "hire@capitolrentals.ng",
    phone: "+234-889-012-7890",
    tagline: "Premium event equipment in the FCT",
    description:
      "Quality tent, table, chair, and linen hire for events in Abuja. Same-day delivery available.",
    capacity: 2000,
    averagePrice: 75000,
    priceRange: { min: 35000, max: 200000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Full Equipment Package", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.5,
    reviewCount: 76,
  },
  {
    category: "rentals",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "PH Event Hire",
    businessName: "PH Event Hire Ltd",
    email: "hire@pheventhire.ng",
    phone: "+234-890-123-8901",
    tagline: "PH's go-to equipment hire",
    description:
      "Tents, tables, chairs, linens, and AV equipment hire in Port Harcourt.",
    capacity: 1500,
    averagePrice: 55000,
    priceRange: { min: 25000, max: 150000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Table & Chair Package", price: { amount: 50000, currency: "NGN" } },
    ],
    rating: 4.3,
    reviewCount: 55,
  },

  // ================================================================
  // EVENT PLANNING / COORDINATION
  // ================================================================
  {
    category: "event_planning",
    cities: ["Lagos"],
    offset: 0,
    name: "Platinum Events Lagos",
    businessName: "Platinum Events Ltd",
    email: "info@platinumevents.ng",
    phone: "+234-891-234-9012",
    tagline: "Full-service event planning perfection",
    description:
      "Award-winning full-service event planning company. From concept to execution, we handle everything for your perfect event.",
    capacity: 2000,
    averagePrice: 250000,
    priceRange: { min: 100000, max: 600000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Full Event Planning", price: { amount: 300000, currency: "NGN" } },
      { name: "Day-of Coordination", price: { amount: 100000, currency: "NGN" } },
    ],
    rating: 4.9,
    reviewCount: 189,
  },
  {
    category: "event_planning",
    cities: ["Lagos"],
    offset: 1,
    name: "Simply Weddings Co.",
    businessName: "Simply Weddings Nigeria",
    email: "info@simplyweddings.ng",
    phone: "+234-892-345-0123",
    tagline: "Your wedding, simply perfect",
    description:
      "Specialist wedding planner in Lagos. Budget management, vendor sourcing, and flawless execution.",
    capacity: 1000,
    averagePrice: 180000,
    priceRange: { min: 80000, max: 400000 },
    eventTypes: ["wedding"],
    services: [
      { name: "Full Wedding Planning", price: { amount: 200000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 144,
  },
  {
    category: "event_planning",
    cities: ["Lagos"],
    offset: 2,
    name: "Budget Planners NG",
    businessName: "Budget Planners Nigeria",
    email: "info@budgetplanners.ng",
    phone: "+234-893-456-1234",
    tagline: "Great events on any budget",
    description:
      "Affordable event planning and coordination. Specialises in small to mid-sized events and corporate functions.",
    capacity: 500,
    averagePrice: 80000,
    priceRange: { min: 40000, max: 150000 },
    eventTypes: ["birthday", "graduation", "corporate"],
    services: [
      { name: "Event Coordination", price: { amount: 80000, currency: "NGN" } },
    ],
    rating: 4.4,
    reviewCount: 98,
  },
  {
    category: "event_planning",
    cities: ["Abuja"],
    offset: 0,
    name: "FCT Event Masters",
    businessName: "FCT Event Masters Ltd",
    email: "info@fcteventmasters.ng",
    phone: "+234-894-567-2345",
    tagline: "Abuja's top event planning firm",
    description:
      "Full-service event planning in Abuja. Serving corporate events, state functions, weddings, and gala dinners.",
    capacity: 2000,
    averagePrice: 300000,
    priceRange: { min: 120000, max: 700000 },
    eventTypes: ["wedding", "corporate", "conference"],
    services: [
      { name: "Full Event Planning", price: { amount: 350000, currency: "NGN" } },
    ],
    rating: 4.9,
    reviewCount: 112,
  },
  {
    category: "event_planning",
    cities: ["Port Harcourt"],
    offset: 0,
    name: "PH Premier Events",
    businessName: "PH Premier Events Ltd",
    email: "info@phpremierevents.ng",
    phone: "+234-895-678-3456",
    tagline: "Premier planning for PH's finest events",
    description:
      "Top event planning company in Port Harcourt. Weddings, oil sector corporate events, and VIP parties.",
    capacity: 1000,
    averagePrice: 220000,
    priceRange: { min: 100000, max: 500000 },
    eventTypes: ["wedding", "corporate", "birthday"],
    services: [
      { name: "Full Wedding Planning", price: { amount: 250000, currency: "NGN" } },
    ],
    rating: 4.8,
    reviewCount: 87,
  },
];

// -------------------------------------------------------------------
// Main seeding logic
// -------------------------------------------------------------------

const seedVendors = async () => {
  console.log("🌱 Starting extended vendor seeding...");

  let created = 0;
  let skipped = 0;
  const hashedPassword = await bcrypt.hash("VendorPass123!", 12);

  for (const v of VENDORS) {
    for (const cityName of v.cities) {
      const city = CITIES[cityName];
      if (!city) continue;

      const email = `${slug(v.name)}.${slug(cityName)}@vendor.ng`;

      // Skip if this vendor email already exists
      const exists = await User.findOne({ email });
      if (exists) {
        skipped++;
        continue;
      }

      try {
        // Create owner user
        const user = await User.create({
          firstName: v.name.split(" ")[0],
          lastName: v.name.split(" ").slice(1).join(" ") || "Events",
          email,
          password: hashedPassword,
          phone: v.phone,
          role: "vendor",
          isActive: true,
          status: "active",
          isEmailVerified: true,
          preferences: {
            notifications: { email: true, push: false, sms: false },
            theme: "light",
            language: "en",
          },
        });

        // Create vendor
        await Vendor.create({
          owner: user._id,
          name: v.name,
          businessName: v.businessName,
          displayName: v.businessName,
          email,
          phone: v.phone,
          tagline: v.tagline || "",
          businessType: BIZ_TYPE[v.category] || "other",
          category: v.category,
          eventTypes: v.eventTypes,
          averagePrice: v.averagePrice,
          priceRange: v.priceRange,
          capacity: v.capacity,
          availabilityStatus: "high",
          description: v.description,
          address: {
            street: "N/A",
            city: cityName,
            state: city.state,
            country: "Nigeria",
          },
          location: {
            type: "Point",
            coordinates: city.coords(v.offset || 0),
          },
          status: "approved",
          isActive: true,
          isFeatured: Math.random() > 0.7,
          services: (v.services || []).map((s) => ({
            name: s.name,
            price: s.price,
          })),
          rating: v.rating || 4.3,
          reviewCount: v.reviewCount || 50,
        });

        created++;
        console.log(`  ✅ ${v.name} (${v.category} — ${cityName})`);
      } catch (err) {
        console.error(`  ❌ Failed: ${v.name} (${cityName}): ${err.message}`);
      }
    }
  }

  const categoryBreakdown = {};
  VENDORS.forEach((v) => {
    const key = v.category;
    categoryBreakdown[key] = (categoryBreakdown[key] || 0) + v.cities.length;
  });

  console.log(`\n✅ Seeding complete — ${created} vendors created, ${skipped} skipped (already exist)`);
  console.log("\n📊 Category breakdown:");
  Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => console.log(`   ${cat.padEnd(18)} ${count} vendors`));
};

connectDB()
  .then(seedVendors)
  .catch((e) => console.error("❌ Seed error:", e))
  .finally(() => mongoose.connection.close());
