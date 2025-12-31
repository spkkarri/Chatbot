// server/routes/chat.js
const express = require('express');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const ChatHistory = require('../models/ChatHistory');
const User = require('../models/User');
const { processQueryWithToT_Streaming } = require('../services/totOrchestrator');
const { analyzeAndRecommend } = require('../services/sessionAnalysisService');
const { processAgenticRequest } = require('../services/agentService');
const { generateCues } = require('../services/criticalThinkingService');
const { decrypt } = require('../utils/crypto');
const { redisClient } = require('../config/redisClient');
const { analyzePrompt } = require('../services/promptCoachService');
const { extractAndStoreKgFromText } = require('../services/kgExtractionService');
const { logger } = require('../utils/logger');
const { auditLog } = require('../utils/logger');
const { selectLLM } = require('../services/llmRouterService');
const LLMPerformanceLog = require('../models/LLMPerformanceLog');
const router = express.Router();


function streamEvent(res, eventData) {
    if (res.writableEnded) {
        console.warn('[Chat Route Stream] Attempted to write to an already closed stream.');
        return;
    }
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
}



function doesQuerySuggestRecall(query) {
    const lowerCaseQuery = query.toLowerCase();
    const recallKeywords = [
        'my name', 'my profession', 'i am', 'i told you',
        'remember', 'recall', 'remind me', 'go back to',
        'previously', 'before', 'we discussed', 'we were talking about',
        'earlier', 'yesterday', 'last session',
        'what did i say', 'what was', 'what were', 'who am i',
        'do you know', 'can you tell me again',
        'continue with', 'let\'s continue', 'pick up where we left off',
    ];
    return recallKeywords.some(keyword => lowerCaseQuery.includes(keyword));
}



