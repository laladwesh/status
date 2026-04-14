const os = require("os");
const { execFile } = require("child_process");

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const HEALTH_CACHE_TTL_MS = parsePositiveInt(process.env.HEALTH_CACHE_TTL_MS, 15000);

let healthCache = {
  data: null,
  expiresAt: 0,
};
let healthFetchPromise = null;

const executeFile = (command, args = []) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          return resolve({
            ok: false,
            output: (stdout || "").trim(),
            error: (stderr || "").trim() || error.message,
          });
        }

        return resolve({ ok: true, output: (stdout || "").trim(), error: "" });
      }
    );
  });

const percentage = (usedValue, totalValue) => {
  if (!totalValue) {
    return null;
  }

  return Number(((usedValue / totalValue) * 100).toFixed(2));
};

const getDiskUsage = async () => {
  if (process.platform === "win32") {
    const result = await executeFile("wmic", [
      "logicaldisk",
      "where",
      "DeviceID='C:'",
      "get",
      "FreeSpace,Size",
      "/format:value",
    ]);

    if (!result.ok) {
      return {
        available: false,
      };
    }

    const freeMatch = result.output.match(/FreeSpace=(\d+)/);
    const totalMatch = result.output.match(/Size=(\d+)/);

    if (!freeMatch || !totalMatch) {
      return {
        available: false,
      };
    }

    const freeBytes = Number(freeMatch[1]);
    const totalBytes = Number(totalMatch[1]);
    const usedBytes = totalBytes - freeBytes;

    return {
      available: true,
      totalBytes,
      usedBytes,
      freeBytes,
      usagePercentage: percentage(usedBytes, totalBytes),
      mountPoint: "C:/",
    };
  }

  const result = await executeFile("df", ["-kP", "/"]);

  if (!result.ok) {
    return {
      available: false,
    };
  }

  const lines = result.output.split("\n").filter(Boolean);
  if (lines.length < 2) {
    return {
      available: false,
    };
  }

  const diskParts = lines[1].trim().split(/\s+/);
  if (diskParts.length < 5) {
    return {
      available: false,
    };
  }

  const totalBytes = Number(diskParts[1]) * 1024;
  const usedBytes = Number(diskParts[2]) * 1024;
  const freeBytes = Number(diskParts[3]) * 1024;

  return {
    available: true,
    totalBytes,
    usedBytes,
    freeBytes,
    usagePercentage: percentage(usedBytes, totalBytes),
    mountPoint: diskParts[5] || "/",
  };
};

const getSwapUsage = async () => {
  if (process.platform === "win32") {
    return {
      available: false,
    };
  }

  const result = await executeFile("free", ["-b"]);

  if (!result.ok) {
    return {
      available: false,
    };
  }

  const swapLine = result.output
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("Swap:"));

  if (!swapLine) {
    return {
      available: false,
    };
  }

  const parts = swapLine.split(/\s+/);
  if (parts.length < 4) {
    return {
      available: false,
    };
  }

  const totalBytes = Number(parts[1]);
  const usedBytes = Number(parts[2]);
  const freeBytes = Number(parts[3]);

  return {
    available: totalBytes > 0,
    totalBytes,
    usedBytes,
    freeBytes,
    usagePercentage: percentage(usedBytes, totalBytes),
  };
};

const getCpuMetrics = () => {
  const cpus = os.cpus() || [];
  const cpuCount = cpus.length || 1;
  const [load1, load5, load15] = os.loadavg();

  const averageSpeedMHz =
    cpus.length > 0
      ? Math.round(cpus.reduce((acc, cpu) => acc + cpu.speed, 0) / cpus.length)
      : null;

  return {
    cores: cpuCount,
    model: cpus[0]?.model || "Unknown",
    averageSpeedMHz,
    loadAverage: [load1, load5, load15],
    loadAverageByWindow: {
      oneMinute: Number(load1.toFixed(2)),
      fiveMinutes: Number(load5.toFixed(2)),
      fifteenMinutes: Number(load15.toFixed(2)),
    },
    loadPercentage1m: percentage(load1, cpuCount),
    loadPercentage5m: percentage(load5, cpuCount),
    loadPercentage15m: percentage(load15, cpuCount),
  };
};

const getNodeProcessMetrics = () => {
  const memoryUsage = process.memoryUsage();

  return {
    pid: process.pid,
    rssBytes: memoryUsage.rss,
    heapUsedBytes: memoryUsage.heapUsed,
    heapTotalBytes: memoryUsage.heapTotal,
    externalBytes: memoryUsage.external,
  };
};

const getSystemMetadata = () => {
  const bootTime = new Date(Date.now() - os.uptime() * 1000);

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    kernelRelease: os.release(),
    nodeVersion: process.version,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    bootTimeIso: bootTime.toISOString(),
  };
};

const buildServerHealth = async () => {
  const cpu = getCpuMetrics();

  const totalMemoryBytes = os.totalmem();
  const freeMemoryBytes = os.freemem();
  const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;

  const [disk, swap] = await Promise.all([getDiskUsage(), getSwapUsage()]);

  return {
    generatedAt: new Date().toISOString(),
    cpu,
    memory: {
      totalBytes: totalMemoryBytes,
      usedBytes: usedMemoryBytes,
      freeBytes: freeMemoryBytes,
      usagePercentage: percentage(usedMemoryBytes, totalMemoryBytes),
      swap,
    },
    uptime: {
      seconds: os.uptime(),
      human: formatUptime(os.uptime()),
    },
    disk,
    process: getNodeProcessMetrics(),
    system: getSystemMetadata(),
  };
};

const getServerHealth = async () => {
  if (healthCache.data && Date.now() < healthCache.expiresAt) {
    return healthCache.data;
  }

  if (healthFetchPromise) {
    return healthFetchPromise;
  }

  healthFetchPromise = (async () => {
    const computed = await buildServerHealth();

    healthCache = {
      data: computed,
      expiresAt: Date.now() + HEALTH_CACHE_TTL_MS,
    };

    return computed;
  })();

  try {
    return await healthFetchPromise;
  } finally {
    healthFetchPromise = null;
  }
};

const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
};

module.exports = {
  getServerHealth,
};
