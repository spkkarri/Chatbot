// server/routes/chat.js
const express = require('express');
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');
const ChatHistory = require('../models/ChatHistory');
const { v4: uuidv4 } = require('uuid');
const { generateContentWithHistory } = require('../services/geminiService');

const router = express.Router();

// --- Helper to call Python RAG Query Endpoint ---
async function queryPythonRagService(userId, query, k = 5) { // <<<--- INCREASED DEFAULT k HERE
    // Read URL from environment variable set during startup
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        console.error("PYTHON_RAG_SERVICE_URL is not set in environment. Cannot query RAG service.");
        throw new Error("RAG service configuration error.");
    }
    const queryUrl = `${pythonServiceUrl}/query`;
    console.log(`Querying Python RAG service for User ${userId} at ${queryUrl} with k=${k}`); // Log k value
    try {
        const response = await axios.post(queryUrl, {
            user_id: userId,
            query: query,
            k: k // Pass the requested k value
        }, { timeout: 30000 }); // 30 second timeout for query

        // Check for valid response structure (expecting "content" now)
        if (response.data && Array.isArray(response.data.relevantDocs)) {
            // Optional: Add a check here if needed to verify docs have 'content'
            // const hasContentField = response.data.relevantDocs.every(doc => doc && typeof doc.content === 'string');
            // if (!hasContentField && response.data.relevantDocs.length > 0) {
            //     console.warn(`Python RAG service returned docs missing the 'content' field.`);
            // }
            console.log(`Python RAG service returned ${response.data.relevantDocs.length} results.`);
            return response.data.relevantDocs;
        } else {
             console.warn(`Python RAG service returned unexpected data structure:`, response.data);
             return []; // Return empty on unexpected structure
        }
    } catch (error) {
        console.error(`Error querying Python RAG service for User ${userId}:`, error.response?.data || error.message);
        // Return empty allows chat to proceed without RAG context on error.
        return [];
    }
}


// --- @route   POST /api/chat/rag ---
// Use tempAuth middleware
router.post('/rag', tempAuth, async (req, res) => {
    const { message } = req.body;
    const userId = req.user._id.toString(); // req.user is guaranteed by tempAuth

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ message: 'Query message text required.' });
    }

    console.log(`>>> POST /api/chat/rag: User=${userId} (TEMP AUTH)`);

    try {
        // --- MODIFICATION START ---
        const kValue = 5; // Define the number of documents to retrieve
        // --- MODIFICATION END ---
        const relevantDocs = await queryPythonRagService(userId, message.trim(), kValue); // Pass kValue
        console.log(`<<< POST /api/chat/rag successful for User ${userId}. Found ${relevantDocs.length} docs.`);
        res.status(200).json({ relevantDocs }); // Send back the results

    } catch (error) {
        console.error(`!!! Error processing RAG query for User ${userId}:`, error);
        res.status(500).json({ message: "Failed to retrieve relevant documents." });
    }
});


