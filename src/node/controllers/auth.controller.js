import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import {
  generateTokenPair,
  verifyRefreshToken,
  generateAccessToken,
} from "../utils/auth.js";
import { handleError } from "../utils/error.js";
import crypto from "crypto";
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../utils/email.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { Console } from "console";

export const register = async (req, res, next) => {
  try {
    const {
      email,
      password,
      userName,
      phone,
      planType,
      planName,
      amount,
      currency,
    } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Default currency to NGN if not provided
    const paymentCurrency = currency || "NGN";

    // Validate plan if provided
    let validatedPlan = null;
    if (planType && planName) {
      validatedPlan = await validatePlan(
        planType,
        planName,
        amount,
        paymentCurrency
      );
      if (!validatedPlan) {
        return next(new AppError("Invalid subscription plan", 400));
      }
    }

    // Determine user role based on plan type
    const role = planType === "vendor" ? "vendor" : "event-planner";

    // Determine initial status
    const isFree = !validatedPlan || validatedPlan.price === 0;
    const status = isFree ? "pending_verification" : "pending_payment";

    // Create user
    // isActive is false by default - will be set to true after payment/email verification
    const user = await User.create({
      email,
      password,
      userName,
      phone,
      role,
      status,
      isActive: isFree, // Free plans are active immediately, paid plans require payment
    });

    // Create subscription with payment if needed
    const subscriptionService = (
      await import("../services/subscription.service.js")
    ).default;
    const result = await subscriptionService.createWithPayment(
      user._id,
      planType || "planner",
      planName || "Starter",
      validatedPlan ? validatedPlan.price : 0,
      paymentCurrency
    );

    // Update user with subscription reference
    user.subscription = result.subscription._id;
    await user.save();

    // Generate verification token and OTP
    const token = user.generateEmailVerificationToken();
    const otp = user.generateOTP();
    await user.save();

    // Send emails based on plan type
    if (isFree) {
      try {
        await sendWelcomeEmail(user);
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError.message);
      }
      try {
        await sendVerificationEmail(user, otp, token);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError.message);
      }

      return res.status(200).json({
        status: "success",
        message:
          "Registration successful. Please check your email to verify your account.",
        data: {
          userId: user._id,
          email: user.email,
          subscriptionId: result.subscription._id,
        },
      });
    } else {
      // For paid plans, return payment URL
      return res.status(200).json({
        status: "success",
        message:
          "Registration successful. Please complete payment to activate your account.",
        data: {
          userId: user._id,
          email: user.email,
          subscriptionId: result.subscription._id,
          paymentUrl: result.paymentUrl,
          reference: result.reference,
          amount: result.amount,
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError("Invalid email or password", 401));
    }

    if (user.isLocked()) {
      return next(
        new AppError("Account is locked. Please try again later.", 401)
      );
    }

    if (!user.isEmailVerified) {
      return next(new AppError("Please verify your email to login.", 401));
    }

    // Check if account is disabled/deactivated
    if (!user.isActive) {
      const message = user.deletedAt
        ? "This account has been disabled. Your data will be retained for 30 days. Please contact support to reactivate your account."
        : "Account is deactivated. Please contact support.";
      return next(new AppError(message, 403));
    }

    // Generate token pair
    const tokens = generateTokenPair(user);

    // Store refresh token
    const refreshToken = await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Set cookies
    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    user.lastLogin = Date.now();
    await user.save();

    res.json({
      status: "success",
      message: "Logged in successfully",
      user: {
        id: user._id,
        email: user.email,
        userName: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const token = await RefreshToken.findOne({ token: refreshToken });
      if (token) {
        await token.revoke();
      }
    }

    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePicture: user.profilePicture,
        oauthProvider: user.oauthProvider,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    // Support both path parameters (/verify-email/:token/:otp) and query parameters (/verify-email?token=...&otp=...)
    const { token, otp } = req.params.token ? req.params : req.query;

    logger.info("Email verification attempt:", {
      token: token ? token.substring(0, 10) + "..." : "missing",
      otp: otp ? "provided" : "missing",
      method: req.params.token ? "path" : "query",
    });

    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: crypto
        .createHash("sha256")
        .update(token)
        .digest("hex"),
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError("Invalid or expired verification token", 400));
    }

    // Check if email is already verified first
    if (user.isEmailVerified) {
      return res.status(200).json({
        status: "success",
        message: "Email is already verified. You can now log in.",
      });
    }

    // Verify OTP
    const isOTPValid = await user.verifyOTP(otp);
    if (!isOTPValid) {
      // Provide more specific error message
      if (!user.otp || !user.otp.code) {
        return next(
          new AppError(
            "OTP not found. Please request a new verification email.",
            400
          )
        );
      }
      if (Date.now() > user.otp.expires) {
        return next(
          new AppError(
            "OTP has expired. Please request a new verification email.",
            400
          )
        );
      }
      if (user.otp.attempts >= 3) {
        return next(
          new AppError(
            "Too many OTP attempts. Please request a new verification email.",
            400
          )
        );
      }
      return next(
        new AppError("Invalid OTP. Please check and try again.", 400)
      );
    }

    // Handle different user statuses
    if (user.status === "pending_payment") {
      return next(
        new AppError("Please complete payment before verifying your email", 400)
      );
    }

    // Update user verification status and activate account
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;

    // Activate account if status is pending_verification
    if (user.status === "pending_verification") {
      user.status = "active";
      user.isActive = true; // Activate user after email verification
    }

    await user.save();

    // Generate new token pair
    const tokens = generateTokenPair(user);

    // Store refresh token
    const refreshToken = await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Set cookies
    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      status: "success",
      message: "Email verified successfully. Your account is now active.",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: true,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    if (user.isEmailVerified) {
      return next(new AppError("Email already verified", 400));
    }

    const token = user.generateEmailVerificationToken();
    const otp = user.generateOTP();
    await user.save();

    await sendVerificationEmail(user, otp, token);

    res.status(200).json({
      status: "success",
      message: "Verification email sent",
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError("No user found with that email address", 404));
    }

    // Generate OTP and reset token
    const otp = user.generateOTP();
    const token = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    await sendPasswordResetEmail(user, otp, token);

    res.status(200).json({
      status: "success",
      message: "Password reset OTP sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError("No user found with that email address", 404));
    }

    const isValid = user.verifyOTP(otp);
    await user.save(); // Save to update the attempts counter

    if (!isValid) {
      return next(new AppError("Invalid or expired OTP", 400));
    }

    // Generate a temporary token for password reset
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    res.status(200).json({
      status: "success",
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, confirmPassword } = req.body;

    // Find user by reset token
    const user = await User.findOne({
      passwordResetToken: crypto
        .createHash("sha256")
        .update(token)
        .digest("hex"),
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError("Invalid or expired reset token", 400));
    }

    // Update password
    user.password = confirmPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.otp = undefined; // Clear OTP after successful password reset
    await user.save();

    // Generate new token pair
    const tokens = generateTokenPair(user);

    // Store refresh token
    const refreshToken = await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Set cookies
    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      status: "success",
      message: "Password reset successful",
    });
  } catch (error) {
    next(error);
  }
};

