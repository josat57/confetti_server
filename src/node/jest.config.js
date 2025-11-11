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
};
