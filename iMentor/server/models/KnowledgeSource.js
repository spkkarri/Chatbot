// server/models/KnowledgeSource.js
const mongoose = require('mongoose');

const AnalysisSchema = new mongoose.Schema({
    faq: { type: String, default: "" },
    topics: { type: String, default: "" },
    mindmap: { type: String, default: "" },
}, { _id: false });

const KnowledgeSourceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sourceType: {
        type: String,
        enum: ['document', 'youtube', 'webpage', 'audio', 'video', 'image'],
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    // Only for URL-based sources
    sourceUrl: {
        type: String,
        trim: true,
    },
    // Only for file-based sources
    serverFilename: {
        type: String,
    },
    status: {
        type: String,
        enum: ['processing_extraction', 'processing_analysis', 'completed', 'failed'],
        default: 'processing_extraction',
    },
    failureReason: {
        type: String,
    },
    textContent: {
        type: String,
    },
    analysis: {
        type: AnalysisSchema,
        default: () => ({}),
    },
    kgStatus: {
        type: String,
        default: "pending", // pending, processing, completed, failed_extraction, skipped_no_chunks, failed_critical
    },
}, { timestamps: true }); // Adds createdAt and updatedAt automatically

KnowledgeSourceSchema.index({ userId: 1, title: 1 }, { unique: true });

const KnowledgeSource = mongoose.model('KnowledgeSource', KnowledgeSourceSchema);

module.exports = KnowledgeSource;