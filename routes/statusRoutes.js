const express = require("express");
const {
  getLatestStatuses,
  runStatusCheck,
} = require("../services/monitorService");

const router = express.Router();

router.get("/status", async (req, res) => {
  try {
    let services = await getLatestStatuses();

    const missingHistory = services.every((service) => !service.timestamp);
    if (missingHistory) {
      await runStatusCheck();
      services = await getLatestStatuses();
    }

    return res.json({
      services,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch status data." });
  }
});

module.exports = router;
