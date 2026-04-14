const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getServerHealth } = require("../services/healthService");
const { getSecurityReport } = require("../services/securityService");

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

module.exports = router;
