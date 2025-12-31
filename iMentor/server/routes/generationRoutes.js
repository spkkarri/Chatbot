// server/routes/generationRoutes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');
const KnowledgeSource = require('../models/KnowledgeSource');
const { decrypt } = require('../utils/crypto');
const { auditLog } = require('../utils/logger');

router.post('/document', async (req, res) => {
    const { markdownContent, docType, sourceDocumentName } = req.body;
    const userId = req.user._id;

    auditLog(req, 'CONTENT_GENERATION_FROM_SOURCE_SUCCESS', {
        docType: docType,
        sourceDocumentName: sourceDocumentName
    });

    // Log the request details
    console.log('Document Generation Request from Source:', {
        docType: docType,
        contentLength: markdownContent ? markdownContent.length : 0,
        sourceDocumentName: sourceDocumentName
    });

    console.log(`[Gen Route] ==> Request to generate .${docType} from source '${sourceDocumentName}'`);
    if (!markdownContent || !docType || !sourceDocumentName) {
        return res.status(400).json({ message: 'markdownContent, docType, and sourceDocumentName are required.' });
    }

    try {
        let sourceDocumentText = null;
        let apiKeyForRequest = null;

        const user = await User.findById(userId).select('+encryptedApiKey');
        const userSource = await KnowledgeSource.findOne({ userId, title: sourceDocumentName }).select('textContent').lean();
        
        if (userSource?.textContent) {
            sourceDocumentText = userSource.textContent;
            if (user?.encryptedApiKey) {
                apiKeyForRequest = decrypt(user.encryptedApiKey);
            }
        } else {
            const adminDoc = await AdminDocument.findOne({ originalName: sourceDocumentName }).select('text').lean();
            if (adminDoc?.text) {
                sourceDocumentText = adminDoc.text;
                apiKeyForRequest = process.env.GEMINI_API_KEY;
            }
        }
        
        if (!sourceDocumentText) {
            return res.status(404).json({ message: `Source document '${sourceDocumentName}' not found.` });
        }
        if (!apiKeyForRequest) {
            return res.status(400).json({ message: "API Key for document generation is missing." });
        }

        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Document generation service is not configured." });
        }
        
        const generationUrl = `${pythonServiceUrl}/generate_document`;
        
        const pythonResponse = await axios.post(generationUrl, {
            markdownContent, docType, sourceDocumentText, api_key: apiKeyForRequest
        }, { 
            responseType: 'stream',
            timeout: 600000 
        });

        res.setHeader('Content-Disposition', pythonResponse.headers['content-disposition']);
        res.setHeader('Content-Type', pythonResponse.headers['content-type']);
        
        // Add error handling to the stream
        pythonResponse.data.on('error', (err) => {
            console.error(`[Node Generation] Stream error proxying from Python for doc '${sourceDocumentName}':`, err.message);
            if (!res.headersSent) {
                res.status(502).json({ message: `Error connecting to the document generation service: ${err.message}` });
            }
        });

        pythonResponse.data.pipe(res);

    } catch (error) {
        auditLog(req, 'CONTENT_GENERATION_FROM_SOURCE_FAILURE', {
            docType: docType,
            sourceDocumentName: sourceDocumentName,
            error: error.message
        });

        // Log the error details
        console.log('Generation Error Details:', {
            errorMessage: error.message,
            responseStatus: error.response?.status,
            responseData: error.response?.data,
            docType: docType,
            sourceDocumentName: sourceDocumentName
        });

        // Enhanced error handling
        if (error.code === 'ECONNREFUSED') {
            console.error(`[Generation Route] Python service connection refused for ${docType} generation`);
            if (!res.headersSent) {
                return res.status(503).json({ 
                    message: 'Document generation service is temporarily unavailable. Please try again later.' 
                });
            }
        }

        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to generate document.";
        console.error(`[Generation Route] Error: ${errorMsg}`);
        if (!res.headersSent) {
            res.status(error.response?.status || 500).json({ message: errorMsg });
        }
    }
});

router.post('/document/from-topic', async (req, res) => {
    const { topic, docType } = req.body;
    const userId = req.user._id;

    auditLog(req, 'CONTENT_GENERATION_FROM_TOPIC_SUCCESS', {
        docType: docType,
        topic: topic
    });


    console.log('Document Generation Request from Topic:', {
        docType: docType,
        topic: topic
    });

    console.log(`[Gen Route] ==> Request to generate .${docType} from topic '${topic}'`);
    if (!topic || !docType) {
        return res.status(400).json({ message: 'Topic and docType are required.' });
    }

    try {
        const user = await User.findById(userId).select('+encryptedApiKey');
        const apiKeyForRequest = user?.encryptedApiKey ? decrypt(user.encryptedApiKey) : process.env.GEMINI_API_KEY;

        if (!apiKeyForRequest) {
            return res.status(400).json({ message: "API Key for document generation is missing." });
        }

        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Document generation service is not configured." });
        }
        
        const generationUrl = `${pythonServiceUrl}/generate_document_from_topic`;
        console.log(`[Node Generation] Proxying request for topic '${topic}' to Python service: ${generationUrl}`);

        const pythonResponse = await axios.post(generationUrl, {
            topic,
            docType,
            api_key: apiKeyForRequest
        }, { 
            responseType: 'stream',
            timeout: 600000 
        });

        res.setHeader('Content-Disposition', pythonResponse.headers['content-disposition']);
        res.setHeader('Content-Type', pythonResponse.headers['content-type']);
        
        // --- THIS IS THE FIX ---
        // We attach an error handler directly to the stream from Python.
        // This will catch connection errors (like ECONNREFUSED) that the try/catch block misses.
        pythonResponse.data.on('error', (err) => {
            console.error(`[Node Generation] Stream error proxying from Python for topic '${topic}':`, err.message);
            // If we haven't already sent headers (like the file headers), we can send a JSON error.
            if (!res.headersSent) {
                res.status(502).json({ message: `Error connecting to the generation service: ${err.message}` });
            }
        });
        
        // Pipe the data to the client response
        pythonResponse.data.pipe(res);
        // --- END OF FIX ---

    } catch (error) {
        auditLog(req, 'CONTENT_GENERATION_FROM_TOPIC_FAILURE', {
            docType: docType,
            topic: topic,
            error: error.message
        });

        console.log('Generation from Topic - Error Details:', {
            errorMessage: error.message,
            responseStatus: error.response?.status,
            responseData: error.response?.data,
            topic: topic,
            docType: docType
        });

        // Enhanced error handling
        if (error.code === 'ECONNREFUSED') {
            console.error(`[Node Generation] Python service unavailable for topic generation: ${topic}`);
            if (!res.headersSent) {
                return res.status(503).json({ 
                    message: 'Document generation service is temporarily unavailable. Please try again later.' 
                });
            }
        }

        console.log('Topic Generation Error Context:', {
            topic: topic,
            docType: docType,
            error: error.message
        });

        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to generate document from topic.";
        console.error(`[Node Generation] Error for topic '${topic}':`, errorMsg);
        if (!res.headersSent) {
            res.status(error.response?.status || 500).json({ message: errorMsg });
        }
    }
});

module.exports = router;