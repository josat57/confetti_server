import nodemailer from "nodemailer";
import { logger } from "./logger.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import EmailConfig from "../config/email.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create reusable transporter using EmailConfig
let transporter;

const initializeTransporter = () => {
  try {
    const config = EmailConfig.getTransporterConfig();

    transporter = nodemailer.createTransport({
      ...config,
      // Additional reliability settings
      requireTLS: true,
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates if needed
      },
    });

    logger.info("Email transporter initialized successfully");
    return transporter;
  } catch (error) {
    logger.error("Failed to initialize email transporter:", error);
    throw error;
  }
};

// Initialize transporter on module load
try {
  initializeTransporter();
} catch (error) {
  logger.error("Email service initialization failed:", error);
}

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

// Check if error is retryable
const isRetryableError = (error) => {
  const retryableCodes = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EAI_AGAIN",
  ];

  const retryableMessages = [
    "timeout",
    "connection",
    "network",
    "temporary failure",
    "try again",
  ];

  // Check error codes
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  // Check error messages (case insensitive)
  if (error.message) {
    const message = error.message.toLowerCase();
    return retryableMessages.some((keyword) => message.includes(keyword));
  }

  return false;
};

// Calculate delay with exponential backoff
const calculateDelay = (attempt) => {
  const delay =
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1);
  return Math.min(delay, RETRY_CONFIG.maxDelay);
};

