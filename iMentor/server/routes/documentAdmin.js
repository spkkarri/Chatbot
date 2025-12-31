// server/routes/documentAdmin.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const axios = require('axios');
const { Worker } = require('worker_threads');
const AdminDocument = require('../models/AdminDocument');
const { auditLog } = require('../utils/logger');

const STAGING_DIR = path.join(__dirname, '..', 'course_assets', '_staging');
const COURSE_ASSETS_BASE_DIR = path.join(__dirname, '..', 'course_assets');
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const stagingStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdir(STAGING_DIR, { recursive: true }, (err) => cb(err, STAGING_DIR));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    }
});
const stagingUpload = multer({ storage: stagingStorage, limits: { fileSize: MAX_FILE_SIZE } });

// Helper to update a specific stage's status
const updateStageStatus = async (docId, stage, status, message = '') => {
    const update = {
        [`processingStages.${stage}.status`]: status,
        [`processingStages.${stage}.message`]: message,
        [`processingStages.${stage}.updatedAt`]: new Date(),
    };
    await AdminDocument.updateOne({ _id: docId }, { $set: update });
};

// Main processing logic, now accepts llmProvider
async function processDocument(docId, filePath, originalName, llmProvider, isOverwrite = false) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) throw new Error("Python service is not configured.");

    const courseCode = originalName.split('_')[0];

    try {
        await AdminDocument.updateOne({ _id: docId }, { $set: { overallStatus: 'processing', failureReason: null, processingProvider: llmProvider } });

        if (isOverwrite) {
            await axios.delete(`${pythonServiceUrl}/delete_qdrant_document_data`, { data: { user_id: 'admin', document_name: originalName } });
            await axios.delete(`${pythonServiceUrl}/kg/admin/${encodeURIComponent(originalName)}`, { data: { user_id: 'admin', document_name: originalName } });
        }

        await updateStageStatus(docId, 'parsing', 'processing');
        // --- PASS PROVIDER TO PYTHON ---
        const response = await axios.post(`${pythonServiceUrl}/add_document`, {
            user_id: "admin", file_path: filePath, original_name: originalName, llm_provider: llmProvider
        }, { timeout: 1200000 });
        
        const { raw_text_for_analysis, chunks_with_metadata } = response.data;
        if (!raw_text_for_analysis) throw new Error("Python service returned no parsed text.");

        const parsedDataDir = path.join(COURSE_ASSETS_BASE_DIR, courseCode, 'parsed_data', 'docs');
        await fsPromises.mkdir(parsedDataDir, { recursive: true });
        const parsedDataPath = path.join(parsedDataDir, `${path.basename(originalName, path.extname(originalName))}.md`);
        await fsPromises.writeFile(parsedDataPath, raw_text_for_analysis);

        await updateStageStatus(docId, 'parsing', 'completed');
        await updateStageStatus(docId, 'vectorization', 'completed', `Vectors created via ${llmProvider} pipeline.`);

        await AdminDocument.updateOne({ _id: docId }, { $set: { text: raw_text_for_analysis } });

        const workerPromises = [];

        if (chunks_with_metadata?.length > 0) {
            await updateStageStatus(docId, 'kg_generation', 'processing');
            const kgWorker = new Worker(path.resolve(__dirname, '..', 'workers', 'kgWorker.js'), {
                workerData: { sourceId: docId, isCourseDocument: true, userId: "admin", originalName, chunksForKg: chunks_with_metadata, llmProvider: llmProvider },
            });
            workerPromises.push(new Promise((resolve, reject) => {
                 kgWorker.on('exit', async (code) => {
                    if (code === 0) {
                        await updateStageStatus(docId, 'kg_generation', 'completed');
                        resolve();
                    } else {
                        await updateStageStatus(docId, 'kg_generation', 'failed', 'Worker process failed.');
                        reject(new Error('KG Worker failed'));
                    }
                });
                kgWorker.on('error', reject);
            }));
        } else {
             await updateStageStatus(docId, 'kg_generation', 'completed', 'Skipped (no content for KG).');
        }

        await updateStageStatus(docId, 'analysis', 'processing');
        const analysisWorker = new Worker(path.resolve(__dirname, '..', 'workers', 'adminAnalysisWorker.js'), {
            workerData: { adminDocumentId: docId, originalName, textForAnalysis: raw_text_for_analysis, llmProvider: llmProvider },
        });
        workerPromises.push(new Promise((resolve, reject) => {
            analysisWorker.on('exit', async (code) => {
                if (code === 0) {
                    await updateStageStatus(docId, 'analysis', 'completed');
                    resolve();
                } else {
                    await updateStageStatus(docId, 'analysis', 'failed', 'Worker process failed.');
                    reject(new Error('Analysis Worker failed'));
                }
            });
            analysisWorker.on('error', reject);
        }));

        await Promise.all(workerPromises);
        await AdminDocument.updateOne({ _id: docId }, { $set: { overallStatus: 'completed' } });
        console.log(`[Document Admin] Full processing complete for ${originalName}`);

    } catch (error) {
        const errorMessage = error.response?.data?.error || error.message;
        await AdminDocument.updateOne({ _id: docId }, {
            $set: { overallStatus: 'failed', failureReason: errorMessage.substring(0, 1000) }
        });
        const doc = await AdminDocument.findById(docId).lean();
        if (doc) {
            for (const stage in doc.processingStages) {
                if (doc.processingStages[stage].status === 'processing') {
                    await updateStageStatus(docId, stage, 'failed', errorMessage.substring(0, 200));
                }
            }
        }
        throw error;
    }
}

