const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const auditMiddleware = require('../middleware/auditMiddleware');
const MonitoredService = require('../models/MonitoredService');
const { MONITORED_SERVICES } = require('../services/monitorService');

const router = express.Router();
router.use(authMiddleware);

router.get('/services', async (req, res) => {
  try {
    let services = await MonitoredService.find().lean();
    if (services.length === 0 && Array.isArray(MONITORED_SERVICES) && MONITORED_SERVICES.length > 0) {
      try {
        await MonitoredService.insertMany(
          MONITORED_SERVICES.map((s) => ({
            name: s.name,
            url: s.url,
            enabled: true,
            tags: [],
          })),
          { ordered: false }
        );
      } catch {}
      services = await MonitoredService.find().lean();
    }
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: 'Failed to list services.' });
  }
});

router.post('/services', auditMiddleware('service.create'), async (req, res) => {
  try {
    const { name, url, enabled, timeoutMs, assertKeyword, tags } = req.body || {};
    if (!name || !url) return res.status(400).json({ message: 'name and url are required.' });
    const created = await MonitoredService.create({
      name,
      url,
      enabled: enabled !== false,
      timeoutMs: timeoutMs || 10000,
      assertKeyword: assertKeyword || null,
      tags: Array.isArray(tags) ? tags : [],
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create service.' });
  }
});

router.patch('/services/:id', auditMiddleware('service.update'), async (req, res) => {
  try {
    const allowed = ['name', 'url', 'enabled', 'timeoutMs', 'assertKeyword', 'tags'];
    const update = {};
    allowed.forEach((k) => {
      if (k in req.body) update[k] = req.body[k];
    });
    const updated = await MonitoredService.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updated) return res.status(404).json({ message: 'Service not found.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update service.' });
  }
});

router.delete('/services/:id', auditMiddleware('service.delete'), async (req, res) => {
  try {
    const result = await MonitoredService.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Service not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete service.' });
  }
});

module.exports = router;
