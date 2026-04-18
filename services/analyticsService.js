const { monitorEventLoopDelay } = require("perf_hooks");

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ANALYTICS_CACHE_TTL_MS = parsePositiveInt(process.env.ANALYTICS_CACHE_TTL_MS, 10000);
const REQUEST_ANALYTICS_WINDOW_MINUTES = parsePositiveInt(
  process.env.REQUEST_ANALYTICS_WINDOW_MINUTES,
  60
);
const EVENT_LOOP_SNAPSHOT_MS = parsePositiveInt(process.env.EVENT_LOOP_SNAPSHOT_MS, 10000);
const SLOW_REQUEST_THRESHOLD_MS = parsePositiveInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 500);
const MAX_SLOW_REQUESTS = parsePositiveInt(process.env.MAX_SLOW_REQUESTS, 200);
const MAX_DURATION_SAMPLES_PER_WINDOW = parsePositiveInt(
  process.env.MAX_DURATION_SAMPLES_PER_WINDOW,
  2000
);
const MAX_ENDPOINTS_PER_WINDOW = parsePositiveInt(process.env.MAX_ENDPOINTS_PER_WINDOW, 250);
const API_ONLY_METRICS = (process.env.API_ONLY_METRICS || "true").toLowerCase() !== "false";

const minuteWindows = [];
const slowRequests = [];

let totalRequestsSinceStart = 0;
let totalErrorsSinceStart = 0;
let slowRequestSequence = 0;

let analyticsCache = {
  data: null,
  expiresAt: 0,
};
let analyticsBuildPromise = null;

const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

let eventLoopSnapshot = {
  available: false,
  generatedAt: new Date().toISOString(),
  sampleWindowMs: EVENT_LOOP_SNAPSHOT_MS,
  p50Ms: null,
  p95Ms: null,
  maxMs: null,
  meanMs: null,
};

const invalidateAnalyticsCache = () => {
  analyticsCache = {
    data: null,
    expiresAt: 0,
  };
};

const toMs = (nanoseconds) => {
  if (typeof nanoseconds !== "number" || !Number.isFinite(nanoseconds) || nanoseconds <= 0) {
    return null;
  }

  return Number((nanoseconds / 1_000_000).toFixed(2));
};

const snapshotEventLoop = () => {
  eventLoopSnapshot = {
    available: true,
    generatedAt: new Date().toISOString(),
    sampleWindowMs: EVENT_LOOP_SNAPSHOT_MS,
    p50Ms: toMs(eventLoopHistogram.percentile(50)),
    p95Ms: toMs(eventLoopHistogram.percentile(95)),
    maxMs: toMs(eventLoopHistogram.max),
    meanMs: toMs(eventLoopHistogram.mean),
  };

  eventLoopHistogram.reset();
};

snapshotEventLoop();
setInterval(snapshotEventLoop, EVENT_LOOP_SNAPSHOT_MS).unref();

const getMinuteStart = (timestampMs = Date.now()) => Math.floor(timestampMs / 60000) * 60000;

const createWindow = (startAt) => ({
  startAt,
  totalRequests: 0,
  errorRequests: 0,
  totalDurationMs: 0,
  durations: [],
  endpointCount: 0,
  endpoints: {},
  statusBuckets: {
    "2xx": 0,
    "3xx": 0,
    "4xx": 0,
    "5xx": 0,
    other: 0,
  },
});

const trimWindows = () => {
  while (minuteWindows.length > REQUEST_ANALYTICS_WINDOW_MINUTES) {
    minuteWindows.shift();
  }
};

const ensureCurrentWindow = (timestampMs) => {
  const targetStart = getMinuteStart(timestampMs);

  if (minuteWindows.length === 0) {
    const initialWindow = createWindow(targetStart);
    minuteWindows.push(initialWindow);
    return initialWindow;
  }

  let lastWindow = minuteWindows[minuteWindows.length - 1];

  while (lastWindow.startAt < targetStart) {
    const nextWindow = createWindow(lastWindow.startAt + 60000);
    minuteWindows.push(nextWindow);
    lastWindow = nextWindow;
  }

  trimWindows();
  return minuteWindows[minuteWindows.length - 1];
};

const normalizePath = (pathValue) => {
  if (!pathValue) {
    return "/";
  }

  return pathValue
    .split("?")[0]
    .replace(/[0-9a-fA-F]{24}(?=\/|$)/g, ":id")
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}(?=\/|$)/g, ":uuid")
    .replace(/\d+(?=\/|$)/g, ":n");
};

const getStatusBucket = (statusCode) => {
  if (statusCode >= 200 && statusCode < 300) {
    return "2xx";
  }

  if (statusCode >= 300 && statusCode < 400) {
    return "3xx";
  }

  if (statusCode >= 400 && statusCode < 500) {
    return "4xx";
  }

  if (statusCode >= 500 && statusCode < 600) {
    return "5xx";
  }

  return "other";
};

