// server/models/FineTuningEvent.js
const mongoose = require('mongoose');

const FineTuningEventSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['started', 'completed', 'failed'], default: 'started' },
  modelTagUpdated: { type: String, required: true },
  datasetPath: { type: String, required: true },
  datasetSize: { type: Number, required: true },
  triggeredBy: { type: String, default: 'admin' }, // Could be extended for different users
  errorMessage: { type: String }, // To store error details on failure
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

module.exports = mongoose.model('FineTuningEvent', FineTuningEventSchema);