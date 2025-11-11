import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory name using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, "../.env") });

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 9000,
    env: process.env.NODE_ENV || "development",
    apiVersion: process.env.API_VERSION || "v1",
    baseUrl: process.env.BASE_URL || "http://localhost:9000",
  },

  // Database configuration
  database: {
    uri: process.env.MONGODB_URI || "mongodb://localhost:27017/tripmatch",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "1h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  // Email configuration
  email: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    from: process.env.SMTP_FROM || "hello@tripmatch.io",
  },

  // File upload configuration
  upload: {
    maxSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024, // 5MB
    allowedTypes: ["image/jpeg", "image/png", "image/gif"],
    uploadDir: process.env.UPLOAD_DIR || "uploads",
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },

  // Cors configuration
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },

  // Logger configuration
  logger: {
    level: process.env.LOG_LEVEL || "info",
    filename: process.env.LOG_FILE || "app.log",
  },
};

// Validate required environment variables
const requiredEnvVars = ["JWT_SECRET", "MONGODB_URI"];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.warn(`Warning: ${envVar} environment variable is not set`);
  }
});

export default config;