// Sleep function for delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry wrapper function for email operations with queue fallback
const withRetry = async (operation, context = "", emailData = null) => {
  let lastError;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Log the attempt
      logger.warn(
        `Email operation failed (attempt ${attempt}/${
          RETRY_CONFIG.maxAttempts
        })${context ? ` - ${context}` : ""}:`,
        {
          error: error.message,
          code: error.code,
          retryable: isRetryableError(error),
        }
      );

      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === RETRY_CONFIG.maxAttempts || !isRetryableError(error)) {
        break;
      }

      // Calculate and apply delay
      const delay = calculateDelay(attempt);
      logger.info(`Retrying email operation in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // All immediate attempts failed - add to queue if email data is provided
  if (emailData && isRetryableError(lastError)) {
    try {
      const emailQueueService = (
        await import("../services/email-queue.service.js")
      ).default;
      const queueId = await emailQueueService.addToQueue(emailData, lastError);

      logger.info(`Email added to retry queue after immediate failure:`, {
        queueId,
        recipient: emailData.to,
        context,
        error: lastError.message,
      });

      // Return a special result indicating queued status
      return {
        queued: true,
        queueId,
        message: "Email queued for retry due to delivery failure",
      };
    } catch (queueError) {
      logger.error("Failed to add email to retry queue:", queueError);
    }
  }

  // All attempts failed, throw the last error
  throw lastError;
};

// Error classification functions
const classifyEmailError = (error) => {
  const errorInfo = {
    type: "unknown",
    category: "general",
    retryable: isRetryableError(error),
    details: error.message || "Unknown error",
  };

  // Configuration errors
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

  // Rate limiting
  else if (error.message && error.message.includes("rate limit")) {
    errorInfo.type = "rate_limit";
    errorInfo.category = "sending";
    errorInfo.retryable = true;
  }

  // Invalid recipient
  else if (
    error.message &&
    (error.message.includes("invalid recipient") ||
      error.message.includes("recipient rejected") ||
      error.message.includes("no such user"))
  ) {
    errorInfo.type = "invalid_recipient";
    errorInfo.category = "sending";
    errorInfo.retryable = false;
  }

  return errorInfo;
};

// Enhanced error logging function
const logEmailError = (error, context = {}) => {
  const errorInfo = classifyEmailError(error);

  const logData = {
    ...context,
    error: {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
    },
    classification: errorInfo,
    timestamp: new Date().toISOString(),
  };

  // Mask sensitive information
  if (logData.smtpConfig) {
    logData.smtpConfig = {
      ...logData.smtpConfig,
      auth: logData.smtpConfig.auth
        ? {
            user: logData.smtpConfig.auth.user,
            pass: "***MASKED***",
          }
        : undefined,
    };
  }

  logger.error(
    `Email ${errorInfo.category} error (${errorInfo.type}):`,
    logData
  );

  return errorInfo;
};

// Load email templates
const loadTemplate = async (templateName) => {
  try {
    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "email",
      `${templateName}.html`
    );
    return await fs.readFile(templatePath, "utf-8");
  } catch (error) {
    logger.error(`Error loading email template ${templateName}:`, error);
    throw new Error(`Failed to load email template: ${templateName}`);
  }
};

// Replace template variables
const replaceTemplateVariables = (template, variables) => {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
};

// Direct email sending function (used by queue service)
export const sendEmailDirect = async (emailData) => {
  try {
    // Ensure transporter is initialized
    if (!transporter) {
      initializeTransporter();
    }

    const fromAddress = EmailConfig.getFromAddress();

    const mailOptions = {
      from: fromAddress,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info("Direct email sent successfully:", {
      messageId: info.messageId,
      recipient: emailData.to,
      subject: emailData.subject,
    });

    return info;
  } catch (error) {
    logger.error("Direct email sending failed:", {
      recipient: emailData.to,
      subject: emailData.subject,
      error: error.message,
    });
    throw error;
  }
};

// Send email with template
export const sendEmail = async ({ to, subject, template, variables }) => {
  const context = {
    operation: "sendEmail",
    recipient: to,
    subject,
    template,
  };

  try {
    return await withRetry(async () => {
      // Ensure transporter is initialized
      if (!transporter) {
        initializeTransporter();
      }

      // Load and process template
      let html = await loadTemplate(template);
      html = replaceTemplateVariables(html, {
        ...variables,
        frontendUrl: process.env.FRONTEND_URL,
      });

      const fromAddress = EmailConfig.getFromAddress();

      // Send email
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });

      logger.info("Email sent successfully:", {
        messageId: info.messageId,
        recipient: to,
        subject,
        template,
        fromAddress: fromAddress,
      });

      return info;
    }, `template email to ${to}`);
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    throw new Error(
      `Failed to send ${template} email to ${to}: ${errorInfo.details}`
    );
  }
};

// Email sending functions
export const sendWelcomeEmail = async (user) => {
  const context = {
    operation: "sendWelcomeEmail",
    recipient: user.email,
    userId: user._id || user.id,
  };

  const emailData = {
    to: user.email,
    subject: "Welcome to Confetti!",
    html: `
      <h1>Welcome to Confetti!</h1>
      <p>Hi ${user.firstName || user.username},</p>
      <p>Thank you for joining Confetti. We're excited to have you on board!</p>
      <p>Get started by exploring our features and creating your first event.</p>
    `,
  };

  try {
    return await withRetry(
      async () => {
        // Ensure transporter is initialized
        if (!transporter) {
          initializeTransporter();
        }

        const fromAddress = EmailConfig.getFromAddress();

        const info = await transporter.sendMail({
          from: fromAddress,
          ...emailData,
        });

        logger.info("Welcome email sent successfully:", {
          messageId: info.messageId,
          recipient: user.email,
          userId: user._id || user.id,
          fromAddress: fromAddress,
        });

        return info;
      },
      `welcome email to ${user.email}`,
      emailData
    );
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error(`Failed to send welcome email to ${user.email}:`, errorInfo);
    throw new Error(`Failed to send welcome email: ${errorInfo.details}`);
  }
};

export const sendVerificationEmail = async (user, otp, token) => {
  const context = {
    operation: "sendVerificationEmail",
    recipient: user.email,
    userId: user._id || user.id,
    hasOtp: !!otp,
    hasToken: !!token,
  };

  const emailData = {
    to: user.email,
    subject: "Verify Your Email",
    html: `
      <h1>Verify Your Email</h1>
      <p>Hi ${user.firstName || user.username},</p>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>Or click the link below to verify your email:</p>
      <a href="${
        process.env.FRONTEND_URL
      }/verify-email?token=${token}&otp=${otp}">
        Verify Email
      </a>
    `,
  };

  try {
    return await withRetry(
      async () => {
        // Ensure transporter is initialized
        if (!transporter) {
          initializeTransporter();
        }

        const fromAddress = EmailConfig.getFromAddress();

        const info = await transporter.sendMail({
          from: fromAddress,
          ...emailData,
        });

        logger.info("Verification email sent successfully:", {
          messageId: info.messageId,
          recipient: user.email,
          userId: user._id || user.id,
          fromAddress: fromAddress,
        });

        return info;
      },
      `verification email to ${user.email}`,
      emailData
    );
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error(
      `Failed to send verification email to ${user.email}:`,
      errorInfo
    );
    throw new Error(`Failed to send verification email: ${errorInfo.details}`);
  }
};

export const sendPasswordResetEmail = async (user, otp, token) => {
  const context = {
    operation: "sendPasswordResetEmail",
    recipient: user.email,
    userId: user._id || user.id,
    hasOtp: !!otp,
    hasToken: !!token,
  };

  const emailData = {
    to: user.email,
    subject: "Reset Your Password",
    html: `
      <h1>Reset Your Password</h1>
      <p>Hi ${user.firstName || user.username},</p>
      <p>Your password reset code is: <strong>${otp}</strong></p>
      <p>Or click the link below to reset your password:</p>
      <a href="${
        process.env.FRONTEND_URL
      }/reset-password?token=${token}&otp=${otp}">
        Reset Password
      </a>
    `,
  };

  try {
    return await withRetry(
      async () => {
        // Ensure transporter is initialized
        if (!transporter) {
          initializeTransporter();
        }

        const fromAddress = EmailConfig.getFromAddress();

        const info = await transporter.sendMail({
          from: fromAddress,
          ...emailData,
        });

        logger.info("Password reset email sent successfully:", {
          messageId: info.messageId,
          recipient: user.email,
          userId: user._id || user.id,
          fromAddress: fromAddress,
        });

        return info;
      },
      `password reset email to ${user.email}`,
      emailData
    );
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error(
      `Failed to send password reset email to ${user.email}:`,
      errorInfo
    );
    throw new Error(
      `Failed to send password reset email: ${errorInfo.details}`
    );
  }
};

// Send message notification email
export const sendMessageNotification = async (recipient, sender, message) => {
  const context = {
    operation: "sendMessageNotification",
    recipient: recipient.email,
    senderId: sender._id || sender.id,
    messageId: message._id || message.id,
  };

  try {
    return await withRetry(async () => {
      // Ensure transporter is initialized
      if (!transporter) {
        initializeTransporter();
      }

      const fromAddress = EmailConfig.getFromAddress();

      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipient.email,
        subject: `New Message from ${sender.firstName || sender.username}`,
        html: `
          <h1>New Message</h1>
          <p>Hi ${recipient.firstName || recipient.username},</p>
          <p>You have received a new message from ${
            sender.firstName || sender.username
          }:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0;">${message.content}</p>
          </div>
          <p>Click the link below to view the message:</p>
          <a href="${process.env.FRONTEND_URL}/messages/${
          message.conversationId
        }">
            View Message
          </a>
        `,
      });

      logger.info("Message notification email sent successfully:", {
        messageId: info.messageId,
        recipient: recipient.email,
        fromAddress: fromAddress,
      });

      return info;
    }, `message notification to ${recipient.email}`);
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error("Error sending message notification email:", errorInfo);
    throw new Error(
      `Failed to send message notification: ${errorInfo.details}`
    );
  }
};

// Send subscription emails
export const sendSubscriptionEmail = async (user, type, data) => {
  const context = {
    operation: "sendSubscriptionEmail",
    recipient: user.email,
    userId: user._id || user.id,
    subscriptionType: type,
  };

  try {
    return await withRetry(async () => {
      // Ensure transporter is initialized
      if (!transporter) {
        initializeTransporter();
      }

      let subject, html;

      switch (type) {
        case "trial_started":
          subject = "Trial Started";
          html = `
            <h1>Trial Started</h1>
            <p>Hi ${user.firstName || user.username},</p>
            <p>Your ${data.planType} trial for the ${
            data.planName
          } plan has started.</p>
            <p>Trial ends on: ${new Date(
              data.trialEndDate
            ).toLocaleDateString()}</p>
            <p>Enjoy your trial period!</p>
          `;
          break;

        case "subscription_activated":
          subject = "Subscription Activated";
          html = `
            <h1>Subscription Activated</h1>
            <p>Hi ${user.firstName || user.username},</p>
            <p>Your ${data.planType} subscription for the ${
            data.planName
          } plan has been activated.</p>
            <p>Next billing date: ${new Date(
              data.endDate
            ).toLocaleDateString()}</p>
            <p>Thank you for your subscription!</p>
          `;
          break;

        case "subscription_cancelled":
          subject = "Subscription Cancelled";
          html = `
            <h1>Subscription Cancelled</h1>
            <p>Hi ${user.firstName || user.username},</p>
            <p>Your ${data.planType} subscription for the ${
            data.planName
          } plan has been cancelled.</p>
            <p>Access will continue until: ${new Date(
              data.endDate
            ).toLocaleDateString()}</p>
            <p>We're sorry to see you go!</p>
          `;
          break;

        case "subscription_upgraded":
          subject = "Subscription Upgraded";
          html = `
            <h1>Subscription Upgraded</h1>
            <p>Hi ${user.firstName || user.username},</p>
            <p>Your ${data.planType} subscription has been upgraded to the ${
            data.planName
          } plan.</p>
            <p>Enjoy your new features!</p>
          `;
          break;

        case "subscription_downgraded":
          subject = "Subscription Downgraded";
          html = `
            <h1>Subscription Downgraded</h1>
            <p>Hi ${user.firstName || user.username},</p>
            <p>Your ${data.planType} subscription has been downgraded to the ${
            data.planName
          } plan.</p>
            <p>Changes will take effect on your next billing date.</p>
          `;
          break;

        default:
          throw new Error("Invalid subscription email type");
      }

      const fromAddress = EmailConfig.getFromAddress();

      const info = await transporter.sendMail({
        from: fromAddress,
        to: user.email,
        subject,
        html,
      });

      logger.info("Subscription email sent successfully:", {
        messageId: info.messageId,
        recipient: user.email,
        subscriptionType: type,
        fromAddress: fromAddress,
      });

      return info;
    }, `subscription email (${type}) to ${user.email}`);
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error("Error sending subscription email:", errorInfo);
    throw new Error(`Failed to send subscription email: ${errorInfo.details}`);
  }
};

/**
 * Send payment success email with subscription details and verification link
 * Task 10.1: Payment success email
 * Requirements: 10.1, 10.2, 10.4
 */
export const sendPaymentSuccessEmail = async (
  user,
  subscription,
  verificationToken
) => {
  const context = {
    operation: "sendPaymentSuccessEmail",
    recipient: user.email,
    userId: user._id || user.id,
    subscriptionId: subscription._id || subscription.id,
  };

  const emailData = {
    to: user.email,
    subject: "Payment Successful - Welcome to Confetti!",
    template: "payment-success",
    variables: {
      firstName: user.firstName || user.username || "there",
      planType:
        subscription.planType.charAt(0).toUpperCase() +
        subscription.planType.slice(1),
      planName: subscription.planName,
      amount: subscription.amount.toLocaleString(),
      endDate: new Date(subscription.endDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&email=${user.email}`,
      email: user.email,
    },
  };

  try {
    return await withRetry(
      async () => {
        // Ensure transporter is initialized
        if (!transporter) {
          initializeTransporter();
        }

        // Load and process template
        let html = await loadTemplate(emailData.template);
        html = replaceTemplateVariables(html, {
          ...emailData.variables,
          frontendUrl: process.env.FRONTEND_URL,
        });

        const fromAddress = EmailConfig.getFromAddress();

        const info = await transporter.sendMail({
          from: fromAddress,
          to: emailData.to,
          subject: emailData.subject,
          html,
        });

        logger.info("Payment success email sent successfully:", {
          messageId: info.messageId,
          recipient: user.email,
          subscriptionId: subscription._id || subscription.id,
          fromAddress: fromAddress,
        });

        return info;
      },
      `payment success email to ${user.email}`,
      emailData
    );
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error(
      `Failed to send payment success email to ${user.email}:`,
      errorInfo
    );
    throw new Error(
      `Failed to send payment success email: ${errorInfo.details}`
    );
  }
};

