import Admin from '../models/Admin.js';
import { createError } from '../utils/error.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import User from '../models/user.model.js';
import Content from '../models/content.model.js';
import SystemConfig from '../models/systemConfig.model.js';
import Event from '../models/event.model.js';
import Payment from '../models/payment.model.js';
import Vendor from '../models/vendor.model.js';
import Announcement from '../models/announcement.model.js';
import SecurityLog from '../models/SecurityLog.model.js';
import SupportTicket from '../models/supportTicket.model.js';
import AuditLog from '../models/auditLog.model.js';

// Helper function to set secure cookies
const setSecureCookies = (res, admin) => {
  const accessToken = jwt.sign(
    { id: admin._id, role: admin.role, type: 'admin' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: admin._id, type: 'admin_refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // Set access token cookie (short-lived)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/'
  });

  // Set refresh token cookie (long-lived)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/admin/refresh'
  });
};

// Helper function to clear cookies
const clearCookies = (res) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/v1/admin/refresh' });
};

// Create initial super admin
export const createAdmin = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, permissions } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return next(createError(400, 'Admin with this email already exists'));
    }

    // Create new admin (password will be hashed by the model's pre-save middleware)
    const admin = new Admin({
      email,
      password, // Pass the plain password - the model will hash it
      firstName,
      lastName,
      role,
      permissions
    });

    await admin.save();

    // Generate JWT token
    setSecureCookies(res, admin);

    res.status(201).json({
      status: 'success',
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get all admins
export const getAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().select('-password');
    res.status(200).json({
      status: 'success',
      data: { admins }
    });
  } catch (error) {
    next(error);
  }
};

// Get admin by ID
export const getAdminById = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id).select('-password');
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }
    res.status(200).json({
      status: 'success',
      data: { admin }
    });
  } catch (error) {
    next(error);
  }
};

