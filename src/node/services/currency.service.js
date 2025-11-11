import CacheService from "./cache.service.js";
import { logger } from "../utils/logger.js";
import { CurrencyConversionError } from "../utils/ai-planner-errors.js";

/**
 * Service for currency conversion
 */
class CurrencyService {
  constructor() {
    this.baseCurrency = "NGN";
    this.cacheTTL = 3600; // 1 hour

    // Fallback exchange rates (updated periodically)
    this.fallbackRates = {
      NGN: 1,
      USD: 0.0013, // 1 NGN = 0.0013 USD (approx 770 NGN/USD)
      EUR: 0.0012, // 1 NGN = 0.0012 EUR
      GBP: 0.001, // 1 NGN = 0.0010 GBP
    };
  }

  /**
   * Convert amount from one currency to another
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<number>} Converted amount
   */
  async convert(amount, fromCurrency, toCurrency) {
    try {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      const rate = await this.getExchangeRate(fromCurrency, toCurrency);
      const converted = amount * rate;

      logger.info("Currency converted", {
        amount,
        fromCurrency,
        toCurrency,
        rate,
        converted: Math.round(converted),
      });

      return Math.round(converted);
    } catch (error) {
      logger.error("Currency conversion failed:", {
        amount,
        fromCurrency,
        toCurrency,
        error: error.message,
      });
      throw new CurrencyConversionError(
        fromCurrency,
        toCurrency,
        error.message
      );
    }
  }

  /**
   * Get exchange rate between two currencies
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<number>} Exchange rate
   */
  async getExchangeRate(fromCurrency, toCurrency) {
    try {
      // Check cache first
      const cacheKey = `exchange-rate:${fromCurrency}:${toCurrency}`;
      const cached = await CacheService.get(cacheKey);

      if (cached) {
        logger.debug("Exchange rate retrieved from cache", {
          fromCurrency,
          toCurrency,
          rate: cached,
        });
        return cached;
      }

      // Try to fetch from API (if available)
      let rate;
      try {
        rate = await this.fetchExchangeRateFromAPI(fromCurrency, toCurrency);
      } catch (apiError) {
        logger.warn("API fetch failed, using fallback rates", {
          error: apiError.message,
        });
        rate = this.getFallbackRate(fromCurrency, toCurrency);
      }

      // Cache the rate
      await CacheService.set(cacheKey, rate, this.cacheTTL);

      return rate;
    } catch (error) {
      logger.error("Error getting exchange rate:", {
        fromCurrency,
        toCurrency,
        error: error.message,
      });

      // Use fallback as last resort
      return this.getFallbackRate(fromCurrency, toCurrency);
    }
  }

  /**
   * Fetch exchange rate from external API
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {Promise<number>} Exchange rate
   */
  async fetchExchangeRateFromAPI(fromCurrency, toCurrency) {
    // In production, integrate with a real exchange rate API
    // For now, use fallback rates
    // Example APIs: exchangerate-api.com, fixer.io, openexchangerates.org

    // Placeholder for API integration
    throw new Error("Exchange rate API not configured");
  }

  /**
   * Get fallback exchange rate
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency
   * @returns {number} Exchange rate
   */
  getFallbackRate(fromCurrency, toCurrency) {
    // Convert through NGN as base
    const fromRate = this.fallbackRates[fromCurrency];
    const toRate = this.fallbackRates[toCurrency];

    if (!fromRate || !toRate) {
      throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);
    }

    // Convert from -> NGN -> to
    const rate = toRate / fromRate;

    logger.debug("Using fallback exchange rate", {
      fromCurrency,
      toCurrency,
      rate,
    });

    return rate;
  }

  /**
   * Convert budget allocation to different currency
   * @param {Object} budgetAllocation - Budget allocation object
   * @param {string} toCurrency - Target currency
   * @returns {Promise<Object>} Converted budget allocation
   */
  async convertBudgetAllocation(budgetAllocation, toCurrency) {
    try {
      const fromCurrency = budgetAllocation.currency || this.baseCurrency;

      if (fromCurrency === toCurrency) {
        return budgetAllocation;
      }

      const rate = await this.getExchangeRate(fromCurrency, toCurrency);

      const converted = {
        ...budgetAllocation,
        currency: toCurrency,
        categories: budgetAllocation.categories.map((cat) => ({
          ...cat,
          allocatedAmount: Math.round(cat.allocatedAmount * rate),
          priceRange: {
            min: Math.round(cat.priceRange.min * rate),
            max: Math.round(cat.priceRange.max * rate),
            average: Math.round(cat.priceRange.average * rate),
            currency: toCurrency,
          },
        })),
        totalAllocated: Math.round(budgetAllocation.totalAllocated * rate),
        contingency: Math.round(budgetAllocation.contingency * rate),
      };

      logger.info("Budget allocation converted", {
        fromCurrency,
        toCurrency,
        originalTotal: budgetAllocation.totalAllocated,
        convertedTotal: converted.totalAllocated,
      });

      return converted;
    } catch (error) {
      logger.error("Error converting budget allocation:", {
        toCurrency,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get supported currencies
   * @returns {Array} Supported currency codes
   */
  getSupportedCurrencies() {
    return Object.keys(this.fallbackRates);
  }

  /**
   * Validate currency code
   * @param {string} currency - Currency code
   * @returns {boolean} Is valid
   */
  isValidCurrency(currency) {
    return this.getSupportedCurrencies().includes(currency.toUpperCase());
  }

  /**
   * Format amount with currency symbol
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted amount
   */
  formatAmount(amount, currency) {
    const symbols = {
      NGN: "₦",
      USD: "$",
      EUR: "€",
      GBP: "£",
    };

    const symbol = symbols[currency] || currency;
    const formatted = amount.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    return `${symbol}${formatted}`;
  }
}

export default new CurrencyService();
