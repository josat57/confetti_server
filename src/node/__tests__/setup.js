import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Global Test Setup
 * Configures test environment and database
 */

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Use in-memory MongoDB for testing
  if (process.env.NODE_ENV === "test" && !process.env.MONGODB_TEST_URI) {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_TEST_URI = mongoUri;
  }

  // Set test environment variables
  process.env.JWT_SECRET = "test-jwt-secret-key";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.NODE_ENV = "test";

  // Increase timeout for tests
  jest.setTimeout(30000);
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  // Stop in-memory MongoDB server
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Global error handler for unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection in tests:", error);
});
