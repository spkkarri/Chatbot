// server/routes/knowledgeSource.js
const express = require('express');
const router = express.Router();
const { Worker } = require('worker_threads');
const path = require('path');
const axios = require('axios');
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');
const KnowledgeSource = require('../models/KnowledgeSource');
const { decrypt } = require('../utils/crypto');
const { auditLog } = require('../utils/logger');
const fs = require('fs').promises;

// --- HELPER FOR PYTHON SERVICE DELETION ---
async function callPythonDeletionEndpoint(endpointPath, userId, documentName) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        console.warn(`[KS Route] Python Service Deletion request for ${documentName} skipped: URL not configured.`);
        return { success: false, message: "Python service URL not configured." };
    }
    const deleteUrl = `${pythonServiceUrl.replace(/\/$/, '')}${endpointPath}`;
    try {
        await axios.delete(deleteUrl, {
            data: { user_id: userId, document_name: documentName },
            timeout: 30000
        });
        return { success: true, message: `Successfully requested deletion from ${endpointPath}` };
    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message;
        console.error(`[KS Route] Error calling Python for deletion (${deleteUrl}): ${errorMsg}`);
        return { success: false, message: errorMsg };
    }
}


// @route   POST /api/knowledge-sources
// @desc    Add a new URL-based knowledge source
// @access  Private
router.post('/', async (req, res) => {
    const { type, content } = req.body;
    const userId = req.user._id;

    console.log(`[KS Route] ==> POST /: Received request to ingest URL: ${content}`);

    if (type !== 'url' || !content) {
        return res.status(400).json({ message: "Request must be for type 'url' and include 'content'." });
    }

    let newSource;
    try {
        // --- THIS IS THE FIX ---
        // 1. Check if this exact URL already exists for this user.
        const existingSource = await KnowledgeSource.findOne({ userId, sourceUrl: content });
        if (existingSource) {
            // 2. If it exists, inform the user and stop execution.
            console.warn(`[KnowledgeSource Route] User ${userId} attempted to re-add existing URL: ${content}`);
            return res.status(409).json({ 
                message: `This URL has already been added. Title: "${existingSource.title}"`,
                source: existingSource
            });
        }
        // --- END OF FIX ---

        // Create initial record in DB to track progress
        newSource = new KnowledgeSource({
            userId,
            sourceType: 'webpage', // Initial type, will be corrected by Python
            title: content, 
            sourceUrl: content,
            status: 'processing_extraction',
        });
        await newSource.save();

        auditLog(req, 'KNOWLEDGE_SOURCE_URL_INGEST_SUCCESS', {
            url: content
        });

        // Immediately respond to the user so the UI doesn't hang
        res.status(202).json({ 
            message: "URL received. Processing has started in the background.",
            source: newSource 
        });
        
        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) console.error("[KS Route] FATAL: PYTHON_RAG_SERVICE_URL is not set.");
        if (!pythonServiceUrl) throw new Error("Python service URL not configured.");

        // 1. Call Python to extract text from URL
        const extractionResponse = await axios.post(`${pythonServiceUrl}/process_url`, {
            url: content,
            user_id: userId.toString(),
        }, { timeout: 300000 }); // 5 min timeout for scraping/transcription
        console.log(`[KS Route] Python /process_url successful for '${content}'.`);

        const { text_content, title, source_type } = extractionResponse.data;
        if (!text_content) throw new Error("Failed to extract text from the URL source.");

        // 2. Call Python to add document to Qdrant and get analysis text + chunks
        const addDocumentResponse = await axios.post(`${pythonServiceUrl}/add_document`, {
            user_id: userId.toString(),
            file_path: null,
            original_name: title,
            text_content_override: text_content
        }, { timeout: 300000 });
        console.log(`[KS Route] Python /add_document successful for '${title}'. Chunks added: ${addDocumentResponse.data.num_chunks_added_to_qdrant}`);

        const { num_chunks_added_to_qdrant, raw_text_for_analysis, chunks_with_metadata: chunksForKg } = addDocumentResponse.data;

        if (num_chunks_added_to_qdrant === 0) {
            throw new Error("No embeddings generated for the URL content. It might be too short or failed processing.");
        }

        // 3. Update the KnowledgeSource record in MongoDB with final details
        const sourceDoc = await KnowledgeSource.findById(newSource._id);
        if (!sourceDoc) throw new Error(`KnowledgeSource with ID ${newSource._id} disappeared during processing.`);

        sourceDoc.textContent = text_content;
        sourceDoc.title = title;
        sourceDoc.sourceType = source_type;
        sourceDoc.status = 'processing_analysis';
        await sourceDoc.save();
        console.log(`[KS Route] MongoDB record updated for '${title}'. Status: processing_analysis.`);

        // 4. Trigger Analysis Worker
        const user = await User.findById(userId).select('+encryptedApiKey preferredLlmProvider ollamaModel ollamaUrl').lean();
        const workerBaseData = {
            sourceId: sourceDoc._id.toString(),
            userId: userId.toString(),
            llmProvider: user.preferredLlmProvider,
        };
        const analysisWorker = new Worker(path.resolve(__dirname, '../workers/analysisWorker.js'), { 
            workerData: { ...workerBaseData, textForAnalysis: raw_text_for_analysis }
        });
        console.log(`[KS Route] Dispatched Analysis Worker for '${title}'.`);
        analysisWorker.on('error', (err) => console.error(`Analysis Worker Error (URL: ${title}):`, err));
        
        // 5. Trigger KG Worker if chunks are available
        if (chunksForKg && chunksForKg.length > 0) {
            const kgWorker = new Worker(path.resolve(__dirname, '../workers/kgWorker.js'), { 
                workerData: { ...workerBaseData, chunksForKg }
            });
            console.log(`[KS Route] Dispatched KG Worker for '${title}'.`);
            kgWorker.on('error', (err) => console.error(`KG Worker Error (URL: ${title}):`, err));
        } else {
            console.warn(`[KnowledgeSource Route] No chunks for KG processing for URL '${title}'.`);
            await KnowledgeSource.updateOne(
                { _id: sourceDoc._id },
                { $set: { kgStatus: "skipped_no_chunks" } }
            );
        }

    } catch (error) {
        console.error(`[KS Route] <== CRITICAL ERROR processing URL source '${content}':`, error);
        if (newSource) {
            await KnowledgeSource.updateOne({ _id: newSource._id }, {
                $set: { status: 'failed', failureReason: error.message }
            });
        }
    }
});

