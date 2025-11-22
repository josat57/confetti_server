import express from "express";
import {
  getHelpArticles,
  getHelpArticle,
  searchHelpArticles,
  getFeaturedArticles,
  getPopularArticles,
  getArticlesByCategory,
  markArticleHelpful,
  getHelpCategories,
} from "../controllers/help.controller.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// Public routes (optional auth for tracking)
router.get("/articles", optionalAuth, getHelpArticles);
router.get("/articles/featured", optionalAuth, getFeaturedArticles);
router.get("/articles/popular", optionalAuth, getPopularArticles);
router.get("/articles/search", optionalAuth, searchHelpArticles);
router.get("/articles/category/:category", optionalAuth, getArticlesByCategory);
router.get("/articles/:slug", optionalAuth, getHelpArticle);
router.get("/categories", getHelpCategories);

// Feedback (optional auth)
router.post("/articles/:slug/feedback", optionalAuth, markArticleHelpful);

export default router;
