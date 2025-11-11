import { AppError } from "./AppError.js";

/**
 * Error thrown when budget is insufficient for event requirements
 */
export class InsufficientBudgetError extends AppError {
  constructor(minimumBudget, suggestedBudget, alternatives = []) {
    super("The budget is too low for this event type", 400);
    this.name = "InsufficientBudgetError";
    this.code = "INSUFFICIENT_BUDGET";
    this.minimumBudget = minimumBudget;
    this.suggestedBudget = suggestedBudget;
    this.alternatives = alternatives;
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      data: {
        minimumBudget: this.minimumBudget,
        suggestedBudget: this.suggestedBudget,
        alternatives: this.alternatives,
      },
    };
  }
}

/**
 * Error thrown when location is not supported or has limited vendor data
 */
export class LocationNotSupportedError extends AppError {
  constructor(
    location,
    nearestCities = [],
    message = "Limited vendor data available for this location"
  ) {
    super(message, 400);
    this.name = "LocationNotSupportedError";
    this.code = "LOCATION_NOT_SUPPORTED";
    this.location = location;
    this.nearestCities = nearestCities;
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      data: {
        location: this.location,
        nearestSupportedCities: this.nearestCities,
        notifyWhenAvailable: true,
      },
    };
  }
}

/**
 * Error thrown when AI processing times out
 */
export class ProcessingTimeoutError extends AppError {
  constructor(message = "Event plan processing timed out. Please try again.") {
    super(message, 408);
    this.name = "ProcessingTimeoutError";
    this.code = "PROCESSING_TIMEOUT";
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      data: {
        retryable: true,
        suggestion: "Please try again in a few moments",
      },
    };
  }
}

/**
 * Error thrown for validation failures
 */
export class ValidationError extends AppError {
  constructor(field, message, details = {}) {
    super(`Validation failed for ${field}: ${message}`, 400);
    this.name = "ValidationError";
    this.code = "VALIDATION_ERROR";
    this.field = field;
    this.details = details;
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      field: this.field,
      details: this.details,
    };
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(retryAfter = 3600) {
    super("Rate limit exceeded. Please try again later.", 429);
    this.name = "RateLimitError";
    this.code = "RATE_LIMIT_EXCEEDED";
    this.retryAfter = retryAfter; // seconds
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      data: {
        retryAfter: this.retryAfter,
        retryAfterMinutes: Math.ceil(this.retryAfter / 60),
      },
    };
  }
}

/**
 * Error thrown when Python ML service is unavailable
 */
export class AIServiceUnavailableError extends AppError {
  constructor(message = "AI analysis service is temporarily unavailable") {
    super(message, 503);
    this.name = "AIServiceUnavailableError";
    this.code = "AI_SERVICE_UNAVAILABLE";
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      data: {
        retryable: true,
        suggestion:
          "Our AI service is experiencing high demand. Please try again shortly.",
      },
    };
  }
}

/**
 * Error thrown when session token is invalid or expired
 */
export class InvalidSessionError extends AppError {
  constructor(message = "Session token is invalid or has expired") {
    super(message, 404);
    this.name = "InvalidSessionError";
    this.code = "INVALID_SESSION";
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      data: {
        suggestion: "Please generate a new event plan",
      },
    };
  }
}

/**
 * Error thrown when currency conversion fails
 */
export class CurrencyConversionError extends AppError {
  constructor(
    fromCurrency,
    toCurrency,
    message = "Currency conversion failed"
  ) {
    super(message, 500);
    this.name = "CurrencyConversionError";
    this.code = "CURRENCY_CONVERSION_ERROR";
    this.fromCurrency = fromCurrency;
    this.toCurrency = toCurrency;
  }

  toJSON() {
    return {
      status: "error",
      code: this.code,
      message: this.message,
      data: {
        fromCurrency: this.fromCurrency,
        toCurrency: this.toCurrency,
      },
    };
  }
}
