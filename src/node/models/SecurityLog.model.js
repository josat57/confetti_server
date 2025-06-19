import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'failed_login',
      'password_change',
      'password_reset',
      'permission_change',
      'role_change',
      'account_lock',
      'account_unlock',
      'suspicious_activity',
      'api_access',
      'file_access',
      'data_export',
      'data_import'
    ]
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  ipAddress: String,
  userAgent: String,
  location: {
    country: String,
    city: String,
    coordinates: {
      type: [Number]
    }
  },
  details: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  }
}, {
  timestamps: true
});

// Indexes
securityLogSchema.index({ event: 1, createdAt: -1 });
securityLogSchema.index({ user: 1, createdAt: -1 });
securityLogSchema.index({ admin: 1, createdAt: -1 });
securityLogSchema.index({ status: 1, severity: 1 });

const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);

export default SecurityLog; 