// @route   GET /api/knowledge-sources
// @desc    Get all knowledge sources for the user (files, urls) and admin (subjects)
// @access  Private
router.get('/', async (req, res) => {
    try {
        console.log(`[KS Route] ==> GET /: Fetching all knowledge sources for user ${req.user._id}`);
        const userId = req.user._id;

        const userSourcesPromise = KnowledgeSource.find({ userId }).sort({ createdAt: -1 }).lean();
        const adminSubjectsPromise = AdminDocument.find().select('originalName createdAt').sort({ createdAt: -1 }).lean();

        const [userSources, adminSubjects] = await Promise.all([userSourcesPromise, adminSubjectsPromise]);

        const formattedAdminSubjects = adminSubjects.map(doc => ({
            _id: doc._id,
            title: doc.originalName,
            sourceType: 'admin_subject',
            isAdminSubject: true,
            createdAt: doc.createdAt
        }));

        console.log(`[KS Route] <== Found ${formattedAdminSubjects.length} subjects and ${userSources.length} user sources.`);
        res.json([...formattedAdminSubjects, ...userSources]);
    } catch (error) {
        console.error("Error fetching all knowledge sources:", error);
        res.status(500).json({ message: "Server error while fetching knowledge sources." });
    }
});


// @route   DELETE /api/knowledge-sources/:sourceId
// @desc    Delete a knowledge source and all its associated data
// @access  Private
router.delete('/:sourceId', async (req, res) => {
    const { sourceId } = req.params;
    const userId = req.user._id.toString();
    const username = req.user.username;

    try {
        const source = await KnowledgeSource.findOne({ _id: sourceId, userId });
        if (!source) {
            return res.status(404).json({ message: "Knowledge source not found or you do not have permission to delete it." });
        }

        console.log(`[Delete Source] Deleting source: '${source.title}' for user: ${username}`);

        auditLog(req, 'KNOWLEDGE_SOURCE_DELETE_SUCCESS', {
            sourceId: sourceId,
            sourceTitle: source.title,
            sourceType: source.sourceType
        });

        // 1. Delete from Vector DB (Qdrant) and Graph DB (Neo4j) via Python service
        await callPythonDeletionEndpoint(`/delete_qdrant_document_data`, userId, source.title);
        await callPythonDeletionEndpoint(`/kg/${userId}/${encodeURIComponent(source.title)}`, userId, source.title);

        if (source.sourceType === 'document' && source.serverFilename) {
            const sanitizedUsername = username.replace(/[^a-zA-Z0-9_-]/g, '_');
            const sourcePath = path.join(__dirname, '..', 'assets', sanitizedUsername, 'document', source.serverFilename);
            const backupDir = path.join(__dirname, '..', 'backup_assets', sanitizedUsername, 'document');
            
            await fs.mkdir(backupDir, { recursive: true });
            const backupPath = path.join(backupDir, source.serverFilename);
            
            try {
                await fs.rename(sourcePath, backupPath);
                console.log(`[Delete Source] Backed up file to ${backupPath}`);
            } catch (fileError) {
                if (fileError.code !== 'ENOENT') {
                    console.warn(`[Delete Source] Could not back up physical file '${sourcePath}': ${fileError.message}`);
                }
            }
        }

        await KnowledgeSource.deleteOne({ _id: sourceId });
        console.log(`[Delete Source] Removed MongoDB record for '${source.title}'`);

        res.status(200).json({ message: `Successfully deleted '${source.title}'.` });
    } catch (error) {
        console.error(`[Delete Source] Error deleting source ID '${sourceId}':`, error);
        res.status(500).json({ message: "An error occurred while deleting the knowledge source." });
    }
});


module.exports = router;