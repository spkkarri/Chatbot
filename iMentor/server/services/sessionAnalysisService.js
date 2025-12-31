// server/services/sessionAnalysisService.js
const geminiService = require('./geminiService');
const ollamaService = require('./ollamaService');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');


const SUMMARY_GAPS_PROMPT = `You are an expert educational analyst. Your task is to analyze the provided chat transcript and perform three actions. Your entire output MUST be a single, valid JSON object with NO other text before or after it.

The JSON object MUST have three keys:
1.  "summary": A string containing an updated, cumulative summary of the conversation. Incorporate the "Existing Summary" with insights from the "New Messages".
2.  "keyTopics": An array of strings listing the 3-4 most important topics discussed in the conversation (e.g., ["Python Decorators", "Machine Learning Applications"]). This must be generated regardless of user proficiency.
3.  "knowledgeGaps": An array of objects, each with "topic" (string) and "proficiencyScore" (a number from 0.0 to 1.0).

**CRITICAL INSTRUCTIONS FOR "knowledgeGaps":**
- A knowledge gap exists if the user **explicitly states confusion** (e.g., "I have a gap in X", "I don't understand Y"), even if you provided a good explanation later.
- A knowledge gap exists if the user asks **multiple, basic clarifying questions** about the same foundational topic.
- Assign a **low proficiencyScore (e.g., 0.3 - 0.5)** to any topic where the user stated a "huge gap" or significant confusion at the start.
- Only include topics where the user's proficiency appears to be below 0.8 by the end of the conversation. If they seem to understand everything perfectly, this array should be empty.

Example Output:
{
  "summary": "The user stated a significant gap in their understanding of the Software Development Life Cycle (SDLC) and Separation of Concerns (SoC). A detailed explanation of SoC was provided, covering its goals and analogies.",
  "keyTopics": ["Separation of Concerns (SoC)", "Software Design Principles", "System Complexity Management"],
  "knowledgeGaps": [
    {
      "topic": "Separation of Concerns (SoC)",
      "proficiencyScore": 0.4
    }
  ]
}`;



// --- NEW, FOCUSED PROMPT 2: For Recommendations ---
const RECOMMENDATIONS_PROMPT = `You are an expert academic advisor. Based on the provided list of topics from a recent study session, your task is to generate 3 strategic "next step" recommendations. Your entire output MUST be a single, valid JSON object with ONE key, "recommendations", containing an array of objects.

For each topic, suggest a logical follow-up action.
- Suggest 'direct_answer' for a related, more advanced concept.
- Suggest 'web_search' for practical applications or recent news.
- Suggest 'academic_search' for deeper, theoretical research.

Each recommendation object MUST have these keys:
- "topic": The string for the NEW recommended topic.
- "actionType": A string, must be one of 'web_search', 'academic_search', or 'direct_answer'.
- "suggestion_text": A string containing a brief, encouraging sentence explaining what the user will learn next.

Example Input Topics: ["Machine Learning Definition", "Real-world AI Applications"]
Example Output:
{
  "recommendations": [
    {
      "topic": "Supervised vs. Unsupervised Learning",
      "actionType": "direct_answer",
      "suggestion_text": "Now that you know what ML is, let's explore its main learning paradigms."
    },
    {
      "topic": "AI in Healthcare",
      "actionType": "web_search",
      "suggestion_text": "Discover how the applications we discussed are being used in the medical field today."
    },
    {
      "topic": "Neural Network Architectures",
      "actionType": "academic_search",
      "suggestion_text": "Dive deeper into the technical foundations of modern AI by exploring research papers."
    }
  ]
}`;



/**
 * STEP A: Gets the summary and knowledge gaps from a transcript.
 */
