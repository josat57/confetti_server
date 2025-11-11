// Email error handling and retry logic tests
describe("Email Error Handling and Retry Logic", () => {
  describe("Error Classification", () => {
    test("should identify retryable error codes", () => {
      const retryableCodes = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ENOTFOUND",
        "ECONNREFUSED",
        "EHOSTUNREACH",
        "ENETUNREACH",
        "EAI_AGAIN",
      ];

      const isRetryableError = (error) => {
        if (error.code && retryableCodes.includes(error.code)) {
          return true;
        }
        return false;
      };

      // Test retryable errors
      expect(isRetryableError({ code: "ECONNRESET" })).toBe(true);
      expect(isRetryableError({ code: "ETIMEDOUT" })).toBe(true);
      expect(isRetryableError({ code: "ENOTFOUND" })).toBe(true);
      expect(isRetryableError({ code: "ECONNREFUSED" })).toBe(true);

      // Test non-retryable errors
      expect(isRetryableError({ code: "EAUTH" })).toBe(false);
      expect(isRetryableError({ code: "EINVAL" })).toBe(false);
      expect(isRetryableError({})).toBe(false);
    });

    test("should identify retryable error messages", () => {
      const retryableMessages = [
        "timeout",
        "connection",
        "network",
        "temporary failure",
        "try again",
      ];

      const isRetryableError = (error) => {
        if (error.message) {
          const message = error.message.toLowerCase();
          return retryableMessages.some((keyword) => message.includes(keyword));
        }
        return false;
      };

      // Test retryable messages
      expect(isRetryableError({ message: "Connection timeout occurred" })).toBe(
        true
      );
      expect(isRetryableError({ message: "Network error detected" })).toBe(
        true
      );
      expect(
        isRetryableError({ message: "Temporary failure, please try again" })
      ).toBe(true);
      expect(isRetryableError({ message: "Connection reset by peer" })).toBe(
        true
      );

      // Test non-retryable messages
      expect(isRetryableError({ message: "Authentication failed" })).toBe(
        false
      );
      expect(isRetryableError({ message: "Invalid credentials" })).toBe(false);
      expect(isRetryableError({ message: "Permission denied" })).toBe(false);
    });

    test("should classify error types correctly", () => {
      const classifyEmailError = (error) => {
        const errorInfo = {
          type: "unknown",
          category: "general",
          retryable: false,
          details: error.message || "Unknown error",
        };

        // Authentication errors
        if (
          error.message &&
          (error.message.includes("Missing credentials") ||
            error.message.includes("Invalid login") ||
            error.message.includes("authentication failed") ||
            error.message.includes("username and password not accepted"))
        ) {
          errorInfo.type = "authentication";
          errorInfo.category = "configuration";
          errorInfo.retryable = false;
        }
        // Connection errors
        else if (
          error.code &&
          ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(
            error.code
          )
        ) {
          errorInfo.type = "connection";
          errorInfo.category = "network";
          errorInfo.retryable = true;
        }
        // SMTP protocol errors
        else if (error.responseCode) {
          errorInfo.type = "smtp_protocol";
          errorInfo.category = "sending";

          if (error.responseCode >= 400 && error.responseCode < 500) {
            errorInfo.retryable = false; // Client errors (permanent)
          } else if (error.responseCode >= 500) {
            errorInfo.retryable = true; // Server errors (temporary)
          }
        }

        return errorInfo;
      };

      // Test authentication error
      const authError = { message: "authentication failed" };
      const authClassification = classifyEmailError(authError);
      expect(authClassification.type).toBe("authentication");
      expect(authClassification.category).toBe("configuration");
      expect(authClassification.retryable).toBe(false);

      // Test connection error
      const connError = { code: "ECONNRESET", message: "Connection reset" };
      const connClassification = classifyEmailError(connError);
      expect(connClassification.type).toBe("connection");
      expect(connClassification.category).toBe("network");
      expect(connClassification.retryable).toBe(true);

      // Test SMTP client error (4xx)
      const clientError = {
        responseCode: 421,
        message: "Service not available",
      };
      const clientClassification = classifyEmailError(clientError);
      expect(clientClassification.type).toBe("smtp_protocol");
      expect(clientClassification.category).toBe("sending");
      expect(clientClassification.retryable).toBe(false);

      // Test SMTP server error (5xx)
      const serverError = { responseCode: 550, message: "Mailbox unavailable" };
      const serverClassification = classifyEmailError(serverError);
      expect(serverClassification.type).toBe("smtp_protocol");
      expect(serverClassification.category).toBe("sending");
      expect(serverClassification.retryable).toBe(true);
    });
  });

  describe("Retry Logic", () => {
    test("should calculate exponential backoff delays correctly", () => {
      const RETRY_CONFIG = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
      };

      const calculateDelay = (attempt) => {
        const delay =
          RETRY_CONFIG.baseDelay *
          Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1);
        return Math.min(delay, RETRY_CONFIG.maxDelay);
      };

      expect(calculateDelay(1)).toBe(1000); // 1000 * 2^0 = 1000
      expect(calculateDelay(2)).toBe(2000); // 1000 * 2^1 = 2000
      expect(calculateDelay(3)).toBe(4000); // 1000 * 2^2 = 4000
      expect(calculateDelay(4)).toBe(8000); // 1000 * 2^3 = 8000
      expect(calculateDelay(5)).toBe(10000); // 1000 * 2^4 = 16000, capped at 10000
    });

    test("should respect maximum retry attempts", () => {
      const RETRY_CONFIG = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffFactor: 2,
      };

      let attemptCount = 0;
      const mockOperation = () => {
        attemptCount++;
        if (attemptCount <= RETRY_CONFIG.maxAttempts) {
          throw new Error("Temporary failure");
        }
        return "success";
      };

      // Simulate retry logic
      let lastError;
      for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
        try {
          const result = mockOperation();
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error;
          if (attempt === RETRY_CONFIG.maxAttempts) {
            // Last attempt failed
            expect(lastError.message).toBe("Temporary failure");
            expect(attemptCount).toBe(RETRY_CONFIG.maxAttempts);
          }
        }
      }
    });

    test("should not retry non-retryable errors", () => {
      const retryableCodes = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];

      const isRetryableError = (error) => {
        return error.code && retryableCodes.includes(error.code);
      };

      // Non-retryable error should not be retried
      const authError = { code: "EAUTH", message: "Authentication failed" };
      expect(isRetryableError(authError)).toBe(false);

      // Retryable error should be retried
      const connError = { code: "ECONNRESET", message: "Connection reset" };
      expect(isRetryableError(connError)).toBe(true);
    });
  });

  describe("Health Check Logic", () => {
    test("should determine overall health status correctly", () => {
      const determineHealthStatus = (
        configValid,
        connectionValid,
        warnings
      ) => {
        const hasErrors = !configValid || !connectionValid;
        const hasWarnings = warnings && warnings.length > 0;

        if (!hasErrors) {
          return hasWarnings ? "healthy_with_warnings" : "healthy";
        } else {
          return "unhealthy";
        }
      };

      // All good, no warnings
      expect(determineHealthStatus(true, true, [])).toBe("healthy");

      // All good, with warnings
      expect(determineHealthStatus(true, true, ["timeout warning"])).toBe(
        "healthy_with_warnings"
      );

      // Config invalid
      expect(determineHealthStatus(false, true, [])).toBe("unhealthy");

      // Connection invalid
      expect(determineHealthStatus(true, false, [])).toBe("unhealthy");

      // Both invalid
      expect(determineHealthStatus(false, false, ["warning"])).toBe(
        "unhealthy"
      );
    });

    test("should collect configuration warnings correctly", () => {
      const checkForWarnings = (env) => {
        const warnings = [];

        // Check for default timeout values
        if (!env.SMTP_CONNECTION_TIMEOUT) {
          warnings.push(
            "Using default connection timeout (60s). Consider setting SMTP_CONNECTION_TIMEOUT for production."
          );
        }
        if (!env.SMTP_GREETING_TIMEOUT) {
          warnings.push(
            "Using default greeting timeout (30s). Consider setting SMTP_GREETING_TIMEOUT for production."
          );
        }
        if (!env.SMTP_SOCKET_TIMEOUT) {
          warnings.push(
            "Using default socket timeout (60s). Consider setting SMTP_SOCKET_TIMEOUT for production."
          );
        }

        // Check for insecure configurations
        if (env.SMTP_SECURE === "false" && parseInt(env.SMTP_PORT) !== 587) {
          warnings.push(
            "Using insecure SMTP connection. Consider using port 587 with STARTTLS or port 465 with SSL."
          );
        }

        return warnings;
      };

      // No warnings case
      const secureEnv = {
        SMTP_CONNECTION_TIMEOUT: "60000",
        SMTP_GREETING_TIMEOUT: "30000",
        SMTP_SOCKET_TIMEOUT: "60000",
        SMTP_SECURE: "false",
        SMTP_PORT: "587",
      };
      expect(checkForWarnings(secureEnv)).toHaveLength(0);

      // Missing timeout warnings
      const missingTimeoutsEnv = {
        SMTP_SECURE: "false",
        SMTP_PORT: "587",
      };
      const timeoutWarnings = checkForWarnings(missingTimeoutsEnv);
      expect(timeoutWarnings).toHaveLength(3);
      expect(timeoutWarnings[0]).toContain("connection timeout");
      expect(timeoutWarnings[1]).toContain("greeting timeout");
      expect(timeoutWarnings[2]).toContain("socket timeout");

      // Insecure connection warning
      const insecureEnv = {
        SMTP_CONNECTION_TIMEOUT: "60000",
        SMTP_GREETING_TIMEOUT: "30000",
        SMTP_SOCKET_TIMEOUT: "60000",
        SMTP_SECURE: "false",
        SMTP_PORT: "25",
      };
      const insecureWarnings = checkForWarnings(insecureEnv);
      expect(insecureWarnings).toHaveLength(1);
      expect(insecureWarnings[0]).toContain("insecure SMTP connection");
    });
  });

  describe("Template Processing", () => {
    test("should replace template variables correctly", () => {
      const replaceTemplateVariables = (template, variables) => {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
          result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
        }
        return result;
      };

      const template =
        "<h1>Hello {{name}}</h1><p>Welcome to {{app}}, {{name}}!</p>";
      const variables = { name: "John", app: "TestApp" };

      const result = replaceTemplateVariables(template, variables);

      expect(result).toBe(
        "<h1>Hello John</h1><p>Welcome to TestApp, John!</p>"
      );
      expect(result).not.toContain("{{");
      expect(result).not.toContain("}}");
    });

    test("should handle missing variables gracefully", () => {
      const replaceTemplateVariables = (template, variables) => {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
          result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
        }
        return result;
      };

      const template = "<h1>Hello {{name}}</h1><p>Your role is {{role}}</p>";
      const variables = { name: "John" }; // Missing 'role' variable

      const result = replaceTemplateVariables(template, variables);

      expect(result).toBe("<h1>Hello John</h1><p>Your role is {{role}}</p>");
      expect(result).toContain("{{role}}"); // Unreplaced variable remains
    });

    test("should handle empty variables object", () => {
      const replaceTemplateVariables = (template, variables) => {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
          result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
        }
        return result;
      };

      const template = "<h1>Hello {{name}}</h1>";
      const variables = {};

      const result = replaceTemplateVariables(template, variables);

      expect(result).toBe("<h1>Hello {{name}}</h1>");
    });
  });
});
