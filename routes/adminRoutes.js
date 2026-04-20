const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getServerHealth } = require("../services/healthService");
const { getSecurityReport } = require("../services/securityService");
const { getApplicationAnalytics } = require("../services/analyticsService");
const { listPm2Apps, getPm2Logs } = require("../services/logService");

const router = express.Router();

router.use(authMiddleware);

router.get("/health", async (req, res) => {
  try {
    const health = await getServerHealth();
    return res.json(health);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load server health." });
  }
});

router.get("/security", async (req, res) => {
  try {
    const security = await getSecurityReport();
    return res.json(security);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load security report." });
  }
});

router.get("/analytics", async (req, res) => {
  try {
    const analytics = await getApplicationAnalytics();
    return res.json(analytics);
  } catch (error) {
    return res.status(500).json({ message: "Failed to load analytics report." });
  }
});

router.get("/logs/apps", async (req, res) => {
  try {
    const payload = await listPm2Apps();
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Failed to list PM2 apps." });
  }
});

router.get("/logs", async (req, res) => {
  try {
    const appName = typeof req.query.app === "string" ? req.query.app : "";
    const linesValue = Number.parseInt(req.query.lines, 10);
    const streamType = typeof req.query.stream === "string" ? req.query.stream : "combined";

    const payload = await getPm2Logs({
      appName,
      lines: Number.isFinite(linesValue) ? linesValue : undefined,
      stream: streamType,
    });

    return res.json(payload);
  } catch (error) {
    if (["MISSING_APP", "INVALID_APP", "APP_NOT_FOUND"].includes(error.code)) {
      return res.status(400).json({
        message: error.message,
        availableApps: error.availableApps || [],
      });
    }

    return res.status(500).json({ message: "Failed to load PM2 logs." });
  }
});

module.exports = router;
