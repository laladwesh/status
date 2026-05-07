const AuditLog = require('../models/AuditLog');
module.exports = (action) => (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode < 400) {
      AuditLog.create({
        action,
        adminUser: req.user?.username || 'unknown',
        ip: req.ip,
        details: { params: req.params }
      }).catch(() => {});
    }
  });
  next();
};
