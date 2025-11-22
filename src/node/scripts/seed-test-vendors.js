import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";

dotenv.config();

const testUsers = [
  {
    email: "vendor1@test.com",
    password: "Test1234!",
    firstName: "John",
    lastName: "Vendor",
    role: "vendor",
    status: "active",
    phone: "+234 803 111 2222",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
  },
  {
    email: "vendor2@test.com",
    password: "Test1234!",
    firstName: "Jane",
    lastName: "Smith",
    role: "vendor",
    status: "active",
    phone: "+234 803 222 3333",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
  },
  {
    email: "vendor3@test.com",
    password: "Test1234!",
    firstName: "Mike",
    lastName: "Johnson",
    role: "vendor",
    status: "active",
    phone: "+234 803 333 4444",
    isEmailVerified: true,
    emailVerifiedAt: new Date(),
    isActive: true,
  },
];

const vendorProfiles = [
  {
    name: "Elite Catering Services",
    email: "vendor1@test.com",
    phone: "+234 803 111 2222",
    businessType: "catering",
    category: "catering",
    subcategory: "Full Service Catering",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 10000,
    priceRange: { min: 7000, max: 15000 },
    capacity: 500,
    availabilityStatus: "high",
    description: "Premium catering service for all your event needs",
    address: {
      street: "123 Test Street",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: {
      type: "Point",
      coordinates: [3.3792, 6.5244],
    },
    status: "approved",
    isVerified: true,
    rating: 4.5,
    reviewCount: 25,
    features: ["Continental", "Nigerian Cuisine", "Buffet", "Waiters"],
  },
  {
    name: "Perfect Moments Photography",
    email: "vendor2@test.com",
    phone: "+234 803 222 3333",
    businessType: "photography",
    category: "photography",
    subcategory: "Wedding Photography",
    eventTypes: ["wedding", "birthday", "graduation"],
    averagePrice: 300000,
    priceRange: { min: 200000, max: 450000 },
    capacity: 0,
    availabilityStatus: "medium",
    description: "Capturing your special moments with professional photography",
    address: {
      street: "456 Photo Lane",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: {
      type: "Point",
      coordinates: [3.3792, 6.5244],
    },
    status: "approved",
    isVerified: true,
    rating: 4.8,
    reviewCount: 42,
    features: ["Digital Photos", "Album", "Drone", "Same Day Edit"],
  },
  {
    name: "Grand Event Hall",
    email: "vendor3@test.com",
    phone: "+234 803 333 4444",
    businessType: "venue",
    category: "venue",
    subcategory: "Event Hall",
    eventTypes: ["wedding", "corporate", "conference"],
    averagePrice: 1500000,
    priceRange: { min: 1000000, max: 2000000 },
    capacity: 800,
    availabilityStatus: "high",
    description: "Spacious and elegant event hall for memorable occasions",
    address: {
      street: "789 Venue Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: {
      type: "Point",
      coordinates: [3.3792, 6.5244],
    },
    status: "approved",
    isVerified: true,
    rating: 4.6,
    reviewCount: 38,
    features: ["AC", "Parking", "Catering Kitchen", "AV Equipment", "WiFi"],
  },
];

async function seedTestVendors() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing test users and vendors
    console.log("\n🧹 Cleaning up existing test data...");
    const testEmails = testUsers.map((u) => u.email);
    await User.deleteMany({ email: { $in: testEmails } });
    await Vendor.deleteMany({ email: { $in: testEmails } });
    console.log("✅ Cleared existing test users and vendors");

    // Create test users
    console.log("\n👤 Creating test users...");
    const createdUsers = [];
    for (const userData of testUsers) {
      const user = await User.create(userData);
      createdUsers.push(user);
      console.log(`  ✓ Created user: ${user.email} (${user.role})`);
    }

    // Create vendor profiles linked to users
    console.log("\n🏢 Creating vendor profiles...");
    const createdVendors = [];
    for (let i = 0; i < vendorProfiles.length; i++) {
      const vendorData = {
        ...vendorProfiles[i],
        owner: createdUsers[i]._id, // Link to user
      };
      const vendor = await Vendor.create(vendorData);
      createdVendors.push(vendor);
      console.log(
        `  ✓ Created vendor: ${vendor.name} (${vendor.category}) - Owner: ${createdUsers[i].email}`
      );
    }

    // Display summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Seeding Summary");
    console.log("=".repeat(60));
    console.log(`✅ Users created: ${createdUsers.length}`);
    console.log(`✅ Vendor profiles created: ${createdVendors.length}`);
    console.log("\n📝 Test Credentials:");
    console.log("=".repeat(60));
    testUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. ${vendorProfiles[index].name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Category: ${vendorProfiles[index].category}`);
    });
    console.log("\n" + "=".repeat(60));
    console.log("\n🎉 Test vendor seeding completed successfully!");
    console.log("\n📝 Next Steps:");
    console.log("  1. Login with any of the test credentials above");
    console.log("  2. Test vendor dashboard endpoints:");
    console.log("     GET /api/v1/vendors/leads");
    console.log("     GET /api/v1/vendors/calendar");
    console.log("     GET /api/v1/vendors/quotes");
    console.log("  3. Access vendor profile:");
    console.log("     GET /api/v1/vendors/profile");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding test vendors:", error);
    process.exit(1);
  }
}

seedTestVendors();
