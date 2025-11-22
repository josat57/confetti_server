/**
 * Performance Testing Infrastructure Verification
 *
 * This test verifies that the performance testing infrastructure is set up correctly.
 */

const fs = require("fs");
const path = require("path");

describe("Performance Testing Infrastructure", () => {
  describe("Directory Structure", () => {
    test("should have profilers directory", () => {
      const profilersDir = path.join(__dirname, "profilers");
      expect(fs.existsSync(profilersDir)).toBe(true);
    });

    test("should have analyzers directory", () => {
      const analyzersDir = path.join(__dirname, "analyzers");
      expect(fs.existsSync(analyzersDir)).toBe(true);
    });

    test("should have reporters directory", () => {
      const reportersDir = path.join(__dirname, "reporters");
      expect(fs.existsSync(reportersDir)).toBe(true);
    });

    test("should have properties directory", () => {
      const propertiesDir = path.join(__dirname, "properties");
      expect(fs.existsSync(propertiesDir)).toBe(true);
    });

    test("should have fixtures directory", () => {
      const fixturesDir = path.join(__dirname, "fixtures");
      expect(fs.existsSync(fixturesDir)).toBe(true);
    });

    test("should have integration directory", () => {
      const integrationDir = path.join(__dirname, "integration");
      expect(fs.existsSync(integrationDir)).toBe(true);
    });

    test("should have utils directory", () => {
      const utilsDir = path.join(__dirname, "utils");
      expect(fs.existsSync(utilsDir)).toBe(true);
    });

    test("should have config directory", () => {
      const configDir = path.join(__dirname, "config");
      expect(fs.existsSync(configDir)).toBe(true);
    });

    test("should have output directory", () => {
      const outputDir = path.join(__dirname, "output");
      expect(fs.existsSync(outputDir)).toBe(true);
    });

    test("should have reports directory", () => {
      const reportsDir = path.join(__dirname, "reports");
      expect(fs.existsSync(reportsDir)).toBe(true);
    });

    test("should have baselines directory", () => {
      const baselinesDir = path.join(__dirname, "baselines");
      expect(fs.existsSync(baselinesDir)).toBe(true);
    });
  });

  describe("Configuration Files", () => {
    test("should have performance config file", () => {
      const configFile = path.join(
        __dirname,
        "config",
        "performance.config.js"
      );
      expect(fs.existsSync(configFile)).toBe(true);
    });

    test("should have test database config file", () => {
      const dbConfigFile = path.join(__dirname, "config", "test-database.js");
      expect(fs.existsSync(dbConfigFile)).toBe(true);
    });
  });

  describe("Utility Files", () => {
    test("should have timer utility", () => {
      const timerFile = path.join(__dirname, "utils", "timer.js");
      expect(fs.existsSync(timerFile)).toBe(true);
    });

    test("should have statistics utility", () => {
      const statsFile = path.join(__dirname, "utils", "statistics.js");
      expect(fs.existsSync(statsFile)).toBe(true);
    });
  });

  describe("Dependencies", () => {
    test("should have fast-check installed", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.devDependencies["fast-check"]).toBeDefined();
    });

    test("should have clinic installed", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.devDependencies["clinic"]).toBeDefined();
    });

    test("should have benchmark installed", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.devDependencies["benchmark"]).toBeDefined();
    });
  });

  describe("NPM Scripts", () => {
    test("should have performance test script", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.scripts["test:performance"]).toBeDefined();
      expect(packageJson.scripts["test:performance"]).toContain("performance");
    });

    test("should have property test script", () => {
      const packageJson = require("../../package.json");
      expect(packageJson.scripts["test:performance:properties"]).toBeDefined();
      expect(packageJson.scripts["test:performance:properties"]).toContain(
        "properties"
      );
    });
  });

  describe("README Documentation", () => {
    test("should have README file", () => {
      const readmeFile = path.join(__dirname, "README.md");
      expect(fs.existsSync(readmeFile)).toBe(true);
    });

    test("should have setup file", () => {
      const setupFile = path.join(__dirname, "setup.js");
      expect(fs.existsSync(setupFile)).toBe(true);
    });
  });
});
