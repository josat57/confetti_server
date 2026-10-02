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

    // Static last-resort rates (approximate, 1 NGN = x). Used only when the live
    // API and the last successfully fetched rates are both unavailable.
    this.fallbackRates = {
      NGN: 1,
      USD: 0.00065, // ≈ 1,540 NGN/USD
      EUR: 0.00057, // ≈ 1,750 NGN/EUR
      GBP: 0.00049, // ≈ 2,050 NGN/GBP
    };
    // Last live rate tables per base currency: { [base]: { rates, fetchedAt } }
    this.lastKnownRates = new Map();
    this.apiTimeoutMs = 8000;
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
        const lastKnown = this.getLastKnownRate(fromCurrency, toCurrency);
        logger.warn(
          lastKnown ? "API fetch failed, using last known live rate" : "API fetch failed, using static fallback rates",
          { error: apiError.message, fromCurrency, toCurrency }
        );
        if (lastKnown) {
          // Short cache so we retry the API soon
          await CacheService.set(cacheKey, lastKnown, 300);
          return lastKnown;
        }
        rate = this.getFallbackRate(fromCurrency, toCurrency);
        await CacheService.set(cacheKey, rate, 300);
        return rate;
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
    const table = await this.fetchRateTable(fromCurrency);
    const rate = table[toCurrency];
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`No live rate for ${fromCurrency}/${toCurrency}`);
    }
    return rate;
  }

  /**
   * Live rate table for a base currency (1 base = rates[X]).
   * Provider: exchangerate-api.com with EXCHANGE_RATE_API_KEY, otherwise its
   * free keyless endpoint (open.er-api.com). Set EXCHANGE_RATES_DISABLED=true to
   * use static rates only. Tables are cached for cacheTTL.
   */
  async fetchRateTable(base) {
    if (process.env.EXCHANGE_RATES_DISABLED === "true") {
      throw new Error("Live exchange rates disabled");
    }
    const code = String(base || "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Invalid currency code: ${base}`);

    // In-process copy first (works even when Redis is unavailable)
    const memo = this.lastKnownRates.get(code);
    if (memo && Date.now() - memo.fetchedAt.getTime() < this.cacheTTL * 1000) return memo.rates;

    const cacheKey = `exchange-rates:${code}`;
    const cached = await CacheService.get(cacheKey);
    if (cached && typeof cached === "object") return cached;

    const { default: axios } = await import("axios");
    const key = process.env.EXCHANGE_RATE_API_KEY;
    const url = key
      ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/${code}`
      : `https://open.er-api.com/v6/latest/${code}`;
    const res = await axios.get(url, { timeout: this.apiTimeoutMs });
    const rates = res.data?.conversion_rates || res.data?.rates;
    if (res.data?.result !== "success" || !rates || typeof rates !== "object") {
      throw new Error(`Exchange rate API error: ${res.data?.["error-type"] || "unexpected response"}`);
    }

    this.lastKnownRates.set(code, { rates, fetchedAt: new Date() });
    await CacheService.set(cacheKey, rates, this.cacheTTL);
    return rates;
  }

  /** Most recent live rate fetched this process (used when the API is down). */
  getLastKnownRate(fromCurrency, toCurrency) {
    const direct = this.lastKnownRates.get(fromCurrency)?.rates?.[toCurrency];
    if (Number.isFinite(direct) && direct > 0) return direct;
    const inverse = this.lastKnownRates.get(toCurrency)?.rates?.[fromCurrency];
    if (Number.isFinite(inverse) && inverse > 0) return 1 / inverse;
    return null;
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