router.post('/message', async (req, res) => {
    const {
        query, sessionId, useWebSearch, useAcademicSearch,
        systemPrompt: clientProvidedSystemInstruction, criticalThinkingEnabled,
        documentContextName, filter
    } = req.body;
    
    const userId = req.user._id;

    auditLog(req, 'CHAT_MESSAGE_SENT', {
        queryLength: query.length,
        useWebSearch: !!useWebSearch,
        useAcademicSearch: !!useAcademicSearch,
        criticalThinkingEnabled: !!criticalThinkingEnabled,
        documentContext: documentContextName || null,
        llmProvider: req.user?.preferredLlmProvider || 'gemini'
    });


    if (!query || typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Query message text required.' });
    }
    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ message: 'Session ID required.' });
    }

    const userMessageForDb = { role: 'user', parts: [{ text: query }], timestamp: new Date() };
    console.log(`>>> POST /api/chat/message: User=${userId}, Session=${sessionId}, CriticalThinking=${criticalThinkingEnabled}, Query: "${query.substring(0, 50)}..."`);
    const startTime = Date.now();

    try {
        const [chatSession, user] = await Promise.all([
            ChatHistory.findOne({ sessionId: sessionId, userId: userId }),
            User.findById(userId).select('+encryptedApiKey preferredLlmProvider ollamaModel ollamaUrl apiKeyRequestStatus').lean()
        ]);
        
        if (user?.preferredLlmProvider === 'gemini' && user?.apiKeyRequestStatus === 'pending' && !user?.encryptedApiKey) {
            console.warn(`[Chat Route] Denying chat access for user ${userId} due to pending API key request.`);
            const err = new Error('Your request for an API key is pending approval. You cannot start a conversation until the administrator approves your request.');
            err.status = 403; // Forbidden
            throw err;
        }

        const historyFromDb = chatSession ? chatSession.messages : [];
        const chatContext = { userId, subject: documentContextName, chatHistory: historyFromDb, user: user };
        const { chosenModel, logic: routerLogic } = await selectLLM(query.trim(), chatContext); 
        const llmConfig = {
            llmProvider: chosenModel.provider,
            geminiModel: chosenModel.provider === 'gemini' ? chosenModel.modelId : null,
            ollamaModel: chosenModel.provider === 'ollama' ? (chosenModel.modelId.includes('/') ? chosenModel.modelId.split('/')[1] : chosenModel.modelId) : null,
            apiKey: user?.encryptedApiKey ? decrypt(user.encryptedApiKey) : null,
            ollamaUrl: user?.ollamaUrl
        };
        
        const summaryFromDb = chatSession ? chatSession.summary || "" : "";
        const historyForLlm = [];

        if (summaryFromDb && doesQuerySuggestRecall(query.trim())) {
            historyForLlm.push({ role: 'user', parts: [{ text: `CONTEXT (Summary of Past Conversations): """${summaryFromDb}"""` }] });
            historyForLlm.push({ role: 'model', parts: [{ text: "Understood. I will use this context if the user's query is about our past conversations." }] });
        }
        
        const formattedDbMessages = historyFromDb.map(msg => ({ role: msg.role, parts: msg.parts.map(part => ({ text: part.text || '' })) }));
        historyForLlm.push(...formattedDbMessages);
        
        const requestContext = {
            documentContextName, criticalThinkingEnabled, filter,
            sessionId, // Pass sessionId for logging
            userId: userId.toString(), 
            systemPrompt: clientProvidedSystemInstruction,
            isWebSearchEnabled: !!useWebSearch, 
            isAcademicSearchEnabled: !!useAcademicSearch,
            ...llmConfig
        };

        let agentResponse;
        if (criticalThinkingEnabled) {
            // --- Logic for STREAMING response ---
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            
            const accumulatedThoughts = [];
            const interceptingStreamCallback = (eventData) => {
                if (eventData.type === 'thought') accumulatedThoughts.push(eventData.content);
                streamEvent(res, eventData);
            };
            
            const totResult = await processQueryWithToT_Streaming(query.trim(), historyForLlm, requestContext, interceptingStreamCallback);
            const endTime = Date.now();
            console.log(`[Chat Route] ToT Streaming request for session ${sessionId} completed in ${endTime - startTime}ms.`);
            const cues = await generateCues(totResult.finalAnswer, llmConfig);

            agentResponse = { ...totResult, thinking: accumulatedThoughts.join(''), criticalThinkingCues: cues };
            
            // 1. Create Log Entry AFTER getting the final answer
            const logEntry = new LLMPerformanceLog({
                userId, 
                sessionId, 
                query: query.trim(), 
                response: agentResponse.finalAnswer, // <-- THIS IS THE NEW LINE
                chosenModelId: chosenModel.modelId,
                routerLogic: routerLogic, 
                responseTimeMs: endTime - startTime
            });
            await logEntry.save();
            // --- END MODIFICATION (Streaming Path) ---

            // 2. Inject logId into the response object
            agentResponse.logId = logEntry._id;
            
            // ... (rest of the streaming logic remains the same)
            // 3. Prepare message for DB and save it ONCE.
            const aiMessageForDb = { 
                ...agentResponse, 
                sender: 'bot', 
                role: 'model', 
                text: agentResponse.finalAnswer, 
                parts: [{ text: agentResponse.finalAnswer }], 
                timestamp: new Date() 
            };
            delete aiMessageForDb.criticalThinkingCues;
            delete aiMessageForDb.sender;
            delete aiMessageForDb.text;
            delete aiMessageForDb.action;
    
            await ChatHistory.findOneAndUpdate({ sessionId, userId }, { $push: { messages: { $each: [userMessageForDb, aiMessageForDb] } } }, { upsert: true });
            
            // 4. Trigger KG extraction
            if (agentResponse.finalAnswer) {
                extractAndStoreKgFromText(agentResponse.finalAnswer, sessionId, userId, llmConfig);
            }

            // 5. Send final event and close stream
            streamEvent(res, { type: 'final_answer', content: agentResponse });
            res.end();

        } else {
            // --- Logic for STANDARD JSON response ---
            const startTime = Date.now(); // Moved start time here
            agentResponse = await processAgenticRequest(query.trim(), historyForLlm, clientProvidedSystemInstruction, requestContext);
            const endTime = Date.now();
            console.log(`[Chat Route] Standard Agentic request for session ${sessionId} completed in ${endTime - startTime}ms.`);
            
            // --- START MODIFICATION (Non-Streaming Path) ---
            // 1. Create the Performance Log Entry with the response
            const logEntry = new LLMPerformanceLog({
                userId, 
                sessionId, 
                query: query.trim(), 
                response: agentResponse.finalAnswer, // <-- THIS IS THE NEW LINE
                chosenModelId: chosenModel.modelId,
                routerLogic: routerLogic, 
                responseTimeMs: endTime - startTime
            });
            await logEntry.save();
            console.log(`[PerformanceLog] Logged decision for session ${sessionId} with logId: ${logEntry._id}.`);
            // --- END MODIFICATION (Non-Streaming Path) ---
            
            // 2. Build the FINAL AI message object for both DB and Client
            const finalAiMessage = {
                sender: 'bot',
                role: 'model',
                text: agentResponse.finalAnswer,
                parts: [{ text: agentResponse.finalAnswer }],
                timestamp: new Date(),
                thinking: agentResponse.thinking || null,
                references: agentResponse.references || [],
                source_pipeline: agentResponse.sourcePipeline,
                action: agentResponse.action || null,
                logId: logEntry._id, // Attach the log ID
                criticalThinkingCues: await generateCues(agentResponse.finalAnswer, llmConfig)
            };
            
            // 3. Create a clean version for the database (without frontend-specific fields)
            const messageForDb = { ...finalAiMessage };
            delete messageForDb.sender;
            delete messageForDb.text;
            delete messageForDb.criticalThinkingCues;
            delete messageForDb.action;
            
            // 4. Save to Database ONCE
            await ChatHistory.findOneAndUpdate(
                { sessionId, userId },
                { $push: { messages: { $each: [userMessageForDb, messageForDb] } } },
                { upsert: true }
            );

            // 5. Send final response to client
            res.status(200).json({ reply: finalAiMessage });
            
            // 6. Trigger background KG extraction
            if (agentResponse.finalAnswer) {
                extractAndStoreKgFromText(agentResponse.finalAnswer, sessionId, userId, llmConfig);
            }
        }
        
        // --- FIX ---
        // The redundant, common DB save logic that was here has been removed.
        // --- END FIX ---

    } catch (error) {
        console.error(`!!! Error processing chat message for Session ${sessionId}:`, error);
        const clientMessage = error.message || "Failed to get response from AI service.";
        
        if (res.headersSent && !res.writableEnded) {
            streamEvent(res, { type: 'error', content: clientMessage });
            res.end();
        } else if (!res.headersSent) {
            res.status(error.status || 500).json({ message: clientMessage });
        }
    }
});


