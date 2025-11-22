import WhatsNew from "../models/whats-new.model.js";
import Onboarding from "../models/onboarding.model.js";

/**
 * Get latest releases
 */
export const getLatestReleases = async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const releases = await WhatsNew.getLatestReleases(parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        releases,
      },
    });
  } catch (error) {
    console.error("Get latest releases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get latest releases",
      error: error.message,
    });
  }
};

/**
 * Get single release by version
 */
export const getRelease = async (req, res) => {
  try {
    const { version } = req.params;
    const userId = req.user?._id;

    const release = await WhatsNew.findOne({ version, published: true });

    if (!release) {
      return res.status(404).json({
        success: false,
        message: "Release not found",
      });
    }

    // Increment view count
    await release.incrementViewCount();

    // Track release view in onboarding if user is logged in
    if (userId) {
      await Onboarding.findOneAndUpdate(
        { user: userId },
        {
          $push: {
            whatsNewViewed: {
              version: release.version,
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
        release,
      },
    });
  } catch (error) {
    console.error("Get release error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get release",
      error: error.message,
    });
  }
};

/**
 * Get featured release
 */
export const getFeaturedRelease = async (req, res) => {
  try {
    const release = await WhatsNew.getFeaturedRelease();

    if (!release) {
      return res.status(404).json({
        success: false,
        message: "No featured release found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        release,
      },
    });
  } catch (error) {
    console.error("Get featured release error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get featured release",
      error: error.message,
    });
  }
};

/**
 * Get unread releases for user
 */
export const getUnreadReleases = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user's onboarding record
    const onboarding = await Onboarding.findOne({ user: userId });

    // Get all viewed versions
    const viewedVersions =
      onboarding?.whatsNewViewed?.map((item) => item.version) || [];

    // Get releases not viewed by user
    const unreadReleases = await WhatsNew.find({
      published: true,
      version: { $nin: viewedVersions },
    }).sort({ releaseDate: -1 });

    res.status(200).json({
      success: true,
      data: {
        releases: unreadReleases,
        count: unreadReleases.length,
      },
    });
  } catch (error) {
    console.error("Get unread releases error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread releases",
      error: error.message,
    });
  }
};

/**
 * Get releases since date
 */
export const getReleasesSince = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date parameter is required",
      });
    }

    const sinceDate = new Date(date);

    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    const releases = await WhatsNew.getReleasesSince(sinceDate);

    res.status(200).json({
      success: true,
      data: {
        releases,
        since: sinceDate,
        count: releases.length,
      },
    });
  } catch (error) {
    console.error("Get releases since error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get releases",
      error: error.message,
    });
  }
};

/**
 * Mark release as viewed
 */
export const markReleaseViewed = async (req, res) => {
  try {
    const { version } = req.params;
    const userId = req.user._id;

    const release = await WhatsNew.findOne({ version, published: true });

    if (!release) {
      return res.status(404).json({
        success: false,
        message: "Release not found",
      });
    }

    // Update onboarding record
    await Onboarding.findOneAndUpdate(
      { user: userId },
      {
        $addToSet: {
          whatsNewViewed: {
            version: release.version,
            viewedAt: new Date(),
          },
        },
        $set: { lastActiveAt: new Date() },
      },
      { upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Release marked as viewed",
    });
  } catch (error) {
    console.error("Mark release viewed error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark release as viewed",
      error: error.message,
    });
  }
};

/**
 * Get changelog (all releases)
 */
export const getChangelog = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const releases = await WhatsNew.find({ published: true })
      .sort({ releaseDate: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await WhatsNew.countDocuments({ published: true });

    res.status(200).json({
      success: true,
      data: {
        releases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get changelog error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get changelog",
      error: error.message,
    });
  }
};
