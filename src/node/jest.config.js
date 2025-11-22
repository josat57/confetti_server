export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
  collectCoverageFrom: [
    "utils/**/*.js",
    "config/**/*.js",
    "!**/*.test.js",
    "!**/*.spec.js",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testTimeout: 30000, // 30 seconds for performance tests
  maxWorkers: 1, // Run tests serially for accurate performance measurements
};