// --- @route   POST /api/chat/message ---
// Use tempAuth middleware
router.post('/message', tempAuth, async (req, res) => {
    const { message, history, sessionId, systemPrompt, isRagEnabled, relevantDocs } = req.body;
    const userId = req.user._id.toString(); // req.user is guaranteed by tempAuth

    // --- Input Validations ---
    if (!message || typeof message !== 'string' || message.trim() === '') return res.status(400).json({ message: 'Message text required.' });
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ message: 'Session ID required.' });
    if (!Array.isArray(history)) return res.status(400).json({ message: 'Invalid history format.'});
    const useRAG = !!isRagEnabled; // Ensure boolean

    console.log(`>>> POST /api/chat/message: User=${userId}, Session=${sessionId}, RAG=${useRAG} (TEMP AUTH)`);

    let contextString = "";
    let citationHints = []; // Store hints for the LLM

    try {
        // --- Construct Context from RAG Results (if enabled and docs provided) ---
        // Use relevantDocs passed from the client (which called /rag first)
        if (useRAG && Array.isArray(relevantDocs) && relevantDocs.length > 0) {
            console.log(`   RAG Enabled: Processing ${relevantDocs.length} relevant documents provided by client.`);
            // Using the slightly relaxed prompt suggestion:
            contextString = "Answer the user's question based primarily on the following context documents.\nIf the context documents do not contain the necessary information to answer the question fully, clearly state what information is missing from the context *before* potentially providing an answer based on your general knowledge.\n\n--- Context Documents ---\n";
            relevantDocs.forEach((doc, index) => {
                // --- MODIFICATION START ---
                // Validate doc structure (check for 'content' now)
                if (!doc || typeof doc.documentName !== 'string' || typeof doc.content !== 'string') {
                    console.warn("   Skipping invalid/incomplete document in relevantDocs (missing 'content'):", doc);
                    return; // Skip this doc if structure is wrong
                }
                const docName = doc.documentName || 'Unknown Document';
                const score = doc.score !== undefined ? `(Rel. Score: ${(1 / (1 + doc.score)).toFixed(3)})` : '';
                const fullContent = doc.content; // Use the full content field
                // --- MODIFICATION END ---

                // Construct the context entry with full content
                contextString += `\n[${index + 1}] Source: ${docName} ${score}\nContent:\n${fullContent}\n---\n`; // Added separator for readability
                citationHints.push(`[${index + 1}] ${docName}`); // Hint for LLM citation
            });
            contextString += "\n--- End of Context ---\n\n";
            console.log(`   Constructed context string using full content. ${citationHints.length} valid docs used.`);
        } else {
            console.log(`   RAG Disabled or no relevant documents provided by client.`);
        }
        // --- End Context Construction ---

        // --- Prepare History & Current Message ---
        const historyForGeminiAPI = history.map(msg => ({
             role: msg.role,
             parts: msg.parts.map(part => ({ text: part.text || '' }))
        })).filter(msg => msg && msg.role && msg.parts && msg.parts.length > 0 && typeof msg.parts[0].text === 'string');

        // --- Construct Final User Query Text for Gemini ---
        let finalUserQueryText = "";
        if (useRAG && contextString) {
            const citationInstruction = `When referencing information ONLY from the context documents provided above, please cite the source using the format [Number] Document Name (e.g., ${citationHints.slice(0, 3).join(', ')}).`; // Show first few hints
            finalUserQueryText = `CONTEXT:\n${contextString}\nINSTRUCTIONS: ${citationInstruction}\n\nUSER QUESTION: ${message.trim()}`;
        } else {
            finalUserQueryText = message.trim();
        }

        const finalHistoryForGemini = [
            ...historyForGeminiAPI,
            { role: "user", parts: [{ text: finalUserQueryText }] }
        ];

        console.log(`   Calling Gemini API. History length: ${finalHistoryForGemini.length}. System Prompt: ${!!systemPrompt}`);

        // --- Call Gemini Service ---
        const geminiResponseText = await generateContentWithHistory(finalHistoryForGemini, systemPrompt);

        // --- Prepare Response ---
        let finalResponseText = geminiResponseText;
        const modelResponseMessage = {
            role: 'model',
            parts: [{ text: finalResponseText }],
            timestamp: new Date() // Add timestamp on the server
        };

        console.log(`<<< POST /api/chat/message successful for session ${sessionId}.`);
        res.status(200).json({ reply: modelResponseMessage });

    } catch (error) {
        // --- Error Handling ---
        console.error(`!!! Error processing chat message for session ${sessionId}:`, error);
        let statusCode = error.status || 500;
        let clientMessage = error.message || "Failed to get response from AI service.";
        // Don't expose excessive detail like stack traces
        if (error.originalError && statusCode === 500) {
            clientMessage = "An internal server error occurred while processing the AI response.";
        }
        res.status(statusCode).json({ message: clientMessage });
    }
});


