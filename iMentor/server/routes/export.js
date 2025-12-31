// server/routes/export.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');
const KnowledgeSource = require('../models/KnowledgeSource'); // Import the correct model
const { decrypt } = require('../utils/crypto'); // For decrypting user's API key
const { auditLog } = require('../utils/logger');

// All routes here are protected by the authMiddleware applied in server.js

// @route   POST /api/export/podcast
// @desc    Generate a high-quality, dual-speaker podcast from a document and proxy the audio stream.
// @access  Private
router.post('/podcast', async (req, res) => {
    // 1. Destructure the request body
    const { analysisContent, sourceDocumentName, podcastOptions } = req.body;
    const userId = req.user._id; // Get user ID from the authenticated session

    // 2. Validate the input
    if (!analysisContent || !sourceDocumentName || !podcastOptions) {
        return res.status(400).json({ message: 'analysisContent, sourceDocumentName, and podcastOptions are required.' });
    }

    try {
        auditLog(req, 'TOOL_USAGE_PODCAST_GENERATOR', {
            sourceDocumentName: sourceDocumentName,
            podcastOptions: podcastOptions
        });

        let sourceDocumentText = null;
        let apiKeyForRequest = null;
        
        // 3. Smartly fetch the document text and the correct API key
        
        // First, fetch the user to get their encrypted API key if it exists

        const user = await User.findById(userId).select('+encryptedApiKey preferredLlmProvider apiKeyRequestStatus');

        if (!user) {
            // This is a sanity check; user should exist if they passed authMiddleware
            return res.status(404).json({ message: 'Authenticated user not found.' });
        }

        if (user?.preferredLlmProvider === 'gemini' && user?.apiKeyRequestStatus === 'pending' && !user?.encryptedApiKey) {
            return res.status(403).json({ message: "Cannot generate podcast: Your API key request is pending approval." });
        }

        
        // Next, check if the requested document is one of the user's personal Knowledge Sources
        const userSource = await KnowledgeSource.findOne({ userId, title: sourceDocumentName }).select('textContent').lean();
        
        if (userSource?.textContent) {
            // Found it in the user's personal collection
            console.log(`[Node Export] Found source text for podcast in user's KnowledgeSource: '${sourceDocumentName}'`);
            sourceDocumentText = userSource.textContent;
            
            // For user documents, we must use the user's own API key
            if (user.preferredLlmProvider === 'gemini' && user.encryptedApiKey) {
                apiKeyForRequest = decrypt(user.encryptedApiKey);
            }
            // If the user prefers Ollama, apiKeyForRequest will remain null, which is fine.
            
        } else {
            // If not found, fall back to checking the shared Admin Documents (Subjects)
            console.log(`[Node Export] Source not in user's collection. Checking Admin Subjects for: '${sourceDocumentName}'`);
            const adminDoc = await AdminDocument.findOne({ originalName: sourceDocumentName }).select('text').lean();
            if (adminDoc?.text) {
                sourceDocumentText = adminDoc.text;
                // For admin documents, the system MUST use the server's global API key
                apiKeyForRequest = process.env.GEMINI_API_KEY;
            }
        }
        
        // 4. Handle failure cases after checking all sources
        if (!sourceDocumentText) {
            return res.status(404).json({ message: `Source document or subject '${sourceDocumentName}' could not be found.` });
        }
        if (user.preferredLlmProvider === 'gemini' && !apiKeyForRequest) {
            // This case happens if the user selected Gemini but didn't provide a key, and the doc wasn't an admin doc
            return res.status(400).json({ message: "An API Key for Gemini is required for podcast generation but is not configured for your account." });
        }

        // 5. Proxy the request to the Python microservice
        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Audio generation service is not configured on the server." });
        }

        const generationUrl = `${pythonServiceUrl}/export_podcast`;
        
        console.log(`[Node Export] Forwarding HQ podcast request to Python service.`);

        // The payload for the Python service, including the correct API key
        const pythonPayload = {
            sourceDocumentText: sourceDocumentText,
            analysisContent: analysisContent,
            podcastOptions: podcastOptions,
            api_key: apiKeyForRequest // Pass the determined key
        };
        
        // Make the request and stream the response
        const fileResponse = await axios.post(generationUrl, pythonPayload, {
            responseType: 'stream',
            timeout: 600000 // 10 minute timeout for potentially long audio synthesis
        });

        // 6. Stream the audio file back to the frontend client
        const safeFilename = sourceDocumentName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
        const finalFilename = `HQ_Podcast_${safeFilename}.mp3`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        fileResponse.data.pipe(res);

    } catch (error) {
        auditLog(req, 'TOOL_USAGE_PODCAST_GENERATOR_FAILURE', {
            sourceDocumentName: sourceDocumentName,
            podcastOptions: podcastOptions,
            error: error.message
        });
        const errorMsg = error.response?.data?.error || error.message || "Failed to generate podcast.";
        console.error(`[Node Export] Error proxying podcast generation: ${errorMsg}`);
        // Ensure we don't try to send headers if the stream has already started
        if (!res.headersSent) {
            res.status(error.response?.status || 500).json({ message: errorMsg });
        }
    }
});

module.exports = router;
