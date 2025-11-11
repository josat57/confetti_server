import { logger } from "../utils/logger.js";

/**
 * EmailConfig class for managing and validating email configuration
 * Handles SMTP settings validation and provides properly formatted configuration
 */
class EmailConfig {
  /**
   * Validate all required email configuration environment variables
   * @returns {Object} Validation result with isValid flag and errors array
   */
  static validate() {
    const errors = [];
    const requiredVars = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "FROM_EMAIL",
      "FROM_NAME",
    ];

    // Check for missing required variables
    requiredVars.forEach((varName) => {
      if (!process.env[varName]) {
        errors.push(`Missing required environment variable: ${varName}`);
      }
    });

    // Check for SMTP password (support both SMTP_PASSWORD and SMTP_PASS)
    if (!process.env.SMTP_PASSWORD && !process.env.SMTP_PASS) {
      errors.push(
        "Missing required environment variable: SMTP_PASSWORD or SMTP_PASS"
      );
    }

    // Validate SMTP_PORT is a valid number
    if (process.env.SMTP_PORT && isNaN(parseInt(process.env.SMTP_PORT))) {
      errors.push("SMTP_PORT must be a valid number");
    }

    // Validate SMTP_SECURE is a valid boolean string
    if (
      process.env.SMTP_SECURE &&
      !["true", "false"].includes(process.env.SMTP_SECURE.toLowerCase())
    ) {
      errors.push('SMTP_SECURE must be "true" or "false"');
    }

    // Validate email format for FROM_EMAIL and SMTP_USER
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (process.env.FROM_EMAIL && !emailRegex.test(process.env.FROM_EMAIL)) {
      errors.push("FROM_EMAIL must be a valid email address");
    }
    if (process.env.SMTP_USER && !emailRegex.test(process.env.SMTP_USER)) {
      errors.push("SMTP_USER must be a valid email address");
    }

    // Validate port and secure setting compatibility
    const port = parseInt(process.env.SMTP_PORT);
    const secure = process.env.SMTP_SECURE === "true";

    if (port === 465 && !secure) {
      errors.push("Port 465 requires SMTP_SECURE to be true (SSL/TLS)");
    }
    if (port === 587 && secure) {
      errors.push("Port 587 should use SMTP_SECURE=false with STARTTLS");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get properly formatted nodemailer transporter configuration
   * @returns {Object} Nodemailer transporter configuration object
   */
  static getTransporterConfig() {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(
        `Email configuration validation failed: ${validation.errors.join(", ")}`
      );
    }

    const port = parseInt(process.env.SMTP_PORT);
    const secure = process.env.SMTP_SECURE === "true";

    return {
      host: process.env.SMTP_HOST,
      port: port,
      secure: secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
      },
      // Connection timeout settings for better reliability
      connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT) || 60000,
      greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT) || 30000,
      socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT) || 60000,
      // Pool settings for better performance
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Keep connections alive
      keepAlive: true,
    };
  }

  /**
   * Construct sender address from environment variables
   * @returns {string} Formatted sender address in "Name <email>" format
   */
  static getFromAddress() {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(
        `Email configuration validation failed: ${validation.errors.join(", ")}`
      );
    }

    const fromName = process.env.FROM_NAME;
    const fromEmail = process.env.FROM_EMAIL;

    return `"${fromName}" <${fromEmail}>`;
  }

  /**
   * Get all email configuration settings for debugging/logging
   * @returns {Object} Configuration object with sensitive data masked
   */
  static getConfigSummary() {
    return {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER,
      password:
        process.env.SMTP_PASSWORD || process.env.SMTP_PASS
          ? "***masked***"
          : "not set",
      fromEmail: process.env.FROM_EMAIL,
      fromName: process.env.FROM_NAME,
      connectionTimeout:
        process.env.SMTP_CONNECTION_TIMEOUT || "60000 (default)",
      greetingTimeout: process.env.SMTP_GREETING_TIMEOUT || "30000 (default)",
      socketTimeout: process.env.SMTP_SOCKET_TIMEOUT || "60000 (default)",
    };
  }
}

export default EmailConfig;
