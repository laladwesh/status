const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return "No data";
  }

  return new Date(timestamp).toLocaleString();
};

function StatusCard({ service }) {
  const isUp = service.status === "UP";
  const indicatorText = isUp ? "Operational" : "Down";

  return (
    <article className="panel rounded-2xl border border-border p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">{service.name}</h3>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            isUp
              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-400/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isUp ? "bg-emerald-400" : "bg-rose-400"
            }`}
          />
          {indicatorText}
        </span>
      </div>

      <p className="mb-1 text-sm text-slate-300">{service.url}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-panelSoft p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Status</p>
          <p className="mt-1 font-medium text-slate-100">{service.status || "DOWN"}</p>
        </div>
        <div className="rounded-xl bg-panelSoft p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Latency</p>
          <p className="mt-1 font-medium text-slate-100">
            {service.latency != null ? `${service.latency} ms` : "N/A"}
          </p>
        </div>
        <div className="rounded-xl bg-panelSoft p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Uptime (24h)</p>
          <p className="mt-1 font-medium text-slate-100">
            {service.uptimePercentage24h != null
              ? `${service.uptimePercentage24h}%`
              : "N/A"}
          </p>
        </div>
        <div className="rounded-xl bg-panelSoft p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Last Down</p>
          <p className="mt-1 font-medium text-slate-100">
            {service.lastDowntime ? formatTimestamp(service.lastDowntime) : "None"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Last check: {formatTimestamp(service.timestamp)}
      </p>
    </article>
  );
}

export default StatusCard;
