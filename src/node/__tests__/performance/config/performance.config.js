/**
 * Performance Testing Configuration
 *
 * This file contains configuration for performance testing and time complexity analysis.
 */

export const performanceConfig = {
  // Database configuration for performance testing
  database: {
    testDbName: "confetti_performance_test",
    connectionString:
      process.env.MONGODB_TEST_URI ||
      "mongodb://localhost:27017/confetti_performance_test",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // Profiler configuration
  profiler: {
    enabled: true,
    sampleRate: 1, // Sample every operation (1 = 100%)
    maxSamples: 10000,
    outputDir: "__tests__/performance/output",
  },

  // Time complexity classification thresholds
  complexity: {
    // R-squared threshold for classification confidence
    rSquaredThreshold: 0.85,

    // Minimum data points required for classification
    minDataPoints: 5,

    // Data size variations for testing
    dataSizes: [10, 50, 100, 500, 1000, 5000, 10000],

    // Growth rate thresholds for classification
    growthRates: {
      constant: 0.1, // O(1): growth rate < 0.1
      logarithmic: 0.3, // O(log n): growth rate < 0.3
      linear: 1.2, // O(n): growth rate ~1.0
      linearithmic: 1.5, // O(n log n): growth rate ~1.2
      quadratic: 2.5, // O(n²): growth rate ~2.0
    },
  },

  // Performance thresholds
  thresholds: {
    // API endpoint response time thresholds (ms)
    api: {
      p50: 100, // 50th percentile
      p95: 500, // 95th percentile
      p99: 1000, // 99th percentile
    },

    // Database query thresholds (ms)
    database: {
      simple: 10,
      complex: 100,
      aggregation: 500,
    },

    // Memory thresholds (MB)
    memory: {
      warning: 100,
      critical: 500,
    },
  },

  // Property-based testing configuration
  propertyTesting: {
    // Number of iterations per property test
    iterations: 100,

    // Seed for reproducible tests (optional)
    seed: undefined,

    // Timeout per property test (ms)
    timeout: 30000,
  },

  // Reporting configuration
  reporting: {
    outputDir: "__tests__/performance/reports",
    formats: ["json", "html", "markdown"],
    includeCharts: true,
    includeRecommendations: true,
  },

  // CI/CD integration
  ci: {
    enabled: process.env.CI === "true",
    failOnRegression: true,
    regressionThreshold: 0.2, // 20% performance degradation fails build
    baselineFile: "__tests__/performance/baselines/baseline.json",
  },
};

export default performanceConfig;
