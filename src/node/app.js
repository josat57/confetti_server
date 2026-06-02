import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./routes/index.js";
import cookieParser from "cookie-parser";
import logger from "./services/logging/advanced.service.js";
import helmet from "helmet";
import morgan from "morgan";
import passport from "passport";
import session from "express-session";
import MongoStore from "connect-mongo";
import { AppError } from "./utils/error.js";
import adminRoutes from "./routes/admin.routes.js";
import { checkEmailConfig } from "./utils/validateEmailConfig.js";
import { setupSwagger } from "./config/swagger.config.js";
import { generalLimiter, authLimiter, sanitizeData } from "./middleware/security.js";
// import authRoutes from './routes/auth.routes.js';
// import oauthService from './services/oauth.service.js';

// Load env vars
dotenv.config();

// Validate required environment variables at startup
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is required — set it in your .env file"
  );
}

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security — NoSQL injection prevention and rate limiting
app.use(sanitizeData);
app.use("/api/v1", generalLimiter);
app.use("/api/v1/auth", authLimiter);

// Configure CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8080",
      "http://localhost:8000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      process.env.PUBLIC_NGROK_URL,
    ].filter(Boolean); // Remove any undefined values

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else if (process.env.NODE_ENV === "production") {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    } else {
      logger.warn(`CORS: allowing unlisted origin in development: ${origin}`);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-Guest-Session", // Add guest session header
    "Access-Control-Allow-Origin",
    "Access-Control-Allow-Headers",
    "Access-Control-Allow-Methods",
    "Access-Control-Allow-Credentials",
    "Access-Control-Expose-Headers",
    "Access-Control-Max-Age",
    "Access-Control-Request-Headers",
    "Access-Control-Request-Method",
  ],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  exposedHeaders: ["set-cookie"],
};

app.use(cors(corsOptions));

// Handle preflight requests for AI planner
app.options("/api/v1/ai-planner/*", cors(corsOptions));

// Cookie parser middleware (before routes)
app.use(cookieParser());

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Session middleware
app.use(
  session({
    secret: sessionSecret,
    resave: true,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl:
        process.env.MONGODB_URI ||
        "mongodb://localhost:27017/confetti?authSource=admin",
      dbName: "confetti",
      ttl: 24 * 60 * 60, // 1 day
      autoRemove: "native",
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging
app.use((req, res, next) => {
  logger.info(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  const emailConfigStatus = checkEmailConfig();

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      email: {
        status: emailConfigStatus.isValid ? "healthy" : "unhealthy",
        errors: emailConfigStatus.errors,
        warnings: emailConfigStatus.warnings,
      },
    },
  });
});

// API Routes
app.use("/api/v1", routes);
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/search', searchRoutes);

// Setup Swagger API documentation
setupSwagger(app);

// 404 handler
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use((err, req, res, next) => {
  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    err.statusCode = 400;
    err.status = "fail";
    err.message = errors.join(". ");
    err.isOperational = true;
  }

  // Handle Mongoose cast errors
  if (err.name === "CastError") {
    err.statusCode = 400;
    err.status = "fail";
    err.message = `Invalid ${err.path}: ${err.value}`;
    err.isOperational = true;
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    err.statusCode = 409;
    err.status = "fail";
    err.message = `${field} already exists`;
    err.isOperational = true;
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error for debugging
  logger.error(`${err.statusCode} - ${err.message}`, { stack: err.stack });

  if (process.env.NODE_ENV === "development") {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      logger.error("Unhandled error", err);
      res.status(500).json({
        status: "error",
        message: "Something went wrong!",
      });
    }
  }
});

export default app;
