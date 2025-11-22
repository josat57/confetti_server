import Guest from "../models/guest.model.js";
import Event from "../models/event.model.js";
import csv from "csv-parser";
import { Readable } from "stream";

/**
 * Data Import Service
 * Handles importing data from CSV/Excel files
 */

class DataImportService {
  /**
   * Import guests from CSV
   * @param {Buffer} fileBuffer - CSV file buffer
   * @param {string} userId - The user ID
   * @param {string} eventId - The event ID
   * @returns {object} Import results
   */
  async importGuestsFromCSV(fileBuffer, userId, eventId) {
    try {
      // Verify event ownership
      const event = await Event.findOne({ _id: eventId, planner: userId });

      if (!event) {
        throw new Error("Event not found or access denied");
      }

      const results = {
        total: 0,
        successful: 0,
        failed: 0,
        errors: [],
        guests: [],
      };

      // Parse CSV
      const guests = await this.parseCSV(fileBuffer);

      results.total = guests.length;

      // Process each guest
      for (let i = 0; i < guests.length; i++) {
        const guestData = guests[i];

        try {
          // Validate required fields
          if (!guestData.firstName || !guestData.email) {
            results.failed++;
            results.errors.push({
              row: i + 2, // +2 for header and 0-index
              error: "Missing required fields (firstName, email)",
              data: guestData,
            });
            continue;
          }

          // Check for duplicate email in this event
          const existingGuest = await Guest.findOne({
            event: eventId,
            email: guestData.email.toLowerCase(),
          });

          if (existingGuest) {
            results.failed++;
            results.errors.push({
              row: i + 2,
              error: "Guest with this email already exists for this event",
              data: guestData,
            });
            continue;
          }

          // Create guest
          const guest = await Guest.create({
            firstName: guestData.firstName.trim(),
            lastName: guestData.lastName?.trim() || "",
            email: guestData.email.toLowerCase().trim(),
            phone: guestData.phone?.trim() || "",
            event: eventId,
            planner: userId,
            category: guestData.category?.toLowerCase() || "general",
            rsvpStatus: guestData.rsvpStatus?.toLowerCase() || "pending",
            plusOne: this.parseBoolean(guestData.plusOne),
            dietaryRestrictions: guestData.dietaryRestrictions?.trim() || "",
            notes: guestData.notes?.trim() || "",
          });

          results.successful++;
          results.guests.push(guest);
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: error.message,
            data: guestData,
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Import guests from CSV error:", error);
      throw error;
    }
  }

  /**
   * Parse CSV file buffer
   * @param {Buffer} fileBuffer - CSV file buffer
   * @returns {Promise<array>} Parsed data
   */
  parseCSV(fileBuffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from(fileBuffer.toString());

      stream
        .pipe(csv())
        .on("data", (data) => {
          // Normalize keys (remove spaces, lowercase)
          const normalizedData = {};
          Object.keys(data).forEach((key) => {
            const normalizedKey = key.trim().replace(/\s+/g, "").toLowerCase();
            normalizedData[normalizedKey] = data[key];
          });
          results.push(normalizedData);
        })
        .on("end", () => {
          resolve(results);
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  /**
   * Parse boolean values from CSV
   * @param {string} value - String value
   * @returns {boolean} Boolean value
   */
  parseBoolean(value) {
    if (!value) return false;
    const normalized = value.toString().toLowerCase().trim();
    return ["yes", "true", "1", "y"].includes(normalized);
  }

  /**
   * Generate CSV template for guests
   * @returns {string} CSV template
   */
  generateGuestCSVTemplate() {
    const headers = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "category",
      "rsvpStatus",
      "plusOne",
      "dietaryRestrictions",
      "notes",
    ];

    const exampleRow = [
      "John",
      "Doe",
      "john.doe@example.com",
      "+1234567890",
      "vip",
      "pending",
      "yes",
      "Vegetarian",
      "Prefers window seat",
    ];

    return [
      headers.join(","),
      exampleRow.map((cell) => `"${cell}"`).join(","),
    ].join("\n");
  }

  /**
   * Validate CSV file
   * @param {Buffer} fileBuffer - CSV file buffer
   * @returns {object} Validation results
   */
  async validateCSV(fileBuffer) {
    try {
      const data = await this.parseCSV(fileBuffer);

      const requiredFields = ["firstname", "email"];
      const validCategories = [
        "vip",
        "family",
        "friend",
        "colleague",
        "general",
      ];
      const validRSVPStatuses = ["pending", "accepted", "declined", "maybe"];

      const errors = [];

      data.forEach((row, index) => {
        // Check required fields
        requiredFields.forEach((field) => {
          if (!row[field] || row[field].trim() === "") {
            errors.push({
              row: index + 2,
              field,
              error: `Required field '${field}' is missing or empty`,
            });
          }
        });

        // Validate email format
        if (row.email && !this.isValidEmail(row.email)) {
          errors.push({
            row: index + 2,
            field: "email",
            error: "Invalid email format",
          });
        }

        // Validate category
        if (
          row.category &&
          !validCategories.includes(row.category.toLowerCase())
        ) {
          errors.push({
            row: index + 2,
            field: "category",
            error: `Invalid category. Must be one of: ${validCategories.join(
              ", "
            )}`,
          });
        }

        // Validate RSVP status
        if (
          row.rsvpstatus &&
          !validRSVPStatuses.includes(row.rsvpstatus.toLowerCase())
        ) {
          errors.push({
            row: index + 2,
            field: "rsvpStatus",
            error: `Invalid RSVP status. Must be one of: ${validRSVPStatuses.join(
              ", "
            )}`,
          });
        }
      });

      return {
        valid: errors.length === 0,
        totalRows: data.length,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} Is valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default new DataImportService();
