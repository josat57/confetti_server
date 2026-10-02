import mongoose from "mongoose";
import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import Document from "../models/document.model.js";
import Vendor from "../models/vendor.model.js";
import SavedSearch from "../models/savedSearch.model.js";
import SearchHistory from "../models/searchHistory.model.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

/**
 * Controller for Planner Global Search
 *
 * Uses escaped, case-insensitive regex matching (no text indexes are required,
 * and user input can never be interpreted as a regular expression).
 */

const CATEGORIES = ["events", "clients", "tasks", "documents", "vendors"];
const MAX_QUERY_LENGTH = 100;
const MAX_SAVED_SEARCHES = 50;

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** 3 = exact, 2 = prefix, 1 = contains, 0.5 = matched a secondary field */
const relevance = (primary, query) => {
  const text = String(primary || "").toLowerCase();
  const q = query.toLowerCase();
  if (text === q) return 3;
  if (text.startsWith(q)) return 2;
  if (text.includes(q)) return 1;
  return 0.5;
};

const recordHistory = (req, query, filters, resultsCount, startedAt) => {
  SearchHistory.create({
    user: req.user._id,
    searchType: "planner",
    query,
    filters,
    resultsCount,
    executionTime: Date.now() - startedAt,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  }).catch((error) => logger.warn("Failed to record search history", { error: error.message }));
};

/**
 * Global search across all content types
 * GET /api/v1/planner/search
 */
