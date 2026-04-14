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

function AdminDashboardPage() {
  const navigate = useNavigate();
  const authUser = getAuthUser();

  const [statusPayload, setStatusPayload] = useState({ services: [], generatedAt: null });
  const [health, setHealth] = useState(null);
  const [security, setSecurity] = useState({
    recentLogins: [],
    failedSshAttempts: [],
    topProcesses: [],
    warnings: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    clearAuthSession();
    navigate("/login", { replace: true });
  };

  const loadDashboard = useCallback(async () => {
    try {
      const [statusResponse, healthResponse, securityResponse] = await Promise.all([
        apiClient.get("/status"),
        apiClient.get("/admin/health"),
        apiClient.get("/admin/security"),
      ]);

      setStatusPayload(statusResponse.data);
      setHealth(healthResponse.data);
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

  useEffect(() => {
    loadDashboard();

    const intervalId = setInterval(loadDashboard, 60000);
    return () => clearInterval(intervalId);
  }, [loadDashboard]);

  return (
    <main className="min-h-screen bg-[#f1f3f5] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-md border border-[#d9dde2] bg-white p-6">
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
          <section className="rounded-md border border-[#f2b8b8] bg-[#fff1f1] p-4 text-sm text-[#be3f3f]">
            {error}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-md border border-[#d9dde2] bg-white p-8 text-center text-[#7a808a]">
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">CPU Load (1m)</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {formatPercent(health?.cpu?.loadPercentage1m)}
                  </p>
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
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {formatBytes(health?.memory?.usedBytes)} / {formatBytes(health?.memory?.totalBytes)}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    {health?.memory?.swap?.available
                      ? `Swap: ${formatBytes(health.memory.swap.usedBytes)} / ${formatBytes(
                          health.memory.swap.totalBytes
                        )}`
                      : "Swap: Disabled or unavailable"}
                  </p>
                </article>

                <article className="rounded-md border border-[#d9dde2] bg-white p-5">
                  <p className="text-xs uppercase tracking-wide text-[#7a808a]">Disk Usage</p>
                  <p className="mt-2 text-3xl font-semibold text-[#1f252b]">
                    {health?.disk?.available ? formatPercent(health.disk.usagePercentage) : "N/A"}
                  </p>
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
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Seconds: {health?.uptime?.seconds ?? "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-[#7a808a]">
                    Boot: {health?.system?.bootTimeIso
                      ? new Date(health.system.bootTimeIso).toLocaleString()
                      : "N/A"}
                  </p>
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
