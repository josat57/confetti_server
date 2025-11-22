/**
 * Script to set up text search indexes for global search functionality
 * Run with: node scripts/setup-search-indexes.js
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
import Document from "../models/document.model.js";
import Vendor from "../models/vendor.model.js";

const setupSearchIndexes = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB\n");

    console.log("Setting up text search indexes...\n");

    // Event text index
    console.log("1. Creating Event text index...");
    try {
      await Event.collection.createIndex(
        {
          title: "text",
          description: "text",
          location: "text",
          eventType: "text",
        },
        {
          name: "event_text_search",
          weights: {
            title: 10,
            description: 5,
            eventType: 3,
            location: 2,
          },
        }
      );
      console.log("   ✓ Event text index created");
    } catch (error) {
      if (error.code === 85) {
        console.log("   ℹ Event text index already exists");
      } else {
        throw error;
      }
    }

    // Client text index
    console.log("2. Creating Client text index...");
    try {
      await Client.collection.createIndex(
        {
          firstName: "text",
          lastName: "text",
          email: "text",
          company: "text",
          phone: "text",
        },
        {
          name: "client_text_search",
          weights: {
            firstName: 10,
            lastName: 10,
            email: 5,
            company: 8,
            phone: 3,
          },
        }
      );
      console.log("   ✓ Client text index created");
    } catch (error) {
      if (error.code === 85) {
        console.log("   ℹ Client text index already exists");
      } else {
        throw error;
      }
    }

    // Task text index
    console.log("3. Creating Task text index...");
    try {
      await Task.collection.createIndex(
        {
          title: "text",
          description: "text",
        },
        {
          name: "task_text_search",
          weights: {
            title: 10,
            description: 5,
          },
        }
      );
      console.log("   ✓ Task text index created");
    } catch (error) {
      if (error.code === 85) {
        console.log("   ℹ Task text index already exists");
      } else {
        throw error;
      }
    }

    // Document text index
    console.log("4. Creating Document text index...");
    try {
      await Document.collection.createIndex(
        {
          name: "text",
          description: "text",
          fileType: "text",
        },
        {
          name: "document_text_search",
          weights: {
            name: 10,
            description: 5,
            fileType: 2,
          },
        }
      );
      console.log("   ✓ Document text index created");
    } catch (error) {
      if (error.code === 85) {
        console.log("   ℹ Document text index already exists");
      } else {
        throw error;
      }
    }

    // Vendor text index
    console.log("5. Creating Vendor text index...");
    try {
      await Vendor.collection.createIndex(
        {
          businessName: "text",
          description: "text",
          category: "text",
          services: "text",
        },
        {
          name: "vendor_text_search",
          weights: {
            businessName: 10,
            category: 8,
            services: 5,
            description: 3,
          },
        }
      );
      console.log("   ✓ Vendor text index created");
    } catch (error) {
      if (error.code === 85) {
        console.log("   ℹ Vendor text index already exists");
      } else {
        throw error;
      }
    }

    console.log("\n✓ All text search indexes set up successfully!");

    // List all indexes
    console.log("\n=== Existing Indexes ===\n");
    const collections = [
      { name: "Event", model: Event },
      { name: "Client", model: Client },
      { name: "Task", model: Task },
      { name: "Document", model: Document },
      { name: "Vendor", model: Vendor },
    ];

    for (const { name, model } of collections) {
      const indexes = await model.collection.indexes();
      console.log(`${name} indexes:`);
      indexes.forEach((index) => {
        console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
      });
      console.log("");
    }
  } catch (error) {
    console.error("Error setting up search indexes:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
    process.exit(0);
  }
};

// Run the setup
setupSearchIndexes();
