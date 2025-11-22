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
// import authRoutes from './routes/auth.routes.js';
// import oauthService from './services/oauth.service.js';

// Load env vars
dotenv.config();

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
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

// Cookie parser middleware (before routes)
app.use(cookieParser());

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Session middleware
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "a3f622dfc19c94003f567781b4c79c3c41aec94581e6cc14673589e2fd1300a7",
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
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

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
      console.error("ERROR 💥", err);
      res.status(500).json({
        status: "error",
        message: "Something went wrong!",
      });
    }
  }
});

export default app;