async function getSummaryAndGaps(transcript, existingSummary, llmProvider, ollamaModel, userApiKey, userOllamaUrl) {
    // Add keyTopics to the default response for safety.
    const defaultResponse = { summary: existingSummary || "", knowledgeGaps: [], keyTopics: [] };
    const userPrompt = `Existing Summary:\n"""\n${existingSummary || "None"}\n"""\n\nNew Messages:\n"""\n${transcript}\n"""\n\nPlease provide your analysis in the required JSON format.`;
    
    console.log(`[SessionAnalysisService] Requesting summary, gaps, and key topics using ${llmProvider}.`);
    
    try {
        const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;
        const llmOptions = { apiKey: userApiKey, ollamaUrl: userOllamaUrl, model: ollamaModel, temperature: 0.2 };
        const responseText = await llmService.generateContentWithHistory([], userPrompt, SUMMARY_GAPS_PROMPT, llmOptions);

        // Find and parse the JSON block from the LLM's response.
        const jsonMatch = responseText.match(/```(json)?\s*([\s\S]+?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[2].trim() : responseText.trim();
        const result = JSON.parse(jsonString);

        // Safely extract each piece of data, providing fallbacks.
        const finalSummary = result.summary || existingSummary || "";
        const knowledgeGaps = (result.knowledgeGaps && Array.isArray(result.knowledgeGaps)) ? result.knowledgeGaps : [];
        const keyTopics = (result.keyTopics && Array.isArray(result.keyTopics)) ? result.keyTopics : [];
        
        console.log(`[SessionAnalysisService] Analysis successful. Found ${knowledgeGaps.length} gaps and ${keyTopics.length} key topics.`);
        
        // Return all three pieces of data in the final object.
        return { summary: finalSummary, knowledgeGaps, keyTopics };
        
    } catch (error) {
        console.error(`[SessionAnalysisService] Error during summary/gap/topic analysis: ${error.message}`);
        return defaultResponse; // Return a safe default on any error.
    }
}

/**
 * STEP B: Gets recommendations based on knowledge gaps.
 */
async function generateRecommendations(knowledgeGaps, llmProvider, ollamaModel, userApiKey, userOllamaUrl) {
    if (!knowledgeGaps || knowledgeGaps.length === 0) {
        return []; // No gaps, no recommendations needed.
    }
    
    const userPrompt = `Knowledge Gaps Identified:\n${JSON.stringify(knowledgeGaps, null, 2)}\n\nPlease provide your recommendations in the required JSON format.`;
    console.log(`[SessionAnalysisService] Requesting recommendations for ${knowledgeGaps.length} knowledge gaps.`);

    try {
        const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;
        const llmOptions = { apiKey: userApiKey, ollamaUrl: userOllamaUrl, model: ollamaModel, temperature: 0.5 };
        const responseText = await llmService.generateContentWithHistory([], userPrompt, RECOMMENDATIONS_PROMPT, llmOptions);

        const jsonMatch = responseText.match(/```(json)?\s*([\s\S]+?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[2].trim() : responseText.trim();
        const result = JSON.parse(jsonString);

        const recommendations = (result.recommendations && Array.isArray(result.recommendations)) ? result.recommendations.slice(0, 3) : [];
        console.log(`[SessionAnalysisService] Recommendation generation successful. Generated ${recommendations.length} recommendations.`);
        return recommendations;
    } catch (error) {
        console.error(`[SessionAnalysisService] Error during recommendation generation: ${error.message}`);
        return []; // Return empty array on error
    }
}

/**
 * Orchestrates the full analysis pipeline.
 * @returns {Promise<{summary: string, knowledgeGaps: Map<string, number>, recommendations: Array<Object>}>}
 */
async function analyzeAndRecommend(messagesToSummarize, existingSummary, llmProvider, ollamaModel, userApiKey, userOllamaUrl) {
    const defaultResponse = { summary: existingSummary || "", knowledgeGaps: new Map(), recommendations: [] };
    if (!messagesToSummarize || messagesToSummarize.length < 2) {
        return defaultResponse;
    }
    
    const transcript = messagesToSummarize.map(msg => `${msg.role === 'model' ? 'Tutor' : 'Student'}: ${msg.parts?.[0]?.text || ''}`).join('\n---\n');

    // Step A: Get Summary, Gaps, and NOW Key Topics
    const { summary, knowledgeGaps, keyTopics } = await getSummaryAndGaps(transcript, existingSummary, llmProvider, ollamaModel, userApiKey, userOllamaUrl);

    // Step B: Generate Recommendations FROM THE KEY TOPICS
    // We now pass keyTopics to the recommendation generator instead of knowledgeGaps
    const recommendations = await generateRecommendations(keyTopics, llmProvider, ollamaModel, userApiKey, userOllamaUrl);
    
    // ... (rest of the function converting knowledgeGaps to a Map remains the same)
    const knowledgeGapsMap = new Map();
    if (knowledgeGaps) {
        knowledgeGaps.forEach(item => {
            if (typeof item.topic === 'string' && typeof item.proficiencyScore === 'number') {
                knowledgeGapsMap.set(item.topic, item.proficiencyScore);
            }
        });
    }

        return { summary, knowledgeGaps: knowledgeGapsMap, recommendations, keyTopics };}


module.exports = { analyzeAndRecommend }; 