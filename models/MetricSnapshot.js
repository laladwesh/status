const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  cpu: Number,
  memory: Number,
  disk: Number,
  dbPingMs: Number,
  upCount: Number,
  totalCount: Number
}, { versionKey: false });
schema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });
module.exports = mongoose.model('MetricSnapshot', schema);
