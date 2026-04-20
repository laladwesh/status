const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const SAFE_LOG_LINE_REGEX = /[^\x09\x0A\x0D\x20-\x7E]/g;
const VALID_STREAMS = new Set(["combined", "out", "error"]);

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PM2_LOGS_DIR = process.env.PM2_LOGS_DIR || path.join(os.homedir(), ".pm2", "logs");
const PM2_LOG_DEFAULT_LINES = parsePositiveInt(process.env.PM2_LOG_DEFAULT_LINES, 200);
const PM2_LOG_MAX_LINES = parsePositiveInt(process.env.PM2_LOG_MAX_LINES, 2000);
const PM2_LOG_READ_CHUNK_BYTES = parsePositiveInt(process.env.PM2_LOG_READ_CHUNK_BYTES, 262144);
const PM2_LOG_MAX_READ_BYTES = parsePositiveInt(process.env.PM2_LOG_MAX_READ_BYTES, 1048576);
const PM2_LOGS_CACHE_TTL_MS = parsePositiveInt(process.env.PM2_LOGS_CACHE_TTL_MS, 3000);
const PM2_APPS_CACHE_TTL_MS = parsePositiveInt(process.env.PM2_APPS_CACHE_TTL_MS, 15000);

const PM2_LOG_ALLOWLIST = (process.env.PM2_LOG_ALLOWLIST || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const appListCache = {
  data: null,
  expiresAt: 0,
};

const logsCache = new Map();
const logsFetchPromises = new Map();

const sanitizeLogLine = (line) => (line || "").replace(SAFE_LOG_LINE_REGEX, "");

const clampLines = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return PM2_LOG_DEFAULT_LINES;
  }

  return Math.max(1, Math.min(PM2_LOG_MAX_LINES, Math.floor(value)));
};

const normalizeStream = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "combined";
  return VALID_STREAMS.has(normalized) ? normalized : "combined";
};

const normalizeAppName = (value) => (typeof value === "string" ? value.trim() : "");

const isSafeAppName = (value) => /^[a-zA-Z0-9._-]+$/.test(value);

const parseAppNameFromLogFile = (fileName) => {
  if (fileName.endsWith("-out.log")) {
    return fileName.slice(0, -8);
  }

  if (fileName.endsWith("-error.log")) {
    return fileName.slice(0, -10);
  }

  return null;
};

const readAvailableAppsFromDisk = async () => {
  const entries = await fs.readdir(PM2_LOGS_DIR, { withFileTypes: true });
  const appSet = new Set();

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const appName = parseAppNameFromLogFile(entry.name);
    if (!appName) {
      continue;
    }

    appSet.add(appName);
  }

  let apps = [...appSet].sort((a, b) => a.localeCompare(b));

  if (PM2_LOG_ALLOWLIST.length) {
    const allowSet = new Set(PM2_LOG_ALLOWLIST);
    apps = apps.filter((app) => allowSet.has(app));
  }

  return apps;
};

const listPm2Apps = async () => {
  if (appListCache.data && Date.now() < appListCache.expiresAt) {
    return appListCache.data;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    logsDirectory: PM2_LOGS_DIR,
    apps: [],
    warnings: [],
  };

  try {
    payload.apps = await readAvailableAppsFromDisk();
  } catch (error) {
    if (error.code === "ENOENT") {
      payload.warnings.push(`PM2 log directory not found at ${PM2_LOGS_DIR}.`);
    } else {
      payload.warnings.push(`Unable to read PM2 logs: ${error.message}`);
    }
  }

  appListCache.data = payload;
  appListCache.expiresAt = Date.now() + PM2_APPS_CACHE_TTL_MS;
  return payload;
};

