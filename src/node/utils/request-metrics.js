/**
 * In-process API request metrics (rolling one-hour window, bounded memory).
 * Mounted in app.js; read by the admin dashboard's system health.
 */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_SAMPLES = 20000;

const samples = []; // { t, ms, status }

export const requestMetricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    samples.push({ t: Date.now(), ms, status: res.statusCode });
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
  });
  next();
};

export const getRequestStats = (windowMs = WINDOW_MS) => {
  const cutoff = Date.now() - windowMs;
  // Drop expired samples (they are in insertion order)
  const expiry = Date.now() - WINDOW_MS;
  let i = 0;
  while (i < samples.length && samples[i].t < expiry) i++;
  if (i) samples.splice(0, i);

  const recent = samples.filter((s) => s.t >= cutoff);
  if (!recent.length) {
    return { requests: 0, avgMs: null, p95Ms: null, errorRatePercent: 0, serverErrors: 0 };
  }
  const durations = recent.map((s) => s.ms).sort((a, b) => a - b);
  const p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))];
  const serverErrors = recent.filter((s) => s.status >= 500).length;
  return {
    requests: recent.length,
    avgMs: Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10,
    p95Ms: Math.round(p95 * 10) / 10,
    errorRatePercent: Math.round((serverErrors / recent.length) * 10000) / 100,
    serverErrors,
  };
};

export const resetRequestStats = () => {
  samples.length = 0;
};
