import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import StatusCard from "../components/StatusCard";
import { clearAuthSession, getAuthUser } from "../utils/auth";

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) {
    return "N/A";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const formatPercent = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value}%`;
};

const formatLoad = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toFixed(2);
};

const formatNumber = (value, fractionDigits = 2) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "N/A";
  }

  return value.toFixed(fractionDigits);
};

const formatMilliseconds = (value) => {
  const formatted = formatNumber(value, 2);
  return formatted === "N/A" ? "N/A" : `${formatted} ms`;
};

const formatRate = (value) => {
  const formatted = formatNumber(value, 2);
  return formatted === "N/A" ? "N/A" : `${formatted}%`;
};

const buildSafeRangeText = (threshold) => {
  if (!threshold) {
    return "Safe range: N/A";
  }

  return `Safe range: 0-${threshold.safeMax}${threshold.unit}`;
};

const getMetricState = (value, threshold) => {
  if (typeof value !== "number" || Number.isNaN(value) || !threshold) {
    return {
      label: "N/A",
      className: "border-[#d4d7dc] bg-[#f4f6f8] text-[#7a808a]",
    };
  }

  if (value <= threshold.safeMax) {
    return {
      label: "Safe",
      className: "border-[#b7ebdf] bg-[#ecfbf5] text-[#168b6f]",
    };
  }

  if (value <= threshold.warningMax) {
    return {
      label: "Watch",
      className: "border-[#f3d489] bg-[#fff8e7] text-[#9c6d00]",
    };
  }

  return {
    label: "High",
    className: "border-[#f2b8b8] bg-[#fff1f1] text-[#be3f3f]",
  };
};

const LOG_LINES_MIN = 20;
const LOG_LINES_MAX = 2000;

const clampLogLineCount = (value) => {
  if (!Number.isFinite(value)) {
    return 200;
  }

  return Math.max(LOG_LINES_MIN, Math.min(LOG_LINES_MAX, Math.floor(value)));
};

function AdminDashboardPage() {
  const navigate = useNavigate();
  const authUser = getAuthUser();

  const [statusPayload, setStatusPayload] = useState({ services: [], generatedAt: null });
  const [health, setHealth] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [security, setSecurity] = useState({
    recentLogins: [],
    failedSshAttempts: [],
    topProcesses: [],
    warnings: [],
  });
  const [logApps, setLogApps] = useState([]);
  const [selectedLogApp, setSelectedLogApp] = useState("");
  const [logStreamType, setLogStreamType] = useState("combined");
  const [logLineCount, setLogLineCount] = useState(200);
  const [logPayload, setLogPayload] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [liveLogStream, setLiveLogStream] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cpuThreshold = health?.thresholds?.cpuLoadPercentage;
  const memoryThreshold = health?.thresholds?.memoryUsagePercentage;
  const diskThreshold = health?.thresholds?.diskUsagePercentage;
  const swapThreshold = health?.thresholds?.swapUsagePercentage;
  const normalizedLoadThreshold = health?.thresholds?.normalizedLoadPercentage;
  const databasePingThreshold = health?.thresholds?.databasePingMs;

  const analyticsErrorRateThreshold = analytics?.thresholds?.errorRatePercentage;
  const analyticsLatencyThreshold = analytics?.thresholds?.latencyP95Ms;
  const analyticsEventLoopThreshold = analytics?.thresholds?.eventLoopLagMs;
  const analyticsSlowRequestThreshold = analytics?.thresholds?.slowRequestDurationMs;

  const cpuState = getMetricState(health?.cpu?.loadPercentage1m, cpuThreshold);
  const memoryState = getMetricState(health?.memory?.usagePercentage, memoryThreshold);
  const diskState = getMetricState(health?.disk?.usagePercentage, diskThreshold);
  const swapState = getMetricState(health?.memory?.swap?.usagePercentage, swapThreshold);
  const normalizedLoadState = getMetricState(
    health?.cpu?.loadPercentage5m,
    normalizedLoadThreshold
  );
  const databaseState = getMetricState(health?.database?.pingMs, databasePingThreshold);
  const swapEnabled = Boolean(health?.memory?.swap?.swapEnabled);

  const oneMinuteTraffic = analytics?.traffic?.oneMinute;
  const monitoredServices = analytics?.monitoredServices;
  const oneMinuteMonitoredChecks = monitoredServices?.oneMinute;
  const fiveMinuteMonitoredChecks = monitoredServices?.fiveMinutes;
  const monitoredApps = monitoredServices?.services || [];
  const monitoredAppsUpCount = monitoredApps.filter(
    (service) => service.latestStatus === "UP"
  ).length;
  const eventLoop = analytics?.eventLoop;
  const slowRequests = analytics?.slowRequests || [];

  const errorRateState = getMetricState(
    oneMinuteTraffic?.errorRatePercentage,
    analyticsErrorRateThreshold
  );
  const latencyP95State = getMetricState(
    oneMinuteTraffic?.latencyPercentiles?.p95Ms,
    analyticsLatencyThreshold
  );
  const eventLoopState = getMetricState(eventLoop?.p95Ms, analyticsEventLoopThreshold);

  const latestSlowRequestDurationMs = slowRequests[0]?.durationMs;
  const slowRequestState = getMetricState(
    latestSlowRequestDurationMs,
    analyticsSlowRequestThreshold
  );

  const stdoutLogLines = logPayload?.out?.lines || [];
  const stderrLogLines = logPayload?.error?.lines || [];

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const loadDashboard = useCallback(async () => {
    try {
      const [statusResponse, healthResponse, analyticsResponse, securityResponse] = await Promise.all([
        apiClient.get("/status"),
        apiClient.get("/admin/health"),
        apiClient.get("/admin/analytics"),
        apiClient.get("/admin/security"),
      ]);

      setStatusPayload(statusResponse.data);
      setHealth(healthResponse.data);
      setAnalytics(analyticsResponse.data);
      setSecurity(securityResponse.data);
      setError("");
    } catch (err) {
      if (err.response?.status === 401) {
        clearAuthSession();
        navigate("/login", { replace: true });
        return;
      }

      setError("Failed to fetch admin dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadLogApps = useCallback(async () => {
    try {
      const response = await apiClient.get("/admin/logs/apps");
      const apps = Array.isArray(response.data?.apps) ? response.data.apps : [];

      setLogApps(apps);
      setSelectedLogApp((current) => {
        if (current && apps.includes(current)) {
          return current;
        }

        return apps[0] || "";
      });
      setLogsError("");
    } catch (err) {
      if (err.response?.status === 401) {
        clearAuthSession();
        navigate("/login", { replace: true });
        return;
      }

      setLogsError("Failed to load PM2 applications.");
    }
  }, [navigate]);

  const loadLogs = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedLogApp) {
        setLogPayload(null);
        return;
      }

      if (!silent) {
        setLogsLoading(true);
      }

      try {
        const response = await apiClient.get("/admin/logs", {
          params: {
            app: selectedLogApp,
            stream: logStreamType,
            lines: clampLogLineCount(logLineCount),
          },
        });

        setLogPayload(response.data);
        setLogsError("");
      } catch (err) {
        if (err.response?.status === 401) {
          clearAuthSession();
          navigate("/login", { replace: true });
          return;
        }

        setLogsError(err.response?.data?.message || "Failed to load PM2 logs.");
      } finally {
        if (!silent) {
          setLogsLoading(false);
        }
      }
    },
    [selectedLogApp, logStreamType, logLineCount, navigate]
  );

  useEffect(() => {
    loadDashboard();

    const intervalId = setInterval(loadDashboard, 60000);
    return () => clearInterval(intervalId);
  }, [loadDashboard]);

  useEffect(() => {
    loadLogApps();
  }, [loadLogApps]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!liveLogStream || !selectedLogApp) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadLogs({ silent: true });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [liveLogStream, selectedLogApp, loadLogs]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#e8f4ff_0%,_#f2f7ff_42%,_#eef2ff_100%)] px-3 py-6 sm:px-5 lg:px-8">
      <div className="mx-auto w-full space-y-6">
        <header className="rounded-2xl border border-[#c9d8ff] bg-gradient-to-r from-white via-[#f7fbff] to-[#edf3ff] p-6 shadow-[0_10px_30px_rgba(56,97,168,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a808a]">
                Admin Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[#111418]">
                Infrastructure Monitoring
              </h1>
              <p className="mt-2 text-sm text-[#60656f]">
                Signed in as {authUser?.username || "admin"}
              </p>
              <p className="mt-3 text-xs text-[#7a808a]">
                Last refresh: {statusPayload.generatedAt
                  ? new Date(statusPayload.generatedAt).toLocaleString()
                  : "Pending"}
              </p>
              <p className="mt-1 text-xs text-[#7a808a]">
                Analytics sample: {analytics?.generatedAt
                  ? new Date(analytics.generatedAt).toLocaleString()
                  : "Pending"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadDashboard}
                className="rounded-md border border-[#d4d7dc] bg-white px-4 py-2 text-sm font-medium text-[#2c3138] transition hover:border-[#aeb5be]"
              >
                Refresh
              </button>
              <Link
                to="/"
                className="rounded-md border border-[#d4d7dc] bg-white px-4 py-2 text-sm font-medium text-[#2c3138] transition hover:border-[#aeb5be]"
              >
                Public Status Page
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-[#f2b8b8] bg-[#fff1f1] px-4 py-2 text-sm font-medium text-[#be3f3f] transition hover:bg-[#ffe9e9]"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <section className="rounded-xl border border-[#f7c7c7] bg-[#fff4f4] p-4 text-sm text-[#be3f3f] shadow-sm">
            {error}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-xl border border-[#d5def5] bg-white p-8 text-center text-[#65708a] shadow-sm">
            Loading admin data...
          </section>
        ) : null}

        {!loading ? (
          <>
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#1b1f24]">Service Status</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {statusPayload.services?.map((service) => (
                  <StatusCard key={service.name} service={service} />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#1b1f24]">Server Health</h2>
              <p className="text-xs text-[#7a808a]">
                Safe ranges are reference thresholds for quick operational review.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">CPU Load (1m)</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {formatPercent(health?.cpu?.loadPercentage1m)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">{buildSafeRangeText(cpuThreshold)}</p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cpuState.className}`}
                  >
                    {cpuState.label}
                  </span>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Cores: {health?.cpu?.cores ?? "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Avg speed: {health?.cpu?.averageSpeedMHz ? `${health.cpu.averageSpeedMHz} MHz` : "N/A"}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Memory Usage</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {formatPercent(health?.memory?.usagePercentage)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">{buildSafeRangeText(memoryThreshold)}</p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${memoryState.className}`}
                  >
                    {memoryState.label}
                  </span>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {formatBytes(health?.memory?.usedBytes)} / {formatBytes(health?.memory?.totalBytes)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {swapEnabled
                      ? `Swap: ${formatBytes(health.memory.swap.usedBytes)} / ${formatBytes(
                          health.memory.swap.totalBytes
                        )}`
                      : "Swap: Disabled or unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {swapEnabled
                      ? `${buildSafeRangeText(swapThreshold)} | Swap state: ${swapState.label}`
                      : "Swap state: Disabled"}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Disk Usage</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {health?.disk?.available ? formatPercent(health.disk.usagePercentage) : "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">{buildSafeRangeText(diskThreshold)}</p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${diskState.className}`}
                  >
                    {diskState.label}
                  </span>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {health?.disk?.available
                      ? `${formatBytes(health.disk.usedBytes)} / ${formatBytes(
                          health.disk.totalBytes
                        )}`
                      : "Disk metrics unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Mount: {health?.disk?.mountPoint || "N/A"}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Uptime</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {health?.uptime?.human || "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">Safe range: increasing and stable</p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Seconds: {health?.uptime?.seconds ?? "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Boot: {health?.system?.bootTimeIso
                      ? new Date(health.system.bootTimeIso).toLocaleString()
                      : "N/A"}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Database Ping</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {health?.database?.connected
                      ? formatMilliseconds(health?.database?.pingMs)
                      : "Disconnected"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {buildSafeRangeText(databasePingThreshold)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${databaseState.className}`}
                  >
                    {health?.database?.connected ? databaseState.label : "High"}
                  </span>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    State: {health?.database?.state || "N/A"}
                  </p>
                  {health?.database?.error ? (
                    <p className="mt-1 text-xs text-[#be3f3f]">{health.database.error}</p>
                  ) : null}
                </article>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Load Averages</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-2">
                      <p className="text-[11px] uppercase text-[#7a808a]">1m</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f252b]">
                        {formatLoad(health?.cpu?.loadAverageByWindow?.oneMinute)}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-2">
                      <p className="text-[11px] uppercase text-[#7a808a]">5m</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f252b]">
                        {formatLoad(health?.cpu?.loadAverageByWindow?.fiveMinutes)}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-2">
                      <p className="text-[11px] uppercase text-[#7a808a]">15m</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f252b]">
                        {formatLoad(health?.cpu?.loadAverageByWindow?.fifteenMinutes)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[#7a808a]">
                    Normalized load: {formatPercent(health?.cpu?.loadPercentage1m)} (1m), {" "}
                    {formatPercent(health?.cpu?.loadPercentage5m)} (5m), {" "}
                    {formatPercent(health?.cpu?.loadPercentage15m)} (15m)
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {buildSafeRangeText(normalizedLoadThreshold)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${normalizedLoadState.className}`}
                  >
                    {normalizedLoadState.label}
                  </span>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">System Details</p>
                  <div className="mt-3 space-y-2 text-sm text-[#1f252b]">
                    <p>
                      <span className="text-[#7a808a]">Hostname:</span>{" "}
                      {health?.system?.hostname || "N/A"}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">Platform:</span>{" "}
                      {health?.system?.platform || "N/A"}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">Architecture:</span>{" "}
                      {health?.system?.architecture || "N/A"}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">Kernel:</span>{" "}
                      {health?.system?.kernelRelease || "N/A"}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">Timezone:</span>{" "}
                      {health?.system?.timezone || "N/A"}
                    </p>
                  </div>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Node Process</p>
                  <div className="mt-3 space-y-2 text-sm text-[#1f252b]">
                    <p>
                      <span className="text-[#7a808a]">Node version:</span>{" "}
                      {health?.system?.nodeVersion || "N/A"}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">PID:</span>{" "}
                      {health?.process?.pid ?? "N/A"}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">RSS:</span>{" "}
                      {formatBytes(health?.process?.rssBytes)}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">Heap:</span>{" "}
                      {formatBytes(health?.process?.heapUsedBytes)} / {" "}
                      {formatBytes(health?.process?.heapTotalBytes)}
                    </p>
                    <p>
                      <span className="text-[#7a808a]">External:</span>{" "}
                      {formatBytes(health?.process?.externalBytes)}
                    </p>
                  </div>
                </article>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#1b1f24]">Application Analytics</h2>
              <p className="text-xs text-[#7a808a]">
                Includes dashboard API traffic and monitor checks for the three public applications.
              </p>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">
                    Checks / Second ({monitoredServices?.count ?? 0} Apps)
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {formatNumber(oneMinuteMonitoredChecks?.checksPerSecond, 3)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    1m checks: {oneMinuteMonitoredChecks?.checks ?? "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    5m checks: {fiveMinuteMonitoredChecks?.checks ?? "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    UP now: {monitoredAppsUpCount}/{monitoredServices?.count ?? "N/A"}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Error Rate (1m)</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {formatRate(oneMinuteTraffic?.errorRatePercentage)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {buildSafeRangeText(analyticsErrorRateThreshold)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${errorRateState.className}`}
                  >
                    {errorRateState.label}
                  </span>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Errors (1m): {oneMinuteTraffic?.errors ?? "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Errors since start: {analytics?.traffic?.totalErrorsSinceStart ?? "N/A"}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">P95 Latency (1m)</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {formatMilliseconds(oneMinuteTraffic?.latencyPercentiles?.p95Ms)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {buildSafeRangeText(analyticsLatencyThreshold)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${latencyP95State.className}`}
                  >
                    {latencyP95State.label}
                  </span>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    P99: {formatMilliseconds(oneMinuteTraffic?.latencyPercentiles?.p99Ms)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Avg: {formatMilliseconds(oneMinuteTraffic?.averageLatencyMs)}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Event Loop Lag (P95)</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {formatMilliseconds(eventLoop?.p95Ms)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {buildSafeRangeText(analyticsEventLoopThreshold)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${eventLoopState.className}`}
                  >
                    {eventLoopState.label}
                  </span>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    P50: {formatMilliseconds(eventLoop?.p50Ms)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Max: {formatMilliseconds(eventLoop?.maxMs)}
                  </p>
                </article>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Traffic Breakdown (1m)</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-2">
                      <p className="text-[11px] uppercase text-[#7a808a]">2xx</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f252b]">
                        {oneMinuteTraffic?.statusBuckets?.["2xx"] ?? "N/A"}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-2">
                      <p className="text-[11px] uppercase text-[#7a808a]">4xx</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f252b]">
                        {oneMinuteTraffic?.statusBuckets?.["4xx"] ?? "N/A"}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-2">
                      <p className="text-[11px] uppercase text-[#7a808a]">5xx</p>
                      <p className="mt-1 text-sm font-semibold text-[#1f252b]">
                        {oneMinuteTraffic?.statusBuckets?.["5xx"] ?? "N/A"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[#7a808a]">
                    Config window: {analytics?.settings?.windowMinutes ?? "N/A"} min
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Slow threshold: {formatMilliseconds(analytics?.settings?.slowRequestThresholdMs)}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Monitored Applications (5m)</p>
                  <div className="mt-3 space-y-2 text-sm text-[#3f464f]">
                    {monitoredApps.length ? (
                      monitoredApps.map((service) => (
                        <div
                          key={service.name}
                          className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3"
                        >
                          <p className="font-semibold text-[#1f252b]">
                            {service.name}
                          </p>
                          <p className="text-xs text-[#7a808a]">
                            Status: {service.latestStatus} | Checks: {service.checksInLast5Minutes}
                          </p>
                          <p className="text-xs text-[#7a808a]">
                            Availability: {formatRate(service.availabilityPercentageLast5Minutes)} | Avg latency: {formatMilliseconds(service.averageLatencyMsLast5Minutes)}
                          </p>
                          <p className="text-xs text-[#7a808a]">
                            Last check: {service.latestCheckedAt
                              ? new Date(service.latestCheckedAt).toLocaleString()
                              : "N/A"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#7a808a]">No monitored app data available yet.</p>
                    )}
                  </div>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Recent Slow Requests</p>
                  <p className="mt-2 text-xs text-[#7a808a]">
                    {buildSafeRangeText(analyticsSlowRequestThreshold)}
                  </p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${slowRequestState.className}`}
                  >
                    {slowRequestState.label}
                  </span>
                  <div className="mt-3 space-y-2 text-sm text-[#3f464f]">
                    {slowRequests.length ? (
                      slowRequests.slice(0, 6).map((request) => (
                        <div
                          key={`${request.id}-${request.timestamp}`}
                          className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3"
                        >
                          <p className="font-semibold text-[#1f252b]">
                            {request.method} {request.path}
                          </p>
                          <p className="text-xs text-[#7a808a]">
                            Duration: {formatMilliseconds(request.durationMs)} | Status: {request.statusCode}
                          </p>
                          <p className="text-xs text-[#7a808a]">
                            Time: {new Date(request.timestamp).toLocaleString()}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#7a808a]">No slow requests in recent samples.</p>
                    )}
                  </div>
                </article>
              </div>
            </section>

            <section className="space-y-5 rounded-2xl border border-[#c9d8ff] bg-gradient-to-b from-[#ffffff] to-[#f3f8ff] p-5 shadow-[0_10px_25px_rgba(56,97,168,0.08)]">
              <h2 className="text-2xl font-semibold text-[#183a7a]">Application Logs (PM2)</h2>
              <p className="text-sm text-[#48608a]">
                View logs app by app, choose stream type, and enable live refresh every 5 seconds.
              </p>

              {logsError ? (
                <div className="rounded-xl border border-[#f4bebe] bg-[#fff2f2] p-4 text-sm text-[#b83d3d] shadow-sm">
                  {logsError}
                </div>
              ) : null}

              <div className="rounded-xl border border-[#bfd3ff] bg-[linear-gradient(180deg,_#ffffff_0%,_#f6f9ff_100%)] p-5 shadow-sm">
                <div className="flex flex-wrap items-end gap-4">
                  <label className="space-y-1 text-sm text-[#2c3138]">
                    <span className="block text-xs uppercase tracking-wide text-[#4d6694]">Application</span>
                    <select
                      value={selectedLogApp}
                      onChange={(event) => setSelectedLogApp(event.target.value)}
                      className="rounded-lg border border-[#b9cfff] bg-white px-3 py-2 text-sm text-[#1f252b] shadow-sm outline-none transition focus:border-[#6e95ff] focus:ring-2 focus:ring-[#d5e3ff]"
                    >
                      {logApps.length ? (
                        logApps.map((appName) => (
                          <option key={appName} value={appName}>
                            {appName}
                          </option>
                        ))
                      ) : (
                        <option value="">No apps found</option>
                      )}
                    </select>
                  </label>

                  <label className="space-y-1 text-sm text-[#2c3138]">
                    <span className="block text-xs uppercase tracking-wide text-[#4d6694]">Stream</span>
                    <select
                      value={logStreamType}
                      onChange={(event) => setLogStreamType(event.target.value)}
                      className="rounded-lg border border-[#b9cfff] bg-white px-3 py-2 text-sm text-[#1f252b] shadow-sm outline-none transition focus:border-[#6e95ff] focus:ring-2 focus:ring-[#d5e3ff]"
                    >
                      <option value="combined">Combined</option>
                      <option value="out">Stdout</option>
                      <option value="error">Stderr</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-sm text-[#2c3138]">
                    <span className="block text-xs uppercase tracking-wide text-[#4d6694]">Lines</span>
                    <input
                      type="number"
                      min={LOG_LINES_MIN}
                      max={LOG_LINES_MAX}
                      value={logLineCount}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        setLogLineCount(clampLogLineCount(parsed));
                      }}
                      className="w-28 rounded-lg border border-[#b9cfff] bg-white px-3 py-2 text-sm text-[#1f252b] shadow-sm outline-none transition focus:border-[#6e95ff] focus:ring-2 focus:ring-[#d5e3ff]"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => loadLogs()}
                    disabled={!selectedLogApp || logsLoading}
                    className="rounded-lg border border-[#5f8dff] bg-[#2e6cff] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#245fe9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {logsLoading ? "Loading..." : "Refresh Logs"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLiveLogStream((current) => !current)}
                    disabled={!selectedLogApp}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      liveLogStream
                        ? "border-[#2f9e75] bg-[#e8f9f2] text-[#157257] hover:bg-[#daf4ea]"
                        : "border-[#7ea7ff] bg-[#edf4ff] text-[#2c58b8] hover:bg-[#e3edff]"
                    }`}
                  >
                    {liveLogStream ? "Stop Live" : "Start Live"}
                  </button>
                </div>

                <p className="mt-3 text-xs text-[#5a7097]">
                  Apps: {logApps.length} | Live refresh: {liveLogStream ? "On (5s)" : "Off"}
                </p>

                {logPayload?.warnings?.length ? (
                  <div className="mt-3 rounded-lg border border-[#f2d08a] bg-[#fff7e2] p-3 text-xs text-[#8f6300]">
                    {logPayload.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {logStreamType !== "error" ? (
                  <article className="rounded-xl border border-[#bfe8d8] bg-[linear-gradient(180deg,_#ffffff_0%,_#f1fcf7_100%)] p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#1d6f57]">Stdout</h3>
                      <p className="text-xs text-[#4d7a6d]">Lines: {logPayload?.out?.lineCount ?? 0}</p>
                    </div>
                    <p className="mt-2 text-xs text-[#4d7a6d] break-all">
                      Source: {logPayload?.out?.path || "N/A"}
                    </p>
                    {logPayload?.out?.readError ? (
                      <p className="mt-2 text-xs text-[#be3f3f]">{logPayload.out.readError}</p>
                    ) : null}
                    <pre className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-[#17362d] bg-[#0f1f1a] p-4 font-mono text-sm leading-6 text-[#d7f9eb] whitespace-pre-wrap break-words">
                      {stdoutLogLines.length ? stdoutLogLines.join("\n") : "No stdout lines available."}
                    </pre>
                    {logPayload?.out?.truncated ? (
                      <p className="mt-2 text-xs text-[#4d7a6d]">Showing recent lines only.</p>
                    ) : null}
                  </article>
                ) : null}

                {logStreamType !== "out" ? (
                  <article className="rounded-xl border border-[#f0c6cf] bg-[linear-gradient(180deg,_#ffffff_0%,_#fff4f6_100%)] p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#9b3048]">Stderr</h3>
                      <p className="text-xs text-[#8b5260]">Lines: {logPayload?.error?.lineCount ?? 0}</p>
                    </div>
                    <p className="mt-2 text-xs text-[#8b5260] break-all">
                      Source: {logPayload?.error?.path || "N/A"}
                    </p>
                    {logPayload?.error?.readError ? (
                      <p className="mt-2 text-xs text-[#be3f3f]">{logPayload.error.readError}</p>
                    ) : null}
                    <pre className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-[#3d1a23] bg-[#1f0f14] p-4 font-mono text-sm leading-6 text-[#ffd9e1] whitespace-pre-wrap break-words">
                      {stderrLogLines.length ? stderrLogLines.join("\n") : "No stderr lines available."}
                    </pre>
                    {logPayload?.error?.truncated ? (
                      <p className="mt-2 text-xs text-[#8b5260]">Showing recent lines only.</p>
                    ) : null}
                  </article>
                ) : null}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#1b1f24]">Security Checks</h2>

              {security?.warnings?.length ? (
                <div className="rounded-md border border-[#f3d489] bg-[#fff8e7] p-4 text-sm text-[#9c6d00]">
                  {security.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#2b3138]">
                    Recent Logins
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-[#3f464f]">
                    {security.recentLogins?.length ? (
                      security.recentLogins.map((login, index) => (
                        <div
                          key={`${login.username}-${index}`}
                          className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3"
                        >
                          <p className="font-semibold text-[#1f252b]">{login.username}</p>
                          <p className="text-xs text-[#7a808a]">Terminal: {login.terminal}</p>
                          <p className="text-xs text-[#7a808a]">Login: {login.loginAt}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#7a808a]">No login data available.</p>
                    )}
                  </div>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#2b3138]">
                    Failed SSH Attempts
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-[#3f464f]">
                    {security.failedSshAttempts?.length ? (
                      security.failedSshAttempts.map((attempt, index) => (
                        <div
                          key={`${attempt.ip}-${index}`}
                          className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3"
                        >
                          <p className="font-semibold text-[#1f252b]">{attempt.username}</p>
                          <p className="text-xs text-[#7a808a]">IP: {attempt.ip}</p>
                          <p className="text-xs text-[#7a808a]">Time: {attempt.timestamp}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#7a808a]">No failed SSH attempts found.</p>
                    )}
                  </div>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#2b3138]">
                    Top CPU Processes
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-[#3f464f]">
                    {security.topProcesses?.length ? (
                      security.topProcesses.map((proc) => (
                        <div
                          key={proc.pid}
                          className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3"
                        >
                          <p className="font-semibold text-[#1f252b]">PID {proc.pid}</p>
                          <p className="text-xs text-[#7a808a]">{proc.command}</p>
                          <p className="text-xs text-[#7a808a]">
                            CPU: {proc.cpu}% | MEM: {proc.memory}%
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[#7a808a]">No process data available.</p>
                    )}
                  </div>
                </article>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default AdminDashboardPage;
