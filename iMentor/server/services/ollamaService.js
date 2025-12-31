// server/services/ollamaService.js
const axios = require('axios');

const SERVER_DEFAULT_OLLAMA_URL = process.env.OLLAMA_API_BASE_URL || 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:14b-instruct';

const DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT = 8192;
const DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_KG = 8192;

// This function formats history for the /api/chat endpoint
function formatHistoryForOllamaChat(chatHistory) {
    return chatHistory.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.parts?.[0]?.text || ''
    }));
}

async function generateContentWithHistory(
    chatHistory,
    currentUserQuery,
    systemPromptText = null,
    options = {}
) {
    const baseUrlToUse = options.ollamaUrl || SERVER_DEFAULT_OLLAMA_URL;
    const modelToUse = options.model || DEFAULT_OLLAMA_MODEL;
    
    const headers = { 'Content-Type': 'application/json' };
    if (options.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    // Always use the /api/chat endpoint for consistency and flexibility.
    const endpoint = `${baseUrlToUse}/api/chat`;
    console.log(`[Ollama Service] ==> Calling unified /api/chat endpoint for model ${modelToUse}.`);

    // Construct the messages array for the /api/chat payload.
    const messages = [];
    if (systemPromptText) {
        messages.push({ role: 'system', content: systemPromptText });
    }
    if (chatHistory && chatHistory.length > 0) {
        messages.push(...formatHistoryForOllamaChat(chatHistory));
    }
    messages.push({ role: 'user', content: currentUserQuery });

    const requestPayload = {
        model: modelToUse,
        messages: messages,
        stream: false,
        options: {
            temperature: options.temperature || 0.7,
        }
    };

    try {
        const response = await axios.post(endpoint, requestPayload, { 
            headers,
            timeout: 120000 
        });

        // The /api/chat endpoint has a consistent response structure.
        if (response.data && response.data.message && response.data.message.content) {
            console.log(`[Ollama Service] <== Received successful response from model ${modelToUse}.`);
            return response.data.message.content.trim();
        } else {
            throw new Error("Ollama service returned an invalid or unrecognized response structure from /api/chat.");
        }
        
    } catch (error) {
        console.error(`[Ollama Service] <== Ollama API Call Error for model ${modelToUse}:`, error.message);
        const clientMessage = error.response?.data?.error || "Failed to get response from Ollama service.";
        const enhancedError = new Error(clientMessage);
        enhancedError.status = error.response?.status || 503;
        throw enhancedError;
    }
}


module.exports = {
    generateContentWithHistory,
    DEFAULT_OLLAMA_MODEL,
    DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_CHAT,
    DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_KG,
};
