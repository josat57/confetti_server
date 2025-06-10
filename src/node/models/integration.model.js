const mongoose = require('mongoose');
const crypto = require('crypto');

const integrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Integration name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Integration type is required'],
    enum: ['payment', 'notification', 'analytics', 'storage', 'communication', 'other']
  },
  provider: {
    type: String,
    required: [true, 'Provider name is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error', 'pending'],
    default: 'pending'
  },
  credentials: {
    apiKey: {
      type: String,
      select: false // Hide by default
    },
    secretKey: {
      type: String,
      select: false // Hide by default
    },
    accessToken: {
      type: String,
      select: false // Hide by default
    },
    refreshToken: {
      type: String,
      select: false // Hide by default
    },
    webhookSecret: {
      type: String,
      select: false // Hide by default
    },
    additionalKeys: {
      type: Map,
      of: String,
      select: false // Hide by default
    }
  },
  config: {
    endpoints: {
      type: Map,
      of: String
    },
    webhooks: [{
      url: String,
      events: [String],
      status: {
        type: String,
        enum: ['active', 'inactive', 'error'],
        default: 'active'
      }
    }],
    settings: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  },
  metadata: {
    version: String,
    lastSync: Date,
    rateLimit: {
      requests: Number,
      period: Number
    },
    features: [String]
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permissions: {
    public: {
      type: Boolean,
      default: false
    },
    allowedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    allowedRoles: [String]
  },
  logs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    level: {
      type: String,
      enum: ['info', 'warning', 'error', 'debug'],
      default: 'info'
    },
    message: String,
    details: mongoose.Schema.Types.Mixed
  }],
  health: {
    lastCheck: Date,
    status: {
      type: String,
      enum: ['healthy', 'degraded', 'unhealthy'],
      default: 'healthy'
    },
    metrics: {
      responseTime: Number,
      errorRate: Number,
      uptime: Number
    }
  }
}, {
  timestamps: true
});

// Indexes
integrationSchema.index({ owner: 1, type: 1 });
integrationSchema.index({ provider: 1, status: 1 });
integrationSchema.index({ 'config.webhooks.url': 1 });

// Virtuals
integrationSchema.virtual('isHealthy').get(function() {
  return this.health.status === 'healthy';
});

integrationSchema.virtual('hasValidCredentials').get(function() {
  return !!(this.credentials.apiKey || this.credentials.accessToken);
});

// Methods
integrationSchema.methods.encryptCredentials = async function() {
  if (this.isModified('credentials')) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const encrypt = (text) => {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'hex'), iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      return {
        iv: iv.toString('hex'),
        encrypted,
        authTag: authTag.toString('hex')
      };
    };

    if (this.credentials.apiKey) {
      const encrypted = encrypt(this.credentials.apiKey);
      this.credentials.apiKey = JSON.stringify(encrypted);
    }
    if (this.credentials.secretKey) {
      const encrypted = encrypt(this.credentials.secretKey);
      this.credentials.secretKey = JSON.stringify(encrypted);
    }
    if (this.credentials.accessToken) {
      const encrypted = encrypt(this.credentials.accessToken);
      this.credentials.accessToken = JSON.stringify(encrypted);
    }
    if (this.credentials.refreshToken) {
      const encrypted = encrypt(this.credentials.refreshToken);
      this.credentials.refreshToken = JSON.stringify(encrypted);
    }
  }
};

integrationSchema.methods.decryptCredentials = function() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('Encryption key not configured');
  }

  const decrypt = (encryptedData) => {
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(encryptionKey, 'hex'),
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  };

  const decrypted = { ...this.credentials };
  if (decrypted.apiKey) decrypted.apiKey = decrypt(decrypted.apiKey);
  if (decrypted.secretKey) decrypted.secretKey = decrypt(decrypted.secretKey);
  if (decrypted.accessToken) decrypted.accessToken = decrypt(decrypted.accessToken);
  if (decrypted.refreshToken) decrypted.refreshToken = decrypt(decrypted.refreshToken);

  return decrypted;
};

integrationSchema.methods.addLog = function(level, message, details = {}) {
  this.logs.push({ level, message, details });
  if (this.logs.length > 100) {
    this.logs = this.logs.slice(-100); // Keep only last 100 logs
  }
};

integrationSchema.methods.updateHealth = function(metrics) {
  this.health = {
    lastCheck: new Date(),
    status: this.calculateHealthStatus(metrics),
    metrics
  };
};

integrationSchema.methods.calculateHealthStatus = function(metrics) {
  if (metrics.errorRate > 0.1 || metrics.responseTime > 1000) {
    return 'unhealthy';
  } else if (metrics.errorRate > 0.05 || metrics.responseTime > 500) {
    return 'degraded';
  }
  return 'healthy';
};

// Pre-save middleware
integrationSchema.pre('save', async function(next) {
  try {
    await this.encryptCredentials();
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-find middleware
integrationSchema.pre('find', function() {
  this.select('+credentials');
});

integrationSchema.pre('findOne', function() {
  this.select('+credentials');
});

const Integration = mongoose.model('Integration', integrationSchema);

module.exports = Integration; 