const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { sendTestAlert, getAlertStatus } = require('../services/alertService');
const router = express.Router();
router.use(authMiddleware);
router.get('/status', (req, res) => res.json(getAlertStatus()));
router.post('/test', async (req, res) => {
  try { await sendTestAlert(); res.json({ sent: true }); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
module.exports = router;
