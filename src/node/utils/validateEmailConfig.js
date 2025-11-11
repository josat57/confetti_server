import EmailConfig from "../config/email.config.js";
import { logger } from "./logger.js";

/**
 * Validate email configuration on application startup
 * Provides detailed error messages and logs configuration status
 * @throws {Error} If email configuration is invalid
 */
export const validateEmailConfig = () => {
  logger.info("Validating email configuration...");

  try {
    const validation = EmailConfig.validate();

    if (!validation.isValid) {
      const errorMessage = `Email configuration validation failed:\n${validation.errors
        .map((error) => `  - ${error}`)
        .join("\n")}`;
      logger.error(errorMessage);

      // Log current configuration for debugging (with masked sensitive data)
      const configSummary = EmailConfig.getConfigSummary();
      logger.error("Current email configuration:", configSummary);

      throw new Error(
        `Email service cannot start due to configuration errors:\n${validation.errors.join(
          "\n"
        )}`
      );
    }

    // Log successful validation with configuration summary
    logger.info("Email configuration validation passed");
    const configSummary = EmailConfig.getConfigSummary();
    logger.info("Email configuration summary:", {
      host: configSummary.host,
      port: configSummary.port,
      secure: configSummary.secure,
      user: configSummary.user,
      fromEmail: configSummary.fromEmail,
      fromName: configSummary.fromName,
    });

    return true;
  } catch (error) {
    logger.error("Email configuration validation error:", error.message);
    throw error;
  }
};

/**
 * Validate email configuration with detailed error reporting
 * Returns validation result without throwing errors
 * @returns {Object} Validation result with isValid flag, errors, and warnings
 */
export const checkEmailConfig = () => {
  try {
    const validation = EmailConfig.validate();
    const configSummary = EmailConfig.getConfigSummary();

    // Check for warnings (non-critical issues)
    const warnings = [];

    // Warn about default timeout values
    if (!process.env.SMTP_CONNECTION_TIMEOUT) {
      warnings.push(
        "Using default connection timeout (60s). Consider setting SMTP_CONNECTION_TIMEOUT for production."
      );
    }
    if (!process.env.SMTP_GREETING_TIMEOUT) {
      warnings.push(
        "Using default greeting timeout (30s). Consider setting SMTP_GREETING_TIMEOUT for production."
      );
    }
    if (!process.env.SMTP_SOCKET_TIMEOUT) {
      warnings.push(
        "Using default socket timeout (60s). Consider setting SMTP_SOCKET_TIMEOUT for production."
      );
    }

    // Warn about insecure configurations
    if (
      process.env.SMTP_SECURE === "false" &&
      parseInt(process.env.SMTP_PORT) !== 587
    ) {
      warnings.push(
        "Using insecure SMTP connection. Consider using port 587 with STARTTLS or port 465 with SSL."
      );
    }

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings,
      config: configSummary,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Configuration check failed: ${error.message}`],
      warnings: [],
      config: null,
    };
  }
};
