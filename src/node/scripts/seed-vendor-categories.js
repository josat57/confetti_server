import mongoose from "mongoose";
import dotenv from "dotenv";
import VendorCategory from "../models/vendor-category.model.js";
import { logger } from "../utils/logger.js";

dotenv.config();

const categories = [
  {
    name: "venue",
    displayName: "Event Venue",
    description:
      "Spaces for hosting your event including halls, outdoor venues, and conference centers",
    icon: "building",
    priority: 10,
  },
  {
    name: "catering",
    displayName: "Catering Services",
    description:
      "Food and beverage services including full meals, buffets, and specialty cuisine",
    icon: "utensils",
    priority: 9,
  },
  {
    name: "entertainment",
    displayName: "Entertainment",
    description:
      "DJs, live bands, performers, MCs, and other entertainment services",
    icon: "music",
    priority: 8,
  },
  {
    name: "photography",
    displayName: "Photography",
    description: "Professional photography services to capture your event",
    icon: "camera",
    priority: 8,
  },
  {
    name: "videography",
    displayName: "Videography",
    description: "Professional video recording and editing services",
    icon: "video",
    priority: 7,
  },
  {
    name: "decoration",
    displayName: "Decoration",
    description: "Event decoration including themes, backdrops, and styling",
    icon: "palette",
    priority: 7,
  },
  {
    name: "florals",
    displayName: "Florals",
    description: "Flower arrangements, bouquets, and floral decorations",
    icon: "flower",
    priority: 6,
  },
  {
    name: "transportation",
    displayName: "Transportation",
    description: "Vehicle rentals and transportation services for guests",
    icon: "car",
    priority: 6,
  },
  {
    name: "audio_visual",
    displayName: "Audio/Visual Equipment",
    description: "Sound systems, projectors, screens, and lighting equipment",
    icon: "speaker",
    priority: 7,
  },
  {
    name: "event_planning",
    displayName: "Event Planning",
    description: "Professional event planning and coordination services",
    icon: "clipboard",
    priority: 8,
  },
  {
    name: "security",
    displayName: "Security Services",
    description: "Professional security personnel for your event",
    icon: "shield",
    priority: 5,
  },
  {
    name: "valet_parking",
    displayName: "Valet Parking",
    description: "Valet parking services for guests",
    icon: "parking",
    priority: 4,
  },
  {
    name: "rentals",
    displayName: "Equipment Rentals",
    description: "Tables, chairs, linens, and other equipment rentals",
    icon: "box",
    priority: 6,
  },
  {
    name: "cake_desserts",
    displayName: "Cake & Desserts",
    description: "Wedding cakes, birthday cakes, and dessert services",
    icon: "cake",
    priority: 6,
  },
  {
    name: "bar_services",
    displayName: "Bar Services",
    description: "Bartending and beverage services",
    icon: "glass",
    priority: 5,
  },
  {
    name: "lighting",
    displayName: "Lighting",
    description: "Professional lighting design and equipment",
    icon: "lightbulb",
    priority: 5,
  },
  {
    name: "invitations",
    displayName: "Invitations",
    description: "Invitation design and printing services",
    icon: "envelope",
    priority: 4,
  },
  {
    name: "favors_gifts",
    displayName: "Favors & Gifts",
    description: "Party favors and guest gifts",
    icon: "gift",
    priority: 3,
  },
];

async function seedVendorCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing categories
    await VendorCategory.deleteMany({});
    console.log("Cleared existing vendor categories");

    // Insert categories
    const result = await VendorCategory.insertMany(categories);
    console.log(`✅ Successfully seeded ${result.length} vendor categories`);

    // Display seeded categories
    console.log("\nSeeded Categories:");
    result.forEach((cat) => {
      console.log(`  - ${cat.displayName} (${cat.name})`);
    });

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding vendor categories:", error);
    process.exit(1);
  }
}

// Run the seeder
seedVendorCategories();