const readTailLines = async (filePath, lineLimit) => {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile() || stats.size <= 0) {
      return { lines: [], truncated: false, bytesRead: 0 };
    }

    let bytesToRead = Math.min(stats.size, PM2_LOG_READ_CHUNK_BYTES);
    let parsedLines = [];
    let start = 0;

    while (true) {
      start = Math.max(0, stats.size - bytesToRead);
      const length = stats.size - start;

      const fileHandle = await fs.open(filePath, "r");
      const buffer = Buffer.alloc(length);

      try {
        await fileHandle.read(buffer, 0, length, start);
      } finally {
        await fileHandle.close();
      }

      const text = buffer.toString("utf8");
      parsedLines = text
        .split(/\r?\n/)
        .map(sanitizeLogLine)
        .filter((line) => line.length > 0);

      const canStop =
        parsedLines.length >= lineLimit ||
        start === 0 ||
        bytesToRead >= PM2_LOG_MAX_READ_BYTES ||
        bytesToRead >= stats.size;

      if (canStop) {
        break;
      }

      bytesToRead = Math.min(bytesToRead * 2, PM2_LOG_MAX_READ_BYTES, stats.size);
    }

    return {
      lines: parsedLines.slice(-lineLimit),
      truncated: start > 0,
      bytesRead: Math.min(bytesToRead, stats.size),
    };
  } catch (error) {
    return {
      lines: [],
      truncated: false,
      bytesRead: 0,
      readError: error.message,
    };
  }
};

const buildLogFilePath = (appName, streamType) => path.join(PM2_LOGS_DIR, `${appName}-${streamType}.log`);

const fetchPm2LogsNoCache = async ({ appName, lines, stream }) => {
  const normalizedAppName = normalizeAppName(appName);

  if (!normalizedAppName) {
    const error = new Error("Query parameter 'app' is required.");
    error.code = "MISSING_APP";
    throw error;
  }

  if (!isSafeAppName(normalizedAppName)) {
    const error = new Error("Invalid app name.");
    error.code = "INVALID_APP";
    throw error;
  }

  const appList = await listPm2Apps();
  if (!appList.apps.includes(normalizedAppName)) {
    const error = new Error("Requested app logs are not available.");
    error.code = "APP_NOT_FOUND";
    error.availableApps = appList.apps;
    throw error;
  }

  const normalizedLines = clampLines(lines);
  const normalizedStream = normalizeStream(stream);

  const includeOut = normalizedStream !== "error";
  const includeError = normalizedStream !== "out";

  const [outResult, errorResult] = await Promise.all([
    includeOut ? readTailLines(buildLogFilePath(normalizedAppName, "out"), normalizedLines) : null,
    includeError
      ? readTailLines(buildLogFilePath(normalizedAppName, "error"), normalizedLines)
      : null,
  ]);

  const payload = {
    generatedAt: new Date().toISOString(),
    app: normalizedAppName,
    stream: normalizedStream,
    linesRequested: normalizedLines,
    logsDirectory: PM2_LOGS_DIR,
    out: includeOut
      ? {
          path: buildLogFilePath(normalizedAppName, "out"),
          lineCount: outResult.lines.length,
          truncated: outResult.truncated,
          readError: outResult.readError || null,
          lines: outResult.lines,
        }
      : null,
    error: includeError
      ? {
          path: buildLogFilePath(normalizedAppName, "error"),
          lineCount: errorResult.lines.length,
          truncated: errorResult.truncated,
          readError: errorResult.readError || null,
          lines: errorResult.lines,
        }
      : null,
    availableApps: appList.apps,
    warnings: appList.warnings,
  };

  return payload;
};

const getPm2Logs = async ({ appName, lines, stream }) => {
  const key = `${normalizeAppName(appName)}|${normalizeStream(stream)}|${clampLines(lines)}`;

  const cached = logsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  if (logsFetchPromises.has(key)) {
    return logsFetchPromises.get(key);
  }

  const promise = (async () => {
    const payload = await fetchPm2LogsNoCache({ appName, lines, stream });
    logsCache.set(key, {
      data: payload,
      expiresAt: Date.now() + PM2_LOGS_CACHE_TTL_MS,
    });
    return payload;
  })();

  logsFetchPromises.set(key, promise);

  try {
    return await promise;
  } finally {
    logsFetchPromises.delete(key);
  }
};

module.exports = {
  listPm2Apps,
  getPm2Logs,
};