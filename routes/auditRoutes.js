const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const AuditLog = require('../models/AuditLog');
const router = express.Router();
router.use(authMiddleware);
router.get('/', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(100).lean();
    res.json(logs);
  } catch { res.status(500).json({ message: 'Failed.' }); }
});
module.exports = router;
