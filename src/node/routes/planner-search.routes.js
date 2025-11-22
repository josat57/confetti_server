import express from "express";
import { protect } from "../middleware/auth.js";
import {
  globalSearch,
  getSavedSearches,
  saveSearch,
  deleteSavedSearch,
  getSearchSuggestions,
  getRecentSearches,
} from "../controllers/planner-search.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/v1/planner/search:
 *   get:
 *     summary: Global search across all content types
 *     tags: [Planner Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [events, clients, tasks, documents, vendors]
 *         description: Filter by category
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Results per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, date]
 *           default: relevance
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       400:
 *         description: Search query required
 *       401:
 *         description: Unauthorized
 */
router.get("/", globalSearch);

/**
 * @swagger
 * /api/v1/planner/search/suggestions:
 *   get:
 *     summary: Get search suggestions for autocomplete
 *     tags: [Planner Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Partial search query
 *     responses:
 *       200:
 *         description: Suggestions retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/suggestions", getSearchSuggestions);

/**
 * @swagger
 * /api/v1/planner/search/recent:
 *   get:
 *     summary: Get recent searches
 *     tags: [Planner Search]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recent searches retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/recent", getRecentSearches);

/**
 * @swagger
 * /api/v1/planner/search/saved:
 *   get:
 *     summary: Get saved searches
 *     tags: [Planner Search]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved searches retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/saved", getSavedSearches);

/**
 * @swagger
 * /api/v1/planner/search/saved:
 *   post:
 *     summary: Save a search query
 *     tags: [Planner Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query to save
 *               filters:
 *                 type: object
 *                 description: Search filters
 *               name:
 *                 type: string
 *                 description: Name for the saved search
 *     responses:
 *       201:
 *         description: Search saved successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post("/saved", saveSearch);

/**
 * @swagger
 * /api/v1/planner/search/saved/{id}:
 *   delete:
 *     summary: Delete a saved search
 *     tags: [Planner Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Saved search ID
 *     responses:
 *       200:
 *         description: Saved search deleted successfully
 *       404:
 *         description: Saved search not found
 *       401:
 *         description: Unauthorized
 */
router.delete("/saved/:id", deleteSavedSearch);

export default router;
