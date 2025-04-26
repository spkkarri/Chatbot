// server/services/geminiService.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
// require('dotenv').config(); // Removed dotenv

// Read API Key directly from environment variables
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-1.5-flash"; // Or read from env: process.env.GEMINI_MODEL_NAME || "gemini-1.5-flash";

if (!API_KEY) {
    // This check is now primarily done in server.js before starting
    // But keep a safeguard here.
    console.error("FATAL ERROR: GEMINI_API_KEY is not available in the environment. Server should have exited.");
    // Throw an error instead of exiting here, let the caller handle it
    throw new Error("GEMINI_API_KEY is missing.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

const baseGenerationConfig = {
    temperature: 0.7, // Moderate temperature for creative but grounded responses
    maxOutputTokens: 4096, // Adjust as needed, Flash model limit might be higher
    // topP: 0.9, // Example: Could add nucleus sampling
    // topK: 40,  // Example: Could add top-k sampling
};

// Stricter safety settings - adjust as needed for your use case
const baseSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

const generateContentWithHistory = async (chatHistory, systemPromptText = null, relevantDocs = []) => {
    try {
        if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
             throw new Error("Chat history must be a non-empty array.");
        }
        // Gemini API requires history to end with a 'user' message for sendMessage
        if (chatHistory[chatHistory.length - 1].role !== 'user') {
            console.error("History for Gemini API must end with a 'user' role message.");
            // Attempt to fix by removing trailing non-user messages if any? Risky.
            // Or just throw error.
            throw new Error("Internal error: Invalid chat history sequence for API call.");
        }

        // --- Prepare Model Options ---
        const modelOptions = {
            model: MODEL_NAME,
            generationConfig: baseGenerationConfig,
            safetySettings: baseSafetySettings,
            // Add system instruction if provided
            ...(systemPromptText && typeof systemPromptText === 'string' && systemPromptText.trim() !== '' && {
                systemInstruction: {
                    // Gemini expects system instruction parts as an array
                    parts: [{ text: systemPromptText.trim() }]
                }
             })
        };
        const model = genAI.getGenerativeModel(modelOptions);


        // --- Prepare History for startChat ---
        // History for startChat should NOT include the latest user message
        const historyForStartChat = chatHistory.slice(0, -1)
            .map(msg => ({ // Ensure correct format
                 role: msg.role,
                 parts: msg.parts.map(part => ({ text: part.text || '' }))
            }))
            .filter(msg => msg.role && msg.parts && msg.parts.length > 0 && typeof msg.parts[0].text === 'string'); // Basic validation

        // --- Start Chat Session ---
        const chat = model.startChat({
            history: historyForStartChat,
        });

        // --- Prepare the message to send ---
        // Get the text from the last user message in the original history
        let lastUserMessageText = chatHistory[chatHistory.length - 1].parts[0].text;

        // Optional: Add a subtle hint for citation if RAG was used (Gemini might pick it up)
        // if (relevantDocs.length > 0) {
        //     const citationHint = ` (Remember to cite sources like ${relevantDocs.map((doc, i) => `[${i+1}] ${doc.documentName}`).slice(0,2).join(', ')} if applicable)`;
        //     lastUserMessageText += citationHint;
        // }

        console.log(`Sending message to Gemini. History length sent to startChat: ${historyForStartChat.length}. System Prompt Used: ${!!modelOptions.systemInstruction}`);
        // console.log("Last User Message Text Sent:", lastUserMessageText.substring(0, 200) + "..."); // Log truncated message

        // --- Send Message ---
        const result = await chat.sendMessage(lastUserMessageText);

        // --- Process Response ---
        const response = result.response;
        const candidate = response?.candidates?.[0];

        // --- Validate Response ---
        if (!candidate || candidate.finishReason === 'STOP' || candidate.finishReason === 'MAX_TOKENS') {
            // Normal completion or max tokens reached
            const responseText = candidate?.content?.parts?.[0]?.text;
            if (typeof responseText === 'string') {
                return responseText; // Success
            } else {
                 console.warn("Gemini response finished normally but text content is missing or invalid.", { finishReason: candidate?.finishReason, content: candidate?.content });
                 throw new Error("Received an empty or invalid response from the AI service.");
            }
        } else {
             // Handle blocked responses or other issues
             const finishReason = candidate?.finishReason || 'Unknown';
             const safetyRatings = candidate?.safetyRatings;
             console.warn("Gemini response was potentially blocked or had issues.", { finishReason, safetyRatings });

             let blockMessage = `AI response generation failed or was blocked.`;
             if (finishReason) blockMessage += ` Reason: ${finishReason}.`;
             if (safetyRatings) {
                const blockedCategories = safetyRatings.filter(r => r.blocked).map(r => r.category).join(', ');
                if (blockedCategories) {
                    blockMessage += ` Blocked Categories: ${blockedCategories}.`;
                }
             }

             const error = new Error(blockMessage);
             error.status = 400; // Treat as a bad request or policy issue
             throw error;
        }

    } catch (error) {
        console.error("Gemini API Call Error:", error?.message || error);
        // Improve error message for client
        let clientMessage = "Failed to get response from AI service.";
        if (error.message?.includes("API key not valid")) {
            clientMessage = "AI Service Error: Invalid API Key.";
        } else if (error.message?.includes("blocked")) {
            clientMessage = error.message; // Use the specific block message
        } else if (error.status === 400) {
             clientMessage = `AI Service Error: ${error.message}`;
        }

        const enhancedError = new Error(clientMessage);
        enhancedError.status = error.status || 500; // Keep original status if available
        enhancedError.originalError = error; // Attach original error if needed for server logs
        throw enhancedError;
    }
};

module.exports = { generateContentWithHistory };
