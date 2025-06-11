import axios from 'axios';
import { logger } from '../utils/logger.js';

class PythonService {
    constructor() {
        this.pythonApiUrl = process.env.PYTHON_API_URL || 'http://python-api:5600';
    }

    async optimizeBudget(budget, preferences) {
        try {
            const response = await axios.post(`${this.pythonApiUrl}/optimize-budget`, {
                budget,
                preferences
            });
            return response.data;
        } catch (error) {
            logger.error('Error calling budget optimizer:', error);
            throw error;
        }
    }

    async predictPrices(items) {
        try {
            const response = await axios.post(`${this.pythonApiUrl}/predict-prices`, {
                items
            });
            return response.data;
        } catch (error) {
            logger.error('Error calling price predictor:', error);
            throw error;
        }
    }

    async matchVendors(requirements) {
        try {
            const response = await axios.post(`${this.pythonApiUrl}/match-vendors`, {
                requirements
            });
            return response.data;
        } catch (error) {
            logger.error('Error calling vendor matcher:', error);
            throw error;
        }
    }

    async getRecommendations(userPreferences) {
        try {
            const response = await axios.post(`${this.pythonApiUrl}/get-recommendations`, {
                preferences: userPreferences
            });
            return response.data;
        } catch (error) {
            logger.error('Error calling recommendation engine:', error);
            throw error;
        }
    }

    async simulateEvent(eventPlan) {
        try {
            const response = await axios.post(`${this.pythonApiUrl}/simulate-event`, {
                plan: eventPlan
            });
            return response.data;
        } catch (error) {
            logger.error('Error calling event simulator:', error);
            throw error;
        }
    }

    async analyzeText(text) {
        try {
            const response = await axios.post(`${this.pythonApiUrl}/analyze-text`, {
                text
            });
            return response.data;
        } catch (error) {
            logger.error('Error calling NLP service:', error);
            throw error;
        }
    }
}

export default new PythonService(); 