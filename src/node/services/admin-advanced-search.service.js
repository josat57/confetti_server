import SavedSearch from "../models/savedSearch.model.js";
import SearchHistory from "../models/searchHistory.model.js";
import User from "../models/user.model.js";
import Vendor from "../models/vendor.model.js";
import Event from "../models/event.model.js";
import Payment from "../models/payment.model.js";
import SupportTicket from "../models/supportTicket.model.js";
import Notification from "../models/notification.model.js";
import AuditLog from "../models/auditLog.model.js";
import { createError } from "../utils/error.js";

class AdminAdvancedSearchService {
  // ==================== Global Search ====================

  async globalSearch(searchQuery, options = {}) {
    const { query, limit = 10, adminId, ipAddress, userAgent } = searchQuery;
    const startTime = Date.now();

    if (!query || query.trim().length < 2) {
      throw createError("Search query must be at least 2 characters", 400);
    }

    const searchRegex = { $regex: query, $options: "i" };

    // Search across multiple collections
    const [users, vendors, events, transactions, tickets, notifications] =
      await Promise.all([
        this.searchUsers(searchRegex, limit),
        this.searchVendors(searchRegex, limit),
        this.searchEvents(searchRegex, limit),
        this.searchTransactions(searchRegex, limit),
        this.searchTickets(searchRegex, limit),
        this.searchNotifications(searchRegex, limit),
      ]);

    const results = {
      users,
      vendors,
      events,
      transactions,
      tickets,
      notifications,
      totalResults:
        users.length +
        vendors.length +
        events.length +
        transactions.length +
        tickets.length +
        notifications.length,
    };

    const executionTime = Date.now() - startTime;

    // Save to search history
    if (adminId) {
      await SearchHistory.create({
        user: adminId,
        searchType: "global",
        query,
        resultsCount: results.totalResults,
        executionTime,
        ipAddress,
        userAgent,
      });
    }

    return {
      query,
      results,
      executionTime,
      timestamp: new Date(),
    };
  }

