import nodemailer from 'nodemailer';
import { logger } from './logger.js';

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send email function
export const sendEmail = async ({ email, subject, message }) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      text: message,
      html: message // You can also send HTML emails
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error('Error sending email');
  }
};

// Send welcome email
export const sendWelcomeEmail = async (user) => {
  const message = `
    <h1>Welcome to Confetti!</h1>
    <p>Hi ${user.firstName},</p>
    <p>Thank you for joining Confetti. We're excited to help you plan your perfect event!</p>
    <p>Get started by creating your first event or browsing our vendor marketplace.</p>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Welcome to Confetti',
    message
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (user, resetToken) => {
  const message = `
    <h1>Password Reset Request</h1>
    <p>Hi ${user.firstName},</p>
    <p>You requested a password reset. Your reset token is: ${resetToken}</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Password Reset Request',
    message
  });
};

// Send email verification
export const sendVerificationEmail = async (user, verificationToken) => {
  const message = `
    <h1>Verify Your Email</h1>
    <p>Hi ${user.firstName},</p>
    <p>Please verify your email by clicking the link below:</p>
    <a href="${process.env.FRONTEND_URL}/verify-email/${verificationToken}">Verify Email</a>
  `;

  return sendEmail({
    email: user.email,
    subject: 'Verify Your Email',
    message
  });
}; 