import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";
import StatusTimelineRow from "../components/StatusTimelineRow";

function PublicStatusPage() {
  const [services, setServices] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const response = await apiClient.get("/status");
      setServices(response.data.services || []);
      setGeneratedAt(response.data.generatedAt || null);
      setError("");
    } catch (err) {
      setError("Unable to load current status. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();

    const intervalId = setInterval(loadStatus, 30000);
    return () => clearInterval(intervalId);
  }, [loadStatus]);

  const allOperational =
    services.length > 0 && services.every((service) => service.status === "UP");

  return (
    <main className="min-h-screen bg-[#f1f3f5] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 rounded-xl bg-transparent py-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7a808a]">
                status.prasadacademic.in
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#111418]">
                Prasad Status
              </h1>
              <p className="mt-2 text-sm text-[#60656f]">
                Live availability for Prasad Academic services.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md bg-[#6d28d9] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:brightness-110"
              >
                Subscribe to Updates
              </button>

              <Link
                to="/login"
                className="rounded-md border border-[#d4d7dc] bg-white px-4 py-2 text-sm font-medium text-[#2c3138] transition hover:border-[#aeb5be]"
              >
                Admin Login
              </Link>
            </div>
          </div>

          <div
            className={`mt-8 rounded-md px-4 py-4 text-lg font-medium text-white ${
              allOperational ? "bg-[#14c8a2]" : "bg-[#df4b4b]"
            }`}
          >
            {allOperational ? "All Systems Operational" : "Partial System Outage"}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#7a808a]">
            <span>
              Updated: {generatedAt ? new Date(generatedAt).toLocaleString() : "Pending"}
            </span>
            <div className="flex items-center gap-4">
              <span>Uptime over the past 90 days.</span>
              <button
                type="button"
                onClick={loadStatus}
                className="text-xs font-medium text-[#4f46e5] transition hover:text-[#4338ca]"
              >
                Refresh now
              </button>
            </div>
          </div>
        </header>

        {loading ? (
          <section className="rounded-md border border-[#e0e2e6] bg-white p-8 text-center text-[#7a808a]">
            Loading service status...
          </section>
        ) : null}

        {error ? (
          <section className="mb-6 rounded-md border border-[#f5b8b8] bg-[#fff0f0] p-4 text-sm text-[#c03939]">
            {error}
          </section>
        ) : null}

        {!loading ? (
          <section className="overflow-visible rounded-md border border-[#d9dde2] bg-white">
            {services.map((service) => (
              <StatusTimelineRow key={service.name} service={service} />
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default PublicStatusPage;
