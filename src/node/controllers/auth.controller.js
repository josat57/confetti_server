import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { generateToken } from '../utils/auth.js';
import { handleError } from '../utils/error.js';
import crypto from 'crypto';
import { sendEmail } from '../utils/email.js';
import AppError from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      address
    });
    const token = user.generateEmailVerificationToken();
    await user.save();
    await sendEmail({
      email: user.email,
      subject: 'Email Verification',
      message: `Please verify your email by clicking the link: ${req.protocol}://${req.get('host')}/api/auth/verify-email/${token}`
    });
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

    // Generate token
    const token = generateToken(user);

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,  //process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    user.lastLogin = Date.now();
    await user.save();

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
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
    const { token } = req.params;
    const user = await User.findOne({
      emailVerificationToken: crypto.createHash('sha256').update(token).digest('hex'),
      emailVerificationExpires: { $gt: Date.now() }
    });
    if (!user) {
      return next(new AppError('Invalid or expired token', 400));
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully'
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
    await user.save();
    await sendEmail({
      email: user.email,
      subject: 'Email Verification',
      message: `Please verify your email by clicking the link: ${req.protocol}://${req.get('host')}/api/auth/verify-email/${token}`
    });
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
      return next(new AppError('User not found', 404));
    }
    const token = user.generatePasswordResetToken();
    await user.save();
    await sendEmail({
      email: user.email,
      subject: 'Password Reset',
      message: `Your password reset OTP is: ${token}`
    });
    res.status(200).json({
      status: 'success',
      message: 'Password reset OTP sent to your email'
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const user = await User.findOne({
      passwordResetToken: crypto.createHash('sha256').update(token).digest('hex'),
      passwordResetExpires: { $gt: Date.now() }
    });
    if (!user) {
      return next(new AppError('Invalid or expired token', 400));
    }
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
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
      return next(new AppError('User not found', 404));
    }
    const token = user.generatePasswordResetToken();
    await user.save();
    await sendEmail({
      email: user.email,
      subject: 'Password Reset OTP',
      message: `Your new password reset OTP is: ${token}`
    });
    res.status(200).json({
      status: 'success',
      message: 'New OTP sent to your email'
    });
  } catch (error) {
    next(error);
  }
}; 