// server/routes/finetuning.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const LLMPerformanceLog = require('../models/LLMPerformanceLog');

// Define the shared directory path. Ensure this is accessible by both Node.js and Python containers.
const SHARED_DATA_DIR = process.env.SHARED_FINETUNING_DATA_DIR || '/srv/finetuning_data';

// @route   POST /api/admin/finetuning/start
// @desc    Initiates a model fine-tuning job
// @access  Admin
router.post('/start', async (req, res) => {
    const { modelIdToUpdate } = req.body;
    if (!modelIdToUpdate) {
        return res.status(400).json({ message: 'modelIdToUpdate is required.' });
    }

    console.log(`[Finetune Route] ==> Received request to start job for model: ${modelIdToUpdate}`);

    try {
        // Step 1: Collect all positive feedback logs
        console.log('[Finetune Orchestrator] Step 1: Fetching positive feedback data from MongoDB...');
        const positiveFeedbackLogs = await LLMPerformanceLog.find({ userFeedback: 'positive' })
            .select('query response -_id') // Select only the query and response, exclude the _id
            .lean(); // Use .lean() for performance with large datasets

        if (positiveFeedbackLogs.length < 10) { // Safety check
            return res.status(400).json({ message: `Insufficient data for fine-tuning. Need at least 10 positive feedback entries, found ${positiveFeedbackLogs.length}.` });
        }
        console.log(`[Finetune Orchestrator] Found ${positiveFeedbackLogs.length} positive feedback entries.`);
        
        // Step 2: Format the dataset
        const dataset = positiveFeedbackLogs.map(log => ({
            instruction: log.query,
            output: log.response
        }));
        
        // Step 3: Save the dataset to the shared folder
        await fs.mkdir(SHARED_DATA_DIR, { recursive: true });
        const datasetFilename = `finetuning-dataset-${Date.now()}.json`;
        const datasetPath = path.join(SHARED_DATA_DIR, datasetFilename);

        console.log(`[Finetune Orchestrator] Step 2: Writing formatted dataset to ${datasetPath}`);
        await fs.writeFile(datasetPath, JSON.stringify(dataset, null, 2));

        // Step 4: Proxy the request to the Python backend
        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            throw new Error("Python fine-tuning service URL is not configured.");
        }
        const pythonEndpoint = `${pythonServiceUrl}/finetune`;

        const pythonPayload = {
            dataset_path: datasetPath, // Pass the full path within the shared volume
            model_name_to_update: modelIdToUpdate.replace('ollama/', '') // Python service might not need the 'ollama/' prefix
        };

        console.log(`[Finetune Orchestrator] Step 3: Proxying request to Python service at ${pythonEndpoint} with payload:`, pythonPayload);
        
        // We use a non-blocking call here. The Python service will run in the background.
        axios.post(pythonEndpoint, pythonPayload, { timeout: 5000 })
            .catch(err => {
                // We log the error but don't fail the user-facing request, as the job is meant to be async.
                console.error(`[Finetune Route] <== Error sending async request to Python fine-tuning service: ${err.message}`);
            });

        // Step 5: Respond to the admin immediately
        res.status(202).json({ 
            message: `Fine-tuning job accepted. The model '${modelIdToUpdate}' will be updated in the background.`,
            datasetSize: dataset.length
        });

    } catch (error) {
        console.error(`[Finetune Orchestrator] An error occurred: ${error.message}`);
        res.status(500).json({ message: 'Server error during fine-tuning orchestration.' });
    }
});

module.exports = router;