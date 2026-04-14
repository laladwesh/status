const os = require("os");
const { execFile } = require("child_process");

const executeFile = (command, args) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          return resolve({ ok: false, output: "" });
        }

        return resolve({ ok: true, output: (stdout || "").trim() });
      }
    );
  });

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
      usagePercentage: Number(((usedBytes / totalBytes) * 100).toFixed(2)),
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
    usagePercentage: Number(((usedBytes / totalBytes) * 100).toFixed(2)),
  };
};

const getServerHealth = async () => {
  const cpuCount = os.cpus().length || 1;
  const loadAverage = os.loadavg();

  const totalMemoryBytes = os.totalmem();
  const freeMemoryBytes = os.freemem();
  const usedMemoryBytes = totalMemoryBytes - freeMemoryBytes;

  const disk = await getDiskUsage();

  return {
    cpu: {
      cores: cpuCount,
      loadAverage,
      loadPercentage1m: Number(((loadAverage[0] / cpuCount) * 100).toFixed(2)),
    },
    memory: {
      totalBytes: totalMemoryBytes,
      usedBytes: usedMemoryBytes,
      freeBytes: freeMemoryBytes,
      usagePercentage: Number(((usedMemoryBytes / totalMemoryBytes) * 100).toFixed(2)),
    },
    uptime: {
      seconds: os.uptime(),
      human: formatUptime(os.uptime()),
    },
    disk,
  };
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
