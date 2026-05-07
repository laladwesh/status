const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  action: String,
  adminUser: String,
  ip: String,
  details: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
}, { versionKey: false });
schema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });
module.exports = mongoose.model('AuditLog', schema);
