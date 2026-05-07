const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getSslCertificates } = require('../services/sslService');
const router = express.Router();
router.use(authMiddleware);
router.get('/', async (req, res) => {
  try { res.json(await getSslCertificates()); }
  catch (e) { res.status(500).json({ message: 'SSL check failed.' }); }
});
module.exports = router;
