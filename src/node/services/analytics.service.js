import Analytics from '../models/analytics.model.js';
import AppError from '../utils/AppError.js';

class AnalyticsService {
  async createAnalytics(analyticsData) {
    const analytics = new Analytics(analyticsData);
    await analytics.save();
    return analytics;
  }

  async getAnalyticsById(id) {
    const analytics = await Analytics.findById(id);
    if (!analytics) {
      throw new AppError('Analytics not found', 404);
    }
    return analytics;
  }

  async listAnalytics(filter = {}) {
    return await Analytics.find(filter);
  }
}

export default new AnalyticsService(); 