// Update admin
export const updateAdmin = async (req, res, next) => {
  try {
    const { firstName, lastName, email, role, permissions } = req.body;
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }

    // Update fields
    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;
    if (email) admin.email = email;
    if (role) admin.role = role;
    if (permissions) admin.permissions = permissions;

    await admin.save();

    res.status(200).json({
      status: 'success',
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete admin
export const deleteAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

// Update admin status
export const updateAdminStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }

    admin.status = status;
    await admin.save();

    res.status(200).json({
      status: 'success',
      data: {
        admin: {
          id: admin._id,
          status: admin.status
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get admin permissions
export const getAdminPermissions = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }
    res.status(200).json({
      status: 'success',
      data: {
        permissions: admin.permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update admin permissions
export const updateAdminPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }

    admin.permissions = permissions;
    await admin.save();

    res.status(200).json({
      status: 'success',
      data: {
        admin: {
          id: admin._id,
          permissions: admin.permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update permissions (alias for updateAdminPermissions)
export const updatePermissions = async (req, res, next) => {
  return updateAdminPermissions(req, res, next);
};

// Admin login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if admin exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return next(createError(401, 'Invalid email or password'));
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    console.log("isPassword: ", isPasswordValid);
    console.log("email: ", email);
    console.log("password: ", password);
    console.log("stored password hash: ", admin.password);
    
    if (!isPasswordValid) {
      return next(createError(401, 'Invalid email or password'));
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Set secure cookies
    setSecureCookies(res, admin);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Admin logout
export const logout = async (req, res, next) => {
  try {
    // Clear cookies
    clearCookies(res);

    res.status(200).json({
      status: 'success',
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};

// Refresh admin token
export const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return next(createError(401, 'Refresh token not found'));
    }

    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    if (decoded.type !== 'refreshToken') {
      return next(createError(401, 'Invalid refresh token type'));
    }

    // Find admin
    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return next(createError(401, 'Admin not found or inactive'));
    }

    // Set new secure cookies
    setSecureCookies(res, admin);

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions
        }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(createError(401, 'Invalid refresh token'));
    }
    next(error);
  }
};

// Verify admin session
export const verifyAdmin = async (req, res, next) => {
  try {
    // This function is called after authenticateAdmin middleware
    // So req.admin should already be populated
    const admin = req.admin;
    
    if (!admin) {
      return next(createError(401, 'Admin not authenticated'));
    }

    res.status(200).json({
      status: 'success',
      message: 'Admin session is valid',
      data: {
        admin: {
          id: admin._id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
          permissions: admin.permissions,
          lastLogin: admin.lastLogin
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Setup two-factor authentication
export const setupTwoFactor = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }

    // Generate secret key for 2FA
    const secret = speakeasy.generateSecret({
      name: `Confetti:${admin.email}`
    });

    // Save secret to admin
    admin.twoFactorSecret = secret.base32;
    admin.twoFactorEnabled = false;
    await admin.save();

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      status: 'success',
      data: {
        secret: secret.base32,
        qrCode
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify two-factor authentication
export const verifyTwoFactor = async (req, res, next) => {
  try {
    const { token } = req.body;
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return next(createError(404, 'Admin not found'));
    }

    if (!admin.twoFactorSecret) {
      return next(createError(400, '2FA not set up'));
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token
    });

    if (!verified) {
      return next(createError(400, 'Invalid 2FA token'));
    }

    // Enable 2FA
    admin.twoFactorEnabled = true;
    await admin.save();

    res.status(200).json({
      status: 'success',
      message: '2FA verified and enabled'
    });
  } catch (error) {
    next(error);
  }
};

// User Management
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({
      status: 'success',
      data: { users }
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      return next(createError(404, 'User not found'));
    }

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

// Content Management
export const manageContent = async (req, res, next) => {
  try {
    const { action, contentId, content } = req.body;
    let result;

    switch (action) {
      case 'create':
        result = await Content.create(content);
        break;
      case 'update':
        result = await Content.findByIdAndUpdate(contentId, content, { new: true });
        break;
      case 'delete':
        result = await Content.findByIdAndDelete(contentId);
        break;
      default:
        return next(createError(400, 'Invalid action'));
    }

    res.status(200).json({
      status: 'success',
      data: { content: result }
    });
  } catch (error) {
    next(error);
  }
};

// System Configuration
export const updateSystemConfig = async (req, res, next) => {
  try {
    const { config } = req.body;
    const systemConfig = await SystemConfig.findOneAndUpdate(
      {},
      { $set: config },
      { new: true, upsert: true }
    );

    res.status(200).json({
      status: 'success',
      data: { config: systemConfig }
    });
  } catch (error) {
    next(error);
  }
};

// Moderation
export const moderateContent = async (req, res, next) => {
  try {
    const { action, reason } = req.body;
    const content = await Content.findById(req.params.contentId);

    if (!content) {
      return next(createError(404, 'Content not found'));
    }

    content.moderationStatus = action;
    content.moderationReason = reason;
    content.moderatedBy = req.admin._id;
    content.moderatedAt = new Date();

    await content.save();

    res.status(200).json({
      status: 'success',
      data: { content }
    });
  } catch (error) {
    next(error);
  }
};

// Support Tickets
export const getSupportTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('user', 'email firstName lastName')
      .sort('-createdAt');

    res.status(200).json({
      status: 'success',
      data: { tickets }
    });
  } catch (error) {
    next(error);
  }
};

export const updateTicketStatus = async (req, res, next) => {
  try {
    const { status, response } = req.body;
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      {
        status,
        adminResponse: response,
        respondedBy: req.admin._id,
        respondedAt: new Date()
      },
      { new: true }
    );

    if (!ticket) {
      return next(createError(404, 'Ticket not found'));
    }

    res.status(200).json({
      status: 'success',
      data: { ticket }
    });
  } catch (error) {
    next(error);
  }
};

// Audit Logs
export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate('admin', 'email firstName lastName')
      .sort('-timestamp');

    res.status(200).json({
      status: 'success',
      data: { logs }
    });
  } catch (error) {
    next(error);
  }
};

// Analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const analytics = {
      users: await User.countDocuments(),
      activeUsers: await User.countDocuments({ status: 'active' }),
      totalEvents: await Event.countDocuments(),
      upcomingEvents: await Event.countDocuments({ startDate: { $gt: new Date() } }),
      totalRevenue: await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    };

    res.status(200).json({
      status: 'success',
      data: { analytics }
    });
  } catch (error) {
    next(error);
  }
};

// Vendor Management
export const getVendors = async (req, res, next) => {
  try {
    const vendors = await Vendor.find().sort('-createdAt');
    res.status(200).json({
      status: 'success',
      data: { vendors }
    });
  } catch (error) {
    next(error);
  }
};

export const updateVendorStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.vendorId,
      { status },
      { new: true }
    );

    if (!vendor) {
      return next(createError(404, 'Vendor not found'));
    }

    res.status(200).json({
      status: 'success',
      data: { vendor }
    });
  } catch (error) {
    next(error);
  }
};

// Communication Management
export const sendAnnouncement = async (req, res, next) => {
  try {
    const { title, message, targetAudience } = req.body;
    const announcement = await Announcement.create({
      title,
      message,
      targetAudience,
      createdBy: req.admin._id
    });

    // TODO: Implement notification system to send to target audience

    res.status(201).json({
      status: 'success',
      data: { announcement }
    });
  } catch (error) {
    next(error);
  }
};

// Security and Compliance
export const getSecurityLogs = async (req, res, next) => {
  try {
    const logs = await SecurityLog.find()
      .sort('-timestamp')
      .limit(100);

    res.status(200).json({
      status: 'success',
      data: { logs }
    });
  } catch (error) {
    next(error);
  }
};

// Financial Oversight
export const getFinancialReports = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { status: 'completed' };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const reports = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalRevenue: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: { reports }
    });
  } catch (error) {
    next(error);
  }
}; 