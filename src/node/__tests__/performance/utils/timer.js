/**
 * Timer Utilities for Performance Measurement
 *
 * This module provides high-precision timing utilities for performance testing.
 */

/**
 * High-precision timer using process.hrtime.bigint()
 */
export class Timer {
  constructor() {
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Start the timer
   */
  start() {
    this.startTime = process.hrtime.bigint();
    this.endTime = null;
  }

  /**
   * Stop the timer
   * @returns {number} Elapsed time in milliseconds
   */
  stop() {
    if (this.startTime === null) {
      throw new Error("Timer not started");
    }

    this.endTime = process.hrtime.bigint();
    return this.elapsed();
  }

  /**
   * Get elapsed time without stopping the timer
   * @returns {number} Elapsed time in milliseconds
   */
  elapsed() {
    if (this.startTime === null) {
      throw new Error("Timer not started");
    }

    const end = this.endTime || process.hrtime.bigint();
    const diff = end - this.startTime;

    // Convert nanoseconds to milliseconds
    return Number(diff) / 1_000_000;
  }

  /**
   * Reset the timer
   */
  reset() {
    this.startTime = null;
    this.endTime = null;
  }
}

/**
 * Measure execution time of an async function
 * @param {Function} fn - Async function to measure
 * @returns {Promise<Object>} Result with duration and return value
 */
export async function measureAsync(fn) {
  const timer = new Timer();
  timer.start();

  try {
    const result = await fn();
    const duration = timer.stop();

    return {
      duration,
      result,
      error: null,
    };
  } catch (error) {
    const duration = timer.stop();

    return {
      duration,
      result: null,
      error,
    };
  }
}

/**
 * Measure execution time of a synchronous function
 * @param {Function} fn - Function to measure
 * @returns {Object} Result with duration and return value
 */
export function measureSync(fn) {
  const timer = new Timer();
  timer.start();

  try {
    const result = fn();
    const duration = timer.stop();

    return {
      duration,
      result,
      error: null,
    };
  } catch (error) {
    const duration = timer.stop();

    return {
      duration,
      result: null,
      error,
    };
  }
}

/**
 * Measure multiple executions and return statistics
 * @param {Function} fn - Function to measure
 * @param {number} iterations - Number of iterations
 * @returns {Promise<Object>} Statistics about execution times
 */
export async function measureMultiple(fn, iterations = 10) {
  const durations = [];

  for (let i = 0; i < iterations; i++) {
    const { duration } = await measureAsync(fn);
    durations.push(duration);
  }

  durations.sort((a, b) => a - b);

  const sum = durations.reduce((acc, val) => acc + val, 0);
  const mean = sum / durations.length;
  const median = durations[Math.floor(durations.length / 2)];
  const min = durations[0];
  const max = durations[durations.length - 1];

  return {
    iterations,
    durations,
    mean,
    median,
    min,
    max,
  };
}

export default {
  Timer,
  measureAsync,
  measureSync,
  measureMultiple,
};
