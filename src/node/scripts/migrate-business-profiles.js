/**
 * Database Migration Script: Business Profile Management
 *
 * This script migrates the database to support business profile management:
 * 1. Adds business profile fields to existing vendor documents
 * 2. Creates indexes for the new fields
 * 3. Creates the PlannerBusinessProfile collection with indexes
 *
 * Usage: node src/node/scripts/migrate-business-profiles.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

// Import models to ensure they're registered
import Vendor from "../models/vendor.model.js";
import PlannerBusinessProfile from "../models/planner-business-profile.model.js";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/confetti";

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

async function migrateVendorCollection() {
  console.log("\n📦 Migrating Vendor collection...");

  try {
    // Get count of vendors before migration
    const totalVendors = await Vendor.countDocuments();
    console.log(`   Found ${totalVendors} vendor documents`);

    if (totalVendors === 0) {
      console.log("   No vendors to migrate");
      return;
    }

    // Update all vendors to add default values for new fields
    const result = await Vendor.updateMany(
      {
        // Only update documents that don't have the new fields
        verificationStatus: { $exists: false },
      },
      {
        $set: {
          verificationStatus: "pending",
          registrationNumber: null,
          taxId: null,
          yearEstablished: null,
          verifiedBy: null,
          rejectionReason: null,
        },
      }
    );

    // Ensure all vendors have branding defaults (if branding field doesn't exist)
    await Vendor.updateMany(
      {
        "branding.primaryColor": { $exists: false },
      },
      {
        $set: {
          "branding.primaryColor": "#6366F1",
          "branding.secondaryColor": "#10B981",
          "branding.font": "Inter",
        },
      }
    );

    console.log(
      `   ✅ Updated ${result.modifiedCount} vendor documents with default business profile fields`
    );

    // Create index on verificationStatus
    await Vendor.collection.createIndex({ verificationStatus: 1 });
    console.log("   ✅ Created index on verificationStatus");
  } catch (error) {
    console.error("   ❌ Error migrating vendor collection:", error);
    throw error;
  }
}

async function createPlannerBusinessProfileCollection() {
  console.log("\n📦 Setting up PlannerBusinessProfile collection...");

  try {
    // Check if collection exists
    const collections = await mongoose.connection.db
      .listCollections({ name: "plannerbusinessprofiles" })
      .toArray();

    if (collections.length > 0) {
      console.log("   Collection already exists");
    } else {
      console.log("   Creating new collection");
    }

    // Create indexes (this will create the collection if it doesn't exist)
    await PlannerBusinessProfile.createIndexes();
    console.log("   ✅ Created indexes for PlannerBusinessProfile collection");

    // Get count
    const count = await PlannerBusinessProfile.countDocuments();
    console.log(`   Collection has ${count} documents`);
  } catch (error) {
    console.error(
      "   ❌ Error creating PlannerBusinessProfile collection:",
      error
    );
    throw error;
  }
}

async function verifyMigration() {
  console.log("\n🔍 Verifying migration...");

  try {
    // Check vendor indexes
    const vendorIndexes = await Vendor.collection.getIndexes();
    const hasVerificationStatusIndex = Object.keys(vendorIndexes).some((key) =>
      key.includes("verificationStatus")
    );

    if (hasVerificationStatusIndex) {
      console.log("   ✅ Vendor verificationStatus index exists");
    } else {
      console.log("   ⚠️  Vendor verificationStatus index not found");
    }

    // Check planner business profile indexes
    const plannerIndexes = await PlannerBusinessProfile.collection.getIndexes();
    const expectedIndexes = ["userId", "verificationStatus", "companyName"];

    for (const indexName of expectedIndexes) {
      const hasIndex = Object.keys(plannerIndexes).some((key) =>
        key.includes(indexName)
      );
      if (hasIndex) {
        console.log(`   ✅ PlannerBusinessProfile ${indexName} index exists`);
      } else {
        console.log(
          `   ⚠️  PlannerBusinessProfile ${indexName} index not found`
        );
      }
    }

    // Sample a vendor to check fields
    const sampleVendor = await Vendor.findOne();
    if (sampleVendor) {
      const hasNewFields = sampleVendor.verificationStatus !== undefined;
      if (hasNewFields) {
        console.log("   ✅ Vendor documents have new business profile fields");
        console.log(
          `      Sample vendor verificationStatus: ${sampleVendor.verificationStatus}`
        );
      } else {
        console.log("   ⚠️  Vendor documents missing new fields");
      }
    }
  } catch (error) {
    console.error("   ❌ Error verifying migration:", error);
    throw error;
  }
}

async function runMigration() {
  console.log("🚀 Starting Business Profile Management Migration");
  console.log("=".repeat(60));

  try {
    await connectDatabase();
    await migrateVendorCollection();
    await createPlannerBusinessProfileCollection();
    await verifyMigration();

    console.log("\n" + "=".repeat(60));
    console.log("✅ Migration completed successfully!");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Database connection closed");
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

export default runMigration;
