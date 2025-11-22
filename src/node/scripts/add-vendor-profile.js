import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import Lead from "../models/lead.model.js";
import Quote from "../models/quote.model.js";

dotenv.config();

const userEmail = "bootqlass@gmail.com";

async function addVendorProfile() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find the user
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      process.exit(1);
    }

    console.log(`\n👤 Found user: ${user.email} (${user.role})`);

    // Check if vendor profile already exists
    let vendor = await Vendor.findOne({ owner: user._id });

    if (vendor) {
      console.log(`\n🏢 Vendor profile already exists: ${vendor.name}`);
      console.log("   Updating existing profile...");
    } else {
      console.log("\n🏢 Creating new vendor profile...");
    }

    // Create or update vendor profile
    const vendorData = {
      owner: user._id,
      name: "Bootqlass Event Services",
      email: userEmail,
      phone: user.phone || "+234 803 555 6666",
      businessType: "other",
      category: "event_planning",
      subcategory: "Full Service Event Planning",
      eventTypes: ["wedding", "corporate", "birthday", "conference"],
      averagePrice: 500000,
      priceRange: { min: 300000, max: 1000000 },
      capacity: 0,
      availabilityStatus: "high",
      description:
        "Professional event planning services for all types of occasions. We handle everything from concept to execution.",
      address: {
        street: "123 Event Plaza",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100001",
      },
      location: {
        type: "Point",
        coordinates: [3.3792, 6.5244],
      },
      status: "approved",
      isVerified: true,
      rating: 4.7,
      reviewCount: 15,
      features: [
        "Full Event Planning",
        "Vendor Coordination",
        "Budget Management",
        "Timeline Management",
        "Day-of Coordination",
      ],
      images: ["https://example.com/bootqlass1.jpg"],
    };

    if (vendor) {
      vendor = await Vendor.findByIdAndUpdate(vendor._id, vendorData, {
        new: true,
      });
      console.log(`✅ Updated vendor profile: ${vendor.name}`);
    } else {
      vendor = await Vendor.create(vendorData);
      console.log(`✅ Created vendor profile: ${vendor.name}`);
    }

    // Create sample leads
    console.log("\n📋 Creating sample leads...");
    await Lead.deleteMany({ vendor: vendor._id });

    const leads = [
      {
        vendor: vendor._id,
        customer: {
          name: "John Smith",
          email: "john.smith@example.com",
          phone: "+234 803 111 1111",
        },
        eventDetails: {
          type: "wedding",
          date: new Date("2025-12-15"),
          location: "Lagos",
          venue: "The Grand Ballroom",
          guestCount: 200,
          budget: 5000000,
          description: "Elegant wedding ceremony and reception",
        },
        status: "new",
        priority: "high",
        source: "website",
        estimatedValue: 800000,
        tags: ["wedding", "luxury", "december"],
      },
      {
        vendor: vendor._id,
        customer: {
          name: "Sarah Johnson",
          email: "sarah.j@company.com",
          phone: "+234 803 222 2222",
        },
        eventDetails: {
          type: "corporate",
          date: new Date("2025-11-25"),
          location: "Victoria Island",
          venue: "Corporate Center",
          guestCount: 150,
          budget: 3000000,
          description: "Annual company conference",
        },
        status: "contacted",
        priority: "medium",
        source: "referral",
        estimatedValue: 600000,
        tags: ["corporate", "conference"],
        notes: [
          {
            text: "Initial contact made. Client interested in full planning package.",
            createdBy: user._id,
          },
        ],
      },
      {
        vendor: vendor._id,
        customer: {
          name: "Michael Brown",
          email: "mbrown@email.com",
          phone: "+234 803 333 3333",
        },
        eventDetails: {
          type: "birthday",
          date: new Date("2025-11-30"),
          location: "Lekki",
          guestCount: 80,
          budget: 1500000,
          description: "50th birthday celebration",
        },
        status: "quoted",
        priority: "medium",
        source: "social",
        estimatedValue: 400000,
        tags: ["birthday", "milestone"],
      },
      {
        vendor: vendor._id,
        customer: {
          name: "Emily Davis",
          email: "emily.davis@example.com",
          phone: "+234 803 444 4444",
        },
        eventDetails: {
          type: "wedding",
          date: new Date("2026-02-14"),
          location: "Abuja",
          guestCount: 300,
          budget: 8000000,
          description: "Valentine's Day destination wedding",
        },
        status: "negotiating",
        priority: "urgent",
        source: "direct",
        estimatedValue: 1200000,
        tags: ["wedding", "destination", "valentines"],
        followUpDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      },
      {
        vendor: vendor._id,
        customer: {
          name: "David Wilson",
          email: "dwilson@startup.com",
          phone: "+234 803 555 5555",
        },
        eventDetails: {
          type: "corporate",
          date: new Date("2025-12-10"),
          location: "Lagos",
          guestCount: 50,
          budget: 1000000,
          description: "Product launch event",
        },
        status: "won",
        priority: "high",
        source: "website",
        estimatedValue: 350000,
        actualValue: 380000,
        tags: ["corporate", "product-launch"],
        wonDate: new Date(),
      },
    ];

    const createdLeads = await Lead.insertMany(leads);
    console.log(`✅ Created ${createdLeads.length} sample leads`);

    // Create sample quotes
    console.log("\n💰 Creating sample quotes...");
    await Quote.deleteMany({ vendor: vendor._id });

    const quotes = [
      {
        vendor: vendor._id,
        createdBy: user._id,
        quoteNumber: `Q-${Date.now()}-001`,
        lead: createdLeads[1]._id, // Sarah Johnson - Corporate event
        customer: {
          name: "Sarah Johnson",
          email: "sarah.j@company.com",
          phone: "+234 803 222 2222",
        },
        eventDetails: {
          type: "corporate",
          date: new Date("2025-11-25"),
          location: "Victoria Island",
          guestCount: 150,
        },
        items: [
          {
            name: "Full Event Planning & Coordination",
            description: "Complete planning and day-of coordination",
            quantity: 1,
            unitPrice: 400000,
            total: 400000,
          },
          {
            name: "Vendor Management",
            description: "Coordination with all vendors",
            quantity: 1,
            unitPrice: 150000,
            total: 150000,
          },
          {
            name: "Timeline & Budget Management",
            description: "Detailed timeline and budget tracking",
            quantity: 1,
            unitPrice: 100000,
            total: 100000,
          },
        ],
        subtotal: 650000,
        tax: 0,
        discount: 50000,
        total: 600000,
        status: "sent",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        notes:
          "Package includes pre-event consultations and post-event wrap-up",
        terms:
          "50% deposit required upon acceptance. Balance due 7 days before event.",
      },
      {
        vendor: vendor._id,
        createdBy: user._id,
        quoteNumber: `Q-${Date.now()}-002`,
        lead: createdLeads[2]._id, // Michael Brown - Birthday
        customer: {
          name: "Michael Brown",
          email: "mbrown@email.com",
          phone: "+234 803 333 3333",
        },
        eventDetails: {
          type: "birthday",
          date: new Date("2025-11-30"),
          location: "Lekki",
          guestCount: 80,
        },
        items: [
          {
            name: "Birthday Event Planning",
            description: "Planning and coordination for birthday celebration",
            quantity: 1,
            unitPrice: 300000,
            total: 300000,
          },
          {
            name: "Decoration Coordination",
            description: "Theme design and decoration setup",
            quantity: 1,
            unitPrice: 100000,
            total: 100000,
          },
        ],
        subtotal: 400000,
        tax: 0,
        discount: 0,
        total: 400000,
        status: "sent",
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      {
        vendor: vendor._id,
        createdBy: user._id,
        quoteNumber: `Q-${Date.now()}-003`,
        lead: createdLeads[4]._id, // David Wilson - Won
        customer: {
          name: "David Wilson",
          email: "dwilson@startup.com",
          phone: "+234 803 555 5555",
        },
        eventDetails: {
          type: "corporate",
          date: new Date("2025-12-10"),
          location: "Lagos",
          guestCount: 50,
        },
        items: [
          {
            name: "Product Launch Planning",
            description: "Complete planning for product launch event",
            quantity: 1,
            unitPrice: 350000,
            total: 350000,
          },
          {
            name: "Media Coordination",
            description: "Press and media management",
            quantity: 1,
            unitPrice: 30000,
            total: 30000,
          },
        ],
        subtotal: 380000,
        tax: 0,
        discount: 0,
        total: 380000,
        status: "accepted",
        acceptedDate: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    ];

    const createdQuotes = await Quote.insertMany(quotes);
    console.log(`✅ Created ${createdQuotes.length} sample quotes`);

    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Summary");
    console.log("=".repeat(60));
    console.log(`✅ User: ${user.email}`);
    console.log(`✅ Vendor Profile: ${vendor.name}`);
    console.log(`✅ Category: ${vendor.category}`);
    console.log(`✅ Leads Created: ${createdLeads.length}`);
    console.log(`   - New: ${leads.filter((l) => l.status === "new").length}`);
    console.log(
      `   - Contacted: ${leads.filter((l) => l.status === "contacted").length}`
    );
    console.log(
      `   - Quoted: ${leads.filter((l) => l.status === "quoted").length}`
    );
    console.log(
      `   - Negotiating: ${
        leads.filter((l) => l.status === "negotiating").length
      }`
    );
    console.log(`   - Won: ${leads.filter((l) => l.status === "won").length}`);
    console.log(`✅ Quotes Created: ${createdQuotes.length}`);
    console.log(
      `   - Sent: ${quotes.filter((q) => q.status === "sent").length}`
    );
    console.log(
      `   - Accepted: ${quotes.filter((q) => q.status === "accepted").length}`
    );

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Setup completed successfully!");
    console.log("\n📝 Login Credentials:");
    console.log(`   Email: ${userEmail}`);
    console.log(`   Password: Ginger@123`);
    console.log("\n📝 You can now access:");
    console.log("   - GET /api/v1/vendors/profile");
    console.log("   - GET /api/v1/vendors/leads");
    console.log("   - GET /api/v1/vendors/leads/stats");
    console.log("   - GET /api/v1/vendors/quotes");
    console.log("   - GET /api/v1/vendors/calendar");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

addVendorProfile();
