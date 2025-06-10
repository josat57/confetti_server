const mongoose = require('mongoose');
const crypto = require('crypto');
const AppError = require('../utils/appError');

const mobileDeviceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['ios', 'android'],
    required: true
  },
  osVersion: {
    type: String,
    required: true
  },
  appVersion: {
    type: String,
    required: true
  },
  pushToken: {
    type: String,
    sparse: true
  },
  pushType: {
    type: String,
    enum: ['fcm', 'apns'],
    sparse: true
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    location: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  metadata: {
    batteryLevel: Number,
    isCharging: Boolean,
    networkType: String,
    appState: {
      type: String,
      enum: ['foreground', 'background', 'terminated']
    },
    memoryUsage: Number
  },
  security: {
    fingerprint: {
      type: String,
      required: true
    },
    isJailbroken: {
      type: Boolean,
      default: false
    },
    isEmulator: {
      type: Boolean,
      default: false
    },
    isDebuggerAttached: {
      type: Boolean,
      default: false
    },
    lastSecurityCheck: {
      type: Date,
      default: Date.now
    },
    securityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100
    },
    blockedReasons: [{
      reason: String,
      timestamp: Date
    }]
  },
  sessions: [{
    token: {
      type: String,
      required: true
    },
    ip: String,
    userAgent: String,
    lastActive: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isValid: {
      type: Boolean,
      default: true
    }
  }],
  failedAttempts: {
    count: {
      type: Number,
      default: 0
    },
    lastAttempt: Date,
    lockUntil: Date
  }
}, {
  timestamps: true
});

// Indexes
mobileDeviceSchema.index({ location: '2dsphere' });
mobileDeviceSchema.index({ 'sessions.token': 1 });
mobileDeviceSchema.index({ 'security.fingerprint': 1 });

// Generate device fingerprint
mobileDeviceSchema.methods.generateFingerprint = function() {
  const data = `${this.deviceId}-${this.model}-${this.platform}-${this.osVersion}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Check if device is blocked
mobileDeviceSchema.methods.isBlocked = function() {
  return this.status === 'blocked' || 
         (this.failedAttempts.lockUntil && this.failedAttempts.lockUntil > Date.now());
};

// Increment failed attempts
mobileDeviceSchema.methods.incrementFailedAttempts = function() {
  this.failedAttempts.count += 1;
  this.failedAttempts.lastAttempt = Date.now();
  
  // Lock device after 5 failed attempts for 1 hour
  if (this.failedAttempts.count >= 5) {
    this.failedAttempts.lockUntil = new Date(Date.now() + 60 * 60 * 1000);
    this.status = 'blocked';
    this.security.blockedReasons.push({
      reason: 'Too many failed attempts',
      timestamp: new Date()
    });
  }
};

// Reset failed attempts
mobileDeviceSchema.methods.resetFailedAttempts = function() {
  this.failedAttempts.count = 0;
  this.failedAttempts.lastAttempt = null;
  this.failedAttempts.lockUntil = null;
};

// Update security score
mobileDeviceSchema.methods.updateSecurityScore = function() {
  let score = 100;
  
  // Reduce score for security issues
  if (this.security.isJailbroken) score -= 30;
  if (this.security.isEmulator) score -= 20;
  if (this.security.isDebuggerAttached) score -= 25;
  if (this.failedAttempts.count > 0) score -= (this.failedAttempts.count * 5);
  
  // Ensure score is within bounds
  this.security.securityScore = Math.max(0, Math.min(100, score));
  this.security.lastSecurityCheck = new Date();
  
  // Block device if security score is too low
  if (this.security.securityScore < 30) {
    this.status = 'blocked';
    this.security.blockedReasons.push({
      reason: 'Low security score',
      timestamp: new Date()
    });
  }
};

// Validate session token
mobileDeviceSchema.methods.validateSession = function(token) {
  const session = this.sessions.find(s => s.token === token);
  if (!session || !session.isValid || session.expiresAt < Date.now()) {
    return false;
  }
  session.lastActive = new Date();
  return true;
};

// Invalidate all sessions
mobileDeviceSchema.methods.invalidateAllSessions = function() {
  this.sessions.forEach(session => {
    session.isValid = false;
  });
};

// Pre-save middleware
mobileDeviceSchema.pre('save', function(next) {
  if (this.isNew) {
    this.security.fingerprint = this.generateFingerprint();
  }
  this.lastActive = new Date();
  next();
});

// Static method to find device by token
mobileDeviceSchema.statics.findByToken = async function(token) {
  return this.findOne({ 'sessions.token': token, 'sessions.isValid': true });
};

// Static method to find active devices for user
mobileDeviceSchema.statics.findActiveDevices = async function(userId) {
  return this.find({
    user: userId,
    status: 'active',
    'security.securityScore': { $gte: 30 }
  });
};

const MobileDevice = mongoose.model('MobileDevice', mobileDeviceSchema);

module.exports = MobileDevice; 