/**
 * Send payment failed email with failure reason and retry link
 * Task 10.2: Payment failed email
 * Requirements: 13.2, 13.5
 */
export const sendPaymentFailedEmail = async (user, payment) => {
  const context = {
    operation: "sendPaymentFailedEmail",
    recipient: user.email,
    userId: user._id || user.id,
    paymentId: payment._id || payment.id,
  };

  const emailData = {
    to: user.email,
    subject: "Payment Failed - Action Required",
    template: "payment-failed",
    variables: {
      firstName: user.firstName || user.username || "there",
      planType: payment.subscriptionDetails?.planType
        ? payment.subscriptionDetails.planType.charAt(0).toUpperCase() +
          payment.subscriptionDetails.planType.slice(1)
        : "Subscription",
      planName: payment.subscriptionDetails?.planName || "Plan",
      amount: payment.amount.toLocaleString(),
      failureReason:
        payment.webhookData?.data?.processor_response ||
        payment.webhookData?.data?.gateway_response ||
        "Payment could not be processed",
      reference: payment.reference,
      retryPaymentLink: `${process.env.FRONTEND_URL}/subscription/payment?reference=${payment.reference}`,
    },
  };

  try {
    return await withRetry(
      async () => {
        // Ensure transporter is initialized
        if (!transporter) {
          initializeTransporter();
        }

        // Load and process template
        let html = await loadTemplate(emailData.template);
        html = replaceTemplateVariables(html, {
          ...emailData.variables,
          frontendUrl: process.env.FRONTEND_URL,
        });

        const fromAddress = EmailConfig.getFromAddress();

        const info = await transporter.sendMail({
          from: fromAddress,
          to: emailData.to,
          subject: emailData.subject,
          html,
        });

        logger.info("Payment failed email sent successfully:", {
          messageId: info.messageId,
          recipient: user.email,
          paymentId: payment._id || payment.id,
          fromAddress: fromAddress,
        });

        return info;
      },
      `payment failed email to ${user.email}`,
      emailData
    );
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error(
      `Failed to send payment failed email to ${user.email}:`,
      errorInfo
    );
    throw new Error(
      `Failed to send payment failed email: ${errorInfo.details}`
    );
  }
};

