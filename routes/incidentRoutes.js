const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const auditMiddleware = require('../middleware/auditMiddleware');
const Incident = require('../models/Incident');

const router = express.Router();

router.get('/incidents', async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const incidents = await Incident.find({
      $or: [
        { status: { $ne: 'resolved' } },
        { resolvedAt: { $gte: sevenDaysAgo } }
      ]
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json(incidents);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch incidents.' });
  }
});

router.get('/admin/incidents', authMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const [items, total] = await Promise.all([
      Incident.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Incident.countDocuments(filter)
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch incidents.' });
  }
});

router.post('/admin/incidents', authMiddleware, auditMiddleware('incident.create'), async (req, res) => {
  try {
    const { title, severity, affectedServices, message } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required.' });
    }
    const incident = new Incident({
      title,
      severity: severity || 'minor',
      affectedServices: Array.isArray(affectedServices) ? affectedServices : [],
      updates: [{ message, status: 'investigating', createdAt: new Date() }],
      status: 'investigating'
    });
    await incident.save();
    res.status(201).json(incident);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create incident.' });
  }
});

router.patch('/admin/incidents/:id', authMiddleware, auditMiddleware('incident.update'), async (req, res) => {
  try {
    const { status, message } = req.body || {};
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: 'Incident not found.' });
    if (message) {
      incident.updates.push({ message, status: status || incident.status, createdAt: new Date() });
    }
    if (status) {
      incident.status = status;
      if (status === 'resolved') incident.resolvedAt = new Date();
    }
    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update incident.' });
  }
});

router.delete('/admin/incidents/:id', authMiddleware, auditMiddleware('incident.delete'), async (req, res) => {
  try {
    const result = await Incident.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Incident not found.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete incident.' });
  }
});

module.exports = router;
