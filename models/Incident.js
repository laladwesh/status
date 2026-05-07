const mongoose = require('mongoose');

const updateSchema = new mongoose.Schema({
  message: { type: String, required: true },
  status: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['investigating', 'identified', 'monitoring', 'resolved'],
    default: 'investigating'
  },
  severity: {
    type: String,
    enum: ['critical', 'major', 'minor', 'maintenance'],
    default: 'minor'
  },
  affectedServices: [String],
  updates: [updateSchema],
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

incidentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Incident', incidentSchema);
