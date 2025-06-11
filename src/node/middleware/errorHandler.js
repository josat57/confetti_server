import logger from '../services/logging/advanced.service.js';
// import config from '../config/env.config2.js';

// Custom error class
export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Format Mongoose Validation Errors
const formatValidationErrors = (err) => {
  const errors = {};
  
  Object.keys(err.errors).forEach(key => {
    errors[key] = err.errors[key].message;
  });

  return {
    status: 'fail',
    statusCode: 400,
    message: 'Validation Error',
    errors
  };
};

const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(400, message);
};

const handleDuplicateFieldsDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(400, message);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(400, message);
};

const handleJWTError = () =>
  new AppError(401, 'Invalid token. Please log in again!');

const handleJWTExpiredError = () =>
  new AppError(401, 'Your token has expired! Please log in again.');

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    logger.error('ERROR 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!'
    });
  }
};

// Global error handling middleware
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error for debugging
  logger.error('Error:', {
    error: err,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });

  // Development Error Response
  if (process.env.NODE_ENV === 'development') {
    if (err.name === 'ValidationError') {
      const formattedError = formatValidationErrors(err);
      return res.status(400).json(formattedError);
    }

    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: err,
      stack: err.stack
    });
  }

  // Production Error Response
  if (err.isOperational) {
    // Known operational errors
    if (err.name === 'ValidationError') {
      const formattedError = formatValidationErrors(err);
      return res.status(400).json(formattedError);
    }

    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }

  // Programming or unknown errors
  logger.error('Unexpected Error:', err);
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong'
  });
};

// Handle unhandled promise rejections
export const handleUnhandledRejection = (server) => {
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });
};

// Handle uncaught exceptions
export const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
  });
};

// Catch Async Errors
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not Found Handler
export const notFound = (req, res, next) => {
  next(new AppError(404, `Route ${req.originalUrl} not found`));
};

// Validation Error Handler
export const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(error => error.message);
  return new AppError(400, `Invalid input: ${errors.join('. ')}`);
};

// Cast Error Handler (Invalid MongoDB ID)
export const handleCastError = (err) => {
  return new AppError(400, `Invalid ${err.path}: ${err.value}`);
};

// Duplicate Key Error Handler
export const handleDuplicateKeyError = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  return new AppError(400, `Duplicate field value: ${value}. Please use another value`);
};

export default {
  AppError,
  errorHandler,
  handleUnhandledRejection,
  handleUncaughtException,
  catchAsync,
  notFound,
  handleValidationError,
  handleCastError,
  handleDuplicateKeyError
}; 