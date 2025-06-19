import Admin from '../models/Admin.js';
import { createError } from '../utils/error.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Create initial super admin
export const createAdmin = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, permissions } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return next(createError(400, 'Admin with this email already exists'));
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new admin
    const admin = new Admin({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      permissions
    });

    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1d' }
    );

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
        },
        token
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