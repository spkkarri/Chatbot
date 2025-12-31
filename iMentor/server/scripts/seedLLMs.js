// server/scripts/seedLLMs.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const LLMConfiguration = require('../models/LLMConfiguration');

// --- The Seed Data ---
const llmSeedData = [
  // ===================================================================
  // === GEMINI MODELS (Full Suite with 1.5 and 2.5 versions)      ===
  // ===================================================================

  // 1. Gemini: The New Default - Fast & Modern
  {
    modelId: "gemini-2.5-flash-latest",
    provider: "gemini",
    displayName: "Gemini 2.5 Flash (Default)",
    description: "Next-gen performance for general chat, creative tasks, and summarization.",
    isDefault: false, 
    strengths: ["chat", "creative", "summarization"],
    subjectFocus: null
  },
  // 2. Gemini: The Ultimate Powerhouse for Code & Technical
  {
    modelId: "gemini-2.5-pro-latest",
    provider: "gemini",
    displayName: "Gemini 2.5 Pro (All rounder - for all tasks)",
    description: "The most powerful model for complex coding, mathematics, and demanding technical queries.",
    isDefault: true,
    strengths: ["code", "technical"], // Explicitly assigned to the most demanding tasks
    subjectFocus: null
  },
  // 3. Gemini: Legacy Powerhouse for Large Context & Deep Reasoning
  {
    modelId: "gemini-1.5-pro-latest",
    provider: "gemini",
    displayName: "Gemini 1.5 Pro (Large Context)",
    description: "A powerful model with a massive context window, ideal for deep reasoning over large documents.",
    isDefault: false,
    strengths: ["reasoning", "large_context"], // Assigned to its unique strengths
    subjectFocus: null
  },
  // 4. Gemini: Legacy Fast Model (Fallback/Legacy Option)
  {
    modelId: "gemini-1.5-flash-latest",
    provider: "gemini",
    displayName: "Gemini 1.5 Flash (Legacy)",
    description: "A solid and fast model for general-purpose tasks.",
    isDefault: false, 
    strengths: [], // No specific strengths to ensure it's not auto-selected over 2.5 Flash
    subjectFocus: null
  },

  // ===================================================================
  // === OLLAMA MODELS (Each with a specific role)                   ===
  // ===================================================================

  // 5. Ollama: Default & Strong All-Rounder
  {
    modelId: "qwen2.5:14b-instruct",
    provider: "ollama",
    displayName: "Ollama qwen 2.5 14b (Default)",
    description: "A well-rounded model for general chat and creative writing.",
    isDefault: true, // Default for the OLLAMA provider.
    strengths: ["chat", "creative"],
    subjectFocus: null
  },
  // 6. Ollama: Specialized for Code Generation
  {
    modelId: "codellama:7b-instruct",
    provider: "ollama",
    displayName: "Ollama Code Llama 7B",
    description: "A specialized model that excels at code generation.",
    isDefault: false,
    strengths: ["code"],
    subjectFocus: null
  },
  // 7. Ollama: Specialized for Technical & Mathematical Tasks
  {
    modelId: "deepseek-coder:6.7b-instruct",
    provider: "ollama",
    displayName: "Ollama DeepSeek Coder 6.7B",
    description: "A top-tier model for mathematics and complex technical reasoning.",
    isDefault: false,
    strengths: ["technical", "reasoning"],
    subjectFocus: null
  },
  // 8. Ollama: Fast & Efficient Model for Summarization
   {
    modelId: "phi3:instruct",
    provider: "ollama",
    displayName: "Ollama Phi-3 Mini",
    description: "A fast and capable small model for summarization tasks.",
    isDefault: false,
    strengths: ["summarization"],
    subjectFocus: null
  },

  // ===================================================================
  // === FINE-TUNED MODELS                                           ===
  // ===================================================================
  {
    modelId: "fine-tuned/physics-v1-on-qwen2",
    provider: "fine-tuned",
    displayName: "Physics Expert (Qwen 2.5 Base)",
    description: "A model fine-tuned specifically on advanced physics textbooks.",
    isDefault: false,
    strengths: ["technical", "reasoning"],
    subjectFocus: "Physics"
  }
];

const seedLLMConfigurations = async () => {
  // ... The rest of this function remains exactly the same and will handle updates correctly ...
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not found in .env file. Aborting.');
    process.exit(1);
  }

  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully.');

    const existingConfigs = await LLMConfiguration.find().select('modelId').lean();
    const existingModelIds = new Set(existingConfigs.map(config => config.modelId));

    const modelsToInsert = llmSeedData.filter(seed => !existingModelIds.has(seed.modelId));
    const modelsToUpdate = llmSeedData.filter(seed => existingModelIds.has(seed.modelId));

    if (modelsToUpdate.length > 0) {
        console.log(`Found ${modelsToUpdate.length} existing LLM configurations to update.`);
        for (const modelData of modelsToUpdate) {
            await LLMConfiguration.updateOne({ modelId: modelData.modelId }, { $set: modelData });
            console.log(`- Updated ${modelData.displayName}`);
        }
    }

    if (modelsToInsert.length === 0) {
      console.log('No new LLM configurations to add.');
    } else {
      console.log(`Found ${modelsToInsert.length} new LLM configurations to add.`);
      const inserted = await LLMConfiguration.insertMany(modelsToInsert);
      console.log('Successfully seeded the following new models:');
      inserted.forEach(doc => console.log(`- ${doc.displayName} (${doc.modelId})`));
    }

  } catch (error) {
    console.error('An error occurred during the seeding process:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nMongoDB connection closed. Seeder finished.');
  }
};

seedLLMConfigurations();