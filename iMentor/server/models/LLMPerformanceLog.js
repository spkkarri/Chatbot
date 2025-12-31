// server/models/LLMPerformanceLog.js
const mongoose = require('mongoose');

const LLMPerformanceLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true, index: true },
  query: { type: String, required: true },
  response: { type: String, required: true }, // <<< ADD THIS LINE
  chosenModelId: { type: String, required: true },
  routerLogic: { type: String },
  responseTimeMs: { type: Number },
  userFeedback: { type: String, enum: ['positive', 'negative', 'none'], default: 'none' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LLMPerformanceLog', LLMPerformanceLogSchema);