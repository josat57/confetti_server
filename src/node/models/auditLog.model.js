import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'user_created',
      'user_updated',
      'user_deleted',
      'user_status_changed',
      'content_created',
      'content_updated',
      'content_deleted',
      'content_moderated',
      'system_config_updated',
      'admin_created',
      'admin_updated',
      'admin_deleted',
      'admin_permissions_updated',
      'vendor_approved',
      'vendor_rejected',
      'payment_processed',
      'ticket_responded',
      'announcement_sent',
      'security_event',
      'financial_report_generated'
    ]
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['user', 'content', 'admin', 'vendor', 'payment', 'ticket', 'announcement', 'system', 'security', 'financial']
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
auditLogSchema.index({ admin: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 });

// Static method to create audit log
auditLogSchema.statics.createLog = async function(data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to prevent breaking main functionality
    return null;
  }
};

// Method to get logs with pagination
auditLogSchema.statics.getLogs = async function(query = {}, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  
  const logs = await this.find(query)
    .populate('admin', 'email firstName lastName')
    .sort('-timestamp')
    .skip(skip)
    .limit(limit);
    
  const total = await this.countDocuments(query);
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog; 