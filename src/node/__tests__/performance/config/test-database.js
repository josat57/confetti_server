/**
 * Test Database Setup for Performance Testing
 *
 * This module provides utilities for setting up and tearing down
 * the test database for performance testing.
 */

import mongoose from "mongoose";
import { performanceConfig } from "./performance.config.js";

/**
 * Connect to the test database
 */
export async function connectTestDatabase() {
  try {
    await mongoose.connect(
      performanceConfig.database.connectionString,
      performanceConfig.database.options
    );
    console.log("Connected to performance test database");
  } catch (error) {
    console.error("Failed to connect to test database:", error);
    throw error;
  }
}

/**
 * Disconnect from the test database
 */
export async function disconnectTestDatabase() {
  try {
    await mongoose.connection.close();
    console.log("Disconnected from performance test database");
  } catch (error) {
    console.error("Failed to disconnect from test database:", error);
    throw error;
  }
}

/**
 * Clear all collections in the test database
 */
export async function clearTestDatabase() {
  try {
    const collections = await mongoose.connection.db.collections();

    for (const collection of collections) {
      await collection.deleteMany({});
    }

    console.log("Cleared all test database collections");
  } catch (error) {
    console.error("Failed to clear test database:", error);
    throw error;
  }
}

/**
 * Seed test data for performance testing
 *
 * @param {string} collectionName - Name of the collection
 * @param {Array} data - Array of documents to insert
 * @returns {Promise<Array>} Inserted documents
 */
export async function seedTestData(collectionName, data) {
  try {
    const collection = mongoose.connection.collection(collectionName);
    const result = await collection.insertMany(data);
    console.log(
      `Seeded ${result.insertedCount} documents to ${collectionName}`
    );
    return Object.values(result.insertedIds);
  } catch (error) {
    console.error(`Failed to seed test data to ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Generate test data with specified size
 *
 * @param {number} size - Number of documents to generate
 * @param {Function} generator - Function to generate a single document
 * @returns {Array} Array of generated documents
 */
export function generateTestData(size, generator) {
  const data = [];
  for (let i = 0; i < size; i++) {
    data.push(generator(i));
  }
  return data;
}

/**
 * Setup test database before all tests
 */
export async function setupTestDatabase() {
  await connectTestDatabase();
  await clearTestDatabase();
}

/**
 * Teardown test database after all tests
 */
export async function teardownTestDatabase() {
  await clearTestDatabase();
  await disconnectTestDatabase();
}

export default {
  connectTestDatabase,
  disconnectTestDatabase,
  clearTestDatabase,
  seedTestData,
  generateTestData,
  setupTestDatabase,
  teardownTestDatabase,
};
