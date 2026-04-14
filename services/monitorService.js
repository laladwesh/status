const axios = require("axios");
const cron = require("node-cron");
const Status = require("../models/Status");

const MONITORED_SERVICES = [
  {
    name: "Prasad Academic",
    url: "https://prasadacademic.in",
  },
  {
    name: "Ease Exit",
    url: "https://easeexit.prasadacademic.in",
  },
  {
    name: "Elective Portal",
    url: "https://elective.prasadacademic.in",
  },
];

const REQUEST_TIMEOUT_MS = 10000;
const HISTORY_DAYS = 90;

const runSingleCheck = async (service) => {
  const start = Date.now();

  try {
    const response = await axios.get(service.url, {
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });

    return {
      name: service.name,
      url: service.url,
      status: response.status < 500 ? "UP" : "DOWN",
      latency: Date.now() - start,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name: service.name,
      url: service.url,
      status: "DOWN",
      latency: Date.now() - start,
      timestamp: new Date(),
    };
  }
};

const runStatusCheck = async () => {
  const checks = await Promise.all(MONITORED_SERVICES.map(runSingleCheck));
  await Status.insertMany(checks);
  return checks;
};

const getServiceHistory = async (serviceName) => {
  const historyStartDate = new Date();
  historyStartDate.setHours(0, 0, 0, 0);
  historyStartDate.setDate(historyStartDate.getDate() - (HISTORY_DAYS - 1));

  const dailyHistory = await Status.aggregate([
    {
      $match: {
        name: serviceName,
        timestamp: { $gte: historyStartDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$timestamp",
            timezone: "UTC",
          },
        },
        totalChecks: { $sum: 1 },
        upChecks: {
          $sum: {
            $cond: [{ $eq: ["$status", "UP"] }, 1, 0],
          },
        },
        downChecks: {
          $sum: {
            $cond: [{ $eq: ["$status", "DOWN"] }, 1, 0],
          },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  const historyByDate = dailyHistory.reduce((acc, dayStats) => {
    acc[dayStats._id] = dayStats;
    return acc;
  }, {});

  const history90d = [];
  let totalChecks90d = 0;
  let upChecks90d = 0;

  for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - dayOffset);

    const dateKey = date.toISOString().slice(0, 10);
    const dayStats = historyByDate[dateKey];

    if (!dayStats) {
      history90d.push({
        date: dateKey,
        status: "unknown",
        downtime: false,
        totalChecks: 0,
        upChecks: 0,
        downChecks: 0,
        uptimePercentage: null,
      });
      continue;
    }

    totalChecks90d += dayStats.totalChecks;
    upChecks90d += dayStats.upChecks;

    history90d.push({
      date: dateKey,
      status: dayStats.downChecks > 0 ? "down" : "up",
      downtime: dayStats.downChecks > 0,
      totalChecks: dayStats.totalChecks,
      upChecks: dayStats.upChecks,
      downChecks: dayStats.downChecks,
      uptimePercentage:
        dayStats.totalChecks > 0
          ? Number(((dayStats.upChecks / dayStats.totalChecks) * 100).toFixed(2))
          : null,
    });
  }

  const uptimePercentage90d =
    totalChecks90d > 0
      ? Number(((upChecks90d / totalChecks90d) * 100).toFixed(2))
      : null;

  const lastDowntimeDayEntry = [...history90d]
    .reverse()
    .find((dayEntry) => dayEntry.downtime);

  return {
    history90d,
    uptimePercentage90d,
    lastDowntimeDay: lastDowntimeDayEntry ? lastDowntimeDayEntry.date : null,
  };
};

const getUptimeStats = async (serviceName) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [uptimeResult, lastDowntime] = await Promise.all([
    Status.aggregate([
      {
        $match: {
          name: serviceName,
          timestamp: { $gte: oneDayAgo },
        },
      },
      {
        $group: {
          _id: null,
          totalChecks: { $sum: 1 },
          upChecks: {
            $sum: {
              $cond: [{ $eq: ["$status", "UP"] }, 1, 0],
            },
          },
        },
      },
    ]),
    Status.findOne({ name: serviceName, status: "DOWN" })
      .sort({ timestamp: -1 })
      .lean(),
  ]);

  const stats = uptimeResult[0] || { totalChecks: 0, upChecks: 0 };
  const uptimePercentage =
    stats.totalChecks === 0
      ? null
      : Number(((stats.upChecks / stats.totalChecks) * 100).toFixed(2));

  return {
    uptimePercentage24h: uptimePercentage,
    lastDowntime: lastDowntime ? lastDowntime.timestamp : null,
  };
};

const getLatestStatuses = async () => {
  const latestStatuses = await Status.aggregate([
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: "$name",
        name: { $first: "$name" },
        url: { $first: "$url" },
        status: { $first: "$status" },
        latency: { $first: "$latency" },
        timestamp: { $first: "$timestamp" },
      },
    },
  ]);

  const statusByName = latestStatuses.reduce((acc, item) => {
    acc[item.name] = item;
    return acc;
  }, {});

  const enriched = await Promise.all(
    MONITORED_SERVICES.map(async (service) => {
      const current = statusByName[service.name] || {
        name: service.name,
        url: service.url,
        status: "DOWN",
        latency: null,
        timestamp: null,
      };

      const [uptimeStats, historyStats] = await Promise.all([
        getUptimeStats(service.name),
        getServiceHistory(service.name),
      ]);

      return {
        ...current,
        ...uptimeStats,
        ...historyStats,
      };
    })
  );

  return enriched;
};

const startMonitoring = () => {
  cron.schedule("* * * * *", async () => {
    try {
      await runStatusCheck();
    } catch (error) {
      console.error("Scheduled status check failed:", error.message);
    }
  });
};

module.exports = {
  MONITORED_SERVICES,
  runStatusCheck,
  getLatestStatuses,
  startMonitoring,
};
