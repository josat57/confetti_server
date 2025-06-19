import nodemailer from 'nodemailer';
import { logger } from './logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

// Load email templates
const loadTemplate = async (templateName) => {
    try {
        const templatePath = path.join(__dirname, '..', 'templates', 'email', `${templateName}.html`);
        return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
        logger.error(`Error loading email template ${templateName}:`, error);
        throw new Error(`Failed to load email template: ${templateName}`);
    }
};

// Replace template variables
const replaceTemplateVariables = (template, variables) => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
};

// Send email with template
export const sendEmail = async ({ to, subject, template, variables }) => {
    try {
        // Load and process template
        let html = await loadTemplate(template);
        html = replaceTemplateVariables(html, {
            ...variables,
            frontendUrl: process.env.FRONTEND_URL
        });

        // Send email
        const info = await transporter.sendMail({
            from: `"Confetti" <${process.env.SMTP_FROM}>`,
            to,
            subject,
            html
        });

        logger.info('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        logger.error('Error sending email:', error);
        throw new Error('Error sending email');
    }
};

// Email sending functions
export const sendWelcomeEmail = async (user) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Welcome to Confetti!',
      html: `
        <h1>Welcome to Confetti!</h1>
        <p>Hi ${user.firstName || user.username},</p>
        <p>Thank you for joining Confetti. We're excited to have you on board!</p>
        <p>Get started by exploring our features and creating your first event.</p>
      `
    });
  } catch (error) {
    logger.error('Error sending welcome email:', error);
  }
};

export const sendVerificationEmail = async (user, otp, token) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Verify Your Email',
      html: `
        <h1>Verify Your Email</h1>
        <p>Hi ${user.firstName || user.username},</p>
        <p>Your verification code is: <strong>${otp}</strong></p>
        <p>Or click the link below to verify your email:</p>
        <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}&otp=${otp}">
          Verify Email
        </a>
      `
    });
  } catch (error) {
    logger.error('Error sending verification email:', error);
  }
};

export const sendPasswordResetEmail = async (user, otp, token) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Reset Your Password',
      html: `
        <h1>Reset Your Password</h1>
        <p>Hi ${user.firstName || user.username},</p>
        <p>Your password reset code is: <strong>${otp}</strong></p>
        <p>Or click the link below to reset your password:</p>
        <a href="${process.env.FRONTEND_URL}/reset-password?token=${token}&otp=${otp}">
          Reset Password
        </a>
      `
    });
  } catch (error) {
    logger.error('Error sending password reset email:', error);
  }
};

// Send message notification email
export const sendMessageNotification = async (recipient, sender, message) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipient.email,
      subject: `New Message from ${sender.firstName || sender.username}`,
      html: `
        <h1>New Message</h1>
        <p>Hi ${recipient.firstName || recipient.username},</p>
        <p>You have received a new message from ${sender.firstName || sender.username}:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 0;">${message.content}</p>
        </div>
        <p>Click the link below to view the message:</p>
        <a href="${process.env.FRONTEND_URL}/messages/${message.conversationId}">
          View Message
        </a>
      `
    });
  } catch (error) {
    logger.error('Error sending message notification email:', error);
  }
};

// Send subscription emails
export const sendSubscriptionEmail = async (user, type, data) => {
  try {
    let subject, html;

    switch (type) {
      case 'trial_started':
        subject = 'Trial Started';
        html = `
          <h1>Trial Started</h1>
          <p>Hi ${user.firstName || user.username},</p>
          <p>Your ${data.planType} trial for the ${data.planName} plan has started.</p>
          <p>Trial ends on: ${new Date(data.trialEndDate).toLocaleDateString()}</p>
          <p>Enjoy your trial period!</p>
        `;
        break;

      case 'subscription_activated':
        subject = 'Subscription Activated';
        html = `
          <h1>Subscription Activated</h1>
          <p>Hi ${user.firstName || user.username},</p>
          <p>Your ${data.planType} subscription for the ${data.planName} plan has been activated.</p>
          <p>Next billing date: ${new Date(data.endDate).toLocaleDateString()}</p>
          <p>Thank you for your subscription!</p>
        `;
        break;

      case 'subscription_cancelled':
        subject = 'Subscription Cancelled';
        html = `
          <h1>Subscription Cancelled</h1>
          <p>Hi ${user.firstName || user.username},</p>
          <p>Your ${data.planType} subscription for the ${data.planName} plan has been cancelled.</p>
          <p>Access will continue until: ${new Date(data.endDate).toLocaleDateString()}</p>
          <p>We're sorry to see you go!</p>
        `;
        break;

      case 'subscription_upgraded':
        subject = 'Subscription Upgraded';
        html = `
          <h1>Subscription Upgraded</h1>
          <p>Hi ${user.firstName || user.username},</p>
          <p>Your ${data.planType} subscription has been upgraded to the ${data.planName} plan.</p>
          <p>Enjoy your new features!</p>
        `;
        break;

      case 'subscription_downgraded':
        subject = 'Subscription Downgraded';
        html = `
          <h1>Subscription Downgraded</h1>
          <p>Hi ${user.firstName || user.username},</p>
          <p>Your ${data.planType} subscription has been downgraded to the ${data.planName} plan.</p>
          <p>Changes will take effect on your next billing date.</p>
        `;
        break;

      default:
        throw new Error('Invalid subscription email type');
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject,
      html
    });
  } catch (error) {
    logger.error('Error sending subscription email:', error);
  }
}; 