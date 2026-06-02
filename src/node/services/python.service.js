import axios from "axios";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import {
  AIServiceUnavailableError,
  ProcessingTimeoutError,
} from "../utils/ai-planner-errors.js";

class PythonService {
  constructor() {
    this.pythonApiUrl = process.env.PYTHON_API_URL || "http://localhost:5600";
    this.aiTimeout = 90000; // 90 seconds — real AI calls take longer
    this.retryAttempts = 2;  // Fewer retries to avoid excessive latency
    this.apiKey = process.env.PYTHON_API_KEY;

    // AI model configurations — updated to current model names (Fix 5)
    this.models = {
      gpt4: {
        endpoint: "/ai/gpt4",
        maxTokens: 4000,
        temperature: 0.4,
        modelName: "gpt-4o",
      },
      claude: {
        endpoint: "/ai/claude",
        maxTokens: 3000,
        temperature: 0.4,
        modelName: "claude-sonnet-4-6",
      },
      gemini: {
        endpoint: "/ai/gemini",
        maxTokens: 2000,
        temperature: 0.5,
        modelName: "gemini-2.0-flash",
      },
      local: {
        endpoint: "/ai/local",
        maxTokens: 1000,
        temperature: 0.5,
        modelName: "local-scoring",
      },
    };
  }

