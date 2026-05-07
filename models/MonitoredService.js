const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  url: { type: String, required: true, trim: true },
  enabled: { type: Boolean, default: true },
  timeoutMs: { type: Number, default: 10000 },
  assertKeyword: { type: String, default: null },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
module.exports = mongoose.model('MonitoredService', schema);
