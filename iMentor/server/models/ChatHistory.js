// server/models/ChatHistory.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const MessageSchema = new mongoose.Schema({
    role: { type: String, enum: ['user', 'model'], required: true },
    parts: [{ text: { type: String, required: true } }],
    timestamp: { type: Date, default: Date.now },
    thinking: { type: String, default: '' },
    references: { type: Array, default: [] },
    source_pipeline: { type: String, default: '' },
    logId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LLMPerformanceLog', 
        default: null 
    }
}, {_id: true });

const ChatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    messages: [MessageSchema],
    summary: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
}, { _id: true }); 

ChatHistorySchema.pre('save', function (next) {
    if (this.isModified()) {
      this.updatedAt = Date.now();
    }
    next();
});

ChatHistorySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);
module.exports = ChatHistory;