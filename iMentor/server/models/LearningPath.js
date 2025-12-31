// server/models/LearningPath.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ModuleSchema = new mongoose.Schema({
    moduleId: { 
        type: String, 
        required: true, 
        default: () => `mod_${uuidv4()}` 
    },
    title: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['completed', 'in_progress', 'not_started', 'locked'], 
        default: 'not_started' 
    },
    objective: {
        type: String
    },
    activity: {
        type: { 
            type: String, 
            required: true,
            enum: ['direct_answer', 'web_search', 'academic_search', 'document_review', 'code_executor']
        },
        resourceName: { // e.g., 'RL_Foundations.pdf' or null
            type: String 
        },
        suggestedPrompt: {
            type: String
        }
    }
}, { _id: false });

const LearningPathSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        index: true 
    },
    title: { 
        type: String, 
        required: true 
    }, // The user's goal, e.g., "Master Reinforcement Learning"
    isActive: { 
        type: Boolean, 
        default: true 
    },
    modules: [ModuleSchema],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const LearningPath = mongoose.model('LearningPath', LearningPathSchema);
module.exports = LearningPath;