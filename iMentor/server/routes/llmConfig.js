// server/routes/llmConfig.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { encrypt } = require("../utils/crypto");
const { auditLog } = require('../utils/logger');

// @route   PUT /api/llm/config
// @desc    Update user's LLM preferences (provider, key, or URL)
// @access  Private
router.put("/config", async (req, res) => {
  // 1. Destructure all possible fields.
  const { llmProvider, apiKey, ollamaUrl, ollamaModel } = req.body;
  const userId = req.user._id;

  try {
    // 2. Start with a blank object. We will only update what is sent.
    const updates = {};

    if (llmProvider) {
      if (!["gemini", "ollama"].includes(llmProvider)) {
        return res
          .status(400)
          .json({ message: "Invalid LLM provider specified." });
      }
      updates.preferredLlmProvider = llmProvider;
    }

    // If a new API key is provided, encrypt and add it to updates.
    if (apiKey) {
      updates.encryptedApiKey = encrypt(apiKey);
    }

    // If a new Ollama URL is provided, add it to updates.
    if (typeof ollamaUrl === "string") {
      updates.ollamaUrl = ollamaUrl.trim().replace(/\/+$/, "");
    }


    // If a new Ollama model is provided, add it to updates.
    if (ollamaModel) {
      updates.ollamaModel = ollamaModel;
    }

    // 3. If the updates object is empty, nothing was sent to change.
    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid update information provided." });
    }

    // 4. Use $set to only modify the fields present in the 'updates' object.
    // This will NEVER delete a field that isn't included in the request.
    await User.updateOne({ _id: userId }, { $set: updates });

    const logPayload = {
        llmProvider: llmProvider || undefined,
        apiKeyUpdated: !!apiKey,
        ollamaUrlUpdated: typeof ollamaUrl === 'string',
        ollamaModelUpdated: !!ollamaModel
    };
    auditLog(req, 'USER_CONFIG_UPDATE_SUCCESS', logPayload);
    
    res.status(200).json({ message: "LLM preferences updated successfully." });
  } catch (error) {
    console.error(`Error updating LLM config for user ${userId}:`, error);
    res.status(500).json({
      message: `Server error while updating LLM preferences: ${error.message}`,
    });
  }
});

// This GET route is correct and doesn't need changes, but it should also return ollamaUrl
router.get("/config", async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await User.findById(userId).select(
      "preferredLlmProvider ollamaModel ollamaUrl"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json({
      preferredLlmProvider: user.preferredLlmProvider,
      ollamaModel: user.ollamaModel,
      ollamaUrl: user.ollamaUrl, // Also return the URL
    });
  } catch (error) {
    console.error(`Error fetching LLM config for user ${userId}:`, error);
    res.status(500).json({ message: "Server error fetching LLM preferences." });
  }
});

module.exports = router;
