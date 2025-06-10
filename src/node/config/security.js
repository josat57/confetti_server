const crypto = require('crypto');

module.exports = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
    expiresIn: '1d',
    refreshExpiresIn: '7d',
    algorithm: 'HS512'
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  },

  // Device Security Configuration
  device: {
    maxFailedAttempts: 5,
    lockoutDuration: 60 * 60 * 1000, // 1 hour
    minSecurityScore: 30,
    sessionExpiry: 24 * 60 * 60 * 1000, // 24 hours
    maxDevicesPerUser: 5,
    locationUpdateInterval: 5 * 60 * 1000, // 5 minutes
    maxLocationHistory: 1000
  },

  // Password Configuration
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    historySize: 5
  },

  // API Security Configuration
  api: {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Device-Token'],
      exposedHeaders: ['X-Rate-Limit-Remaining'],
      credentials: true,
      maxAge: 86400 // 24 hours
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      xssFilter: true,
      noSniff: true,
      referrerPolicy: { policy: 'same-origin' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }
  },

  // Encryption Configuration
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 64,
    iterations: 100000
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    sensitiveFields: ['password', 'token', 'secret', 'key'],
    maxSize: '20m',
    maxFiles: '14d'
  },

  // Monitoring Configuration
  monitoring: {
    enabled: true,
    interval: 60000, // 1 minute
    metrics: {
      cpu: true,
      memory: true,
      disk: true,
      network: true,
      security: true
    },
    alerts: {
      cpuThreshold: 80,
      memoryThreshold: 80,
      diskThreshold: 80,
      errorRateThreshold: 1
    }
  },

  // Backup Configuration
  backup: {
    enabled: true,
    schedule: '0 0 * * *', // Daily at midnight
    retention: 30, // 30 days
    compression: true,
    encryption: true
  }
}; 