// server/controllers/generationController.js
const axios = require('axios');
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');
const KnowledgeSource = require('../models/KnowledgeSource');
const { decrypt } = require('../utils/crypto');

async function proxyToFileGeneration(req, res, endpoint, payload) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        return res.status(500).json({ message: "Document generation service is not configured." });
    }
    const generationUrl = `${pythonServiceUrl}${endpoint}`;
    
    try {
        console.log(`[GenController] Proxying request to Python: ${generationUrl}`);
        const pythonResponse = await axios.post(generationUrl, payload, {
            responseType: 'stream', // CRITICAL: Receive the response as a stream
            timeout: 600000 // 10 minute timeout
        });

        // Pipe the file stream from Python directly back to the client
        res.setHeader('Content-Disposition', pythonResponse.headers['content-disposition']);
        res.setHeader('Content-Type', pythonResponse.headers['content-type']);
        pythonResponse.data.pipe(res);

    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || "Failed to generate document via proxy.";
        console.error(`[GenController] Error proxying to Python service:`, errorMsg);
        if (!res.headersSent) {
            res.status(error.response?.status || 500).json({ message: errorMsg });
        }
    }
}

exports.generateDocument = async (req, res) => {
    const { markdownContent, docType, sourceDocumentName } = req.body;
    const userId = req.user._id;

    try {
        let sourceDocumentText = null;
        let apiKeyForRequest = null;

        const user = await User.findById(userId).select('+encryptedApiKey');
        const userSource = await KnowledgeSource.findOne({ userId, title: sourceDocumentName }).select('textContent').lean();
        
        if (userSource?.textContent) {
            sourceDocumentText = userSource.textContent;
            if (user?.encryptedApiKey) apiKeyForRequest = decrypt(user.encryptedApiKey);
        } else {
            const adminDoc = await AdminDocument.findOne({ originalName: sourceDocumentName }).select('text').lean();
            if (adminDoc?.text) {
                sourceDocumentText = adminDoc.text;
                apiKeyForRequest = process.env.GEMINI_API_KEY;
            }
        }
        
        if (!sourceDocumentText) return res.status(404).json({ message: `Source document '${sourceDocumentName}' not found.` });
        if (!apiKeyForRequest) return res.status(400).json({ message: "API Key for generation is missing." });

        await proxyToFileGeneration(req, res, '/generate_document', {
            markdownContent, docType, sourceDocumentText, api_key: apiKeyForRequest
        });
    } catch (error) {
        console.error(`[GenController] Error in generateDocument handler:`, error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};

exports.generateDocumentFromTopic = async (req, res) => {
    const { topic, docType } = req.body;
    const userId = req.user._id;

    try {
        const user = await User.findById(userId).select('+encryptedApiKey');
        const apiKeyForRequest = user?.encryptedApiKey ? decrypt(user.encryptedApiKey) : process.env.GEMINI_API_KEY;
        if (!apiKeyForRequest) return res.status(400).json({ message: "API Key for generation is missing." });

        await proxyToFileGeneration(req, res, '/generate_document_from_topic', {
            topic, docType, api_key: apiKeyForRequest
        });
    } catch (error) {
        console.error(`[GenController] Error in generateDocumentFromTopic handler:`, error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};