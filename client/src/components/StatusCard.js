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
    <article className="rounded-md border border-[#d9dde2] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1b1f24]">{service.name}</h3>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            isUp
              ? "border-[#b7ebdf] bg-[#ecfbf5] text-[#168b6f]"
              : "border-[#f5c4c4] bg-[#fff2f2] text-[#c13f3f]"
          }`}
        >
          {indicatorText}
        </span>
      </div>

      <p className="mb-3 break-all text-xs text-[#7a808a]">{service.url}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3">
          <p className="text-xs uppercase tracking-wide text-[#7a808a]">Status</p>
          <p className="mt-1 font-semibold text-[#1f252b]">{service.status || "DOWN"}</p>
        </div>
        <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3">
          <p className="text-xs uppercase tracking-wide text-[#7a808a]">Latency</p>
          <p className="mt-1 font-semibold text-[#1f252b]">
            {service.latency != null ? `${service.latency} ms` : "N/A"}
          </p>
        </div>
        <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3">
          <p className="text-xs uppercase tracking-wide text-[#7a808a]">Uptime (24h)</p>
          <p className="mt-1 font-semibold text-[#1f252b]">
            {service.uptimePercentage24h != null
              ? `${service.uptimePercentage24h}%`
              : "N/A"}
          </p>
        </div>
        <div className="rounded-md border border-[#eceff3] bg-[#f7f8fa] p-3">
          <p className="text-xs uppercase tracking-wide text-[#7a808a]">Last Down</p>
          <p className="mt-1 font-semibold text-[#1f252b]">
            {service.lastDowntime ? formatTimestamp(service.lastDowntime) : "None"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-[#7a808a]">
        Last check: {formatTimestamp(service.timestamp)}
      </p>
    </article>
  );
}

export default StatusCard;