// @route   POST /api/admin/documents/stage-upload
// @desc    Uploads a file to a temporary staging area before processing
// @access  Admin
router.post('/stage-upload', stagingUpload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file was uploaded.' });
    }
    // If multer succeeds, the file is in the staging directory.
    // Respond with the path and server-generated filename.
    res.status(200).json({
        message: 'File staged successfully.',
        stagedPath: req.file.path,
        serverFilename: req.file.filename
    });
});


router.post("/process-staged", async (req, res) => {
    // --- RECEIVE llmProvider FROM REQUEST ---
    const { stagedPath, originalName, serverFilename, courseCode, overwrite, llmProvider } = req.body;
    if (!stagedPath || !originalName || !serverFilename || !courseCode || !llmProvider) {
        return res.status(400).json({ message: "Missing file information, course code, or LLM provider." });
    }

    const finalFilename = `${courseCode}_${originalName}`;
    const finalDir = path.join(COURSE_ASSETS_BASE_DIR, courseCode, 'docs');
    const finalPath = path.join(finalDir, serverFilename);
    let doc;

    try {
        await fsPromises.mkdir(finalDir, { recursive: true });
        const existingDoc = await AdminDocument.findOne({ originalName: finalFilename });
        if (existingDoc && !overwrite) {
            await fsPromises.unlink(stagedPath);
            return res.status(409).json({ message: `File with name '${originalName}' already exists for this course.` });
        }

        await fsPromises.rename(stagedPath, finalPath);

        if (existingDoc && overwrite) {
            doc = existingDoc;
            doc.filename = serverFilename;
            doc.overallStatus = 'staged';
            doc.failureReason = null;
            doc.processingProvider = llmProvider; // Update provider on overwrite
            Object.keys(doc.processingStages).forEach(key => {
                doc.processingStages[key] = { status: 'pending', message: '', updatedAt: null };
            });
            await doc.save();
        } else {
            doc = new AdminDocument({
                filename: serverFilename,
                originalName: finalFilename,
                overallStatus: 'staged',
                processingProvider: llmProvider, // Set provider on create
            });
            await doc.save();
        }
        
        res.status(202).json({ message: `File '${originalName}' accepted for processing with ${llmProvider}.`, document: doc });
        
        // --- PASS llmProvider TO PROCESSING FUNCTION ---
        processDocument(doc._id.toString(), finalPath, finalFilename, llmProvider, !!overwrite).catch(err => {
            console.error(`[BG Processing] Error processing ${finalFilename}: ${err.message}`);
        });

    } catch (error) {
        await fsPromises.unlink(stagedPath).catch(() => {});
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
});

router.get('/by-course/:courseCode', async (req, res) => {
    try {
        const { courseCode } = req.params;
        const documents = await AdminDocument.find({
            originalName: { $regex: `^${courseCode}_`, $options: 'i' }
        }).sort({ uploadedAt: -1 });
        res.json(documents);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching course documents.' });
    }
});

router.post('/:id/reprocess', async (req, res) => {
    try {
        const doc = await AdminDocument.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found.' });
        
        const courseCode = doc.originalName.split('_')[0];
        const filePath = path.join(COURSE_ASSETS_BASE_DIR, courseCode, 'docs', doc.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Physical file is missing, cannot reprocess.' });
        }
        
        // --- THIS IS THE FIX ---
        // On reprocessing, use the provider stored with the document.
        const providerToUse = doc.processingProvider || 'gemini'; // Fallback to gemini if not set
        res.status(202).json({ message: `Reprocessing for '${doc.originalName}' with ${providerToUse} has been initiated.` });

        processDocument(doc._id.toString(), filePath, doc.originalName, providerToUse, true).catch(err => {
            console.error(`[BG Reprocessing] Error for ${doc.originalName}: ${err.message}`);
        });

    } catch (error) {
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const doc = await AdminDocument.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Document not found.' });

        const courseCode = doc.originalName.split('_')[0];
        const filePath = path.join(COURSE_ASSETS_BASE_DIR, courseCode, 'docs', doc.filename);
        const parsedDataPath = path.join(COURSE_ASSETS_BASE_DIR, courseCode, 'parsed_data', 'docs', `${path.basename(doc.originalName, path.extname(doc.originalName))}.md`);


        await fsPromises.unlink(filePath).catch(err => console.warn(`File deletion warning: ${err.message}`));
        await fsPromises.unlink(parsedDataPath).catch(err => console.warn(`Parsed data deletion warning: ${err.message}`));
        
        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        await axios.delete(`${pythonServiceUrl}/delete_qdrant_document_data`, { data: { user_id: 'admin', document_name: doc.originalName } });
        await axios.delete(`${pythonServiceUrl}/kg/admin/${encodeURIComponent(doc.originalName)}`, { data: { user_id: 'admin', document_name: doc.originalName } });

        await AdminDocument.deleteOne({ _id: doc._id });

        auditLog(req, 'ADMIN_DOCUMENT_DELETED', { documentName: doc.originalName });
        res.status(200).json({ message: 'Document and all associated data deleted.' });

    } catch (error) {
        res.status(500).json({ message: `Server error: ${error.message}` });
    }
});

module.exports = router;