// --- @route   POST /api/chat/history ---
// (No changes needed in this route)
router.post('/history', tempAuth, async (req, res) => {
    const { sessionId, messages } = req.body;
    const userId = req.user._id; // req.user guaranteed by tempAuth
    if (!sessionId) return res.status(400).json({ message: 'Session ID required to save history.' });
    if (!Array.isArray(messages)) return res.status(400).json({ message: 'Invalid messages format.' });

    try {
        const validMessages = messages.filter(m =>
            m && typeof m.role === 'string' &&
            Array.isArray(m.parts) && m.parts.length > 0 &&
            typeof m.parts[0].text === 'string' &&
            m.timestamp
        ).map(m => ({
            role: m.role,
            parts: [{ text: m.parts[0].text }],
            timestamp: m.timestamp
        }));

        if (validMessages.length !== messages.length) {
             console.warn(`Session ${sessionId}: Filtered out ${messages.length - validMessages.length} invalid messages during save.`);
        }
        if (validMessages.length === 0) {
             console.log(`Session ${sessionId}: No valid messages to save. Generating new session ID.`);
             const newSessionId = uuidv4();
             return res.status(200).json({
                 message: 'No history saved (empty chat). New session started.',
                 savedSessionId: null,
                 newSessionId: newSessionId
             });
        }

        const savedHistory = await ChatHistory.findOneAndUpdate(
            { sessionId: sessionId, userId: userId },
            { $set: { userId: userId, sessionId: sessionId, messages: validMessages, updatedAt: Date.now() } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        const newSessionId = uuidv4();
        console.log(`History saved for session ${savedHistory.sessionId}. New session ID generated: ${newSessionId}`);
        res.status(200).json({
            message: 'Chat history saved successfully.',
            savedSessionId: savedHistory.sessionId,
            newSessionId: newSessionId
        });
    } catch (error) {
        console.error(`Error saving chat history for session ${sessionId}:`, error);
        if (error.name === 'ValidationError') return res.status(400).json({ message: "Validation Error saving history: " + error.message });
        if (error.code === 11000) return res.status(409).json({ message: "Conflict: Session ID might already exist unexpectedly." });
        res.status(500).json({ message: 'Failed to save chat history due to a server error.' });
    }
});


// --- @route   GET /api/chat/sessions ---
// (No changes needed in this route)
router.get('/sessions', tempAuth, async (req, res) => {
    const userId = req.user._id;
    try {
        const sessions = await ChatHistory.find({ userId: userId })
            .sort({ updatedAt: -1 })
            .select('sessionId createdAt updatedAt messages')
            .lean();

        const sessionSummaries = sessions.map(session => {
             const firstUserMessage = session.messages?.find(m => m.role === 'user');
             let preview = 'Chat Session';
             if (firstUserMessage?.parts?.[0]?.text) {
                 preview = firstUserMessage.parts[0].text.substring(0, 75);
                 if (firstUserMessage.parts[0].text.length > 75) {
                     preview += '...';
                 }
             }
             return {
                 sessionId: session.sessionId,
                 createdAt: session.createdAt,
                 updatedAt: session.updatedAt,
                 messageCount: session.messages?.length || 0,
                 preview: preview
             };
        });
        res.status(200).json(sessionSummaries);
    } catch (error) {
        console.error(`Error fetching chat sessions for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve chat sessions.' });
    }
});


// --- @route   GET /api/chat/session/:sessionId ---
// (No changes needed in this route)
router.get('/session/:sessionId', tempAuth, async (req, res) => {
    const userId = req.user._id;
    const { sessionId } = req.params;
    if (!sessionId) return res.status(400).json({ message: 'Session ID parameter is required.' });
    try {
        const session = await ChatHistory.findOne({ sessionId: sessionId, userId: userId }).lean();
        if (!session) return res.status(404).json({ message: 'Chat session not found or access denied.' });
        res.status(200).json(session);
    } catch (error) {
        console.error(`Error fetching chat session ${sessionId} for user ${userId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve chat session details.' });
    }
});

module.exports = router;
