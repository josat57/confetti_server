import FeatureFlag from "../models/FeatureFlag.js";
import ABTest from "../models/ABTest.js";
import ABTestParticipant from "../models/ABTestParticipant.js";
import FeatureUsage from "../models/FeatureUsage.js";
import crypto from "crypto";

class FeatureFlagService {
  // ==================== FEATURE FLAGS ====================

  /**
   * Get all feature flags with filtering
   */
  async getFeatureFlags(filters = {}) {
    const query = {};

    if (filters.enabled !== undefined) {
      query.enabled = filters.enabled === "true" || filters.enabled === true;
    }

    if (filters.environment) {
      query.environment = { $in: [filters.environment, "all"] };
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { key: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [flags, total] = await Promise.all([
      FeatureFlag.find(query)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FeatureFlag.countDocuments(query),
    ]);

    return {
      flags,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get feature flag by ID
   */
  async getFeatureFlagById(flagId) {
    const flag = await FeatureFlag.findById(flagId)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!flag) {
      throw new Error("Feature flag not found");
    }

    // Get usage statistics
    const usageStats = await this.getFeatureFlagUsageStats(flag.key);

    return {
      ...flag,
      usageStats,
    };
  }

  /**
   * Create new feature flag
   */
  async createFeatureFlag(data, adminId) {
    // Generate key from name if not provided
    if (!data.key) {
      data.key = data.name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
    }

    // Check if key already exists
    const existing = await FeatureFlag.findOne({ key: data.key });
    if (existing) {
      throw new Error("Feature flag with this key already exists");
    }

    const flag = new FeatureFlag({
      ...data,
      createdBy: adminId,
    });

    await flag.save();

    return flag;
  }

  /**
   * Update feature flag
   */
  async updateFeatureFlag(flagId, updates, adminId) {
    const flag = await FeatureFlag.findById(flagId);
    if (!flag) {
      throw new Error("Feature flag not found");
    }

    // Don't allow key changes
    delete updates.key;

    Object.assign(flag, updates);
    flag.updatedBy = adminId;

    await flag.save();

    return flag;
  }

  /**
   * Delete feature flag
   */
  async deleteFeatureFlag(flagId) {
    const flag = await FeatureFlag.findById(flagId);
    if (!flag) {
      throw new Error("Feature flag not found");
    }

    await flag.deleteOne();

    return { message: "Feature flag deleted successfully" };
  }

  /**
   * Toggle feature flag
   */
  async toggleFeatureFlag(flagId, adminId) {
    const flag = await FeatureFlag.findById(flagId);
    if (!flag) {
      throw new Error("Feature flag not found");
    }

    flag.enabled = !flag.enabled;
    flag.updatedBy = adminId;

    await flag.save();

    return flag;
  }

  /**
   * Check if feature is enabled for user
   */
  async isFeatureEnabled(featureKey, userId, userType, subscriptionTier) {
    const flag = await FeatureFlag.findOne({ key: featureKey });

    if (!flag) {
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check date range
    const now = new Date();
    if (flag.startDate && now < flag.startDate) {
      return false;
    }
    if (flag.endDate && now > flag.endDate) {
      return false;
    }

    // Check target audience
    const audience = flag.targetAudience;

    // Check user types
    if (audience.userTypes && audience.userTypes.length > 0) {
      if (
        !audience.userTypes.includes("all") &&
        !audience.userTypes.includes(userType)
      ) {
        return false;
      }
    }

    // Check specific user IDs
    if (audience.userIds && audience.userIds.length > 0) {
      if (!audience.userIds.some((id) => id.toString() === userId.toString())) {
        return false;
      }
    }

    // Check subscription tiers
    if (audience.subscriptionTiers && audience.subscriptionTiers.length > 0) {
      if (!audience.subscriptionTiers.includes(subscriptionTier)) {
        return false;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = crypto
        .createHash("md5")
        .update(`${featureKey}:${userId}`)
        .digest("hex");
      const hashValue = parseInt(hash.substring(0, 8), 16);
      const percentage = (hashValue % 100) + 1;

      if (percentage > flag.rolloutPercentage) {
        return false;
      }
    }

    // Log usage
    await this.logFeatureUsage(featureKey, userId, userType, true);

    return true;
  }

  /**
   * Log feature usage
   */
  async logFeatureUsage(
    featureKey,
    userId,
    userType,
    enabled,
    variant = null,
    metadata = {}
  ) {
    const usage = new FeatureUsage({
      featureKey,
      userId,
      userType,
      enabled,
      variant,
      metadata,
    });

    await usage.save();
  }

  /**
   * Get feature flag usage statistics
   */
  async getFeatureFlagUsageStats(featureKey, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await FeatureUsage.aggregate([
      {
        $match: {
          featureKey,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: 1 },
          uniqueUsers: { $addToSet: "$userId" },
          enabledCount: {
            $sum: { $cond: ["$enabled", 1, 0] },
          },
          disabledCount: {
            $sum: { $cond: ["$enabled", 0, 1] },
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        totalUsage: 0,
        uniqueUsers: 0,
        enabledCount: 0,
        disabledCount: 0,
        enabledPercentage: 0,
      };
    }

    const result = stats[0];
    return {
      totalUsage: result.totalUsage,
      uniqueUsers: result.uniqueUsers.length,
      enabledCount: result.enabledCount,
      disabledCount: result.disabledCount,
      enabledPercentage: (
        (result.enabledCount / result.totalUsage) *
        100
      ).toFixed(2),
    };
  }

  // ==================== A/B TESTS ====================

  /**
   * Get all A/B tests
   */
  async getABTests(filters = {}) {
    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { key: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const [tests, total] = await Promise.all([
      ABTest.find(query)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ABTest.countDocuments(query),
    ]);

    return {
      tests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get A/B test by ID
   */
  async getABTestById(testId) {
    const test = await ABTest.findById(testId)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!test) {
      throw new Error("A/B test not found");
    }

    // Get detailed results
    const detailedResults = await this.calculateABTestResults(test.key);

    return {
      ...test,
      detailedResults,
    };
  }

  /**
   * Create new A/B test
   */
  async createABTest(data, adminId) {
    // Generate key from name if not provided
    if (!data.key) {
      data.key = data.name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
    }

    // Check if key already exists
    const existing = await ABTest.findOne({ key: data.key });
    if (existing) {
      throw new Error("A/B test with this key already exists");
    }

    // Validate variant weights sum to 100
    const totalWeight = data.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error("Variant weights must sum to 100");
    }

    const test = new ABTest({
      ...data,
      createdBy: adminId,
    });

    await test.save();

    return test;
  }

  /**
   * Update A/B test
   */
  async updateABTest(testId, updates, adminId) {
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new Error("A/B test not found");
    }

    // Don't allow updates to running tests
    if (test.status === "running") {
      throw new Error("Cannot update a running test. Pause it first.");
    }

    // Don't allow key changes
    delete updates.key;

    // Validate variant weights if provided
    if (updates.variants) {
      const totalWeight = updates.variants.reduce(
        (sum, v) => sum + v.weight,
        0
      );
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new Error("Variant weights must sum to 100");
      }
    }

    Object.assign(test, updates);
    test.updatedBy = adminId;

    await test.save();

    return test;
  }

  /**
   * Delete A/B test
   */
  async deleteABTest(testId) {
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new Error("A/B test not found");
    }

    // Don't allow deletion of running tests
    if (test.status === "running") {
      throw new Error("Cannot delete a running test. Stop it first.");
    }

    await test.deleteOne();

    // Clean up participants
    await ABTestParticipant.deleteMany({ testKey: test.key });

    return { message: "A/B test deleted successfully" };
  }

  /**
   * Start A/B test
   */
  async startABTest(testId, adminId) {
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new Error("A/B test not found");
    }

    if (test.status === "running") {
      throw new Error("Test is already running");
    }

    test.status = "running";
    test.updatedBy = adminId;

    await test.save();

    return test;
  }

  /**
   * Pause A/B test
   */
  async pauseABTest(testId, adminId) {
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new Error("A/B test not found");
    }

    test.status = "paused";
    test.updatedBy = adminId;

    await test.save();

    return test;
  }

  /**
   * Complete A/B test
   */
  async completeABTest(testId, adminId) {
    const test = await ABTest.findById(testId);
    if (!test) {
      throw new Error("A/B test not found");
    }

    test.status = "completed";
    test.updatedBy = adminId;

    // Calculate final results
    const results = await this.calculateABTestResults(test.key);
    test.results = results;

    await test.save();

    return test;
  }

  /**
   * Assign user to A/B test variant
   */
  async assignVariant(testKey, userId) {
    const test = await ABTest.findOne({ key: testKey, status: "running" });

    if (!test) {
      return null;
    }

    // Check if user already assigned
    let participant = await ABTestParticipant.findOne({ testKey, userId });

    if (participant) {
      return participant.variantKey;
    }

    // Assign variant based on weights
    const hash = crypto
      .createHash("md5")
      .update(`${testKey}:${userId}`)
      .digest("hex");
    const hashValue = parseInt(hash.substring(0, 8), 16);
    const percentage = hashValue % 100;

    let cumulativeWeight = 0;
    let assignedVariant = test.variants[0].key;

    for (const variant of test.variants) {
      cumulativeWeight += variant.weight;
      if (percentage < cumulativeWeight) {
        assignedVariant = variant.key;
        break;
      }
    }

    // Create participant record
    participant = new ABTestParticipant({
      testKey,
      userId,
      variantKey: assignedVariant,
    });

    await participant.save();

    // Update test participant count
    await ABTest.updateOne(
      { key: testKey },
      {
        $inc: {
          "results.totalParticipants": 1,
          "sampleSize.current": 1,
        },
      }
    );

    return assignedVariant;
  }

  /**
   * Track A/B test conversion
   */
  async trackConversion(testKey, userId, eventData = {}) {
    const participant = await ABTestParticipant.findOne({ testKey, userId });

    if (!participant) {
      return;
    }

    if (!participant.converted) {
      participant.converted = true;
      participant.convertedAt = new Date();
    }

    participant.events.push({
      eventType: "conversion",
      eventData,
      timestamp: new Date(),
    });

    await participant.save();
  }

  /**
   * Track A/B test event
   */
  async trackEvent(testKey, userId, eventType, eventData = {}) {
    const participant = await ABTestParticipant.findOne({ testKey, userId });

    if (!participant) {
      return;
    }

    participant.events.push({
      eventType,
      eventData,
      timestamp: new Date(),
    });

    await participant.save();
  }

  /**
   * Calculate A/B test results
   */
  async calculateABTestResults(testKey) {
    const test = await ABTest.findOne({ key: testKey });

    if (!test) {
      throw new Error("A/B test not found");
    }

    const variantResults = [];

    for (const variant of test.variants) {
      const participants = await ABTestParticipant.countDocuments({
        testKey,
        variantKey: variant.key,
      });

      const conversions = await ABTestParticipant.countDocuments({
        testKey,
        variantKey: variant.key,
        converted: true,
      });

      const conversionRate =
        participants > 0 ? (conversions / participants) * 100 : 0;

      variantResults.push({
        variantKey: variant.key,
        variantName: variant.name,
        participants,
        conversions,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
      });
    }

    // Determine winner (simple approach - highest conversion rate)
    const winner = variantResults.reduce((prev, current) =>
      current.conversionRate > prev.conversionRate ? current : prev
    );

    return {
      variantResults,
      winner: {
        variantKey: winner.variantKey,
        variantName: winner.variantName,
        conversionRate: winner.conversionRate,
      },
    };
  }

  /**
   * Get A/B test analytics
   */
  async getABTestAnalytics(testKey) {
    const test = await ABTest.findOne({ key: testKey });

    if (!test) {
      throw new Error("A/B test not found");
    }

    const results = await this.calculateABTestResults(testKey);

    // Get daily breakdown
    const dailyStats = await ABTestParticipant.aggregate([
      {
        $match: { testKey },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$assignedAt" },
            },
            variantKey: "$variantKey",
          },
          participants: { $sum: 1 },
          conversions: {
            $sum: { $cond: ["$converted", 1, 0] },
          },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    return {
      test,
      results,
      dailyStats,
    };
  }
}

export default new FeatureFlagService();