/**
 * Send upgrade confirmation email with new plan details and prorated amount
 * Task 10.3: Upgrade confirmation email
 * Requirements: 6.5
 */
export const sendUpgradeConfirmationEmail = async (
  user,
  subscription,
  upgradeDetails
) => {
  const context = {
    operation: "sendUpgradeConfirmationEmail",
    recipient: user.email,
    userId: user._id || user.id,
    subscriptionId: subscription._id || subscription.id,
  };

  const emailData = {
    to: user.email,
    subject: "Subscription Upgraded Successfully!",
    template: "upgrade-confirmation",
    variables: {
      firstName: user.firstName || user.username || "there",
      planType:
        subscription.planType.charAt(0).toUpperCase() +
        subscription.planType.slice(1),
      planName: subscription.planName,
      previousPlan: upgradeDetails.previousPlan || "Previous Plan",
      proratedAmount: (upgradeDetails.proratedAmount || 0).toLocaleString(),
      newMonthlyAmount: subscription.amount.toLocaleString(),
      endDate: new Date(subscription.endDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  };

  try {
    return await withRetry(
      async () => {
        // Ensure transporter is initialized
        if (!transporter) {
          initializeTransporter();
        }

        // Load and process template
        let html = await loadTemplate(emailData.template);
        html = replaceTemplateVariables(html, {
          ...emailData.variables,
          frontendUrl: process.env.FRONTEND_URL,
        });

        const fromAddress = EmailConfig.getFromAddress();

        const info = await transporter.sendMail({
          from: fromAddress,
          to: emailData.to,
          subject: emailData.subject,
          html,
        });

        logger.info("Upgrade confirmation email sent successfully:", {
          messageId: info.messageId,
          recipient: user.email,
          subscriptionId: subscription._id || subscription.id,
          fromAddress: fromAddress,
        });

        return info;
      },
      `upgrade confirmation email to ${user.email}`,
      emailData
    );
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error(
      `Failed to send upgrade confirmation email to ${user.email}:`,
      errorInfo
    );
    throw new Error(
      `Failed to send upgrade confirmation email: ${errorInfo.details}`
    );
  }
};

/**
 * Send subscription expiration reminder email
 * Task 10.4: Subscription expiration reminders
 * Requirements: 5.4
 */
export const sendSubscriptionExpiringEmail = async (
  user,
  subscription,
  daysRemaining
) => {
  const context = {
    operation: "sendSubscriptionExpiringEmail",
    recipient: user.email,
    userId: user._id || user.id,
    subscriptionId: subscription._id || subscription.id,
    daysRemaining,
  };

  // Determine urgency class based on days remaining
  const urgencyClass = daysRemaining <= 1 ? "urgency-high" : "";

  const emailData = {
    to: user.email,
    subject: `Subscription Expiring in ${daysRemaining} Day${
      daysRemaining !== 1 ? "s" : ""
    }`,
    template: "subscription-expiring",
    variables: {
      firstName: user.firstName || user.username || "there",
      planType:
        subscription.planType.charAt(0).toUpperCase() +
        subscription.planType.slice(1),
      planName: subscription.planName,
      amount: subscription.amount.toLocaleString(),
      daysRemaining: daysRemaining.toString(),
      expirationDate: new Date(subscription.endDate).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      ),
      autoRenewStatus: subscription.autoRenew ? "Enabled" : "Disabled",
      urgencyClass,
      renewalLink: `${process.env.FRONTEND_URL}/subscription/renew?id=${
        subscription._id || subscription.id
      }`,
    },
  };

  try {
    return await withRetry(
      async () => {
        // Ensure transporter is initialized
        if (!transporter) {
          initializeTransporter();
        }

        // Load and process template
        let html = await loadTemplate(emailData.template);
        html = replaceTemplateVariables(html, {
          ...emailData.variables,
          frontendUrl: process.env.FRONTEND_URL,
        });

        const fromAddress = EmailConfig.getFromAddress();

        const info = await transporter.sendMail({
          from: fromAddress,
          to: emailData.to,
          subject: emailData.subject,
          html,
        });

        logger.info("Subscription expiring email sent successfully:", {
          messageId: info.messageId,
          recipient: user.email,
          subscriptionId: subscription._id || subscription.id,
          daysRemaining,
          fromAddress: fromAddress,
        });

        return info;
      },
      `subscription expiring email to ${user.email}`,
      emailData
    );
  } catch (error) {
    const errorInfo = logEmailError(error, context);
    logger.error(
      `Failed to send subscription expiring email to ${user.email}:`,
      errorInfo
    );
    throw new Error(
      `Failed to send subscription expiring email: ${errorInfo.details}`
    );
  }
};

// Email service testing and health check functions

/**
 * Test SMTP connection to verify email service connectivity
 * @returns {Promise<Object>} Connection test result with status and details
 */
export const testEmailConnection = async () => {
  const testResult = {
    success: false,
    timestamp: new Date().toISOString(),
    connectionTime: null,
    error: null,
    details: {},
  };

  const startTime = Date.now();

  try {
    logger.info("Testing SMTP connection...");

    // Verify the transporter connection
    const isConnected = await transporter.verify();

    testResult.connectionTime = Date.now() - startTime;
    testResult.success = isConnected;
    testResult.details = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER,
      connectionTimeMs: testResult.connectionTime,
    };

    if (isConnected) {
      logger.info("SMTP connection test successful:", testResult.details);
    } else {
      logger.warn("SMTP connection test failed - verify() returned false");
      testResult.error = "SMTP verification failed";
    }

    return testResult;
  } catch (error) {
    testResult.connectionTime = Date.now() - startTime;
    testResult.error = error.message;
    testResult.details = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER,
      connectionTimeMs: testResult.connectionTime,
      errorCode: error.code,
      errorCommand: error.command,
    };

    const errorInfo = logEmailError(error, {
      operation: "testEmailConnection",
      testResult: testResult.details,
    });

    logger.error("SMTP connection test failed:", {
      error: error.message,
      code: error.code,
      connectionTime: testResult.connectionTime,
      classification: errorInfo,
    });

    return testResult;
  }
};

