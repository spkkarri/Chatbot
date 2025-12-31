// server/services/kgExtractionService.js
const { decrypt } = require("../utils/crypto");
const User = require("../models/User");
const geminiService = require("./geminiService");
const ollamaService = require("./ollamaService");
const axios = require("axios");
const path = require("path");

const KG_EXTRACTION_PROMPT = `
You are an expert data architect. Your task is to analyze the provided text and extract a detailed knowledge graph of the key concepts and their relationships.

**INSTRUCTIONS:**
1.  **Identify Entities/Nodes**: Identify the top 5-7 most important entities (concepts, technologies, processes). These will be your nodes.
2.  **Identify Relationships/Edges**: Determine how these nodes are connected with descriptive verb phrases (e.g., 'IS_A', 'USES', 'RESULTS_IN').
3.  **Format as JSON**: Your entire output MUST be a single, valid JSON object with "nodes" and "edges".
    -   Nodes: \`[{"id": "NodeID", "description": "A brief, one-sentence description."}]\`
    -   Edges: \`[{"from": "SourceNodeID", "to": "TargetNodeID", "relationship": "RELATIONSHIP_TYPE"}]\`
4.  **Be Concise**: Focus only on the most critical concepts from the provided text.

---
**TEXT TO ANALYZE:**
"{textToAnalyze}"
---

**FINAL KNOWLEDGE GRAPH JSON (start immediately with \`{\`):**
`;

async function extractAndStoreKgFromText(text, sessionId, userId, llmConfig) { // llmConfig is now a fallback
  const logPrefix = `[KG Extraction Service] Session: ${sessionId}`;
  try {
    // --- THIS IS THE FIX ---
    // Directly fetch the user's settings to ensure their preference is always respected.
    const user = await User.findById(userId).select('+encryptedApiKey preferredLlmProvider ollamaModel ollamaUrl');
    if (!user) throw new Error("User not found for KG extraction.");

    const preferredLlmProvider = user.preferredLlmProvider;
    const llmService = preferredLlmProvider === "ollama" ? ollamaService : geminiService;
    
    const finalLlmOptions = {
        apiKey: user.encryptedApiKey ? decrypt(user.encryptedApiKey) : null,
        ollamaUrl: user.ollamaUrl,
        model: user.ollamaModel,
        temperature: 0.2,
    };
    // --- END OF FIX ---

    if (preferredLlmProvider === "gemini" && !finalLlmOptions.apiKey) {
      throw new Error("User has selected Gemini but has no API key configured for KG extraction.");
    }

    const prompt = KG_EXTRACTION_PROMPT.replace(
      "{textToAnalyze}",
      text.substring(0, 4000)
    );

    console.log(`${logPrefix} Calling LLM (${preferredLlmProvider}) to extract KG entities...`);
    const responseText = await llmService.generateContentWithHistory(
      [],
      prompt,
      null,
      finalLlmOptions // Use the corrected options
    );

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      throw new Error("LLM did not return a valid JSON object for the KG.");

    const graphData = JSON.parse(jsonMatch[0]);
    if (!graphData.nodes || !graphData.edges)
      throw new Error("LLM JSON is missing 'nodes' or 'edges'.");

    console.log(
      `${logPrefix} Extracted ${graphData.nodes.length} nodes. Sending to Python for ingestion.`
    );

    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl)
      throw new Error("Python service URL not configured.");

    await axios.post(
      `${pythonServiceUrl}/kg`,
      {
        userId: userId.toString(),
        originalName: sessionId,
        nodes: graphData.nodes,
        edges: graphData.edges,
      },
      { timeout: 60000 }
    );

    console.log(`${logPrefix} KG ingestion successful.`);
  } catch (error) {
    console.error(
      `${logPrefix} Failed to extract and store KG:`,
      error.message
    );
    // Do not throw here to prevent crashing the main thread for a background task
  }
}

module.exports = { extractAndStoreKgFromText };
