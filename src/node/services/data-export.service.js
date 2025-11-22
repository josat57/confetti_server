import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import Guest from "../models/guest.model.js";
import Document from "../models/document.model.js";
import User from "../models/user.model.js";

/**
 * Data Export Service
 * Handles exporting user data in various formats
 */

class DataExportService {
  /**
   * Export all user data as JSON
   * @param {string} userId - The user ID
   * @returns {object} Complete user data export
   */
  async exportAllData(userId) {
    try {
      // Get user data
      const user = await User.findById(userId).select("-password -__v");

      // Get all events
      const events = await Event.find({ planner: userId })
        .populate("client", "firstName lastName email company")
        .select("-__v")
        .lean();

      // Get all clients
      const clients = await Client.find({ planner: userId })
        .select("-__v")
        .lean();

      // Get all tasks
      const tasks = await Task.find({ planner: userId })
        .populate("event", "title")
        .select("-__v")
        .lean();

      // Get all guests
      const guests = await Guest.find({ planner: userId })
        .populate("event", "title")
        .select("-__v")
        .lean();

      // Get all documents
      const documents = await Document.find({ uploadedBy: userId })
        .populate("event", "title")
        .select("-__v")
        .lean();

      // Calculate statistics
      const statistics = {
        totalEvents: events.length,
        totalClients: clients.length,
        totalTasks: tasks.length,
        totalGuests: guests.length,
        totalDocuments: documents.length,
        eventsByType: this.groupByField(events, "eventType"),
        eventsByStatus: this.groupByField(events, "status"),
        tasksByStatus: this.groupByField(tasks, "status"),
        tasksByPriority: this.groupByField(tasks, "priority"),
        guestsByRSVP: this.groupByField(guests, "rsvpStatus"),
      };

      return {
        exportDate: new Date().toISOString(),
        exportVersion: "1.0",
        user: user.toObject(),
        events,
        clients,
        tasks,
        guests,
        documents,
        statistics,
      };
    } catch (error) {
      console.error("Export all data error:", error);
      throw error;
    }
  }

  /**
   * Export events as JSON
   * @param {string} userId - The user ID
   * @param {object} filters - Optional filters
   * @returns {array} Events data
   */
  async exportEvents(userId, filters = {}) {
    try {
      const query = { planner: userId, ...filters };

      const events = await Event.find(query)
        .populate("client", "firstName lastName email company")
        .select("-__v")
        .lean();

      return events;
    } catch (error) {
      console.error("Export events error:", error);
      throw error;
    }
  }

  /**
   * Export clients as JSON
   * @param {string} userId - The user ID
   * @returns {array} Clients data
   */
  async exportClients(userId) {
    try {
      const clients = await Client.find({ planner: userId })
        .select("-__v")
        .lean();

      return clients;
    } catch (error) {
      console.error("Export clients error:", error);
      throw error;
    }
  }

  /**
   * Export guests as CSV format
   * @param {string} userId - The user ID
   * @param {string} eventId - Optional event ID filter
   * @returns {string} CSV data
   */
  async exportGuestsCSV(userId, eventId = null) {
    try {
      const query = { planner: userId };
      if (eventId) {
        query.event = eventId;
      }

      const guests = await Guest.find(query).populate("event", "title").lean();

      // CSV headers
      const headers = [
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Event",
        "Category",
        "RSVP Status",
        "Plus One",
        "Dietary Restrictions",
        "Notes",
      ];

      // CSV rows
      const rows = guests.map((guest) => [
        guest.firstName || "",
        guest.lastName || "",
        guest.email || "",
        guest.phone || "",
        guest.event?.title || "",
        guest.category || "",
        guest.rsvpStatus || "pending",
        guest.plusOne ? "Yes" : "No",
        guest.dietaryRestrictions || "",
        guest.notes || "",
      ]);

      // Convert to CSV string
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      return csvContent;
    } catch (error) {
      console.error("Export guests CSV error:", error);
      throw error;
    }
  }

  /**
   * Export tasks as JSON
   * @param {string} userId - The user ID
   * @param {object} filters - Optional filters
   * @returns {array} Tasks data
   */
  async exportTasks(userId, filters = {}) {
    try {
      const query = { planner: userId, ...filters };

      const tasks = await Task.find(query)
        .populate("event", "title")
        .select("-__v")
        .lean();

      return tasks;
    } catch (error) {
      console.error("Export tasks error:", error);
      throw error;
    }
  }

  /**
   * Helper method to group data by field
   * @param {array} data - Array of objects
   * @param {string} field - Field to group by
   * @returns {object} Grouped data with counts
   */
  groupByField(data, field) {
    return data.reduce((acc, item) => {
      const key = item[field] || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }
}

export default new DataExportService();
