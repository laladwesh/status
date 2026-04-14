const BAR_COUNT = 90;

const clampPercentage = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.min(100, Math.max(0, value));
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return "N/A";
  }

  return new Date(timestamp).toLocaleString();
};

const formatDayLabel = (dateKey) => {
  if (!dateKey) {
    return "Unknown day";
  }

  const date = new Date(`${dateKey}T00:00:00Z`);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getFallbackHistory = (isOperational) => {
  const generated = [];

  for (let index = BAR_COUNT - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);

    generated.push({
      date: date.toISOString().slice(0, 10),
      status: isOperational ? "up" : "down",
      downtime: !isOperational,
      totalChecks: 0,
      upChecks: 0,
      downChecks: 0,
      uptimePercentage: isOperational ? 100 : 0,
    });
  }

  return generated;
};

const getTooltipPositionClasses = (index, count) => {
  const edgeThreshold = 8;

  if (index < edgeThreshold) {
    return "left-0 translate-x-0";
  }

  if (index > count - edgeThreshold - 1) {
    return "left-auto right-0 translate-x-0";
  }

  return "left-1/2 -translate-x-1/2";
};

const getTooltipArrowClasses = (index, count) => {
  const edgeThreshold = 8;

  if (index < edgeThreshold) {
    return "left-4 -translate-x-0";
  }

  if (index > count - edgeThreshold - 1) {
    return "right-4 left-auto translate-x-0";
  }

  return "left-1/2 -translate-x-1/2";
};

function StatusTimelineRow({ service }) {
  const isOperational = service.status === "UP";
  const history =
    Array.isArray(service.history90d) && service.history90d.length
      ? service.history90d.slice(-BAR_COUNT)
      : getFallbackHistory(isOperational);

  const resolvedUptime =
    clampPercentage(service.uptimePercentage90d) ??
    clampPercentage(service.uptimePercentage24h) ??
    (isOperational ? 100 : 0);

  const visibleBarCount = history.length;

  return (
    <article className="border-b border-[#e8e8e8] px-4 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-lg font-medium text-[#2b2e33]">{service.name}</h3>
        <span
          className={`text-sm font-medium ${
            isOperational ? "text-[#13b78f]" : "text-[#df4b4b]"
          }`}
        >
          {isOperational ? "Operational" : "Down"}
        </span>
      </div>

      <p className="mb-3 text-xs text-[#767a85]">{service.url}</p>

      <div className="mb-3 flex h-8 items-center gap-1">
        {history.map((dayEntry, index) => {
          const dayLabel = formatDayLabel(dayEntry.date);
          const isUnknownDay = dayEntry.status === "unknown";
          const hasDowntime = Boolean(dayEntry.downtime) || dayEntry.status === "down";
          const dayMessage = isUnknownDay
            ? "No data recorded on this day."
            : hasDowntime
              ? "Downtime recorded on this day."
              : "No downtime recorded on this day.";

          return (
            <button
              type="button"
              key={`${service.name}-${dayEntry.date}-${index}`}
              aria-label={`${dayLabel}: ${dayMessage}`}
              className="group relative h-8 w-[6px] cursor-default p-0 focus:outline-none"
            >
              <span
                className={`block h-8 w-[6px] rounded-sm ${
                  isUnknownDay
                    ? "bg-[#dfe6e9]"
                    : hasDowntime
                      ? "bg-[#f87171]"
                      : "bg-[#14c8a2]"
                }`}
              />

              <span
                className={`pointer-events-none absolute bottom-[calc(100%+12px)] z-20 w-[280px] rounded-md border border-[#d9dde2] bg-white px-5 py-4 text-left opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.18)] invisible translate-y-1 transition-all duration-200 ease-out group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus:visible group-focus:translate-y-0 group-focus:opacity-100 ${getTooltipPositionClasses(
                  index,
                  visibleBarCount
                )}`}
              >
                <span className="block text-sm font-medium text-[#2e3036]">{dayLabel}</span>
                <span className="mt-3 block text-[15px] leading-6 text-[#2e3036]">
                  {dayMessage}
                </span>
                {!isUnknownDay ? (
                  <span className="mt-2 block text-xs text-[#7a808a]">
                    {dayEntry.upChecks || 0} UP checks | {dayEntry.downChecks || 0} DOWN checks
                  </span>
                ) : null}
                <span
                  className={`absolute top-full h-3 w-3 -translate-y-1/2 rotate-45 border-b border-r border-[#d9dde2] bg-white ${getTooltipArrowClasses(
                    index,
                    visibleBarCount
                  )}`}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-[#8a8f9b]">
        <span>90 days ago</span>
        <span className="h-px flex-1 bg-[#d7dbe0]" />
        <span>{resolvedUptime.toFixed(1)}% uptime</span>
        <span className="h-px flex-1 bg-[#d7dbe0]" />
        <span>Today</span>
      </div>

      <p className="mt-2 text-xs text-[#8a8f9b]">
        Latency: {service.latency != null ? `${service.latency} ms` : "N/A"} | Last check: {" "}
        {formatTimestamp(service.timestamp)}
      </p>
    </article>
  );
}

export default StatusTimelineRow;
