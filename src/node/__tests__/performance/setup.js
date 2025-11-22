/**
 * Performance Test Setup
 *
 * This file is run before performance tests to set up the test environment.
 */

import {
  setupTestDatabase,
  teardownTestDatabase,
} from "./config/test-database.js";

// Global setup before all tests
beforeAll(async () => {
  console.log("Setting up performance test environment...");

  // Connect to test database
  await setupTestDatabase();

  console.log("Performance test environment ready");
});

// Global teardown after all tests
afterAll(async () => {
  console.log("Tearing down performance test environment...");

  // Disconnect from test database
  await teardownTestDatabase();

  console.log("Performance test environment cleaned up");
});

// Increase timeout for performance tests
jest.setTimeout(30000);