const addDurationSample = (window, durationMs) => {
  if (window.durations.length < MAX_DURATION_SAMPLES_PER_WINDOW) {
    window.durations.push(durationMs);
    return;
  }

  if (Math.random() < 0.01) {
    const index = Math.floor(Math.random() * MAX_DURATION_SAMPLES_PER_WINDOW);
    window.durations[index] = durationMs;
  }
};

const recordSlowRequest = (payload) => {
  slowRequests.push({
    id: ++slowRequestSequence,
    ...payload,
  });

  if (slowRequests.length > MAX_SLOW_REQUESTS) {
    slowRequests.shift();
  }
};

const recordEndpoint = (window, method, path, statusCode, durationMs) => {
  const key = `${method} ${path}`;

  if (!window.endpoints[key]) {
    if (window.endpointCount >= MAX_ENDPOINTS_PER_WINDOW) {
      return;
    }

    window.endpoints[key] = {
      method,
      path,
      requests: 0,
      errorRequests: 0,
      totalDurationMs: 0,
      slowRequests: 0,
      statusBuckets: {
        "2xx": 0,
        "3xx": 0,
        "4xx": 0,
        "5xx": 0,
        other: 0,
      },
    };
    window.endpointCount += 1;
  }

  const endpoint = window.endpoints[key];
  endpoint.requests += 1;
  endpoint.totalDurationMs += durationMs;

  if (statusCode >= 500) {
    endpoint.errorRequests += 1;
  }

  const bucket = getStatusBucket(statusCode);
  endpoint.statusBuckets[bucket] += 1;

  if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
    endpoint.slowRequests += 1;
  }
};

const createRequestMetricsMiddleware = () => (req, res, next) => {
  if (API_ONLY_METRICS && !req.originalUrl.startsWith("/api/")) {
    return next();
  }

  const startTimeNs = process.hrtime.bigint();

  res.on("finish", () => {
    const endTimeNs = process.hrtime.bigint();
    const durationMs = Number((Number(endTimeNs - startTimeNs) / 1_000_000).toFixed(2));
    const statusCode = res.statusCode;
    const timestampMs = Date.now();

    const window = ensureCurrentWindow(timestampMs);

    window.totalRequests += 1;
    window.totalDurationMs += durationMs;
    if (statusCode >= 500) {
      window.errorRequests += 1;
    }

    const statusBucket = getStatusBucket(statusCode);
    window.statusBuckets[statusBucket] += 1;

    addDurationSample(window, durationMs);

    const normalizedPath = normalizePath(req.baseUrl ? `${req.baseUrl}${req.path}` : req.path);
    recordEndpoint(window, req.method, normalizedPath, statusCode, durationMs);

    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      recordSlowRequest({
        method: req.method,
        path: normalizedPath,
        statusCode,
        durationMs,
        timestamp: new Date(timestampMs).toISOString(),
      });
    }

    totalRequestsSinceStart += 1;
    if (statusCode >= 500) {
      totalErrorsSinceStart += 1;
    }

    invalidateAnalyticsCache();
  });

  return next();
};

