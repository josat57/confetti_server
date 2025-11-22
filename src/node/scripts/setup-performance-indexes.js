/**
 * Script to set up performance indexes for common queries
 * Run with: node scripts/setup-performance-indexes.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "../.env") });

// Import models
import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import Guest from "../models/guest.model.js";
import Document from "../models/document.model.js";
import Vendor from "../models/vendor.model.js";
import Notification from "../models/notification.model.js";
import TeamMember from "../models/team-member.model.js";

const setupPerformanceIndexes = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB\n");

    console.log("Setting up performance indexes...\n");

    // Event indexes
    console.log("1. Creating Event performance indexes...");
    await Event.collection.createIndex({ planner: 1, startDate: -1 });
    await Event.collection.createIndex({ planner: 1, status: 1 });
    await Event.collection.createIndex({ planner: 1, eventType: 1 });
    await Event.collection.createIndex({ startDate: 1 });
    await Event.collection.createIndex({ endDate: 1 });
    console.log("   ✓ Event indexes created");

    // Client indexes
    console.log("2. Creating Client performance indexes...");
    await Client.collection.createIndex({ planner: 1, createdAt: -1 });
    await Client.collection.createIndex({ planner: 1, status: 1 });
    await Client.collection.createIndex({ email: 1 });
    console.log("   ✓ Client indexes created");

    // Task indexes
    console.log("3. Creating Task performance indexes...");
    await Task.collection.createIndex({ planner: 1, dueDate: 1 });
    await Task.collection.createIndex({ planner: 1, status: 1 });
    await Task.collection.createIndex({ planner: 1, priority: 1 });
    await Task.collection.createIndex({ event: 1, status: 1 });
    await Task.collection.createIndex({ assignee: 1, status: 1 });
    await Task.collection.createIndex({ dueDate: 1, status: 1 });
    console.log("   ✓ Task indexes created");

    // Guest indexes
    console.log("4. Creating Guest performance indexes...");
    await Guest.collection.createIndex({ event: 1, rsvpStatus: 1 });
    await Guest.collection.createIndex({ planner: 1, createdAt: -1 });
    await Guest.collection.createIndex({ email: 1 });
    console.log("   ✓ Guest indexes created");

    // Document indexes
    console.log("5. Creating Document performance indexes...");
    await Document.collection.createIndex({ uploadedBy: 1, uploadDate: -1 });
    await Document.collection.createIndex({ event: 1, uploadDate: -1 });
    await Document.collection.createIndex({ fileType: 1 });
    console.log("   ✓ Document indexes created");

    // Vendor indexes
    console.log("6. Creating Vendor performance indexes...");
    await Vendor.collection.createIndex({ category: 1, rating: -1 });
    await Vendor.collection.createIndex({ "location.city": 1, category: 1 });
    await Vendor.collection.createIndex({ rating: -1 });
    await Vendor.collection.createIndex({ isActive: 1, isVerified: 1 });
    console.log("   ✓ Vendor indexes created");

    // Notification indexes
    console.log("7. Creating Notification performance indexes...");
    await Notification.collection.createIndex({
      user: 1,
      read: 1,
      createdAt: -1,
    });
    await Notification.collection.createIndex({ user: 1, type: 1 });
    await Notification.collection.createIndex({ createdAt: -1 });
    console.log("   ✓ Notification indexes created");

    // Team Member indexes
    console.log("8. Creating Team Member performance indexes...");
    await TeamMember.collection.createIndex({ planner: 1, status: 1 });
    await TeamMember.collection.createIndex({ user: 1 });
    await TeamMember.collection.createIndex({ planner: 1, role: 1 });
    console.log("   ✓ Team Member indexes created");

    console.log("\n✓ All performance indexes set up successfully!");

    // Analyze index usage
    console.log("\n=== Index Statistics ===\n");
    const collections = [
      { name: "Event", model: Event },
      { name: "Client", model: Client },
      { name: "Task", model: Task },
      { name: "Guest", model: Guest },
      { name: "Document", model: Document },
      { name: "Vendor", model: Vendor },
      { name: "Notification", model: Notification },
      { name: "TeamMember", model: TeamMember },
    ];

    for (const { name, model } of collections) {
      const indexes = await model.collection.indexes();
      console.log(`${name}: ${indexes.length} indexes`);
    }

    console.log("\n=== Recommendations ===\n");
    console.log(
      "1. Monitor query performance using MongoDB Atlas or explain()"
    );
    console.log("2. Review slow query logs regularly");
    console.log(
      "3. Consider compound indexes for frequently used query patterns"
    );
    console.log("4. Remove unused indexes to improve write performance");
    console.log("5. Use covered queries where possible");
    console.log("6. Implement Redis caching for frequently accessed data");
  } catch (error) {
    console.error("Error setting up performance indexes:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  }
};

// Run the setup
setupPerformanceIndexes();
