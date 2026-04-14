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
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-border bg-panel p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Admin Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-100">
                Infrastructure Monitoring
              </h1>
              <p className="mt-2 text-sm text-muted">
                Signed in as {authUser?.username || "admin"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="rounded-lg border border-border bg-panelSoft px-4 py-2 text-sm text-slate-100 transition hover:border-accent/40 hover:text-accent"
              >
                Public Status Page
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
              >
                Logout
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted">
            Last refresh: {statusPayload.generatedAt
              ? new Date(statusPayload.generatedAt).toLocaleString()
              : "Pending"}
          </p>
        </header>

        {error ? (
          <section className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-2xl border border-border bg-panel p-8 text-center text-muted shadow-panel">
            Loading admin data...
          </section>
        ) : null}

        {!loading ? (
          <>
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-100">Service Status</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {statusPayload.services?.map((service) => (
                  <StatusCard key={service.name} service={service} />
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-100">Server Health</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-border bg-panel p-5 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-muted">CPU Load (1m)</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">
                    {health?.cpu?.loadPercentage1m ?? 0}%
                  </p>
                  <p className="mt-1 text-xs text-muted">Cores: {health?.cpu?.cores ?? "N/A"}</p>
                </article>

                <article className="rounded-2xl border border-border bg-panel p-5 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-muted">Memory Usage</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">
                    {health?.memory?.usagePercentage ?? 0}%
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatBytes(health?.memory?.usedBytes)} / {formatBytes(health?.memory?.totalBytes)}
                  </p>
                </article>

                <article className="rounded-2xl border border-border bg-panel p-5 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-muted">Disk Usage</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">
                    {health?.disk?.available ? `${health.disk.usagePercentage}%` : "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {health?.disk?.available
                      ? `${formatBytes(health.disk.usedBytes)} / ${formatBytes(
                          health.disk.totalBytes
                        )}`
                      : "Disk metrics unavailable"}
                  </p>
                </article>

                <article className="rounded-2xl border border-border bg-panel p-5 shadow-panel">
                  <p className="text-xs uppercase tracking-wide text-muted">Uptime</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">
                    {health?.uptime?.human || "N/A"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Seconds: {health?.uptime?.seconds ?? "N/A"}
                  </p>
                </article>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-slate-100">Security Checks</h2>

              {security?.warnings?.length ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                  {security.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-3">
                <article className="rounded-2xl border border-border bg-panel p-5 shadow-panel">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-100">
                    Recent Logins
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    {security.recentLogins?.length ? (
                      security.recentLogins.map((login, index) => (
                        <div key={`${login.username}-${index}`} className="rounded-lg bg-panelSoft p-3">
                          <p className="font-medium text-slate-100">{login.username}</p>
                          <p className="text-xs text-muted">Terminal: {login.terminal}</p>
                          <p className="text-xs text-muted">Login: {login.loginAt}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">No login data available.</p>
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-border bg-panel p-5 shadow-panel">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-100">
                    Failed SSH Attempts
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    {security.failedSshAttempts?.length ? (
                      security.failedSshAttempts.map((attempt, index) => (
                        <div key={`${attempt.ip}-${index}`} className="rounded-lg bg-panelSoft p-3">
                          <p className="font-medium text-slate-100">{attempt.username}</p>
                          <p className="text-xs text-muted">IP: {attempt.ip}</p>
                          <p className="text-xs text-muted">Time: {attempt.timestamp}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">No failed SSH attempts found.</p>
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-border bg-panel p-5 shadow-panel">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-100">
                    Top CPU Processes
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    {security.topProcesses?.length ? (
                      security.topProcesses.map((proc) => (
                        <div key={proc.pid} className="rounded-lg bg-panelSoft p-3">
                          <p className="font-medium text-slate-100">PID {proc.pid}</p>
                          <p className="text-xs text-muted">{proc.command}</p>
                          <p className="text-xs text-muted">
                            CPU: {proc.cpu}% | MEM: {proc.memory}%
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted">No process data available.</p>
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
