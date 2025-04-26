const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'model'], // Gemini roles
        required: true
    },
    parts: [{
        text: {
            type: String,
            required: true
        }
        // _id: false // Mongoose adds _id by default, can disable if truly not needed per part
    }],
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // Don't create separate _id for each message object in the array

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
    messages: [MessageSchema], // Array of message objects
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});

// Update `updatedAt` timestamp before saving any changes
ChatHistorySchema.pre('save', function (next) {
    if (this.isModified()) { // Only update if document changed
      this.updatedAt = Date.now();
    }
    next();
});

// Also update `updatedAt` on findOneAndUpdate operations if messages are modified
ChatHistorySchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});


const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);

module.exports = ChatHistory;
