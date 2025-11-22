import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import Subscription from "../models/subscription.model.js";
import { logger } from "../utils/logger.js";

dotenv.config();

/**
 * Migration script for subscription-payment integration
 *
 * This script performs the following migrations:
 * 1. Add status field to existing users (default: active)
 * 2. Update existing user roles (map 'user' to 'event-planner', remove 'superadmin')
 * 3. Add subscription reference to users (field already exists in schema)
 * 4. Update existing payments with paymentType: 'event'
 * 5. Ensure indexes are created on Payment and Subscription models
 */

async function migrateUsers() {
  console.log("\n📝 Migrating User records...");

  try {
    // Find all users without a status field or with old roles
    const usersToUpdate = await User.find({
      $or: [
        { status: { $exists: false } },
        { role: { $in: ["user", "superadmin"] } },
      ],
    });

    console.log(`Found ${usersToUpdate.length} users to migrate`);

    let updatedCount = 0;
    let roleChanges = { user: 0, superadmin: 0 };

    for (const user of usersToUpdate) {
      let needsUpdate = false;

      // Add status field if missing (default to 'active' for existing users)
      if (!user.status) {
        user.status = "active";
        needsUpdate = true;
      }

      // Update role mappings
      if (user.role === "user") {
        user.role = "event-planner";
        roleChanges.user++;
        needsUpdate = true;
      } else if (user.role === "superadmin") {
        user.role = "admin";
        roleChanges.superadmin++;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save({ validateBeforeSave: false });
        updatedCount++;
      }
    }

    console.log(`✅ Updated ${updatedCount} user records`);
    if (roleChanges.user > 0) {
      console.log(
        `   - Mapped ${roleChanges.user} 'user' roles to 'event-planner'`
      );
    }
    if (roleChanges.superadmin > 0) {
      console.log(
        `   - Mapped ${roleChanges.superadmin} 'superadmin' roles to 'admin'`
      );
    }

    return { success: true, updated: updatedCount };
  } catch (error) {
    console.error("❌ Error migrating users:", error.message);
    return { success: false, error: error.message };
  }
}

async function migratePayments() {
  console.log("\n💳 Migrating Payment records...");

  try {
    // Find all payments without paymentType field
    const paymentsToUpdate = await Payment.find({
      $or: [{ paymentType: { $exists: false } }, { paymentType: null }],
    });

    console.log(`Found ${paymentsToUpdate.length} payments to migrate`);

    let updatedCount = 0;

    for (const payment of paymentsToUpdate) {
      // Set paymentType to 'event' for existing payments (backward compatibility)
      payment.paymentType = "event";
      await payment.save({ validateBeforeSave: false });
      updatedCount++;
    }

    console.log(
      `✅ Updated ${updatedCount} payment records with paymentType: 'event'`
    );

    return { success: true, updated: updatedCount };
  } catch (error) {
    console.error("❌ Error migrating payments:", error.message);
    return { success: false, error: error.message };
  }
}

async function ensureIndexes() {
  console.log("\n🔍 Ensuring database indexes...");

  try {
    // Ensure indexes on User model
    console.log("Creating indexes for User model...");
    await User.createIndexes();

    // Ensure indexes on Payment model
    console.log("Creating indexes for Payment model...");
    await Payment.createIndexes();

    // Ensure indexes on Subscription model
    console.log("Creating indexes for Subscription model...");
    await Subscription.createIndexes();

    console.log("✅ All indexes created successfully");

    return { success: true };
  } catch (error) {
    console.error("❌ Error creating indexes:", error.message);
    return { success: false, error: error.message };
  }
}

async function generateMigrationReport() {
  console.log("\n📊 Generating Migration Report...");

  try {
    // Count users by status
    const usersByStatus = await User.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Count users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    // Count payments by type
    const paymentsByType = await Payment.aggregate([
      { $group: { _id: "$paymentType", count: { $sum: 1 } } },
    ]);

    // Count subscriptions by status
    const subscriptionsByStatus = await Subscription.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    console.log("\n" + "=".repeat(60));
    console.log("📈 Database Statistics After Migration");
    console.log("=".repeat(60));

    console.log("\nUsers by Status:");
    usersByStatus.forEach((item) => {
      console.log(`  - ${item._id || "undefined"}: ${item.count}`);
    });

    console.log("\nUsers by Role:");
    usersByRole.forEach((item) => {
      console.log(`  - ${item._id}: ${item.count}`);
    });

    console.log("\nPayments by Type:");
    paymentsByType.forEach((item) => {
      console.log(`  - ${item._id || "undefined"}: ${item.count}`);
    });

    console.log("\nSubscriptions by Status:");
    if (subscriptionsByStatus.length > 0) {
      subscriptionsByStatus.forEach((item) => {
        console.log(`  - ${item._id}: ${item.count}`);
      });
    } else {
      console.log("  - No subscriptions found");
    }

    console.log("=".repeat(60));

    return { success: true };
  } catch (error) {
    console.error("❌ Error generating report:", error.message);
    return { success: false, error: error.message };
  }
}

async function runMigration() {
  const startTime = Date.now();

  console.log("\n" + "=".repeat(60));
  console.log("🚀 Starting Subscription-Payment Integration Migration");
  console.log("=".repeat(60));

  try {
    // Connect to MongoDB
    console.log("\n🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Run migrations
    const results = {
      users: await migrateUsers(),
      payments: await migratePayments(),
      indexes: await ensureIndexes(),
      report: await generateMigrationReport(),
    };

    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 Migration Summary");
    console.log("=".repeat(60));
    console.log(`✅ Users migrated: ${results.users.updated || 0}`);
    console.log(`✅ Payments migrated: ${results.payments.updated || 0}`);
    console.log(
      `✅ Indexes created: ${results.indexes.success ? "Yes" : "No"}`
    );
    console.log(`⏱️  Duration: ${duration}s`);
    console.log("=".repeat(60));

    // Check for failures
    const hasFailures =
      !results.users.success ||
      !results.payments.success ||
      !results.indexes.success;

    if (hasFailures) {
      console.log(
        "\n⚠️  Migration completed with some errors. Please review the logs above."
      );
      process.exit(1);
    } else {
      console.log("\n🎉 Migration completed successfully!");
      console.log("\n📝 Next Steps:");
      console.log("  1. Verify the migration results in your database");
      console.log("  2. Test the subscription and payment flows");
      console.log("  3. Deploy the updated application");
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
  }
}

// Run the migration
runMigration();