const percentile = (samples, percentileValue) => {
  if (!samples.length) {
    return null;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const rank = (percentileValue / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);

  if (lowerIndex === upperIndex) {
    return Number(sorted[lowerIndex].toFixed(2));
  }

  const weight = rank - lowerIndex;
  const interpolated = sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
  return Number(interpolated.toFixed(2));
};

const aggregateWindows = (windows) => {
  const aggregate = {
    totalRequests: 0,
    errorRequests: 0,
    totalDurationMs: 0,
    durations: [],
    statusBuckets: {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0,
      other: 0,
    },
    endpoints: {},
  };

  for (const window of windows) {
    aggregate.totalRequests += window.totalRequests;
    aggregate.errorRequests += window.errorRequests;
    aggregate.totalDurationMs += window.totalDurationMs;

    for (const key of Object.keys(window.statusBuckets)) {
      aggregate.statusBuckets[key] += window.statusBuckets[key];
    }

    if (aggregate.durations.length < MAX_DURATION_SAMPLES_PER_WINDOW * 5) {
      const availableSlots = MAX_DURATION_SAMPLES_PER_WINDOW * 5 - aggregate.durations.length;
      aggregate.durations.push(...window.durations.slice(0, availableSlots));
    }

    for (const [endpointKey, endpointValue] of Object.entries(window.endpoints)) {
      if (!aggregate.endpoints[endpointKey]) {
        aggregate.endpoints[endpointKey] = {
          ...endpointValue,
        };
        continue;
      }

      const current = aggregate.endpoints[endpointKey];
      current.requests += endpointValue.requests;
      current.errorRequests += endpointValue.errorRequests;
      current.totalDurationMs += endpointValue.totalDurationMs;
      current.slowRequests += endpointValue.slowRequests;

      for (const bucket of Object.keys(current.statusBuckets)) {
        current.statusBuckets[bucket] += endpointValue.statusBuckets[bucket] || 0;
      }
    }
  }

  return aggregate;
};

const buildWindowAnalytics = (windows, minutes) => {
  const aggregate = aggregateWindows(windows);
  const totalRequests = aggregate.totalRequests;
  const errorRequests = aggregate.errorRequests;

  const averageLatencyMs =
    totalRequests > 0 ? Number((aggregate.totalDurationMs / totalRequests).toFixed(2)) : null;

  const errorRatePercentage =
    totalRequests > 0 ? Number(((errorRequests / totalRequests) * 100).toFixed(2)) : 0;

  const requestsPerSecond = Number((totalRequests / (minutes * 60)).toFixed(3));

  return {
    requests: totalRequests,
    requestsPerSecond,
    errors: errorRequests,
    errorRatePercentage,
    averageLatencyMs,
    latencyPercentiles: {
      p50Ms: percentile(aggregate.durations, 50),
      p95Ms: percentile(aggregate.durations, 95),
      p99Ms: percentile(aggregate.durations, 99),
    },
    statusBuckets: aggregate.statusBuckets,
    endpointAggregate: aggregate.endpoints,
  };
};

const buildTopEndpoints = (endpointAggregate) => {
  return Object.values(endpointAggregate)
    .map((endpoint) => {
      const errorRatePercentage =
        endpoint.requests > 0
          ? Number(((endpoint.errorRequests / endpoint.requests) * 100).toFixed(2))
          : 0;

      return {
        method: endpoint.method,
        path: endpoint.path,
        requests: endpoint.requests,
        errorRatePercentage,
        averageLatencyMs:
          endpoint.requests > 0
            ? Number((endpoint.totalDurationMs / endpoint.requests).toFixed(2))
            : null,
        slowRequests: endpoint.slowRequests,
      };
    })
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);
};

const getRecentWindows = (count) => {
  if (minuteWindows.length === 0) {
    return [];
  }

  return minuteWindows.slice(-Math.max(1, Math.min(count, minuteWindows.length)));
};

const getApplicationAnalytics = async () => {
  if (analyticsCache.data && Date.now() < analyticsCache.expiresAt) {
    return analyticsCache.data;
  }

  if (analyticsBuildPromise) {
    return analyticsBuildPromise;
  }

  analyticsBuildPromise = (async () => {
    const oneMinuteWindows = getRecentWindows(1);
    const fiveMinuteWindows = getRecentWindows(5);

    const oneMinuteAnalytics = buildWindowAnalytics(oneMinuteWindows, 1);
    const fiveMinuteAnalytics = buildWindowAnalytics(fiveMinuteWindows, 5);

    const analyticsPayload = {
      generatedAt: new Date().toISOString(),
      settings: {
        windowMinutes: REQUEST_ANALYTICS_WINDOW_MINUTES,
        slowRequestThresholdMs: SLOW_REQUEST_THRESHOLD_MS,
      },
      traffic: {
        totalRequestsSinceStart,
        totalErrorsSinceStart,
        oneMinute: oneMinuteAnalytics,
        fiveMinutes: fiveMinuteAnalytics,
      },
      eventLoop: eventLoopSnapshot,
      slowRequests: [...slowRequests].reverse().slice(0, 20),
      topEndpoints: buildTopEndpoints(fiveMinuteAnalytics.endpointAggregate),
      thresholds: {
        errorRatePercentage: {
          safeMax: 1,
          warningMax: 3,
          unit: "%",
          label: "Error rate",
        },
        latencyP95Ms: {
          safeMax: 300,
          warningMax: 700,
          unit: "ms",
          label: "P95 latency",
        },
        eventLoopLagMs: {
          safeMax: 20,
          warningMax: 50,
          unit: "ms",
          label: "Event loop lag",
        },
        slowRequestDurationMs: {
          safeMax: SLOW_REQUEST_THRESHOLD_MS,
          warningMax: SLOW_REQUEST_THRESHOLD_MS * 2,
          unit: "ms",
          label: "Slow request duration",
        },
      },
    };

    analyticsCache = {
      data: analyticsPayload,
      expiresAt: Date.now() + ANALYTICS_CACHE_TTL_MS,
    };

    return analyticsPayload;
  })();

  try {
    return await analyticsBuildPromise;
  } finally {
    analyticsBuildPromise = null;
  }
};

module.exports = {
  createRequestMetricsMiddleware,
  getApplicationAnalytics,
};
