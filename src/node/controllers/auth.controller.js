import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import { generateTokenPair, verifyRefreshToken, generateAccessToken } from '../utils/auth.js';
import { handleError } from '../utils/error.js';
import crypto from 'crypto';
import { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { Console } from 'console';

export const register = async (req, res, next) => {
  try {
    const { email, password, userName, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      userName,
      phone,
    });

    // Generate verification token and OTP
    const token = user.generateEmailVerificationToken();
    const otp = user.generateOTP();
    await user.save();

    // Send welcome and verification emails
    await sendWelcomeEmail(user);
    await sendVerificationEmail(user, otp, token);

    res.status(200).json({
      status: 'success',
      message: 'User registered successfully. Please verify your email.'
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    if (user.isLocked()) {
      return next(new AppError('Account is locked. Please try again later.', 401));
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Generate token pair
    const tokens = generateTokenPair(user);

    // Store refresh token
    const refreshToken = await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    user.lastLogin = Date.now();
    await user.save();

    res.json({
      status: 'success',
      message: 'Logged in successfully',
      user: {
        id: user._id,
        email: user.email,
        userName: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        role: user.role
      }
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

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.json({ 
      status: 'success',
      message: 'Logged out successfully' 
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profilePicture: user.profilePicture,
        oauthProvider: user.oauthProvider
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token, otp } = req.params;
    
    // Find user with valid verification token
    const user = await User.findOne({
      emailVerificationToken: crypto.createHash('sha256').update(token).digest('hex'),
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Invalid or expired verification token', 400));
    }

    // Verify OTP
    const isOTPValid = await user.verifyOTP(otp);
    if (!isOTPValid) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    if (user.isEmailVerified) {
      return next(new AppError('Email is already verified', 400));
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate new token pair
    const tokens = generateTokenPair(user);

    // Store refresh token
    const refreshToken = await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        isEmailVerified: true
      }
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
      return next(new AppError('User not found', 404));
    }
    if (user.isEmailVerified) {
      return next(new AppError('Email already verified', 400));
    }

    const token = user.generateEmailVerificationToken();
    const otp = user.generateOTP();
    await user.save();

    await sendVerificationEmail(user, otp, token);

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent'
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
      return next(new AppError('No user found with that email address', 404));
    }

    // Generate OTP and reset token
    const otp = user.generateOTP();
    const token = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    await sendPasswordResetEmail(user, otp, token);

    res.status(200).json({
      status: 'success',
      message: 'Password reset OTP sent to your email'
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
      return next(new AppError('No user found with that email address', 404));
    }

    const isValid = user.verifyOTP(otp);
    await user.save(); // Save to update the attempts counter

    if (!isValid) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    // Generate a temporary token for password reset
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully',
      resetToken
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
      passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'),
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Invalid or expired reset token', 400));
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
      userAgent: req.headers['user-agent']
    });

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful'
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
      return next(new AppError('No user found with that email address', 404));
    }

    // Check if previous OTP exists and hasn't expired
    if (user.otp && user.otp.expires > Date.now()) {
      const timeLeft = Math.ceil((user.otp.expires - Date.now()) / 1000 / 60);
      return next(new AppError(`Please wait ${timeLeft} minutes before requesting a new OTP`, 400));
    }

    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();

    // Send new OTP via email
    console.log('Transporter created: ', process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_SECURE, process.env.SMTP_USER, process.env.SMTP_PASS);

    await sendEmail({
      email: user.email,
      subject: 'New Password Reset OTP',
      message: `Your new password reset OTP is: ${otp}. This OTP will expire in 15 minutes.`
    });

    res.status(200).json({
      status: 'success',
      message: 'New OTP sent to your email'
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
      return next(new AppError('Refresh token is required', 400));
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check if user's token version matches
    if (user.tokenVersion !== decoded.tokenVersion) {
      return next(new AppError('Token has been revoked', 401));
    }

    // Generate new token pair
    const tokens = generateTokenPair(user);

    // Store refresh token
    const newRefreshToken = await RefreshToken.create({
      token: tokens.refreshToken,
      user: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      status: 'success',
      message: 'Tokens refreshed successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

export const revokeRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Find and revoke the token
    const token = await RefreshToken.findOne({ token: refreshToken });
    if (!token) {
      return next(new AppError('Token not found', 404));
    }

    await token.revoke();

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
      status: 'success',
      message: 'Token revoked successfully'
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
        status: 'fail',
        message: 'Not authenticated'
      });
    }

    // Get user from session
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'Account is deactivated'
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
      oauthProvider: user.oauthProvider
    }

    req.user = userData;

    // Return user information
    res.json({
      status: 'success',
      userData
    });
  } catch (error) {
    next(error);
  }
};