import { AppError } from "./AppError.js";
import { logger } from "./logger.js";

/**
 * Input sanitization and validation utility for AI Event Planner
 */
class InputSanitizer {
  /**
   * Sanitize complete event request
   * @param {Object} request - Raw request data
   * @returns {Object} Sanitized request
   */
  sanitizeEventRequest(request) {
    try {
      return {
        eventType: this.sanitizeEnum(
          request.eventType,
          [
            "wedding",
            "corporate",
            "birthday",
            "graduation",
            "conference",
            "other",
          ],
          "eventType"
        ),
        eventDate: this.sanitizeDate(request.eventDate),
        guestCount: this.sanitizeNumber(
          request.guestCount,
          1,
          10000,
          "guestCount"
        ),
        location: this.sanitizeLocation(request.location),
        eventDescription: this.sanitizeText(
          request.eventDescription,
          50,
          1000,
          "eventDescription"
        ),
        guestClass: this.sanitizeGuestClass(request.guestClass),
        budget: this.sanitizeBudget(request.budget),
      };
    } catch (error) {
      logger.error("Input sanitization failed:", {
        error: error.message,
        request,
      });
      throw error;
    }
  }

  /**
   * Sanitize text input
   * @param {string} text - Text to sanitize
   * @param {number} minLength - Minimum length
   * @param {number} maxLength - Maximum length
   * @param {string} fieldName - Field name for error messages
   * @returns {string} Sanitized text
   */
  sanitizeText(text, minLength, maxLength, fieldName = "text") {
    if (!text || typeof text !== "string") {
      throw new AppError(`${fieldName} is required and must be a string`, 400);
    }

    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, "");