export const resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return next(new AppError("No user found with that email address", 404));
    }

    // Check if previous OTP exists and hasn't expired
    if (user.otp && user.otp.expires > Date.now()) {
      const timeLeft = Math.ceil((user.otp.expires - Date.now()) / 1000 / 60);
      return next(
        new AppError(
          `Please wait ${timeLeft} minutes before requesting a new OTP`,
          400
        )
      );
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send new OTP via email
    console.log(
      "Transporter created: ",
      process.env.SMTP_HOST,
      process.env.SMTP_PORT,
      process.env.SMTP_SECURE,
      process.env.SMTP_USER,
      process.env.SMTP_PASSWORD
    );

    await sendEmail({
      email: user.email,
      subject: "New Password Reset OTP",
      message: `Your new password reset OTP is: ${otp}. This OTP will expire in 15 minutes.`,
    });

    res.status(200).json({
      status: "success",
      message: "New OTP sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    console.log(refreshToken);
    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 400));
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Check if user's token version matches
    if ((user.tokenVersion ?? 0) !== (decoded.tokenVersion ?? 0)) {
      return next(new AppError("Token has been revoked", 401));
    }

    // Generate new token pair
    const tokens = generateTokenPair(user);

    // Store refresh token
    const newRefreshToken = await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Set cookies
    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      status: "success",
      message: "Tokens refreshed successfully",
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const revokeRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError("Refresh token is required", 400));
    }

    // Find and revoke the token
    const token = await RefreshToken.findOne({ token: refreshToken });
    if (!token) {
      return next(new AppError("Token not found", 404));
    }

    await token.revoke();

    // Clear cookies
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    res.json({
      status: "success",
      message: "Token revoked successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyUser = async (req, res, next) => {
  try {
    const { id } = req.user;
    console.log(req.user);
    // Check if user is authenticated via session
    if (!id) {
      return res.status(401).json({
        status: "fail",
        message: "Not authenticated",
      });
    }

    // Get user from session
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Check if account is disabled/deactivated
    if (!user.isActive) {
      const message = user.deletedAt
        ? "This account has been disabled. Please contact support to reactivate your account."
        : "Account is deactivated. Please contact support.";
      return res.status(403).json({
        status: "fail",
        message: message,
      });
    }

    const userData = {
      id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      role: user.role,
      profilePicture: user.profilePicture,
      oauthProvider: user.oauthProvider,
    };

    req.user = userData;

    // Return user information
    res.json({
      status: "success",
      userData,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to validate plan from database
async function validatePlan(planType, planName, amount, currency = "NGN") {
  try {
    // Import SubscriptionPlan model
    const SubscriptionPlan = (
      await import("../models/subscriptionPlan.model.js")
    ).default;

    // Find plan from database
    const plan = await SubscriptionPlan.findByTypeAndName(planType, planName);

    if (!plan) {
      console.error(`Plan not found: ${planType} - ${planName}`);
      return null;
    }

    // Get pricing for the specified currency
    const pricing = plan.getPriceForCurrency(currency);

    if (!pricing) {
      console.error(
        `Pricing not found for plan ${planName} in currency ${currency}`
      );
      return null;
    }

    // Frontend can send amount in either format:
    // 1. Major units (naira/dollars): 4900 → convert to 490000 kobo
    // 2. Minor units (kobo/cents): 490000 → use as is
    let amountInMinorUnits = amount;

    // If amount is less than 100000, assume it's in major units and convert
    if (amount > 0 && amount < 100000) {
      amountInMinorUnits = Math.round(amount * 100);
    }

    // Verify amount matches plan price (prevent price manipulation)
    if (pricing.amountInMinorUnits !== amountInMinorUnits) {
      console.error(
        `Price mismatch for ${planName} (${currency}): expected ${pricing.amountInMinorUnits}, got ${amountInMinorUnits} (original: ${amount})`
      );
      return null;
    }

    return {
      name: plan.planName,
      price: pricing.amountInMinorUnits,
      currency,
      displayName: plan.displayName,
      description: plan.description,
    };
  } catch (error) {
    console.error(`Error validating plan: ${error.message}`);
    return null;
  }
}

/**
 * Disable user account
 * POST /api/v1/auth/disable-account
 */
export const disableAccount = async (req, res, next) => {
  try {
    const { password, reason } = req.body;

    // Require password for security
    if (!password) {
      return next(new AppError("Password is required to disable account", 400));
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return next(new AppError("Incorrect password", 401));
    }

    // Soft delete - mark as inactive
    user.isActive = false;
    user.deletedAt = new Date();
    user.accountDisabledReason = reason || "User requested account disable";
    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.deleteMany({ user: user._id });

    // Log the action
    logger.info(`Account disabled for user ${user._id}`, {
      userId: user._id,
      email: user.email,
      reason: user.accountDisabledReason,
    });

    res.status(200).json({
      status: "success",
      message:
        "Account disabled successfully. Your data will be retained for 30 days.",
    });
  } catch (error) {
    next(error);
  }
};
