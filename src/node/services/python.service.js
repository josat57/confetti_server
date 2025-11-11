import axios from "axios";
import { logger } from "../utils/logger.js";
import {
  AIServiceUnavailableError,
  ProcessingTimeoutError,
} from "../utils/ai-planner-errors.js";

class PythonService {
  constructor() {
    this.pythonApiUrl = process.env.PYTHON_API_URL || "http://python-api:5600";
    this.aiTimeout = 30000; // 30 seconds for AI processing
  }

  async optimizeBudget(budget, preferences) {
    try {
      const response = await axios.post(
        `${this.pythonApiUrl}/optimize-budget`,
        {
          budget,
          preferences,
        }
      );
      return response.data;
    } catch (error) {
      logger.error("Error calling budget optimizer:", error);
      throw error;
    }
  }

  async predictPrices(items) {
    try {
      const response = await axios.post(`${this.pythonApiUrl}/predict-prices`, {
        items,
      });
      return response.data;
    } catch (error) {
      logger.error("Error calling price predictor:", error);
      throw error;
    }
  }

  async matchVendors(requirements) {
    try {
      const response = await axios.post(`${this.pythonApiUrl}/match-vendors`, {
        requirements,
      });
      return response.data;
    } catch (error) {
      logger.error("Error calling vendor matcher:", error);
      throw error;
    }
  }

  async getRecommendations(userPreferences) {
    try {
      const response = await axios.post(
        `${this.pythonApiUrl}/get-recommendations`,
        {
          preferences: userPreferences,
        }
      );
      return response.data;
    } catch (error) {
      logger.error("Error calling recommendation engine:", error);
      throw error;
    }
  }

  async simulateEvent(eventPlan) {
    try {
      const response = await axios.post(`${this.pythonApiUrl}/simulate-event`, {
        plan: eventPlan,
      });
      return response.data;
    } catch (error) {
      logger.error("Error calling event simulator:", error);
      throw error;
    }
  }

  async analyzeText(text) {
    try {
      const response = await axios.post(`${this.pythonApiUrl}/analyze-text`, {
        text,
      });
      return response.data;
    } catch (error) {
      logger.error("Error calling NLP service:", error);
      throw error;
    }
  }

  /**
   * Analyze event plan using Python AI services
   * @param {Object} eventData - Complete event data and vendors
   * @returns {Promise<Object>} AI analysis result
   */
  async analyzeEventPlan(eventData) {
    try {
      logger.info("Calling Python AI service for complete event analysis", {
        eventType: eventData.event_data?.eventType,
        vendorCount: eventData.vendors?.length || 0,
        budget: eventData.event_data?.budget,
      });

      const response = await axios.post(
        `${this.pythonApiUrl}/analyze-event-plan`,
        eventData,
        {
          timeout: this.aiTimeout,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      logger.info("Python AI analysis completed successfully", {
        processingTime: response.headers["x-processing-time"],
        feasibilityScore: response.data.budget_optimization?.feasibility_score,
      });

      return response.data;
    } catch (error) {
      if (error.code === "ECONNABORTED") {
        logger.error("Python AI service timeout");
        throw new ProcessingTimeoutError(
          "AI analysis is taking too long, please try again"
        );
      }

      if (error.response?.status === 503) {
        logger.error("Python AI service unavailable");
        throw new AIServiceUnavailableError();
      }

      logger.error("Error calling Python AI event analyzer:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      throw new AIServiceUnavailableError("Failed to analyze event plan");
    }
  }

  /**
   * Health check for Python AI services
   * @returns {Promise<Object>} Health status
   */
  async checkAIHealth() {
    try {
      const response = await axios.get(`${this.pythonApiUrl}/health/ai`, {
        timeout: 5000,
      });

      return {
        status: "healthy",
        services: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Python AI health check failed:", error.message);
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default new PythonService();
