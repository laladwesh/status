const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const MetricSnapshot = require('../models/MetricSnapshot');

const router = express.Router();
router.use(authMiddleware);

router.get('/metrics/history', async (req, res) => {
  try {
    const reqHours = Number(req.query.hours);
    const hours = Math.min(168, Math.max(1, Number.isFinite(reqHours) && reqHours > 0 ? reqHours : 24));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (hours <= 6) {
      const snapshots = await MetricSnapshot.find({ timestamp: { $gte: since } })
        .sort({ timestamp: 1 })
        .lean();
      return res.json({ snapshots, hours, resolution: 'minute' });
    }

    const aggregated = await MetricSnapshot.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            hour: { $hour: '$timestamp' },
          },
          timestamp: { $first: '$timestamp' },
          cpu: { $avg: '$cpu' },
          memory: { $avg: '$memory' },
          disk: { $avg: '$disk' },
          dbPingMs: { $avg: '$dbPingMs' },
          upCount: { $avg: '$upCount' },
          totalCount: { $avg: '$totalCount' },
        },
      },
      { $sort: { timestamp: 1 } },
    ]);

    const snapshots = aggregated.map((row) => {
      const ts = new Date(Date.UTC(row._id.year, row._id.month - 1, row._id.day, row._id.hour));
      return {
        timestamp: ts,
        cpu: row.cpu != null ? Number(row.cpu.toFixed(2)) : null,
        memory: row.memory != null ? Number(row.memory.toFixed(2)) : null,
        disk: row.disk != null ? Number(row.disk.toFixed(2)) : null,
        dbPingMs: row.dbPingMs != null ? Number(row.dbPingMs.toFixed(2)) : null,
        upCount: row.upCount != null ? Number(row.upCount.toFixed(2)) : null,
        totalCount: row.totalCount != null ? Number(row.totalCount.toFixed(2)) : null,
      };
    });

    res.json({ snapshots, hours, resolution: 'hour' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch metrics history.' });
  }
});

module.exports = router;
