import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  siteName: {
    type: String,
    required: true,
    default: 'Confetti'
  },
  siteDescription: String,
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  maintenanceMessage: String,
  emailSettings: {
    smtpHost: String,
    smtpPort: Number,
    smtpUser: String,
    smtpPass: String,
    fromEmail: String,
    fromName: String
  },
  socialMedia: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String
  },
  paymentSettings: {
    currency: {
      type: String,
      default: 'USD'
    },
    stripePublicKey: String,
    stripeSecretKey: String,
    paypalClientId: String,
    paypalSecret: String
  },
  securitySettings: {
    passwordMinLength: {
      type: Number,
      default: 8
    },
    requireStrongPassword: {
      type: Boolean,
      default: true
    },
    sessionTimeout: {
      type: Number,
      default: 24 // hours
    },
    maxLoginAttempts: {
      type: Number,
      default: 5
    },
    lockoutDuration: {
      type: Number,
      default: 30 // minutes
    }
  },
  notificationSettings: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    }
  },
  themeSettings: {
    primaryColor: {
      type: String,
      default: '#007bff'
    },
    secondaryColor: {
      type: String,
      default: '#6c757d'
    },
    logo: String,
    favicon: String
  }
}, {
  timestamps: true
});

// Ensure only one system config document exists
systemConfigSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    if (count > 0) {
      throw new Error('Only one system configuration document can exist');
    }
  }
  next();
});

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

export default SystemConfig; 