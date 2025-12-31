// server/services/geminiService.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const FALLBACK_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash";

const DEFAULT_MAX_OUTPUT_TOKENS_CHAT = 8192;
const DEFAULT_MAX_OUTPUT_TOKENS_KG = 8192;

const baseSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

async function generateContentWithHistory(
    chatHistory,
    currentUserQuery,
    systemPromptText = null,
    options = {} // Now accepts { maxOutputTokens, apiKey }
) {
    const apiKeyToUse = options.apiKey || FALLBACK_API_KEY;

    if (!apiKeyToUse) {
        console.error("FATAL ERROR: Gemini API key is not available for this request. Ensure server's GEMINI_API_KEY is set or user provides one.");
        throw new Error("Gemini API key is missing. Please configure it.");
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKeyToUse);

        if (typeof currentUserQuery !== 'string' || currentUserQuery.trim() === '') {
             throw new Error("currentUserQuery must be a non-empty string.");
        }

        const generationConfig = {
            temperature: 0.7,
            maxOutputTokens: options.maxOutputTokens || DEFAULT_MAX_OUTPUT_TOKENS_CHAT,
        };

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: (systemPromptText && typeof systemPromptText === 'string' && systemPromptText.trim() !== '') ? 
                { parts: [{ text: systemPromptText.trim() }] } : undefined,
            safetySettings: baseSafetySettings,
        });

        const historyForStartChat = (chatHistory || [])
            .map(msg => ({
                 role: msg.role, 
                 parts: Array.isArray(msg.parts) ? msg.parts.map(part => ({ text: part.text || '' })) : [{text: msg.text || ''}] 
            }))
            .filter(msg => msg.role && msg.parts && msg.parts.length > 0 && typeof msg.parts[0].text === 'string');

        const chat = model.startChat({
            history: historyForStartChat,
            generationConfig: generationConfig,
        });

        console.log(`Sending message to Gemini. History sent: ${historyForStartChat.length}. System Prompt: ${!!systemPromptText}. Max Tokens: ${generationConfig.maxOutputTokens}`);
        // console.log(`Current User Query to sendMessage (first 100): "${currentUserQuery.substring(0,100)}..."`); // Can be very long

        // console.log("\n==================== START GEMINI FINAL INPUT ====================");
        // console.log("--- System Prompt Sent to Model ---");
        // console.log(systemPromptText || "N/A");
        // console.log("\n--- History Sent to Model ---");
        // console.log(JSON.stringify(historyForStartChat, null, 2));
        // console.log("\n--- Current User Query Sent to Model ---");
        // console.log(currentUserQuery);
        // console.log("==================== END GEMINI FINAL INPUT ====================\n");
        // console.log("\n==================== START GEMINI FINAL INPUT ====================");
        // console.log("--- System Prompt Sent to Model ---");
        // console.log(systemPromptText || "N/A");
        // console.log("\n--- History Sent to Model ---");
        // console.log(JSON.stringify(historyForStartChat, null, 2));
        // console.log("\n--- Current User Query Sent to Model ---");
        // console.log(currentUserQuery);
        // console.log("==================== END GEMINI FINAL INPUT ====================\n");

        const result = await chat.sendMessage(currentUserQuery);
        const response = result.response;
        const candidate = response?.candidates?.[0];

        if (candidate && (candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS')) {
            const responseText = candidate?.content?.parts?.[0]?.text || "";
            if (candidate.finishReason === 'MAX_TOKENS') {
                console.warn("Gemini response was truncated due to MAX_TOKENS limit.");
            }
            return responseText;
        } else {
             const finishReason = candidate?.finishReason || 'Unknown';
             const safetyRatings = candidate?.safetyRatings;
             console.warn("Gemini response was potentially blocked or had issues.", { finishReason, safetyRatings });
             let blockMessage = `AI response generation failed or was blocked.`;
             if (finishReason === 'SAFETY') {
                 blockMessage += ` Reason: SAFETY.`;
                 if (safetyRatings) {
                    const blockedCategories = safetyRatings.filter(r => r.blocked).map(r => r.category).join(', ');
                    if (blockedCategories) blockMessage += ` Blocked Categories: ${blockedCategories}.`;
                 }
             } else if (finishReason) {
                 blockMessage += ` Reason: ${finishReason}.`;
             }
             const error = new Error(blockMessage);
             error.status = 400;
             throw error;
        }
    } catch (error) {
        console.error("Gemini API Call Error:", error?.message || error);
        let clientMessage = "Failed to get response from AI service.";
        if (error.message?.includes("API key not valid")) {
            clientMessage = "Invalid API Key.";
        } else if (error.message?.includes("API key not found")) {
            clientMessage = "API Key not found";
        } else if (error.message?.includes("API_KEY_INVALID")) {
            clientMessage = "API Key not invalid. Please Provide the Valid one.";
        } else if (error.message?.includes("enabled this API recently")) {
            clientMessage = "Looks like new API key. Need some time to fully activate."
        } else if (error.message?.includes("billing account")) {
            clientMessage = "Billing account issue with the provided API Key.";
        } else if (error.message?.includes("blocked due to safety")) {
            clientMessage = "AI response blocked due to safety settings.";
        } else if (error.message?.includes("Invalid JSON payload")) {
            clientMessage = "Invalid request format sent to AI.";
        } else if (error.message?.includes("User location is not supported")) {
            clientMessage = "User location is not supported for this model.";
        } else if (error.message?.includes("model is overloaded")) {
            clientMessage = "The AI model is currently overloaded. Please try again in a moment.";
        } else if (error.status === 400) {
            clientMessage = `${error.message}`; 
        }
        const enhancedError = new Error(clientMessage);
        enhancedError.status = error.status || 500; 
        enhancedError.originalError = error; 
        throw enhancedError;
    }
};

module.exports = {
    generateContentWithHistory,
    DEFAULT_MAX_OUTPUT_TOKENS_KG 
}