  async optimizeBudget(budget, preferences) {
    try {
      // Extract numeric amount from budget object if needed
      const budgetAmount = typeof budget === "object" ? budget.amount : budget;

      const response = await axios.post(
        `${this.pythonApiUrl}/optimize-budget`,
        {
          budget: budgetAmount,
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
   * Analyze event plan using enhanced Python AI services
   * @param {Object} eventData - Complete event data and vendors
   * @returns {Promise<Object>} AI analysis result
   */
  async analyzeEventPlan(eventData) {
    try {
      logger.info(
        "Calling enhanced Python AI service for comprehensive analysis",
        {
          eventType: eventData.event_data?.eventType,
          vendorCount: eventData.vendors?.length || 0,
          budget: eventData.event_data?.budget,
          vendorId: eventData.vendor_id,
          planLevel: eventData.plan_level,
        }
      );

      // Prepare enhanced analysis data
      const analysisData = {
        ...eventData,
        analysis_type: "comprehensive",
        use_multiple_models: true,
        include_learning: true,
      };

      // Try the new comprehensive analysis endpoint first
      try {
        const response = await this.makeRequest(
          "/ai/comprehensive-analysis",
          analysisData
        );

        if (response.status === "success") {
          logger.info(
            "Python comprehensive AI analysis completed successfully",
            {
              confidence: response.analysis.overall_confidence,
              modelsUsed: response.analysis.metadata?.models_used,
              processingTime: response.analysis.metadata?.processing_time_ms,
            }
          );
          return response.analysis;
        }
      } catch (comprehensiveError) {
        logger.warn(
          "Comprehensive analysis failed, falling back to legacy endpoint",
          {
            error: comprehensiveError.message,
          }
        );

        // Fallback to legacy endpoint
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

        logger.info("Python AI analysis completed successfully (legacy)", {
          processingTime: response.headers["x-processing-time"],
          feasibilityScore:
            response.data.budget_optimization?.feasibility_score,
        });

        return response.data;
      }
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
   * Query specific AI model with enhanced capabilities
   */
  async queryAIModel(params) {
    const { model, prompt, temperature, maxTokens, context } = params;

    try {
      const modelConfig = this.models[model] || this.models.local;

      const requestData = {
        prompt,
        temperature: temperature || modelConfig.temperature,
        max_tokens: maxTokens || modelConfig.maxTokens,
        context: context || {},
        model_name: model,
      };

      logger.info(`Querying AI model: ${model}`, {
        promptLength: prompt.length,
        temperature: requestData.temperature,
      });

      const response = await this.makeRequest(
        modelConfig.endpoint,
        requestData
      );

      if (response.status === "success") {
        return {
          response: response.response,
          model: model,
          confidence: response.confidence || 0.8,
          processingTime: response.processing_time,
          tokensUsed: response.tokens_used,
        };
      } else {
        throw new Error(response.message || "AI model query failed");
      }
    } catch (error) {
      logger.error(`AI model ${model} query failed:`, error);

      // Try fallback to local model if external model fails
      if (model !== "local") {
        logger.info(`Falling back to local model for: ${model}`);
        return this.queryAIModel({ ...params, model: "local" });
      }

      throw new AppError(`AI model query failed: ${error.message}`, 500);
    }
  }

  /**
   * Generate images using AI models
   */
  async generateImage(params) {
    const { prompt, model, style, aspectRatio, quality } = params;

    try {
      const requestData = {
        prompt,
        model: model || "stable-diffusion",
        style: style || "photorealistic",
        aspect_ratio: aspectRatio || "16:9",
        quality: quality || "high",
        safety_check: true,
      };

      logger.info("Generating image with AI", {
        model: requestData.model,
        style: requestData.style,
      });

      const response = await this.makeRequest(
        "/ai/generate-image",
        requestData
      );

      if (response.status === "success") {
        return {
          imageUrl: response.image_url,
          detectedStyle: response.detected_style,
          confidence: response.confidence,
          processingTime: response.processing_time,
        };
      } else {
        throw new Error(response.message || "Image generation failed");
      }
    } catch (error) {
      logger.error("AI image generation failed:", error);
      throw new AppError(`Image generation failed: ${error.message}`, 500);
    }
  }

  /**
   * Analyze images using AI vision models
   */
  async analyzeImage(params) {
    const { imageUrl, prompt, model, analysisType } = params;

    try {
      const requestData = {
        image_url: imageUrl,
        prompt: prompt,
        model: model || "gpt-4o",
        analysis_type: analysisType || "general",
        detailed_analysis: true,
      };

      logger.info("Analyzing image with AI vision", {
        model: requestData.model,
        analysisType: requestData.analysis_type,
      });

      const response = await this.makeRequest("/ai/analyze-image", requestData);

      if (response.status === "success") {
        return {
          analysis: response.analysis,
          confidence: response.confidence,
          detectedElements: response.detected_elements,
          recommendations: response.recommendations,
          overallScore: response.overall_score,
        };
      } else {
        throw new Error(response.message || "Image analysis failed");
      }
    } catch (error) {
      logger.error("AI image analysis failed:", error);
      throw new AppError(`Image analysis failed: ${error.message}`, 500);
    }
  }

  /**
   * Train vendor-specific AI model
   */
  async trainVendorModel(params) {
    const { vendorId, trainingData, modelType } = params;

    try {
      const requestData = {
        vendor_id: vendorId,
        training_data: trainingData,
        model_type: modelType || "personalized",
        training_mode: "incremental",
        validation_split: 0.2,
      };

      logger.info("Training vendor-specific AI model", {
        vendorId,
        dataPoints: trainingData.length || 0,
        modelType: requestData.model_type,
      });

      const response = await this.makeRequest(
        "/ai/train-vendor-model",
        requestData
      );

      if (response.status === "success") {
        return {
          modelId: response.model_id,
          trainingMetrics: response.training_metrics,
          accuracy: response.accuracy,
          trainingTime: response.training_time,
          modelVersion: response.model_version,
        };
      } else {
        throw new Error(response.message || "Model training failed");
      }
    } catch (error) {
      logger.error("AI model training failed:", error);
      throw new AppError(`Model training failed: ${error.message}`, 500);
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(vendorId) {
    try {
      const response = await this.makeRequest(
        `/ai/model-metrics/${vendorId}`,
        {},
        "GET"
      );

      if (response.status === "success") {
        return {
          accuracy: response.metrics.accuracy,
          precision: response.metrics.precision,
          recall: response.metrics.recall,
          f1Score: response.metrics.f1_score,
          trainingHistory: response.metrics.training_history,
          lastUpdated: response.metrics.last_updated,
          totalPredictions: response.metrics.total_predictions,
          successRate: response.metrics.success_rate,
        };
      } else {
        throw new Error(response.message || "Failed to get model metrics");
      }
    } catch (error) {
      logger.error("Failed to get model metrics:", error);
      throw new AppError(`Failed to get model metrics: ${error.message}`, 500);
    }
  }

  /**
   * Generate market insights using AI
   */
  async generateMarketInsights(params) {
    const { location, eventType, timeframe, analysisDepth } = params;

    try {
      const requestData = {
        location,
        event_type: eventType,
        timeframe: timeframe || "monthly",
        analysis_depth: analysisDepth || "comprehensive",
        include_predictions: true,
        include_trends: true,
      };

      logger.info("Generating market insights with AI", {
        location: location.city,
        eventType,
        timeframe,
      });

      const response = await this.makeRequest(
        "/ai/market-insights",
        requestData
      );

      if (response.status === "success") {
        return {
          insights: response.insights,
          trends: response.trends,
          predictions: response.predictions,
          confidence: response.confidence,
          dataFreshness: response.data_freshness,
          generatedAt: new Date(),
        };
      } else {
        throw new Error(
          response.message || "Market insights generation failed"
        );
      }
    } catch (error) {
      logger.error("Market insights generation failed:", error);
      return this.getFallbackMarketInsights(params);
    }
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  async makeRequest(endpoint, data, method = "POST") {
    let lastError;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const config = {
          method,
          url: `${this.pythonApiUrl}${endpoint}`,
          timeout: this.aiTimeout,
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
          },
        };

        if (method === "POST" && data) {
          config.data = data;
        }

        const response = await axios(config);
        return response.data;
      } catch (error) {
        lastError = error;
        logger.warn(`Request attempt ${attempt} failed:`, {
          endpoint,
          error: error.message,
          status: error.response?.status,
        });

        if (attempt < this.retryAttempts) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Health check for Python AI services with enhanced metrics
   */
  async checkAIHealth() {
    try {
      const response = await axios.get(`${this.pythonApiUrl}/health/ai`, {
        timeout: 10000,
      });

      return {
        status: "healthy",
        pythonService: {
          available: true,
          responseTime: response.data.response_time || 0,
          version: response.data.version || "unknown",
          uptime: response.data.uptime || 0,
        },
        aiModels: {
          gpt4: response.data.models?.gpt4 || { status: "unknown" },
          claude: response.data.models?.claude || { status: "unknown" },
          gemini: response.data.models?.gemini || { status: "unknown" },
          local: response.data.models?.local || { status: "unknown" },
        },
        capabilities: {
          textGeneration: response.data.capabilities?.text_generation || false,
          imageGeneration:
            response.data.capabilities?.image_generation || false,
          imageAnalysis: response.data.capabilities?.image_analysis || false,
          modelTraining: response.data.capabilities?.model_training || false,
        },
        performance: {
          averageResponseTime:
            response.data.performance?.avg_response_time || 0,
          requestsPerMinute:
            response.data.performance?.requests_per_minute || 0,
          errorRate: response.data.performance?.error_rate || 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("Python AI health check failed:", error.message);
      return {
        status: "unhealthy",
        pythonService: {
          available: false,
          error: error.message,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Stream a plan generation from the Python SSE endpoint (Fix 6).
   * Calls the Flask /ai/stream-plan endpoint and pipes chunks to the Express response.
   *
   * @param {Object} payload   - { event_data, vendors, vendor_statistics, user_context }
   * @param {Object} res       - Express response object (must not be ended yet)
   */
  async streamPlan(payload, res) {
    const url = `${this.pythonApiUrl}/ai/stream-plan`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      const response = await axios.post(url, payload, {
        responseType: "stream",
        timeout: this.aiTimeout,
        headers: { "Content-Type": "application/json" },
      });

      response.data.on("data", (chunk) => {
        res.write(chunk);
      });

      await new Promise((resolve, reject) => {
        response.data.on("end", resolve);
        response.data.on("error", reject);
      });
    } catch (error) {
      logger.error("streamPlan failed:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message, phase: "error" })}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * Record user feedback on a generated plan — feeds the learning loop.
   */
  async recordFeedback({ userId, userType, rating, comments, successful }) {
    try {
      const response = await this.makeRequest("/ai/feedback", {
        user_id: userId,
        user_type: userType,
        rating,
        comments,
        successful,
      });
      return response;
    } catch (error) {
      logger.error("recordFeedback failed:", error.message);
      return { recorded: false, error: error.message };
    }
  }

  /**
   * Get the learning status / metrics for a user.
   */
  async getUserLearningStatus(userId, userType) {
    try {
      return await this.makeRequest(
        `/ai/model-metrics/${userType}/${userId}`,
        {},
        "GET"
      );
    } catch (error) {
      logger.error("getUserLearningStatus failed:", error.message);
      return { exists: false };
    }
  }

  getFallbackMarketInsights() {
    return {
      insights: { demandLevel: "moderate", competitionLevel: "medium", pricingTrend: "stable" },
      trends: { seasonal: "spring_peak", popular_themes: ["modern", "rustic", "elegant"] },
      confidence: 0.6,
      dataSource: "fallback",
    };
  }
}

export default new PythonService();
