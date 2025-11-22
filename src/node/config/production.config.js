import dotenv from "dotenv";

dotenv.config();

/**
 * Production Configuration
 * Environment-specific settings for production deployment
 */

export const productionConfig = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || "0.0.0.0",
    nodeEnv: process.env.NODE_ENV || "production",
    apiVersion: process.env.API_VERSION || "v1",
  },

  // Database Configuration
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI,
      options: {
        maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE) || 10,
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
      },
    },
    redis: {
      url: process.env.REDIS_URL,
      options: {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      },
    },
  },

  // Security Configuration
  security: {
    jwt: {
      secret: process.env.JWT_SECRET,
      accessTokenExpiry: process.env.JWT_EXPIRES_IN || "15m",
      refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    },
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || ["https://yourdomain.com"],
      credentials: true,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    },
  },

  // Email Configuration
  email: {
    service: process.env.EMAIL_SERVICE || "gmail",
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    from: process.env.EMAIL_FROM || "noreply@yourdomain.com",
  },

  // Payment Configuration
  payment: {
    flutterwave: {
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY,
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
      encryptionKey: process.env.FLUTTERWAVE_ENCRYPTION_KEY,
      webhookSecret: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
    },
    paystack: {
      publicKey: process.env.PAYSTACK_PUBLIC_KEY,
      secretKey: process.env.PAYSTACK_SECRET_KEY,
    },
  },

  // Storage Configuration
  storage: {
    type: process.env.STORAGE_TYPE || "local", // 'local', 's3', 'cloudinary'
    local: {
      uploadDir: process.env.UPLOAD_DIR || "./uploads",
    },
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
  },

  // Monitoring Configuration
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate:
        parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    },
    newRelic: {
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
      appName: process.env.NEW_RELIC_APP_NAME || "Event Planner API",
    },
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    format: process.env.LOG_FORMAT || "json",
    destination: process.env.LOG_DESTINATION || "file",
    file: {
      path: process.env.LOG_FILE_PATH || "./logs",
      maxSize: process.env.LOG_MAX_SIZE || "20m",
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14,
    },
  },

  // Cache Configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600, // 10 minutes
  },

  // Feature Flags
  features: {
    aiPlanner: process.env.FEATURE_AI_PLANNER === "true",
    webhooks: process.env.FEATURE_WEBHOOKS === "true",
    analytics: process.env.FEATURE_ANALYTICS === "true",
    mobileApp: process.env.FEATURE_MOBILE_APP === "true",
  },

  // External Services
  external: {
    googleMaps: {
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    },
    googleCalendar: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    },
    outlook: {
      clientId: process.env.OUTLOOK_CLIENT_ID,
      clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
      redirectUri: process.env.OUTLOOK_REDIRECT_URI,
    },
  },

  // Backup Configuration
  backup: {
    enabled: process.env.BACKUP_ENABLED === "true",
    schedule: process.env.BACKUP_SCHEDULE || "0 2 * * *", // 2 AM daily
    retention: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    destination: process.env.BACKUP_DESTINATION || "s3",
  },
};

// Validate required environment variables
export function validateProductionConfig() {
  const required = [
    "MONGODB_URI",
    "JWT_SECRET",
    "REDIS_URL",
    "EMAIL_USER",
    "EMAIL_PASSWORD",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  return true;
}

export default productionConfig;
