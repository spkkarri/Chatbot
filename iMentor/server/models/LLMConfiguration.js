// server/models/LLMConfiguration.js
const mongoose = require('mongoose');

const LLMConfigurationSchema = new mongoose.Schema({
  modelId: { type: String, required: true, unique: true, description: "e.g., 'gemini-1.5-pro', 'ollama/qwen2.5:14b-instruct', 'fine-tuned/physics-v1'" },
  provider: { type: String, required: true, enum: ['gemini', 'ollama', 'openai', 'fine-tuned'] },
  displayName: { type: String, required: true, description: "e.g., 'Gemini 1.5 Pro', 'Ollama Qwen 2.5'" },
  description: { type: String, description: "Internal notes on the model's strengths." },
  isDefault: { type: Boolean, default: false, description: "Fallback model if no specific model is chosen." },
  // Strengths for the router to use in its decision-making
  strengths: [{ type: String, enum: ['reasoning', 'chat', 'code', 'technical', 'creative', 'summarization', 'large_context', 'multilingual'] }],  // If it's a fine-tuned model, this links it to a subject (FOR FEATURE P2.8)
  subjectFocus: { type: String, default: null, index: true }, 
});

module.exports = mongoose.model('LLMConfiguration', LLMConfigurationSchema);