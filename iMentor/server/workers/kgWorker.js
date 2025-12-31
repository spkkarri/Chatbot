// server/workers/kgWorker.js
const { workerData } = require('worker_threads');
const mongoose = require('mongoose');
const AdminDocument = require('../models/AdminDocument'); // <-- Import AdminDocument
const KnowledgeSource = require('../models/KnowledgeSource');
const connectDB = require('../config/db');
const kgService = require('../services/kgService');

async function runKgGeneration() {
    // --- DESTRUCTURE isCourseDocument and llmProvider ---
    const { chunksForKg, userId, originalName, llmProvider, ollamaModel, sourceId, isCourseDocument } = workerData;
    let dbConnected = false;
    let overallSuccess = false;
    let finalMessage = "KG processing encountered an issue.";
    const logPrefix = `[KG Worker ${process.pid}, SourceID: ${sourceId}]`;

    // --- CHOOSE MODEL BASED ON isCourseDocument ---
    const Model = isCourseDocument ? AdminDocument : KnowledgeSource;
    const kgStatusField = isCourseDocument ? "processingStages.kg_generation" : "kgStatus";


    try {
        console.log(`${logPrefix} Received task. Provider: ${llmProvider}. Chunks: ${chunksForKg ? chunksForKg.length : 0}`);
        if (!process.env.MONGO_URI || !sourceId || !userId || !originalName) {
            throw new Error("Missing critical worker data.");
        }

        await connectDB(process.env.MONGO_URI);
        dbConnected = true;

        if (isCourseDocument) {
            await Model.updateOne({ _id: sourceId }, { $set: { [`${kgStatusField}.status`]: "processing" } });
        } else {
            await Model.updateOne({ _id: sourceId }, { $set: { [kgStatusField]: "processing" } });
        }
        
        console.log(`${logPrefix} Status set to 'processing'.`);

        if (!chunksForKg || chunksForKg.length === 0) {
            finalMessage = "No chunks provided for KG generation.";
            const statusUpdate = isCourseDocument 
                ? { [`${kgStatusField}.status`]: "completed", [`${kgStatusField}.message`]: "Skipped: no chunks" } 
                : { [kgStatusField]: "skipped_no_chunks" };
            await Model.updateOne({ _id: sourceId }, { $set: statusUpdate });
            overallSuccess = true;
        } else {
            const kgExtractionResult = await kgService.generateAndStoreKg(chunksForKg, userId, originalName, llmProvider, ollamaModel);

            if (kgExtractionResult && kgExtractionResult.success) {
                const statusUpdate = isCourseDocument
                    ? { [`${kgStatusField}.status`]: "completed", [`${kgStatusField}.message`]: kgExtractionResult.message }
                    : { [kgStatusField]: "completed" };
                await Model.updateOne({ _id: sourceId }, { $set: statusUpdate });
                overallSuccess = true;
                finalMessage = kgExtractionResult.message || "KG generation completed.";
            } else {
                const statusUpdate = isCourseDocument
                    ? { [`${kgStatusField}.status`]: "failed", [`${kgStatusField}.message`]: kgExtractionResult.message }
                    : { [kgStatusField]: "failed_extraction" };
                await Model.updateOne({ _id: sourceId }, { $set: statusUpdate });
                finalMessage = kgExtractionResult?.message || "KG extraction failed.";
                overallSuccess = false;
            }
        }

    } catch (error) {
        console.error(`${logPrefix} CRITICAL error:`, error);
        finalMessage = error.message || "Unknown critical error.";
        overallSuccess = false;
        if (dbConnected && sourceId) {
            try {
                const statusUpdate = isCourseDocument
                    ? { [`${kgStatusField}.status`]: "failed", [`${kgStatusField}.message`]: `Critical error: ${finalMessage}` }
                    : { [kgStatusField]: "failed_critical" };
                await Model.updateOne({ _id: sourceId }, { $set: statusUpdate });
            } catch (dbUpdateError) {
                console.error(`${logPrefix} DB update error on critical fail:`, dbUpdateError);
            }
        }
    } finally {
        if (dbConnected) {
            await mongoose.disconnect();
        }
        console.log(`${logPrefix} Finished task. Overall Success: ${overallSuccess}`);
    }
}

runKgGeneration();
