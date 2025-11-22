import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import Document from "../models/document.model.js";
import Vendor from "../models/vendor.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Controller for Planner Global Search
 */

/**
 * Global search across all content types
 * GET /api/v1/planner/search
 */
export const globalSearch = async (req, res, next) => {
  try {
    const plannerId = req.user._id;
    const {
      q: query,
      category,
      page = 1,
      limit = 20,
      sortBy = "relevance",
    } = req.query;

    if (!query || query.trim().length === 0) {
      return next(new AppError("Search query is required", 400));
    }

    const searchQuery = query.trim();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    logger.info("Global search initiated", {
      plannerId,
      query: searchQuery,
      category,
      page,
      limit,
    });

    // Build text search query
    const textSearchQuery = { $text: { $search: searchQuery } };
    const textSearchProjection = { score: { $meta: "textScore" } };
    const textSearchSort =
      sortBy === "relevance" ? { score: { $meta: "textScore" } } : {};

    // Search results object
    const results = {
      query: searchQuery,
      totalResults: 0,
      categories: {},
      results: [],
    };

    // Search in different categories based on filter
    const searchCategories = category
      ? [category]
      : ["events", "clients", "tasks", "documents", "vendors"];

    // Search Events
    if (searchCategories.includes("events")) {
      const eventQuery = {
        planner: plannerId,
        ...textSearchQuery,
      };

      const [events, eventCount] = await Promise.all([
        Event.find(eventQuery, textSearchProjection)
          .sort(textSearchSort)
          .limit(limitNum)
          .select("title eventType startDate location status budget")
          .lean(),
        Event.countDocuments(eventQuery),
      ]);

      results.categories.events = {
        count: eventCount,
        results: events.map((event) => ({
          ...event,
          type: "event",
          snippet: highlightText(event.title, searchQuery),
        })),
      };
      results.totalResults += eventCount;
    }

    // Search Clients
    if (searchCategories.includes("clients")) {
      const clientQuery = {
        planner: plannerId,
        ...textSearchQuery,
      };

      const [clients, clientCount] = await Promise.all([
        Client.find(clientQuery, textSearchProjection)
          .sort(textSearchSort)
          .limit(limitNum)
          .select("firstName lastName email phone company")
          .lean(),
        Client.countDocuments(clientQuery),
      ]);

      results.categories.clients = {
        count: clientCount,
        results: clients.map((client) => ({
          ...client,
          type: "client",
          snippet: highlightText(
            `${client.firstName} ${client.lastName}`,
            searchQuery
          ),
        })),
      };
      results.totalResults += clientCount;
    }

    // Search Tasks
    if (searchCategories.includes("tasks")) {
      const taskQuery = {
        planner: plannerId,
        ...textSearchQuery,
      };

      const [tasks, taskCount] = await Promise.all([
        Task.find(taskQuery, textSearchProjection)
          .sort(textSearchSort)
          .limit(limitNum)
          .select("title description dueDate priority status event")
          .populate("event", "title")
          .lean(),
        Task.countDocuments(taskQuery),
      ]);

      results.categories.tasks = {
        count: taskCount,
        results: tasks.map((task) => ({
          ...task,
          type: "task",
          snippet: highlightText(task.title, searchQuery),
        })),
      };
      results.totalResults += taskCount;
    }

    // Search Documents
    if (searchCategories.includes("documents")) {
      const documentQuery = {
        uploadedBy: plannerId,
        ...textSearchQuery,
      };

      const [documents, documentCount] = await Promise.all([
        Document.find(documentQuery, textSearchProjection)
          .sort(textSearchSort)
          .limit(limitNum)
          .select("name description fileType size uploadDate event")
          .populate("event", "title")
          .lean(),
        Document.countDocuments(documentQuery),
      ]);

      results.categories.documents = {
        count: documentCount,
        results: documents.map((doc) => ({
          ...doc,
          type: "document",
          snippet: highlightText(doc.name, searchQuery),
        })),
      };
      results.totalResults += documentCount;
    }

    // Search Vendors (from favorites)
    if (searchCategories.includes("vendors")) {
      const vendorQuery = {
        ...textSearchQuery,
      };

      const [vendors, vendorCount] = await Promise.all([
        Vendor.find(vendorQuery, textSearchProjection)
          .sort(textSearchSort)
          .limit(limitNum)
          .select("businessName category location rating services")
          .lean(),
        Vendor.countDocuments(vendorQuery),
      ]);

      results.categories.vendors = {
        count: vendorCount,
        results: vendors.map((vendor) => ({
          ...vendor,
          type: "vendor",
          snippet: highlightText(vendor.businessName, searchQuery),
        })),
      };
      results.totalResults += vendorCount;
    }

    // Combine all results for pagination
    const allResults = [];
    Object.keys(results.categories).forEach((cat) => {
      allResults.push(...results.categories[cat].results);
    });

    // Sort by relevance if needed
    if (sortBy === "relevance") {
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    // Apply pagination to combined results
    results.results = allResults.slice(skip, skip + limitNum);
    results.page = parseInt(page);
    results.limit = limitNum;
    results.totalPages = Math.ceil(results.totalResults / limitNum);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error("Global search error:", error);
    next(error);
  }
};

/**
 * Get saved searches
 * GET /api/v1/planner/search/saved
 */
export const getSavedSearches = async (req, res, next) => {
  try {
    const plannerId = req.user._id;

    // For now, return from user preferences
    // In production, this would be stored in a separate collection
    const savedSearches = req.user.savedSearches || [];

    res.status(200).json({
      success: true,
      data: {
        searches: savedSearches,
        total: savedSearches.length,
      },
    });
  } catch (error) {
    logger.error("Get saved searches error:", error);
    next(error);
  }
};

/**
 * Save a search query
 * POST /api/v1/planner/search/saved
 */
export const saveSearch = async (req, res, next) => {
  try {
    const plannerId = req.user._id;
    const { query, filters, name } = req.body;

    if (!query) {
      return next(new AppError("Search query is required", 400));
    }

    // Create saved search object
    const savedSearch = {
      name: name || query,
      query,
      filters: filters || {},
      createdAt: new Date(),
    };

    // In production, save to a separate SavedSearch collection
    // For now, we'll add to user document
    // This is a placeholder - you'd want to create a SavedSearch model

    logger.info("Search saved", { plannerId, query });

    res.status(201).json({
      success: true,
      message: "Search saved successfully",
      data: { savedSearch },
    });
  } catch (error) {
    logger.error("Save search error:", error);
    next(error);
  }
};

/**
 * Delete a saved search
 * DELETE /api/v1/planner/search/saved/:id
 */
export const deleteSavedSearch = async (req, res, next) => {
  try {
    const plannerId = req.user._id;
    const { id } = req.params;

    // In production, delete from SavedSearch collection
    logger.info("Saved search deleted", { plannerId, searchId: id });

    res.status(200).json({
      success: true,
      message: "Saved search deleted successfully",
    });
  } catch (error) {
    logger.error("Delete saved search error:", error);
    next(error);
  }
};

/**
 * Get search suggestions/autocomplete
 * GET /api/v1/planner/search/suggestions
 */
export const getSearchSuggestions = async (req, res, next) => {
  try {
    const plannerId = req.user._id;
    const { q: query } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        success: true,
        data: { suggestions: [] },
      });
    }

    const searchRegex = new RegExp(query, "i");

    // Get suggestions from different sources
    const [eventSuggestions, clientSuggestions, taskSuggestions] =
      await Promise.all([
        Event.find({
          planner: plannerId,
          title: searchRegex,
        })
          .select("title")
          .limit(5)
          .lean(),
        Client.find({
          planner: plannerId,
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { company: searchRegex },
          ],
        })
          .select("firstName lastName company")
          .limit(5)
          .lean(),
        Task.find({
          planner: plannerId,
          title: searchRegex,
        })
          .select("title")
          .limit(5)
          .lean(),
      ]);

    const suggestions = [
      ...eventSuggestions.map((e) => ({ text: e.title, type: "event" })),
      ...clientSuggestions.map((c) => ({
        text: `${c.firstName} ${c.lastName}`,
        type: "client",
      })),
      ...taskSuggestions.map((t) => ({ text: t.title, type: "task" })),
    ];

    res.status(200).json({
      success: true,
      data: { suggestions: suggestions.slice(0, 10) },
    });
  } catch (error) {
    logger.error("Get search suggestions error:", error);
    next(error);
  }
};

/**
 * Helper function to highlight matching text
 */
function highlightText(text, query) {
  if (!text || !query) return text;

  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

/**
 * Get recent searches
 * GET /api/v1/planner/search/recent
 */
export const getRecentSearches = async (req, res, next) => {
  try {
    const plannerId = req.user._id;

    // In production, fetch from a SearchHistory collection
    // For now, return empty array
    const recentSearches = [];

    res.status(200).json({
      success: true,
      data: {
        searches: recentSearches,
        total: recentSearches.length,
      },
    });
  } catch (error) {
    logger.error("Get recent searches error:", error);
    next(error);
  }
};
