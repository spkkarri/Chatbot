// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const { authMiddleware } = require('../middleware/authMiddleware');
const User = require('../models/User');
const KnowledgeSource = require('../models/KnowledgeSource');
const { Worker } = require('worker_threads');
const { decrypt } = require('../utils/crypto');
const { logger, auditLog } = require('../utils/logger');

const router = express.Router();

// --- Constants & Multer Config ---
const UPLOAD_DIR = path.join(__dirname, '..', 'assets');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // Increased to 50MB for media
const allowedMimeTypes = {
    // Documents
    'application/pdf': { type: 'document', processor: 'ai_core' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'document', processor: 'ai_core' },
    'text/plain': { type: 'document', processor: 'ai_core' },
    'text/markdown': { type: 'document', processor: 'ai_core' },
    // Media
    'audio/mpeg': { type: 'audio', processor: 'media' },
    'audio/wav': { type: 'audio', processor: 'media' },
    'video/mp4': { type: 'video', processor: 'media' },
    'video/quicktime': { type: 'video', processor: 'media' },
    'image/png': { type: 'image', processor: 'media' },
    'image/jpeg': { type: 'image', processor: 'media' },
};
const allowedExtensions = Object.keys(allowedMimeTypes).flatMap(mime => {
    const extMap = { 'application/pdf': '.pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', /* etc */ };
    return extMap[mime] || []; // Simplified, a full map would be needed
}); // This part can be improved if needed

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.user || !req.user.email) {
            return cb(new Error("Authentication error: User context not found for upload destination."));
        }
        const sanitizedUsername = req.user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileMimeType = file.mimetype.toLowerCase();
        const fileTypeSubfolder = allowedMimeTypes[fileMimeType]?.type || 'others';
        const destinationPath = path.join(UPLOAD_DIR, sanitizedUsername, fileTypeSubfolder);
        fs.mkdir(destinationPath, { recursive: true }).then(() => cb(null, destinationPath)).catch(cb);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase();
        const sanitizedBaseName = path.basename(file.originalname, fileExt)
                                      .replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
        const uniqueFilename = `${timestamp}-${sanitizedBaseName}${fileExt}`;
        cb(null, uniqueFilename);
    }
});

const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE } });

// Main upload route
router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file received." });
    const userId = req.user._id;
    const { originalname: originalName, path: serverPath, mimetype } = req.file;
    
    let newSource;
    try {
        const { type, processor } = allowedMimeTypes[mimetype.toLowerCase()] || {};
        if (!type || !processor) {
            throw new Error(`Unsupported file type: ${mimetype}`);
        }

        newSource = new KnowledgeSource({
            userId,
            sourceType: type,
            title: originalName,
            serverFilename: path.basename(serverPath),
            status: 'processing_extraction'
        });
        await newSource.save();

        auditLog(req, 'KNOWLEDGE_SOURCE_UPLOAD_SUCCESS', {
            sourceType: type,
            originalName: originalName,
            sizeBytes: req.file.size
        });

        res.status(202).json({ 
            message: "File accepted. Processing has started in the background.",
            source: newSource
        });

        // --- Start background processing ---
        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) throw new Error("Python service URL not configured.");

        let pythonEndpoint = '';
        let pythonPayload = {};

        if (processor === 'ai_core') {
            pythonEndpoint = '/add_document';
            pythonPayload = { user_id: userId.toString(), file_path: serverPath, original_name: originalName };
        } else if (processor === 'media') {
            pythonEndpoint = '/process_media_file';
            pythonPayload = { file_path: serverPath, media_type: type };
        }
        
        const extractionResponse = await axios.post(`${pythonServiceUrl}${pythonEndpoint}`, pythonPayload, { timeout: 600000 }); // 10 min timeout for media
        
        const text_content = extractionResponse.data?.text_content || (processor === 'ai_core' ? extractionResponse.data?.raw_text_for_analysis : null);
        
        if (!text_content) throw new Error("Failed to extract text from the source.");
        
        const sourceDoc = await KnowledgeSource.findById(newSource._id);
        sourceDoc.textContent = text_content;
        sourceDoc.status = 'processing_analysis';
        await sourceDoc.save();

        // Trigger analysis and KG workers...
        const user = await User.findById(userId).select('+encryptedApiKey preferredLlmProvider ollamaModel ollamaUrl').lean();
        const llmProvider = user?.preferredLlmProvider || 'gemini';
        const userApiKey = user.encryptedApiKey ? decrypt(user.encryptedApiKey) : null;
        
        const workerBaseData = {
            sourceId: sourceDoc._id.toString(), userId: userId.toString(), originalName, llmProvider,
            ollamaModel: user.ollamaModel, apiKey: userApiKey, ollamaUrl: user.ollamaUrl
        };
        
        const analysisWorker = new Worker(path.resolve(__dirname, '../workers/analysisWorker.js'), { 
            workerData: { ...workerBaseData, textForAnalysis: text_content }
        });
        analysisWorker.on('error', (err) => console.error(`Analysis Worker Error (File: ${originalName}):`, err));
        
        // KG worker logic for ai_core processed docs (needs refactor for unified chunks)
        const chunksForKg = extractionResponse.data?.chunks_with_metadata || [];
         if (chunksForKg.length > 0) {
            const kgWorker = new Worker(path.resolve(__dirname, '../workers/kgWorker.js'), { 
                workerData: { ...workerBaseData, chunksForKg }
            });
            kgWorker.on('error', (err) => console.error(`KG Worker Error (File: ${originalName}):`, err));
        }


    } catch (error) {
        

        console.error(`Error processing uploaded file '${originalName}':`, error);
        if (newSource) {
            await KnowledgeSource.updateOne({ _id: newSource._id }, {
                $set: { status: 'failed', failureReason: error.message }
            });
        }
        // If headers not sent, send error to client. This happens for initial errors.
        if (!res.headersSent) {
        if (error.message && error.message.includes("E11000 duplicate key error")) {
            res.status(400).json({ message: "File already exists" });
        } else {
            res.status(500).json({ message: error.message || "Server error during file processing." });
        }
}

    }
});

module.exports = router;