    // Remove script tags and their content
    cleaned = cleaned.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );

    // Trim whitespace
    cleaned = cleaned.trim();

    // Validate length
    if (cleaned.length < minLength) {
      throw new AppError(
        `${fieldName} must be at least ${minLength} characters`,
        400
      );
    }

    if (cleaned.length > maxLength) {
      throw new AppError(
        `${fieldName} cannot exceed ${maxLength} characters`,
        400
      );
    }

    return cleaned;
  }

  /**
   * Sanitize date input
   * @param {string|Date} dateInput - Date to sanitize
   * @returns {Date} Sanitized date
   */
  sanitizeDate(dateInput) {
    const date = new Date(dateInput);

    if (isNaN(date.getTime())) {
      throw new AppError(
        "Invalid date format. Please provide a valid date.",
        400
      );
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    if (date < now) {
      throw new AppError("Event date must be in the future", 400);
    }

    // Check if date is not too far in the future (e.g., 5 years)
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 5);

    if (date > maxDate) {
      throw new AppError(
        "Event date cannot be more than 5 years in the future",
        400
      );
    }

    return date;
  }

  /**
   * Sanitize number input
   * @param {number|string} value - Number to sanitize
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {string} fieldName - Field name for error messages
   * @returns {number} Sanitized number
   */
  sanitizeNumber(value, min, max, fieldName = "number") {
    const num = Number(value);

    if (isNaN(num)) {
      throw new AppError(`${fieldName} must be a valid number`, 400);
    }

    if (num < min) {
      throw new AppError(`${fieldName} must be at least ${min}`, 400);
    }

    if (num > max) {
      throw new AppError(`${fieldName} cannot exceed ${max}`, 400);
    }

    return num;
  }

  /**
   * Sanitize enum value
   * @param {string} value - Value to sanitize
   * @param {string[]} allowedValues - Allowed values
   * @param {string} fieldName - Field name for error messages
   * @returns {string} Sanitized enum value
   */
  sanitizeEnum(value, allowedValues, fieldName = "field") {
    if (!value || typeof value !== "string") {
      throw new AppError(`${fieldName} is required`, 400);
    }

    const normalized = value.toLowerCase().trim();

    if (!allowedValues.includes(normalized)) {
      throw new AppError(
        `${fieldName} must be one of: ${allowedValues.join(", ")}`,
        400
      );
    }

    return normalized;
  }

  /**
   * Sanitize location data
   * @param {Object} location - Location data
   * @returns {Object} Sanitized location
   */
  sanitizeLocation(location) {
    if (!location || typeof location !== "object") {
      throw new AppError("Location is required", 400);
    }

    const sanitized = {
      address: this.sanitizeText(location.address, 5, 200, "address"),
      city: this.sanitizeText(location.city, 2, 100, "city"),
      state: this.sanitizeText(location.state, 2, 100, "state"),
      country: location.country || "Nigeria",
    };

    // Sanitize coordinates if provided
    if (location.latitude !== undefined && location.longitude !== undefined) {
      sanitized.latitude = this.sanitizeNumber(
        location.latitude,
        -90,
        90,
        "latitude"
      );
      sanitized.longitude = this.sanitizeNumber(
        location.longitude,
        -180,
        180,
        "longitude"
      );
      sanitized.coordinates = [sanitized.longitude, sanitized.latitude]; // MongoDB format
    } else if (location.coordinates && Array.isArray(location.coordinates)) {
      // Handle MongoDB format [longitude, latitude]
      if (location.coordinates.length !== 2) {
        throw new AppError(
          "Coordinates must be an array of [longitude, latitude]",
          400
        );
      }
      sanitized.longitude = this.sanitizeNumber(
        location.coordinates[0],
        -180,
        180,
        "longitude"
      );
      sanitized.latitude = this.sanitizeNumber(
        location.coordinates[1],
        -90,
        90,
        "latitude"
      );
      sanitized.coordinates = [sanitized.longitude, sanitized.latitude];
    }

    return sanitized;
  }

  /**
   * Sanitize guest class data
   * @param {Object} guestClass - Guest class data
   * @returns {Object} Sanitized guest class
   */
  sanitizeGuestClass(guestClass) {
    if (!guestClass || typeof guestClass !== "object") {
      throw new AppError("Guest class information is required", 400);
    }

    const allowedAgeGroups = [
      "children",
      "teenagers",
      "young_adults",
      "adults",
      "seniors",
    ];
    const allowedFormality = ["casual", "semi-formal", "formal", "black-tie"];
    const allowedSocialStatus = [
      "budget-conscious",
      "middle-class",
      "affluent",
      "luxury",
    ];
    const allowedSpecialReqs = [
      "dietary-restrictions",
      "accessibility-needs",
      "cultural-considerations",
      "religious-considerations",
    ];

    const sanitized = {
      formality: this.sanitizeEnum(
        guestClass.formality || "casual",
        allowedFormality,
        "formality"
      ),
    };

    // Sanitize arrays
    if (guestClass.ageGroups && Array.isArray(guestClass.ageGroups)) {
      sanitized.ageGroups = guestClass.ageGroups
        .filter((group) => allowedAgeGroups.includes(group.toLowerCase()))
        .map((group) => group.toLowerCase());
    } else {
      sanitized.ageGroups = ["adults"]; // Default
    }

    if (guestClass.socialStatus && Array.isArray(guestClass.socialStatus)) {
      sanitized.socialStatus = guestClass.socialStatus
        .filter((status) => allowedSocialStatus.includes(status.toLowerCase()))
        .map((status) => status.toLowerCase());
    } else {
      sanitized.socialStatus = ["middle-class"]; // Default
    }

    if (
      guestClass.specialRequirements &&
      Array.isArray(guestClass.specialRequirements)
    ) {
      sanitized.specialRequirements = guestClass.specialRequirements
        .filter((req) => allowedSpecialReqs.includes(req.toLowerCase()))
        .map((req) => req.toLowerCase());
    } else {
      sanitized.specialRequirements = [];
    }

    // Sanitize additional details if provided
    if (guestClass.additionalDetails) {
      sanitized.additionalDetails = this.sanitizeText(
        guestClass.additionalDetails,
        0,
        500,
        "additionalDetails"
      );
    }

    return sanitized;
  }

  /**
   * Sanitize budget data
   * @param {Object} budget - Budget data
   * @returns {Object} Sanitized budget
   */
  sanitizeBudget(budget) {
    if (!budget || typeof budget !== "object") {
      throw new AppError("Budget information is required", 400);
    }

    const allowedCurrencies = ["NGN", "USD", "EUR", "GBP"];

    const sanitized = {
      amount: this.sanitizeNumber(
        budget.amount,
        0,
        1000000000,
        "budget amount"
      ),
      currency: this.sanitizeEnum(
        budget.currency || "NGN",
        allowedCurrencies,
        "currency"
      ).toUpperCase(),
    };

    // Validate minimum budget based on currency
    const minimumBudgets = {
      NGN: 10000,
      USD: 50,
      EUR: 50,
      GBP: 40,
    };

    const minBudget = minimumBudgets[sanitized.currency];
    if (sanitized.amount < minBudget) {
      throw new AppError(
        `Minimum budget for ${sanitized.currency} is ${minBudget}`,
        400
      );
    }

    return sanitized;
  }

  /**
   * Sanitize IP address
   * @param {string} ip - IP address
   * @returns {string} Sanitized IP
   */
  sanitizeIP(ip) {
    if (!ip) return null;

    // Basic IP validation (IPv4 and IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (ipv4Regex.test(ip) || ipv6Regex.test(ip)) {
      return ip;
    }

    return null;
  }

  /**
   * Sanitize user agent string
   * @param {string} userAgent - User agent string
   * @returns {string} Sanitized user agent
   */
  sanitizeUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== "string") return null;

    // Limit length and remove potentially harmful characters
    return userAgent.substring(0, 500).replace(/[<>]/g, "");
  }
}

export default new InputSanitizer();
