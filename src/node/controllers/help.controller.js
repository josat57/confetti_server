import HelpArticle from "../models/help-article.model.js";
import Onboarding from "../models/onboarding.model.js";

/**
 * Get all help articles with optional filtering
 */
export const getHelpArticles = async (req, res) => {
  try {
    const { category, featured, limit = 20, page = 1 } = req.query;

    const query = { published: true };

    if (category) {
      query.category = category;
    }

    if (featured === "true") {
      query.featured = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const articles = await HelpArticle.find(query)
      .select("-content") // Exclude full content in list view
      .sort({ featured: -1, viewCount: -1, publishedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await HelpArticle.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get help articles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get help articles",
      error: error.message,
    });
  }
};

/**
 * Get single help article by slug
 */
export const getHelpArticle = async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user?._id;

    const article = await HelpArticle.findOne({
      slug,
      published: true,
    }).populate("relatedArticles", "title slug excerpt category");

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Help article not found",
      });
    }

    // Increment view count
    await article.incrementViewCount();

    // Track article view in onboarding if user is logged in
    if (userId) {
      await Onboarding.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            helpArticlesViewed: {
              articleId: article._id.toString(),
              viewedAt: new Date(),
            },
          },
          $set: { lastActiveAt: new Date() },
        },
        { upsert: true }
      );
    }

    res.status(200).json({
      success: true,
      data: {
        article,
      },
    });
  } catch (error) {
    console.error("Get help article error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get help article",
      error: error.message,
    });
  }
};

/**
 * Search help articles
 */
export const searchHelpArticles = async (req, res) => {
  try {
    const { q, category } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const articles = await HelpArticle.searchArticles(q, category);

    res.status(200).json({
      success: true,
      data: {
        query: q,
        category: category || "all",
        articles,
        total: articles.length,
      },
    });
  } catch (error) {
    console.error("Search help articles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search help articles",
      error: error.message,
    });
  }
};

/**
 * Get featured help articles
 */
export const getFeaturedArticles = async (req, res) => {
  try {
    const articles = await HelpArticle.getFeaturedArticles();

    res.status(200).json({
      success: true,
      data: {
        articles,
      },
    });
  } catch (error) {
    console.error("Get featured articles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get featured articles",
      error: error.message,
    });
  }
};

/**
 * Get popular help articles
 */
export const getPopularArticles = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const articles = await HelpArticle.getPopularArticles(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        articles,
      },
    });
  } catch (error) {
    console.error("Get popular articles error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get popular articles",
      error: error.message,
    });
  }
};

/**
 * Get articles by category
 */
export const getArticlesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const articles = await HelpArticle.getArticlesByCategory(category);

    res.status(200).json({
      success: true,
      data: {
        category,
        articles,
        total: articles.length,
      },
    });
  } catch (error) {
    console.error("Get articles by category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get articles by category",
      error: error.message,
    });
  }
};

/**
 * Mark article as helpful
 */
export const markArticleHelpful = async (req, res) => {
  try {
    const { slug } = req.params;
    const { helpful } = req.body;

    const article = await HelpArticle.findOne({ slug, published: true });

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Help article not found",
      });
    }

    if (helpful === true) {
      await article.markHelpful();
    } else {
      await article.markNotHelpful();
    }

    res.status(200).json({
      success: true,
      message: "Feedback recorded successfully",
      data: {
        helpfulCount: article.helpfulCount,
        notHelpfulCount: article.notHelpfulCount,
      },
    });
  } catch (error) {
    console.error("Mark article helpful error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record feedback",
      error: error.message,
    });
  }
};

/**
 * Get help categories with article counts
 */
export const getHelpCategories = async (req, res) => {
  try {
    const categories = [
      "getting-started",
      "events",
      "clients",
      "vendors",
      "budget",
      "tasks",
      "guests",
      "calendar",
      "team",
      "settings",
      "billing",
      "integrations",
      "troubleshooting",
    ];

    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await HelpArticle.countDocuments({
          category,
          published: true,
        });
        return {
          name: category,
          displayName: category
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          count,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        categories: categoriesWithCounts.filter((cat) => cat.count > 0),
      },
    });
  } catch (error) {
    console.error("Get help categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get help categories",
      error: error.message,
    });
  }
};
