// server/routes/kg.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');
const { decrypt } = require('../utils/crypto');
const { auditLog } = require('../utils/logger');

router.get('/visualize/:documentName', async (req, res) => {
    const { documentName } = req.params;
    const currentUserId = req.user._id;

    console.log(`[KG Route] ==> Request for on-the-fly KG visualization for doc: '${documentName}'`);
    if (!documentName) {
        return res.status(400).json({ message: 'Document name is required.' });
    }

    try {
        let sourceDocumentText = null;
        let apiKeyForRequest = null;
        
        // We need to fetch the user to get their encrypted API key
        const user = await User.findById(currentUserId).select('uploadedDocuments.filename uploadedDocuments.text +encryptedApiKey');

        // Check if the requested document belongs to the user
        const userDoc = user?.uploadedDocuments.find(doc => doc.filename === documentName);
        
        if (userDoc?.text) {
            sourceDocumentText = userDoc.text;
            // Decrypt the key if the document is a user document
            if (user.encryptedApiKey) {
                apiKeyForRequest = decrypt(user.encryptedApiKey);
            }
        } else {
            // If not a user document, check if it's an admin document (Subject)
            const adminDoc = await AdminDocument.findOne({ originalName: documentName }).select('text');
            if (adminDoc?.text) {
                sourceDocumentText = adminDoc.text;
                // For admin docs, use the server's global API key
                apiKeyForRequest = process.env.GEMINI_API_KEY;
            }
        }
        
        if (!sourceDocumentText) {
            return res.status(404).json({ message: `Source document '${documentName}' not found.` });
        }

        if (!apiKeyForRequest) {
             return res.status(400).json({ message: "API Key for document processing is missing." });
        }

        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Knowledge Graph service is not configured." });
        }
        
        const getKgUrl = `${pythonServiceUrl}/generate_kg_from_text`;
        
        console.log(`[KG Visualize] Proxying request to Python with API Key for KG generation.`);
        
        const pythonResponse = await axios.post(getKgUrl, {
            document_text: sourceDocumentText,
            api_key: apiKeyForRequest // <<< Pass the correct key
        }, { timeout: 300000 });

        if (pythonResponse.data && pythonResponse.data.success) {
            res.status(200).json(pythonResponse.data.graph_data);
        } else {
            throw new Error(pythonResponse.data.error || "Python service failed to generate the knowledge graph.");
        }
    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || "Failed to retrieve knowledge graph.";
        console.error(`[KG Visualize] Error for '${documentName}': ${errorMsg}`);
        res.status(error.response?.status || 500).json({ error: errorMsg });
    }
});


// --- NEW ROUTE ---
// @route   GET /api/kg/session/:sessionId
// @desc    Get the knowledge graph for a specific chat session
// @access  Private
router.get('/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user._id.toString();

    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        return res.status(500).json({ error: "Knowledge Graph service is not configured." });
    }
    
    // The sessionId is used as the document_name for the KG
    const getKgUrl = `${pythonServiceUrl}/kg/${userId}/${encodeURIComponent(sessionId)}`;

    try {
        auditLog(req, 'TOOL_USAGE_LIVE_CONCEPT_MAP', {
            sessionId: sessionId
        });
        console.log(`[KG Route] Proxying request to Python service to get KG for session: ${sessionId}`);
        console.log(`[KG Route]   - Python URL: ${getKgUrl}`);
        const pythonResponse = await axios.get(getKgUrl, { timeout: 30000 });
        
        if (pythonResponse.data) {
            res.status(200).json(pythonResponse.data);
        } else {
            // It's not an error if a KG doesn't exist yet, just return empty data
            res.status(200).json({ nodes: [], edges: [] });
        }
    } catch (error) {
        console.error(`[KG Route] Error retrieving KG for session '${sessionId}':`, error);
        if (error.response && error.response.status === 404) {
            // Handle case where Python service returns 404 if KG doesn't exist
            return res.status(200).json({ nodes: [], edges: [] });
        }
        const errorMsg = error.response?.data?.error || error.message || "Failed to retrieve knowledge graph.";
        console.error(`[KG Route] Error for session '${sessionId}': ${errorMsg}`);
        res.status(error.response?.status || 500).json({ error: errorMsg });
    }
});

module.exports = router;