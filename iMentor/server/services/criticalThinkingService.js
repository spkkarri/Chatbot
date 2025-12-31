// server/services/criticalThinkingService.js
const geminiService = require('./geminiService');
const ollamaService = require('./ollamaService');
const { CRITICAL_THINKING_CUE_TEMPLATE } = require('../config/promptTemplates');

const CUE_GEMINI_MODEL = process.env.PROMPT_COACH_GEMINI_MODEL || 'gemini-1.5-flash-latest';
const CUE_OLLAMA_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:14b-instruct';

/**
 * Analyzes an AI's final answer to generate critical thinking cue prompts.
 * @param {string} aiAnswerText - The final text of the AI's response.
 * @param {object} llmConfig - Configuration object containing the user's provider, key, URL, etc.
 * @returns {Promise<object|null>} An object with cue prompts, or null if none are generated or an error occurs.
 */
async function generateCues(aiAnswerText, llmConfig) {
    if (!aiAnswerText || aiAnswerText.trim().length < 50) {
        return null;
    }

    const { llmProvider, ollamaUrl, apiKey } = llmConfig;
    const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;

    const promptForLlm = CRITICAL_THINKING_CUE_TEMPLATE.replace('{aiAnswer}', aiAnswerText.substring(0, 2000));

    const llmOptions = {
        model: llmProvider === 'ollama' ? CUE_OLLAMA_MODEL : CUE_GEMINI_MODEL,
        apiKey: apiKey,
        ollamaUrl: ollamaUrl,
        temperature: 0.4 
    };

    try {
        console.log(`[CriticalThinkingService] Generating cues using ${llmProvider} with model ${llmOptions.model}.`);
        const responseText = await llmService.generateContentWithHistory([], promptForLlm, null, llmOptions);

        // --- THIS IS THE FIX (More Robust JSON Extraction) ---
        let jsonString = '';
        // First, try to find a JSON object within markdown code fences
        const fencedMatch = responseText.match(/```(json)?\s*(\{[\s\S]*?\})\s*```/);
        if (fencedMatch && fencedMatch[2]) {
            jsonString = fencedMatch[2];
        } else {
            // If not found, fall back to finding the first and last curly brace
            const firstBrace = responseText.indexOf('{');
            const lastBrace = responseText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonString = responseText.substring(firstBrace, lastBrace + 1);
            }
        }
        
        if (!jsonString) {
            console.warn("[CriticalThinkingService] LLM response did not contain a parsable JSON object.");
            return null;
        }
        // --- END OF FIX ---
        
        const parsedResponse = JSON.parse(jsonString);

        if (parsedResponse.verificationPrompt || parsedResponse.alternativePrompt || parsedResponse.applicationPrompt) {
            return parsedResponse;
        }

        return null;

    } catch (error) {
        console.error(`[CriticalThinkingService] Failed to generate cues: ${error.message}`);
        return null;
    }
}

module.exports = {
    generateCues
};
