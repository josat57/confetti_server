import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';
import { createError } from '../utils/error.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

class AdminService {
  // Authentication methods
  async login(email, password) {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      throw createError(404, 'Admin not found');
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      throw createError(401, 'Invalid credentials');
    }

    if (!admin.isActive) {
      throw createError(403, 'Account is deactivated');
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { token, admin: admin.getPublicProfile() };
  }

  // Admin management methods
  async createAdmin(adminData) {
    const existingAdmin = await Admin.findOne({ email: adminData.email });
    if (existingAdmin) {
      throw createError(400, 'Email already registered');
    }

    const admin = new Admin(adminData);
    await admin.save();
    return admin.getPublicProfile();
  }

  async updateAdmin(id, updateData) {
    const admin = await Admin.findById(id);
    if (!admin) {
      throw createError(404, 'Admin not found');
    }

    Object.assign(admin, updateData);
    await admin.save();
    return admin.getPublicProfile();
  }

  async deleteAdmin(id) {
    const admin = await Admin.findById(id);
    if (!admin) {
      throw createError(404, 'Admin not found');
    }

    await admin.remove();
    return { message: 'Admin deleted successfully' };
  }

  // Two-factor authentication methods
  async setupTwoFactor(id) {
    const admin = await Admin.findById(id);
    if (!admin) {
      throw createError(404, 'Admin not found');
    }

    const secret = speakeasy.generateSecret({
      name: `Confetti:${admin.email}`
    });

    admin.twoFactorSecret = secret.base32;
    await admin.save();

    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    return { secret: secret.base32, qrCode };
  }

  async verifyTwoFactor(id, token) {
    const admin = await Admin.findById(id);
    if (!admin) {
      throw createError(404, 'Admin not found');
    }

    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: 'base32',
      token
    });

    if (!verified) {
      throw createError(400, 'Invalid 2FA token');
    }

    admin.twoFactorEnabled = true;
    await admin.save();
    return { message: '2FA enabled successfully' };
  }

  // Permission management methods
  async updatePermissions(id, permissions) {
    const admin = await Admin.findById(id);
    if (!admin) {
      throw createError(404, 'Admin not found');
    }

    admin.permissions = permissions;
    await admin.save();
    return admin.getPublicProfile();
  }

  // User management methods
  async getUsers(query = {}, page = 1, limit = 10) {
    // Implementation for getting users with pagination
    // This would interact with the User model
  }

  async updateUserStatus(userId, status) {
    // Implementation for updating user status
  }

  // Content management methods
  async manageContent(contentData) {
    // Implementation for content management
  }

  // System configuration methods
  async updateSystemConfig(configData) {
    // Implementation for system configuration
  }

  // Moderation methods
  async moderateContent(contentId, action) {
    // Implementation for content moderation
  }

  // Support ticket methods
  async getSupportTickets(query = {}, page = 1, limit = 10) {
    // Implementation for getting support tickets
  }

  async updateTicketStatus(ticketId, status) {
    // Implementation for updating ticket status
  }

  // Audit log methods
  async getAuditLogs(query = {}, page = 1, limit = 10) {
    // Implementation for getting audit logs
  }

  // Analytics methods
  async getAnalytics(timeframe) {
    // Implementation for getting analytics
  }

  // Vendor management methods
  async getVendors(query = {}, page = 1, limit = 10) {
    // Implementation for getting vendors
  }

  async updateVendorStatus(vendorId, status) {
    // Implementation for updating vendor status
  }

  // Communication management methods
  async sendAnnouncement(announcementData) {
    // Implementation for sending announcements
  }

  // Security and compliance methods
  async getSecurityLogs(query = {}, page = 1, limit = 10) {
    // Implementation for getting security logs
  }

  // Financial oversight methods
  async getFinancialReports(timeframe) {
    // Implementation for getting financial reports
  }
}

export default new AdminService(); 