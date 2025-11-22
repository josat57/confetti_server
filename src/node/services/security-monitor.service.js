import { logger } from "../utils/logger.js";
import { sendEmail } from "../utils/email.js";

/**
 * Security Monitoring Service
 * Tracks and alerts on security events
 */

class SecurityMonitorService {
  constructor() {
    this.suspiciousActivityThreshold = 5;
    this.failedLoginThreshold = 3;
    this.alertCooldown = 60 * 60 * 1000; // 1 hour
    this.recentAlerts = new Map();
  }

  /**
   * Log security event
   */
  logEvent(eventType, details = {}) {
    const event = {
      type: eventType,
      timestamp: new Date(),
      ...details,
    };

    logger.info("Security Event", event);

    // In production, store in database for analysis
    return event;
  }

  /**
   * Track failed login attempt
   */
  async trackFailedLogin(email, ip, reason = "Invalid credentials") {
    const event = this.logEvent("failed_login", {
      email,
      ip,
      reason,
    });

    // Check if threshold exceeded
    const recentFailures = await this.getRecentFailedLogins(email);

    if (recentFailures >= this.failedLoginThreshold) {
      await this.sendSecurityAlert(email, "multiple_failed_logins", {
        count: recentFailures,
        ip,
      });
    }

    return event;
  }

  /**
   * Track successful login
   */
  async trackSuccessfulLogin(userId, email, ip, userAgent) {
    const event = this.logEvent("successful_login", {
      userId,
      email,
      ip,
      userAgent,
    });

    // Check for unusual login patterns
    await this.checkUnusualLogin(userId, ip);

    return event;
  }

  /**
   * Track unauthorized access attempt
   */
  async trackUnauthorizedAccess(userId, resource, action) {
    const event = this.logEvent("unauthorized_access", {
      userId,
      resource,
      action,
    });

    // Check if threshold exceeded
    const recentAttempts = await this.getRecentUnauthorizedAttempts(userId);

    if (recentAttempts >= this.suspiciousActivityThreshold) {
      await this.sendSecurityAlert(userId, "suspicious_activity", {
        count: recentAttempts,
        resource,
      });
    }

    return event;
  }

  /**
   * Track data access
   */
  trackDataAccess(userId, resourceType, resourceId, action) {
    return this.logEvent("data_access", {
      userId,
      resourceType,
      resourceId,
      action,
    });
  }

  /**
   * Track sensitive operation
   */
  trackSensitiveOperation(userId, operation, details = {}) {
    return this.logEvent("sensitive_operation", {
      userId,
      operation,
      ...details,
    });
  }

  /**
   * Track password change
   */
  async trackPasswordChange(userId, email, ip) {
    const event = this.logEvent("password_change", {
      userId,
      email,
      ip,
    });

    // Send notification email
    try {
      await sendEmail({
        to: email,
        subject: "Password Changed",
        template: "password-changed",
        variables: {
          timestamp: new Date().toLocaleString(),
          ip,
        },
      });
    } catch (error) {
      logger.error("Failed to send password change email:", error);
    }

    return event;
  }

  /**
   * Track 2FA events
   */
  track2FAEvent(userId, email, eventType, success = true) {
    return this.logEvent("2fa_event", {
      userId,
      email,
      eventType, // enabled, disabled, verified, failed
      success,
    });
  }

  /**
   * Track account lockout
   */
  async trackAccountLockout(userId, email, reason) {
    const event = this.logEvent("account_lockout", {
      userId,
      email,
      reason,
    });

    // Send notification email
    try {
      await sendEmail({
        to: email,
        subject: "Account Locked",
        template: "account-locked",
        variables: {
          reason,
          timestamp: new Date().toLocaleString(),
        },
      });
    } catch (error) {
      logger.error("Failed to send account lockout email:", error);
    }

    return event;
  }

  /**
   * Check for unusual login patterns
   */
  async checkUnusualLogin(userId, ip) {
    // In production, implement:
    // 1. Check if IP is from different country
    // 2. Check if login time is unusual
    // 3. Check if device is new
    // 4. Compare with user's typical patterns

    // For now, just log
    logger.debug("Checking unusual login patterns", { userId, ip });
  }

  /**
   * Get recent failed login count
   */
  async getRecentFailedLogins(email) {
    // In production, query from database
    // For now, return 0
    return 0;
  }

  /**
   * Get recent unauthorized access attempts
   */
  async getRecentUnauthorizedAttempts(userId) {
    // In production, query from database
    // For now, return 0
    return 0;
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(identifier, alertType, details = {}) {
    try {
      // Check cooldown
      const alertKey = `${identifier}-${alertType}`;
      const lastAlert = this.recentAlerts.get(alertKey);

      if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
        logger.debug("Alert cooldown active", { alertKey });
        return;
      }

      this.recentAlerts.set(alertKey, Date.now());

      logger.warn("Security Alert", {
        identifier,
        alertType,
        ...details,
      });

      // In production:
      // 1. Send email to user
      // 2. Send notification to security team
      // 3. Create incident ticket
      // 4. Update security dashboard
    } catch (error) {
      logger.error("Failed to send security alert:", error);
    }
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(startDate, endDate) {
    // In production, query database for events in date range
    const report = {
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalEvents: 0,
        failedLogins: 0,
        successfulLogins: 0,
        unauthorizedAccess: 0,
        suspiciousActivity: 0,
        accountLockouts: 0,
      },
      topEvents: [],
      recommendations: [],
    };

    return report;
  }

  /**
   * Check if IP is blacklisted
   */
  async isBlacklisted(ip) {
    // In production, check against blacklist database
    return false;
  }

  /**
   * Add IP to blacklist
   */
  async blacklistIP(ip, reason, duration = 24 * 60 * 60 * 1000) {
    logger.warn("IP blacklisted", { ip, reason, duration });
    // In production, store in database with expiration
  }

  /**
   * Check rate limit violations
   */
  async checkRateLimitViolations(userId) {
    // In production, track rate limit violations
    return {
      violations: 0,
      lastViolation: null,
    };
  }

  /**
   * Analyze security trends
   */
  async analyzeSecurityTrends() {
    // In production, analyze patterns and trends
    return {
      trends: [],
      anomalies: [],
      recommendations: [],
    };
  }
}

// Create singleton instance
const securityMonitorService = new SecurityMonitorService();

export default securityMonitorService;
