export default {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/src/node/__tests__/setup.js"],
  testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(spec|test).js"],
  collectCoverageFrom: [
    "src/node/**/*.js",
    "!src/node/__tests__/**",
    "!src/node/node_modules/**",
    "!src/node/config/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  verbose: true,
  testTimeout: 30000,
  maxWorkers: "50%",
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
