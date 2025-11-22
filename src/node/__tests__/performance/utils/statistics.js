/**
 * Statistical Utilities for Performance Analysis
 *
 * This module provides statistical functions for analyzing performance data.
 */

/**
 * Calculate mean (average) of an array of numbers
 * @param {number[]} values - Array of numbers
 * @returns {number} Mean value
 */
export function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate median of an array of numbers
 * @param {number[]} values - Array of numbers
 * @returns {number} Median value
 */
export function median(values) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate standard deviation
 * @param {number[]} values - Array of numbers
 * @returns {number} Standard deviation
 */
export function standardDeviation(values) {
  if (values.length === 0) return 0;

  const avg = mean(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);

  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate percentile
 * @param {number[]} values - Array of numbers
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
export function percentile(values, percentile) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);

  if (Number.isInteger(index)) {
    return sorted[index];
  }

  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate R-squared (coefficient of determination)
 * @param {number[]} actual - Actual values
 * @param {number[]} predicted - Predicted values
 * @returns {number} R-squared value (0-1)
 */
export function rSquared(actual, predicted) {
  if (actual.length !== predicted.length || actual.length === 0) {
    return 0;
  }

  const actualMean = mean(actual);

  const totalSumSquares = actual.reduce(
    (sum, val) => sum + Math.pow(val - actualMean, 2),
    0
  );

  const residualSumSquares = actual.reduce(
    (sum, val, i) => sum + Math.pow(val - predicted[i], 2),
    0
  );

  if (totalSumSquares === 0) return 0;

  return 1 - residualSumSquares / totalSumSquares;
}

/**
 * Perform linear regression
 * @param {number[]} x - Independent variable values
 * @param {number[]} y - Dependent variable values
 * @returns {Object} Regression result with slope, intercept, and r-squared
 */
export function linearRegression(x, y) {
  if (x.length !== y.length || x.length === 0) {
    throw new Error("x and y must have the same non-zero length");
  }

  const n = x.length;
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const predicted = x.map((val) => slope * val + intercept);
  const r2 = rSquared(y, predicted);

  return {
    slope,
    intercept,
    rSquared: r2,
    predict: (xVal) => slope * xVal + intercept,
  };
}

/**
 * Calculate growth rate between two values
 * @param {number} initial - Initial value
 * @param {number} final - Final value
 * @returns {number} Growth rate
 */
export function growthRate(initial, final) {
  if (initial === 0) return final === 0 ? 0 : Infinity;
  return (final - initial) / initial;
}

export default {
  mean,
  median,
  standardDeviation,
  percentile,
  rSquared,
  linearRegression,
  growthRate,
};