router.post('/history', async (req, res) => {
    const { previousSessionId, skipAnalysis } = req.body;
    const userId = req.user._id;
    const newSessionId = uuidv4();
    
    auditLog(req, 'NEW_CHAT_SESSION_CREATED', {
        previousSessionId: previousSessionId || null,
        skipAnalysis: !!skipAnalysis
    });

    // This will hold our final response payload
    const responsePayload = {
        message: 'New session started.',
        newSessionId: newSessionId,
        studyPlanSuggestion: null // Default to null
    };

    try {
        if (previousSessionId && !skipAnalysis) {
            const previousSession = await ChatHistory.findOne({ sessionId: previousSessionId, userId: userId });
            
            if (previousSession && previousSession.messages?.length > 1) {
                console.log(`[Chat Route] Finalizing previous session '${previousSessionId}'...`);
                
                const user = await User.findById(userId).select('profile preferredLlmProvider ollamaModel ollamaUrl +encryptedApiKey');
                const llmConfig = {
                    llmProvider: user?.preferredLlmProvider || 'gemini',
                    ollamaModel: user?.ollamaModel || process.env.OLLAMA_DEFAULT_MODEL,
                    apiKey: user?.encryptedApiKey ? decrypt(user.encryptedApiKey) : null,
                    ollamaUrl: user?.ollamaUrl || null
                };

                const { summary, knowledgeGaps, recommendations, keyTopics } = await analyzeAndRecommend(
                    previousSession.messages, previousSession.summary,
                    llmConfig.llmProvider, llmConfig.ollamaModel, llmConfig.apiKey, llmConfig.ollamaUrl
                );

                await ChatHistory.updateOne(
                    { sessionId: previousSessionId, userId: userId },
                    { $set: { summary: summary } }
                );

                if (knowledgeGaps && knowledgeGaps.size > 0) {
                    user.profile.performanceMetrics.clear();     
                    knowledgeGaps.forEach((score, topic) => {
                        user.profile.performanceMetrics.set(topic.replace(/\./g, '-'), score);
                    });
                    await user.save(); 
                    console.log(`[Chat Route] Updated user performance metrics with ${knowledgeGaps.size} new gaps.`);

                    let mostSignificantGap = null;
                    let lowestScore = 1.1;

                    knowledgeGaps.forEach((score, topic) => {
                        if (score < lowestScore) {
                            lowestScore = score;
                            mostSignificantGap = topic;
                        }
                    });

                    if (mostSignificantGap && lowestScore < 0.6) {
                        console.log(`[Chat Route] SIGNIFICANT KNOWLEDGE GAP DETECTED: "${mostSignificantGap}" (Score: ${lowestScore}). Generating study plan suggestion.`);
                        responsePayload.studyPlanSuggestion = {
                            topic: mostSignificantGap,
                            reason: `Analysis of your last session shows this is a key area for improvement.`
                        };
                    }
                }
                
                if (keyTopics && keyTopics.length > 0 && !responsePayload.studyPlanSuggestion) {
                    const primaryTopic = keyTopics[0];
                    console.log(`[Chat Route] Focused topic detected: "${primaryTopic}". Generating study plan suggestion.`);
                    responsePayload.studyPlanSuggestion = {
                        topic: primaryTopic,
                        reason: `Your last session focused on ${primaryTopic}. Would you like to create a structured study plan to master it?`
                    };
                }

                if (redisClient && redisClient.isOpen && recommendations && recommendations.length > 0) {
                    const cacheKey = `recommendations:${newSessionId}`;
                    await redisClient.set(cacheKey, JSON.stringify(recommendations), { EX: 3600 });
                    console.log(`[Chat Route] Caching ${recommendations.length} quick recommendations for new session ${newSessionId}.`);
                }
            }
        }

        await ChatHistory.create({ userId, sessionId: newSessionId, messages: [] });
        console.log(`[Chat Route] New session ${newSessionId} created. Sending response to user ${userId}.`);
        res.status(200).json(responsePayload);

    } catch (error) {
        console.error(`Error during finalize-and-create-new process:`, error);
        if (!res.headersSent) {
            try {
                await ChatHistory.create({ userId, sessionId: newSessionId, messages: [] });
                responsePayload.message = 'New session started, but analysis of previous session failed.';
                res.status(200).json(responsePayload);
            } catch (fallbackError) {
                 res.status(500).json({ message: 'A critical error occurred while creating a new session.' });
            }
        }
    }
});

