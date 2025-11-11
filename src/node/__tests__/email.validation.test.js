// Email validation and configuration tests
describe("Email Configuration Validation", () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("Required Environment Variables", () => {
    test("should identify missing required variables", () => {
      const requiredVars = [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "FROM_EMAIL",
        "FROM_NAME",
      ];

      // Clear all required variables
      requiredVars.forEach((varName) => {
        delete process.env[varName];
      });

      const errors = [];
      requiredVars.forEach((varName) => {
        if (!process.env[varName]) {
          errors.push(`Missing required environment variable: ${varName}`);
        }
      });

      expect(errors).toHaveLength(6);
      expect(errors).toContain(
        "Missing required environment variable: SMTP_HOST"
      );
      expect(errors).toContain(
        "Missing required environment variable: SMTP_PORT"
      );
      expect(errors).toContain(
        "Missing required environment variable: SMTP_USER"
      );
      expect(errors).toContain(
        "Missing required environment variable: SMTP_PASSWORD"
      );
      expect(errors).toContain(
        "Missing required environment variable: FROM_EMAIL"
      );
      expect(errors).toContain(
        "Missing required environment variable: FROM_NAME"
      );
    });

    test("should pass validation with all required variables set", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASSWORD = "password123";
      process.env.FROM_EMAIL = "noreply@example.com";
      process.env.FROM_NAME = "Test App";

      const requiredVars = [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "FROM_EMAIL",
        "FROM_NAME",
      ];

      const errors = [];
      requiredVars.forEach((varName) => {
        if (!process.env[varName]) {
          errors.push(`Missing required environment variable: ${varName}`);
        }
      });

      expect(errors).toHaveLength(0);
    });
  });

  describe("Port Validation", () => {
    test("should validate SMTP_PORT is a number", () => {
      const testCases = [
        { port: "587", valid: true },
        { port: "465", valid: true },
        { port: "25", valid: true },
        { port: "invalid", valid: false },
        { port: "abc", valid: false },
        { port: "", valid: false },
      ];

      testCases.forEach(({ port, valid }) => {
        process.env.SMTP_PORT = port;
        const isValidPort = !isNaN(parseInt(process.env.SMTP_PORT));
        expect(isValidPort).toBe(valid);
      });
    });

    test("should validate port and security combinations", () => {
      // Port 465 should require secure=true
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "false";

      const port = parseInt(process.env.SMTP_PORT);
      const secure = process.env.SMTP_SECURE === "true";
      const hasPortSecurityError = port === 465 && !secure;

      expect(hasPortSecurityError).toBe(true);

      // Port 587 should use secure=false
      process.env.SMTP_PORT = "587";
      process.env.SMTP_SECURE = "true";

      const port587 = parseInt(process.env.SMTP_PORT);
      const secure587 = process.env.SMTP_SECURE === "true";
      const hasPort587Warning = port587 === 587 && secure587;

      expect(hasPort587Warning).toBe(true);
    });
  });

  describe("Email Address Validation", () => {
    test("should validate email address format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const testCases = [
        { email: "test@example.com", valid: true },
        { email: "user.name@domain.co.uk", valid: true },
        { email: "user+tag@example.org", valid: true },
        { email: "invalid-email", valid: false },
        { email: "test@", valid: false },
        { email: "@example.com", valid: false },
        { email: "test.example.com", valid: false },
        { email: "", valid: false },
      ];

      testCases.forEach(({ email, valid }) => {
        const isValid = emailRegex.test(email);
        expect(isValid).toBe(valid);
      });
    });

    test("should validate FROM_EMAIL and SMTP_USER formats", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      process.env.FROM_EMAIL = "invalid-email";
      process.env.SMTP_USER = "also-invalid";

      const errors = [];

      if (process.env.FROM_EMAIL && !emailRegex.test(process.env.FROM_EMAIL)) {
        errors.push("FROM_EMAIL must be a valid email address");
      }
      if (process.env.SMTP_USER && !emailRegex.test(process.env.SMTP_USER)) {
        errors.push("SMTP_USER must be a valid email address");
      }

      expect(errors).toContain("FROM_EMAIL must be a valid email address");
      expect(errors).toContain("SMTP_USER must be a valid email address");
    });
  });

  describe("SMTP_SECURE Validation", () => {
    test("should validate SMTP_SECURE boolean values", () => {
      const testCases = [
        { value: "true", valid: true },
        { value: "false", valid: true },
        { value: "yes", valid: false },
        { value: "no", valid: false },
        { value: "1", valid: false },
        { value: "0", valid: false },
        { value: "maybe", valid: false },
      ];

      testCases.forEach(({ value, valid }) => {
        process.env.SMTP_SECURE = value;
        const lowercaseValue =
          process.env.SMTP_SECURE && process.env.SMTP_SECURE.toLowerCase();
        const isValid = ["true", "false"].includes(lowercaseValue);
        expect(isValid).toBe(valid);
      });
    });
  });

  describe("Configuration Summary", () => {
    test("should mask sensitive information in config summary", () => {
      process.env.SMTP_PASSWORD = "secret123";

      const getConfigSummary = () => ({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        password: process.env.SMTP_PASSWORD ? "***masked***" : "not set",
        fromEmail: process.env.FROM_EMAIL,
        fromName: process.env.FROM_NAME,
      });

      const summary = getConfigSummary();
      expect(summary.password).toBe("***masked***");
      expect(summary.password).not.toContain("secret123");
    });

    test('should show "not set" for missing password', () => {
      delete process.env.SMTP_PASSWORD;

      const getConfigSummary = () => ({
        password: process.env.SMTP_PASSWORD ? "***masked***" : "not set",
      });

      const summary = getConfigSummary();
      expect(summary.password).toBe("not set");
    });
  });

  describe("Transporter Configuration", () => {
    test("should create proper transporter config", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_SECURE = "false";
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASSWORD = "password123";
      process.env.SMTP_CONNECTION_TIMEOUT = "30000";
      process.env.SMTP_GREETING_TIMEOUT = "15000";
      process.env.SMTP_SOCKET_TIMEOUT = "45000";

      const getTransporterConfig = () => ({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        connectionTimeout:
          parseInt(process.env.SMTP_CONNECTION_TIMEOUT) || 60000,
        greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT) || 30000,
        socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT) || 60000,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        keepAlive: true,
      });

      const config = getTransporterConfig();

      expect(config.host).toBe("smtp.example.com");
      expect(config.port).toBe(587);
      expect(config.secure).toBe(false);
      expect(config.auth.user).toBe("test@example.com");
      expect(config.auth.pass).toBe("password123");
      expect(config.connectionTimeout).toBe(30000);
      expect(config.greetingTimeout).toBe(15000);
      expect(config.socketTimeout).toBe(45000);
      expect(config.pool).toBe(true);
      expect(config.maxConnections).toBe(5);
      expect(config.maxMessages).toBe(100);
      expect(config.keepAlive).toBe(true);
    });

    test("should use default timeout values when not provided", () => {
      delete process.env.SMTP_CONNECTION_TIMEOUT;
      delete process.env.SMTP_GREETING_TIMEOUT;
      delete process.env.SMTP_SOCKET_TIMEOUT;

      const getTransporterConfig = () => ({
        connectionTimeout:
          parseInt(process.env.SMTP_CONNECTION_TIMEOUT) || 60000,
        greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT) || 30000,
        socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT) || 60000,
      });

      const config = getTransporterConfig();

      expect(config.connectionTimeout).toBe(60000);
      expect(config.greetingTimeout).toBe(30000);
      expect(config.socketTimeout).toBe(60000);
    });
  });
});
test("should reject case-sensitive boolean values", () => {
  // Test that we only accept exact lowercase "true" and "false"
  process.env.SMTP_SECURE = "TRUE";
  const isValidUpper =
    process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "false";
  expect(isValidUpper).toBe(false);

  process.env.SMTP_SECURE = "FALSE";
  const isValidUpperFalse =
    process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "false";
  expect(isValidUpperFalse).toBe(false);
});