/**
 * Send a test email to verify email sending functionality
 * @param {string} recipientEmail - Email address to send test email to
 * @param {Object} options - Optional test email configuration
 * @returns {Promise<Object>} Test email result with status and details
 */
export const sendTestEmail = async (recipientEmail, options = {}) => {
  const {
    subject = "Email Service Test",
    includeTimestamp = true,
    includeConfig = false,
  } = options;

  const testResult = {
    success: false,
    timestamp: new Date().toISOString(),
    recipient: recipientEmail,
    messageId: null,
    sendTime: null,
    error: null,
  };

  const startTime = Date.now();

  try {
    logger.info(`Sending test email to ${recipientEmail}...`);

    // Validate email address format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      throw new Error("Invalid recipient email address format");
    }

    // Prepare test email content
    let html = `
      <h1>Email Service Test</h1>
      <p>This is a test email from the Confetti application email service.</p>
      <p><strong>Test Status:</strong> Email service is working correctly!</p>
    `;

    if (includeTimestamp) {
      html += `<p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>`;
    }

    if (includeConfig) {
      html += `
        <h2>Configuration Details</h2>
        <ul>
          <li><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</li>
          <li><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</li>
          <li><strong>Secure Connection:</strong> ${process.env.SMTP_SECURE}</li>
          <li><strong>From Address:</strong> ${process.env.SMTP_FROM}</li>
        </ul>
      `;
    }

    html += `
      <p>If you received this email, the email service is configured and working properly.</p>
      <hr>
      <p><small>This is an automated test email from Confetti Email Service</small></p>
    `;

    // Ensure transporter is initialized
    if (!transporter) {
      initializeTransporter();
    }

    const fromAddress = EmailConfig.getFromAddress();

    // Send the test email
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: includeTimestamp
        ? `${subject} - ${new Date().toLocaleString()}`
        : subject,
      html,
    });

    testResult.success = true;
    testResult.messageId = info.messageId;
    testResult.sendTime = Date.now() - startTime;

    logger.info("Test email sent successfully:", {
      messageId: info.messageId,
      recipient: recipientEmail,
      sendTimeMs: testResult.sendTime,
    });

    return testResult;
  } catch (error) {
    testResult.sendTime = Date.now() - startTime;
    testResult.error = error.message;

    const errorInfo = logEmailError(error, {
      operation: "sendTestEmail",
      recipient: recipientEmail,
      sendTime: testResult.sendTime,
    });

    logger.error(`Test email failed to ${recipientEmail}:`, {
      error: error.message,
      code: error.code,
      sendTime: testResult.sendTime,
      classification: errorInfo,
    });

    return testResult;
  }
};