export const globalSearch = async (req, res, next) => {
  try {
    const startedAt = Date.now();
    const plannerId = req.user._id;
    const { q: query, category, page = 1, limit = 20, sortBy = "relevance" } = req.query;

    if (!query || String(query).trim().length === 0) {
      return next(new AppError("Search query is required", 400));
    }
    if (category && !CATEGORIES.includes(category)) {
      return next(new AppError(`category must be one of: ${CATEGORIES.join(", ")}`, 400));
    }

    const searchQuery = String(query).trim().slice(0, MAX_QUERY_LENGTH);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    // Enough of each category to fill the requested page after merging
    const perCategory = skip + limitNum;
    const rx = new RegExp(escapeRegex(searchQuery), "i");

    logger.info("Global search initiated", { plannerId, query: searchQuery, category, page: pageNum, limit: limitNum });

    const results = {
      query: searchQuery,
      totalResults: 0,
      categories: {},
      results: [],
    };

    const specs = {
      events: {
        model: Event,
        filter: { planner: plannerId, $or: [{ title: rx }, { description: rx }] },
        select: "title eventType startDate location status budget",
        type: "event",
        label: (e) => e.title,
      },
      clients: {
        model: Client,
        filter: { planner: plannerId, $or: [{ name: rx }, { email: rx }, { company: rx }, { phone: rx }] },
        select: "name email phone company status",
        type: "client",
        label: (c) => c.name,
      },
      tasks: {
        model: Task,
        filter: { planner: plannerId, $or: [{ title: rx }, { description: rx }] },
        select: "title description dueDate priority status event",
        populate: ["event", "title"],
        type: "task",
        label: (t) => t.title,
      },
      documents: {
        model: Document,
        filter: {
          owner: plannerId,
          status: { $ne: "deleted" },
          $or: [{ name: rx }, { "metadata.description": rx }, { "metadata.tags": rx }, { "metadata.originalName": rx }],
        },
        select: "name type mimeType size event createdAt",
        populate: ["event", "title"],
        type: "document",
        label: (d) => d.name,
      },
      vendors: {
        model: Vendor,
        filter: {
          $or: [{ businessName: rx }, { name: rx }, { category: rx }, { description: rx }, { "services.name": rx }],
        },
        select: "businessName category location rating services",
        type: "vendor",
        label: (v) => v.businessName,
      },
    };

    const selected = category ? [category] : CATEGORIES;
    await Promise.all(
      selected.map(async (cat) => {
        const spec = specs[cat];
        let finder = spec.model.find(spec.filter).select(spec.select).limit(perCategory).lean();
        if (spec.populate) finder = finder.populate(...spec.populate);
        if (sortBy !== "relevance") finder = finder.sort({ createdAt: -1 });
        const [docs, count] = await Promise.all([finder, spec.model.countDocuments(spec.filter)]);
        results.categories[cat] = {
          count,
          results: docs.map((doc) => ({
            ...doc,
            type: spec.type,
            score: relevance(spec.label(doc), searchQuery),
            snippet: highlightText(spec.label(doc), searchQuery),
          })),
        };
        results.totalResults += count;
      })
    );

    // Preserve the category order for deterministic output
    const allResults = CATEGORIES.filter((c) => results.categories[c]).flatMap((c) => results.categories[c].results);
    if (sortBy === "relevance") {
      allResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    results.results = allResults.slice(skip, skip + limitNum);
    results.page = pageNum;
    results.limit = limitNum;
    results.totalPages = Math.ceil(results.totalResults / limitNum);

    recordHistory(req, searchQuery, category ? { category } : {}, results.totalResults, startedAt);

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
    const searches = await SavedSearch.find({ user: req.user._id, searchType: "planner" })
      .sort({ lastUsedAt: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        searches,
        total: searches.length,
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
    const { query, filters, name, description } = req.body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return next(new AppError("Search query is required", 400));
    }
    if (filters !== undefined && (typeof filters !== "object" || Array.isArray(filters))) {
      return next(new AppError("filters must be an object", 400));
    }
    if (filters?.category && !CATEGORIES.includes(filters.category)) {
      return next(new AppError(`filters.category must be one of: ${CATEGORIES.join(", ")}`, 400));
    }

    const searchName = String(name || query).trim().slice(0, 100);
    const count = await SavedSearch.countDocuments({ user: plannerId, searchType: "planner" });

    // Saving under an existing name updates it instead of creating a duplicate
    const existing = await SavedSearch.findOne({ user: plannerId, searchType: "planner", name: searchName });
    if (!existing && count >= MAX_SAVED_SEARCHES) {
      return next(new AppError(`You can keep at most ${MAX_SAVED_SEARCHES} saved searches`, 400));
    }

    const savedSearch = existing || new SavedSearch({ user: plannerId, searchType: "planner", name: searchName });
    savedSearch.query = query.trim().slice(0, MAX_QUERY_LENGTH);
    savedSearch.filters = filters || {};
    if (description !== undefined) savedSearch.description = description;
    await savedSearch.save();

    logger.info("Search saved", { plannerId, query: savedSearch.query, updated: Boolean(existing) });

    res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? "Saved search updated" : "Search saved successfully",
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

    if (!mongoose.isValidObjectId(id)) {
      return next(new AppError("Invalid saved search id", 400));
    }

    const deleted = await SavedSearch.findOneAndDelete({ _id: id, user: plannerId, searchType: "planner" });
    if (!deleted) {
      return next(new AppError("Saved search not found", 404));
    }

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

    if (!query || String(query).trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: { suggestions: [] },
      });
    }

    const searchRegex = new RegExp(escapeRegex(String(query).trim().slice(0, MAX_QUERY_LENGTH)), "i");

    const [eventSuggestions, clientSuggestions, taskSuggestions] = await Promise.all([
      Event.find({ planner: plannerId, title: searchRegex }).select("title").limit(5).lean(),
      Client.find({ planner: plannerId, $or: [{ name: searchRegex }, { company: searchRegex }] })
        .select("name company")
        .limit(5)
        .lean(),
      Task.find({ planner: plannerId, title: searchRegex }).select("title").limit(5).lean(),
    ]);

    const suggestions = [
      ...eventSuggestions.map((e) => ({ text: e.title, type: "event" })),
      ...clientSuggestions.map((c) => ({
        text: searchRegex.test(c.name || "") || !c.company ? c.name : c.company,
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
 * Highlight matches with <mark>; the text itself is HTML-escaped so the
 * snippet is safe to render.
 */
function highlightText(text, query) {
  if (!text) return text;
  const safe = escapeHtml(text);
  if (!query) return safe;
  const regex = new RegExp(`(${escapeRegex(escapeHtml(query))})`, "gi");
  return safe.replace(regex, "<mark>$1</mark>");
}

/**
 * Get recent searches (latest distinct queries)
 * GET /api/v1/planner/search/recent
 */
export const getRecentSearches = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const recentSearches = await SearchHistory.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)), searchType: "planner" } },
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
      {
        $group: {
          _id: { $toLower: "$query" },
          query: { $first: "$query" },
          lastSearchedAt: { $first: "$createdAt" },
          resultsCount: { $first: "$resultsCount" },
          timesSearched: { $sum: 1 },
        },
      },
      { $sort: { lastSearchedAt: -1 } },
      { $limit: limit },
      { $project: { _id: 0, query: 1, lastSearchedAt: 1, resultsCount: 1, timesSearched: 1 } },
    ]);

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