  async searchUsers(searchRegex, limit) {
    return await User.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ],
    })
      .select("firstName lastName email role status createdAt")
      .limit(limit)
      .lean();
  }

  async searchVendors(searchRegex, limit) {
    return await Vendor.find({
      $or: [
        { name: searchRegex },
        { businessName: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
      ],
    })
      .populate("owner", "firstName lastName email")
      .select("name businessName category status rating")
      .limit(limit)
      .lean();
  }

  async searchEvents(searchRegex, limit) {
    return await Event.find({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
      ],
    })
      .populate("organizer", "firstName lastName email")
      .select("title eventType date location status")
      .limit(limit)
      .lean();
  }

  async searchTransactions(searchRegex, limit) {
    return await Payment.find({
      $or: [{ transactionId: searchRegex }, { reference: searchRegex }],
    })
      .populate("user", "firstName lastName email")
      .select("amount status paymentMethod transactionId createdAt")
      .limit(limit)
      .lean();
  }

  async searchTickets(searchRegex, limit) {
    return await SupportTicket.find({
      $or: [{ subject: searchRegex }, { description: searchRegex }],
    })
      .populate("user", "firstName lastName email")
      .select("subject category priority status createdAt")
      .limit(limit)
      .lean();
  }

  async searchNotifications(searchRegex, limit) {
    return await Notification.find({
      $or: [{ title: searchRegex }, { message: searchRegex }],
    })
      .populate("recipient", "firstName lastName email")
      .select("title type category status createdAt")
      .limit(limit)
      .lean();
  }

  // ==================== Advanced Search ====================

  async advancedSearch(searchData, adminId) {
    const {
      searchType,
      query,
      filters,
      sortBy,
      sortOrder,
      page = 1,
      limit = 20,
    } = searchData;
    const startTime = Date.now();

    let results;
    let total;

    switch (searchType) {
      case "users":
        ({ results, total } = await this.advancedUserSearch(
          query,
          filters,
          sortBy,
          sortOrder,
          page,
          limit
        ));
        break;
      case "vendors":
        ({ results, total } = await this.advancedVendorSearch(
          query,
          filters,
          sortBy,
          sortOrder,
          page,
          limit
        ));
        break;
      case "events":
        ({ results, total } = await this.advancedEventSearch(
          query,
          filters,
          sortBy,
          sortOrder,
          page,
          limit
        ));
        break;
      case "transactions":
        ({ results, total } = await this.advancedTransactionSearch(
          query,
          filters,
          sortBy,
          sortOrder,
          page,
          limit
        ));
        break;
      case "tickets":
        ({ results, total } = await this.advancedTicketSearch(
          query,
          filters,
          sortBy,
          sortOrder,
          page,
          limit
        ));
        break;
      case "audit_logs":
        ({ results, total } = await this.advancedAuditLogSearch(
          query,
          filters,
          sortBy,
          sortOrder,
          page,
          limit
        ));
        break;
      default:
        throw createError("Invalid search type", 400);
    }

    const executionTime = Date.now() - startTime;

    // Save to search history
    await SearchHistory.create({
      user: adminId,
      searchType,
      query: query || "advanced_filter",
      filters,
      resultsCount: total,
      executionTime,
    });

    return {
      searchType,
      results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      executionTime,
    };
  }

  async advancedUserSearch(
    query,
    filters,
    sortBy = "createdAt",
    sortOrder = "desc",
    page,
    limit
  ) {
    const searchQuery = {};

    if (query) {
      searchQuery.$or = [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ];
    }

    if (filters) {
      if (filters.role) searchQuery.role = filters.role;
      if (filters.status) searchQuery.status = filters.status;
      if (filters.tier) searchQuery["subscription.tier"] = filters.tier;
      if (filters.startDate || filters.endDate) {
        searchQuery.createdAt = {};
        if (filters.startDate)
          searchQuery.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate)
          searchQuery.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [results, total] = await Promise.all([
      User.find(searchQuery)
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(searchQuery),
    ]);

    return { results, total };
  }

  async advancedVendorSearch(
    query,
    filters,
    sortBy = "createdAt",
    sortOrder = "desc",
    page,
    limit
  ) {
    const searchQuery = {};

    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: "i" } },
        { businessName: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ];
    }

    if (filters) {
      if (filters.category) searchQuery.category = filters.category;
      if (filters.status) searchQuery.status = filters.status;
      if (filters.verificationStatus)
        searchQuery.verificationStatus = filters.verificationStatus;
      if (filters.minRating) searchQuery.rating = { $gte: filters.minRating };
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [results, total] = await Promise.all([
      Vendor.find(searchQuery)
        .populate("owner", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(searchQuery),
    ]);

    return { results, total };
  }

  async advancedEventSearch(
    query,
    filters,
    sortBy = "date",
    sortOrder = "desc",
    page,
    limit
  ) {
    const searchQuery = {};

    if (query) {
      searchQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ];
    }

    if (filters) {
      if (filters.eventType) searchQuery.eventType = filters.eventType;
      if (filters.status) searchQuery.status = filters.status;
      if (filters.startDate || filters.endDate) {
        searchQuery.date = {};
        if (filters.startDate)
          searchQuery.date.$gte = new Date(filters.startDate);
        if (filters.endDate) searchQuery.date.$lte = new Date(filters.endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [results, total] = await Promise.all([
      Event.find(searchQuery)
        .populate("organizer", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments(searchQuery),
    ]);

    return { results, total };
  }

  async advancedTransactionSearch(
    query,
    filters,
    sortBy = "createdAt",
    sortOrder = "desc",
    page,
    limit
  ) {
    const searchQuery = {};

    if (query) {
      searchQuery.$or = [
        { transactionId: { $regex: query, $options: "i" } },
        { reference: { $regex: query, $options: "i" } },
      ];
    }

    if (filters) {
      if (filters.status) searchQuery.status = filters.status;
      if (filters.paymentMethod)
        searchQuery.paymentMethod = filters.paymentMethod;
      if (filters.minAmount || filters.maxAmount) {
        searchQuery.amount = {};
        if (filters.minAmount) searchQuery.amount.$gte = filters.minAmount;
        if (filters.maxAmount) searchQuery.amount.$lte = filters.maxAmount;
      }
      if (filters.startDate || filters.endDate) {
        searchQuery.createdAt = {};
        if (filters.startDate)
          searchQuery.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate)
          searchQuery.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [results, total] = await Promise.all([
      Payment.find(searchQuery)
        .populate("user", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(searchQuery),
    ]);

    return { results, total };
  }

  async advancedTicketSearch(
    query,
    filters,
    sortBy = "createdAt",
    sortOrder = "desc",
    page,
    limit
  ) {
    const searchQuery = {};

    if (query) {
      searchQuery.$or = [
        { subject: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ];
    }

    if (filters) {
      if (filters.status) searchQuery.status = filters.status;
      if (filters.priority) searchQuery.priority = filters.priority;
      if (filters.category) searchQuery.category = filters.category;
      if (filters.assignedTo) searchQuery.assignedTo = filters.assignedTo;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [results, total] = await Promise.all([
      SupportTicket.find(searchQuery)
        .populate("user", "firstName lastName email")
        .populate("assignedTo", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      SupportTicket.countDocuments(searchQuery),
    ]);

    return { results, total };
  }

  async advancedAuditLogSearch(
    query,
    filters,
    sortBy = "createdAt",
    sortOrder = "desc",
    page,
    limit
  ) {
    const searchQuery = {};

    if (query) {
      searchQuery.$or = [
        { action: { $regex: query, $options: "i" } },
        { resource: { $regex: query, $options: "i" } },
      ];
    }

    if (filters) {
      if (filters.admin) searchQuery.admin = filters.admin;
      if (filters.action) searchQuery.action = filters.action;
      if (filters.resource) searchQuery.resource = filters.resource;
      if (filters.startDate || filters.endDate) {
        searchQuery.createdAt = {};
        if (filters.startDate)
          searchQuery.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate)
          searchQuery.createdAt.$lte = new Date(filters.endDate);
      }
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [results, total] = await Promise.all([
      AuditLog.find(searchQuery)
        .populate("admin", "firstName lastName email")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(searchQuery),
    ]);

    return { results, total };
  }

  // ==================== Saved Searches ====================

  async getSavedSearches(filters = {}) {
    const { userId, searchType, isPublic } = filters;

    const query = {};
    if (userId) query.user = userId;
    if (searchType) query.searchType = searchType;
    if (isPublic !== undefined) query.isPublic = isPublic;

    const searches = await SavedSearch.find(query)
      .populate("user", "firstName lastName email")
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();

    return searches;
  }

  async getSavedSearchById(searchId) {
    const search = await SavedSearch.findById(searchId)
      .populate("user", "firstName lastName email")
      .lean();

    if (!search) {
      throw createError("Saved search not found", 404);
    }

    return search;
  }

  async createSavedSearch(searchData, adminId) {
    const {
      name,
      description,
      searchType,
      query,
      filters,
      sortBy,
      sortOrder,
      isPublic,
      tags,
    } = searchData;

    const savedSearch = await SavedSearch.create({
      name,
      description,
      user: adminId,
      searchType,
      query,
      filters,
      sortBy,
      sortOrder,
      isPublic,
      tags,
    });

    return savedSearch;
  }

  async updateSavedSearch(searchId, updates, adminId) {
    const search = await SavedSearch.findById(searchId);

    if (!search) {
      throw createError("Saved search not found", 404);
    }

    if (search.user.toString() !== adminId.toString()) {
      throw createError("You can only update your own saved searches", 403);
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        search[key] = updates[key];
      }
    });

    await search.save();

    return search;
  }

  async deleteSavedSearch(searchId, adminId) {
    const search = await SavedSearch.findById(searchId);

    if (!search) {
      throw createError("Saved search not found", 404);
    }

    if (search.user.toString() !== adminId.toString()) {
      throw createError("You can only delete your own saved searches", 403);
    }

    await SavedSearch.findByIdAndDelete(searchId);

    return { message: "Saved search deleted successfully" };
  }

  async executeSavedSearch(searchId, options, adminId) {
    const search = await SavedSearch.findById(searchId);

    if (!search) {
      throw createError("Saved search not found", 404);
    }

    // Update usage stats
    search.usageCount += 1;
    search.lastUsedAt = new Date();
    await search.save();

    // Execute the search
    const result = await this.advancedSearch(
      {
        searchType: search.searchType,
        query: search.query,
        filters: search.filters,
        sortBy: search.sortBy,
        sortOrder: search.sortOrder,
        ...options,
      },
      adminId
    );

    return result;
  }

  // ==================== Search History ====================

  async getSearchHistory(filters = {}) {
    const { userId, searchType, page = 1, limit = 50 } = filters;

    const query = {};
    if (userId) query.user = userId;
    if (searchType) query.searchType = searchType;

    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      SearchHistory.find(query)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SearchHistory.countDocuments(query),
    ]);

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async clearSearchHistory(userId) {
    await SearchHistory.deleteMany({ user: userId });
    return { message: "Search history cleared successfully" };
  }

  async getSearchAnalytics(filters = {}) {
    const { userId, startDate, endDate } = filters;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }

    if (userId) dateQuery.user = userId;

    const [
      totalSearches,
      bySearchType,
      topQueries,
      averageExecutionTime,
      averageResultsCount,
    ] = await Promise.all([
      SearchHistory.countDocuments(dateQuery),
      SearchHistory.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$searchType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      SearchHistory.aggregate([
        { $match: dateQuery },
        { $group: { _id: "$query", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      SearchHistory.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, avgTime: { $avg: "$executionTime" } } },
      ]),
      SearchHistory.aggregate([
        { $match: dateQuery },
        { $group: { _id: null, avgResults: { $avg: "$resultsCount" } } },
      ]),
    ]);

    return {
      totalSearches,
      bySearchType,
      topQueries,
      averageExecutionTime: averageExecutionTime[0]?.avgTime || 0,
      averageResultsCount: Math.round(averageResultsCount[0]?.avgResults || 0),
    };
  }
}

export default new AdminAdvancedSearchService();
