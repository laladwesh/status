const { execFile } = require("child_process");

const SAFE_LINE_REGEX = /[^\x20-\x7E]/g;

const executeSafeCommand = (command, args = []) =>
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
          return resolve({
            ok: false,
            output: "",
            error: error.message,
          });
        }

        return resolve({
          ok: true,
          output: stdout || "",
        });
      }
    );
  });

const sanitizeLine = (line) => line.replace(SAFE_LINE_REGEX, "").trim();

const parseRecentLogins = (rawOutput) => {
  return rawOutput
    .split("\n")
    .map(sanitizeLine)
    .filter((line) => line && !line.startsWith("wtmp begins"))
    .slice(0, 10)
    .map((line) => {
      const tokens = line.split(/\s+/);

      return {
        username: tokens[0] || "unknown",
        terminal: tokens[1] || "unknown",
        loginAt: tokens.slice(2, 7).join(" ") || "unknown",
        sessionInfo: tokens.slice(7).join(" ") || "unknown",
      };
    });
};

const parseFailedSshAttempts = (rawOutput) => {
  const lines = rawOutput
    .split("\n")
    .map(sanitizeLine)
    .filter((line) => line.includes("Failed password"));

  return lines.slice(-10).map((line) => {
    const match = line.match(
      /^(\w+\s+\d+\s+\d+:\d+:\d+)\s+(\S+)\s+sshd\[\d+\]:\s+Failed password for (invalid user )?(\S+) from (\S+) port (\d+)\s+(\S+)/
    );

    if (!match) {
      return {
        timestamp: "unknown",
        host: "unknown",
        username: "unknown",
        ip: "unknown",
        port: "unknown",
        protocol: "unknown",
      };
    }

    return {
      timestamp: match[1],
      host: match[2],
      invalidUser: Boolean(match[3]),
      username: match[4],
      ip: match[5],
      port: Number(match[6]),
      protocol: match[7],
    };
  });
};

const parseTopProcesses = (rawOutput) => {
  const lines = rawOutput
    .split("\n")
    .map(sanitizeLine)
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  return lines.slice(1, 11).map((line) => {
    const parts = line.split(/\s+/, 11);

    return {
      user: parts[0] || "unknown",
      pid: Number(parts[1]) || 0,
      cpu: Number(parts[2]) || 0,
      memory: Number(parts[3]) || 0,
      command: parts[10] || "unknown",
      state: parts[7] || "unknown",
      startedAt: parts[8] || "unknown",
      cpuTime: parts[9] || "unknown",
    };
  });
};

const getSecurityReport = async () => {
  if (process.platform === "win32") {
    return {
      recentLogins: [],
      failedSshAttempts: [],
      topProcesses: [],
      warnings: ["Security command checks are available only on Linux hosts."],
    };
  }

  const [lastResult, failedSshResult, topProcessesResult] = await Promise.all([
    executeSafeCommand("last", ["-a"]),
    executeSafeCommand("grep", ["Failed password", "/var/log/auth.log"]),
    executeSafeCommand("ps", ["aux", "--sort=-%cpu"]),
  ]);

  const warnings = [];

  if (!lastResult.ok) {
    warnings.push(`Unable to fetch recent logins: ${lastResult.error}`);
  }

  if (!failedSshResult.ok) {
    warnings.push(`Unable to fetch failed SSH attempts: ${failedSshResult.error}`);
  }

  if (!topProcessesResult.ok) {
    warnings.push(`Unable to fetch top processes: ${topProcessesResult.error}`);
  }

  return {
    recentLogins: lastResult.ok ? parseRecentLogins(lastResult.output) : [],
    failedSshAttempts: failedSshResult.ok
      ? parseFailedSshAttempts(failedSshResult.output)
      : [],
    topProcesses: topProcessesResult.ok
      ? parseTopProcesses(topProcessesResult.output)
      : [],
    warnings,
  };
};

module.exports = {
  getSecurityReport,
};