router.get('/sessions', async (req, res) => {
    try {
        const sessions = await ChatHistory.find({ userId: req.user._id }).sort({ updatedAt: -1 }).select('sessionId createdAt updatedAt messages').lean();
        const sessionSummaries = sessions.map(session => {
            const firstUserMessage = session.messages?.find(m => m.role === 'user');
            let preview = firstUserMessage?.parts?.[0]?.text?.substring(0, 75) || 'Chat Session';
            if (preview.length === 75) preview += '...';
            return { sessionId: session.sessionId, createdAt: session.createdAt, updatedAt: session.updatedAt, messageCount: session.messages?.length || 0, preview: preview };
        });
        res.status(200).json(sessionSummaries);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve chat sessions.' });
    }
});

router.get('/session/:sessionId', async (req, res) => {
     try {
        const session = await ChatHistory.findOne({ sessionId: req.params.sessionId, userId: req.user._id }).lean();
        if (!session) return res.status(404).json({ message: 'Chat session not found or access denied.' });

        const messagesForFrontend = (session.messages || []).map(msg => ({
            id: msg._id || uuidv4(),
            sender: msg.role === 'model' ? 'bot' : 'user',
            text: msg.parts?.[0]?.text || '',
            thinking: msg.thinking,
            references: msg.references,
            timestamp: msg.timestamp,
            source_pipeline: msg.source_pipeline,
            logId: msg.logId || null
        }));
        
        res.status(200).json({ ...session, messages: messagesForFrontend });
    } catch (error) {
        console.error(`!!! Error fetching chat session ${req.params.sessionId} for user ${req.user._id}:`, error);
        res.status(500).json({ message: 'Failed to retrieve chat session details.' });
    }
});

router.delete('/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user._id;
    try {
        const result = await ChatHistory.deleteOne({ sessionId: sessionId, userId: userId });
        if (redisClient && redisClient.isOpen) {
            const cacheKey = `session:${sessionId}`;
            await redisClient.del(cacheKey);
        }
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Chat session not found.' });
        }
        res.status(200).json({ message: 'Chat session deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error while deleting chat session.' });
    }
});


// @route   POST /api/chat/analyze-prompt
// @desc    Analyze a user's prompt and suggest improvements.
// @access  Private
router.post('/analyze-prompt', async (req, res) => {
    const { prompt } = req.body;
    const userId = req.user._id;

    auditLog(req, 'PROMPT_COACH_REQUESTED', {
        promptLength: prompt ? prompt.length : 0
    });


    // --- REVISED VALIDATION ---
    if (!prompt || typeof prompt !== 'string') {
        console.warn(`[API /analyze-prompt] Bad Request from user ${userId}: 'prompt' field is missing or not a string. Received body:`, req.body);
        return res.status(400).json({ message: "'prompt' field is missing or invalid." });
    }

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 3) { // <-- The changed value
        console.warn(`[API /analyze-prompt] Bad Request from user ${userId}: Prompt is too short. Received: "${trimmedPrompt}"`);
        return res.status(400).json({ message: `Prompt must be at least 3 characters long.` }); // <-- The changed message
    }
    // --- END REVISED VALIDATION ---

    try {
        const analysis = await analyzePrompt(userId, trimmedPrompt);
        res.status(200).json(analysis);
    } catch (error) {
        console.error(`[API /analyze-prompt] Error for user ${userId} with prompt "${trimmedPrompt.substring(0, 50)}...":`, error);
        res.status(500).json({ message: error.message || 'Server error during prompt analysis.' });
    }
});

module.exports = router;