/**
 * Get comprehensive email service health status
 * @returns {Promise<Object>} Health check result with detailed status information
 */
export const getEmailServiceHealth = async () => {
  const healthStatus = {
    status: "unknown",
    timestamp: new Date().toISOString(),
    checks: {
      configuration: { status: "unknown", details: null },
      connection: { status: "unknown", details: null },
    },
    overall: {
      healthy: false,
      issues: [],
      warnings: [],
    },
  };

  try {
    // Check configuration
    logger.info("Performing email service health check...");

    const configCheck = await import("./validateEmailConfig.js").then(
      (module) => module.checkEmailConfig()
    );

    healthStatus.checks.configuration = {
      status: configCheck.isValid ? "healthy" : "unhealthy",
      details: {
        errors: configCheck.errors,
        warnings: configCheck.warnings,
        config: configCheck.config,
      },
    };

    if (!configCheck.isValid) {
      healthStatus.overall.issues.push(...configCheck.errors);
    }
    if (configCheck.warnings.length > 0) {
      healthStatus.overall.warnings.push(...configCheck.warnings);
    }

    // Check SMTP connection if configuration is valid
    if (configCheck.isValid) {
      const connectionTest = await testEmailConnection();

      healthStatus.checks.connection = {
        status: connectionTest.success ? "healthy" : "unhealthy",
        details: {
          connectionTime: connectionTest.connectionTime,
          error: connectionTest.error,
          config: connectionTest.details,
        },
      };

      if (!connectionTest.success) {
        healthStatus.overall.issues.push(
          `SMTP connection failed: ${connectionTest.error}`
        );
      }
    } else {
      healthStatus.checks.connection = {
        status: "skipped",
        details: { reason: "Configuration validation failed" },
      };
    }

    // Determine overall health status
    const hasErrors = healthStatus.overall.issues.length > 0;
    const hasWarnings = healthStatus.overall.warnings.length > 0;

    if (!hasErrors) {
      healthStatus.status = hasWarnings ? "healthy_with_warnings" : "healthy";
      healthStatus.overall.healthy = true;
    } else {
      healthStatus.status = "unhealthy";
      healthStatus.overall.healthy = false;
    }

    logger.info("Email service health check completed:", {
      status: healthStatus.status,
      healthy: healthStatus.overall.healthy,
      issueCount: healthStatus.overall.issues.length,
      warningCount: healthStatus.overall.warnings.length,
    });

    return healthStatus;
  } catch (error) {
    healthStatus.status = "error";
    healthStatus.overall.healthy = false;
    healthStatus.overall.issues.push(`Health check failed: ${error.message}`);

    logger.error("Email service health check error:", error);
    return healthStatus;
  }
};
