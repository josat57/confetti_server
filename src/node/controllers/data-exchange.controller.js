import dataExportService from "../services/data-export.service.js";
import dataImportService from "../services/data-import.service.js";

/**
 * Export all user data
 */
export const exportAllData = async (req, res) => {
  try {
    const userId = req.user._id;

    const data = await dataExportService.exportAllData(userId);

    res.status(200).json({
      success: true,
      message: "Data exported successfully",
      data,
    });
  } catch (error) {
    console.error("Export all data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export data",
      error: error.message,
    });
  }
};

/**
 * Export events
 */
export const exportEvents = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, eventType, startDate, endDate } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (eventType) filters.eventType = eventType;
    if (startDate || endDate) {
      filters.startDate = {};
      if (startDate) filters.startDate.$gte = new Date(startDate);
      if (endDate) filters.startDate.$lte = new Date(endDate);
    }

    const events = await dataExportService.exportEvents(userId, filters);

    res.status(200).json({
      success: true,
      message: "Events exported successfully",
      data: {
        events,
        total: events.length,
      },
    });
  } catch (error) {
    console.error("Export events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export events",
      error: error.message,
    });
  }
};

/**
 * Export clients
 */
export const exportClients = async (req, res) => {
  try {
    const userId = req.user._id;

    const clients = await dataExportService.exportClients(userId);

    res.status(200).json({
      success: true,
      message: "Clients exported successfully",
      data: {
        clients,
        total: clients.length,
      },
    });
  } catch (error) {
    console.error("Export clients error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export clients",
      error: error.message,
    });
  }
};

/**
 * Export guests as CSV
 */
export const exportGuestsCSV = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.query;

    const csv = await dataExportService.exportGuestsCSV(userId, eventId);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=guests.csv");
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export guests CSV error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export guests",
      error: error.message,
    });
  }
};

/**
 * Export tasks
 */
export const exportTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, priority, eventId } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (eventId) filters.event = eventId;

    const tasks = await dataExportService.exportTasks(userId, filters);

    res.status(200).json({
      success: true,
      message: "Tasks exported successfully",
      data: {
        tasks,
        total: tasks.length,
      },
    });
  } catch (error) {
    console.error("Export tasks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export tasks",
      error: error.message,
    });
  }
};

/**
 * Import guests from CSV
 */
export const importGuestsCSV = async (req, res) => {
  try {
    const userId = req.user._id;
    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const results = await dataImportService.importGuestsFromCSV(
      req.file.buffer,
      userId,
      eventId
    );

    res.status(200).json({
      success: true,
      message: `Import completed. ${results.successful} guests imported successfully, ${results.failed} failed.`,
      data: results,
    });
  } catch (error) {
    console.error("Import guests CSV error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import guests",
      error: error.message,
    });
  }
};

/**
 * Validate CSV file
 */
export const validateCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "CSV file is required",
      });
    }

    const validation = await dataImportService.validateCSV(req.file.buffer);

    res.status(200).json({
      success: true,
      message: validation.valid ? "CSV file is valid" : "CSV file has errors",
      data: validation,
    });
  } catch (error) {
    console.error("Validate CSV error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate CSV",
      error: error.message,
    });
  }
};

/**
 * Download CSV template
 */
export const downloadCSVTemplate = async (req, res) => {
  try {
    const template = dataImportService.generateGuestCSVTemplate();

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=guest-import-template.csv"
    );
    res.status(200).send(template);
  } catch (error) {
    console.error("Download CSV template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download template",
      error: error.message,
    });
  }
};
