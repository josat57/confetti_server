import User from '../models/user.model.js';
import AppError from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';

// Get current user profile
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return next(new AppError('User not found', 404));
    res.status(200).json({ status: 'success', user });
  } catch (error) {
    next(error);
  }
};

// Update user profile
export const updateProfile = async (req, res, next) => {
  try {
    const updates = (({ firstName, lastName, phone, address, preferences }) => ({ firstName, lastName, phone, address, preferences }))(req.body);
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select('-password');
    if (!user) return next(new AppError('User not found', 404));
    res.status(200).json({ status: 'success', user });
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return next(new AppError('User not found', 404));
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return next(new AppError('Current password is incorrect', 400));
    user.password = newPassword;
    await user.save();
    res.status(200).json({ status: 'success', message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// Deactivate/Delete account
export const deactivateAccount = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { isActive: false }, { new: true });
    if (!user) return next(new AppError('User not found', 404));
    res.status(200).json({ status: 'success', message: 'Account deactivated' });
  } catch (error) {
    next(error);
  }
};

// Update user preferences
export const updatePreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { preferences }, { new: true, runValidators: true }).select('-password');
    if (!user) return next(new AppError('User not found', 404));
    res.status(200).json({ status: 'success', user });
  } catch (error) {
    next(error);
  }
};

// ADMIN: List all users
export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({ status: 'success', users });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Get user by ID
export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return next(new AppError('User not found', 404));
    res.status(200).json({ status: 'success', user });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Activate/Deactivate user
export const setUserActiveStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!user) return next(new AppError('User not found', 404));
    res.status(200).json({ status: 'success', user });
  } catch (error) {
    next(error);
  }
};

// ADMIN: Lock/Unlock user account
export const setUserLockStatus = async (req, res, next) => {
  try {
    const { lock } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    if (lock) {
      user.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    } else {
      user.lockUntil = undefined;
      user.loginAttempts = 0;
    }
    await user.save();
    res.status(200).json({ status: 'success', user });
  } catch (error) {
    next(error);
  }
}; 