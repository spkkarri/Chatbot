// server/models/AdminDocument.js
const mongoose = require('mongoose');

const StageStatusSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    message: { type: String, default: '' },
    updatedAt: { type: Date }
}, { _id: false });

const AdminDocumentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    unique: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    default: "",
  },
  analysis: {
    faq: { type: String, default: "" },
    topics: { type: String, default: "" },
    mindmap: { type: String, default: "" },
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  analysisUpdatedAt: {
    type: Date,
  },
  isLinked: {
    type: Boolean,
    default: false
  },
  // --- NEW: Granular status tracking ---
  overallStatus: {
    type: String,
    enum: ['staged', 'processing', 'completed', 'failed'],
    default: 'staged',
    index: true,
  },
  failureReason: {
    type: String,
  },
  processingStages: {
    parsing: { type: StageStatusSchema, default: () => ({ status: 'pending' }) },
    vectorization: { type: StageStatusSchema, default: () => ({ status: 'pending' }) },
    kg_generation: { type: StageStatusSchema, default: () => ({ status: 'pending' }) },
    analysis: { type: StageStatusSchema, default: () => ({ status: 'pending' }) },
  },
  // --- THIS IS THE NEW FIELD ---
  processingProvider: {
    type: String,
    enum: ['gemini', 'ollama'],
    default: 'gemini'
  }
});

AdminDocumentSchema.index({ originalName: 1 });

const AdminDocument = mongoose.model('AdminDocument', AdminDocumentSchema);

module.exports = AdminDocument;
