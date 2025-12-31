// server/workers/analysisWorker.js
const { workerData, parentPort } = require('worker_threads');
const mongoose = require('mongoose');
const path = require('path');

const KnowledgeSource = require('../models/KnowledgeSource');
const connectDB = require('../config/db');
const geminiService = require('../services/geminiService');
const ollamaService = require('../services/ollamaService');
const { ANALYSIS_PROMPTS } = require('../config/promptTemplates');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function performFullAnalysis(sourceId, textForAnalysis, llmProvider, ollamaModel, apiKey, ollamaUrl) {
    const logPrefix = `[AnalysisWorker ${process.pid}, SourceID: ${sourceId}]`;
    console.log(`${logPrefix} Starting analysis. Using provider: ${llmProvider}`);

    const analysisResults = { faq: "", topics: "", mindmap: "" };
    let allIndividualAnalysesSuccessful = true; // We still track this for logging/reasoning

    if (llmProvider === 'gemini' && !apiKey) {
        const errorMessage = "Error: Analysis failed because no valid Gemini API key was provided to the worker.";
        console.error(`${logPrefix} ${errorMessage}`);
        // We will still update the DB with this error message in the fields
        analysisResults.faq = errorMessage;
        analysisResults.topics = errorMessage;
        analysisResults.mindmap = errorMessage;
        allIndividualAnalysesSuccessful = false;
    } else {
        async function generateSingleAnalysis(type, promptContentForLLM) {
            try {
                console.log(`${logPrefix} Generating ${type}...`);
                const historyForLLM = [{ role: 'user', parts: [{ text: "Perform the requested analysis based on the system instruction provided." }] }];
                
                const llmOptions = { 
                    apiKey,
                    ollamaUrl,
                    model: ollamaModel,
                    maxOutputTokens: ollamaService.DEFAULT_MAX_OUTPUT_TOKENS_OLLAMA_KG 
                };

                const generatedText = llmProvider === 'ollama'
                    ? await ollamaService.generateContentWithHistory(historyForLLM, promptContentForLLM, null, llmOptions)
                    : await geminiService.generateContentWithHistory(historyForLLM, promptContentForLLM, null, llmOptions);

                if (!generatedText || typeof generatedText !== 'string' || generatedText.trim() === "") {
                    console.warn(`${logPrefix} LLM returned empty content for ${type}.`);
                    allIndividualAnalysesSuccessful = false; // Mark that one part failed
                    return { success: false, content: `Notice: No content generated for ${type}.` };
                }
                console.log(`${logPrefix} ${type} generation successful.`);
                return { success: true, content: generatedText.trim() };
            } catch (error) {
                console.error(`${logPrefix} Error during ${type} generation: ${error.message}`);
                allIndividualAnalysesSuccessful = false; // Mark that one part failed
                return { success: false, content: `Error generating ${type}: ${error.message.substring(0, 250)}` };
            }
        }

        const analysisPromises = [
            generateSingleAnalysis('FAQ', ANALYSIS_PROMPTS.faq.getPrompt(textForAnalysis)),
            generateSingleAnalysis('Topics', ANALYSIS_PROMPTS.topics.getPrompt(textForAnalysis)),
            generateSingleAnalysis('Mindmap', ANALYSIS_PROMPTS.mindmap.getPrompt(textForAnalysis))
        ];
        const outcomes = await Promise.all(analysisPromises); // Use Promise.all since we handle errors inside

        analysisResults.faq = outcomes[0].content;
        analysisResults.topics = outcomes[1].content;
        analysisResults.mindmap = outcomes[2].content;
    }
    
    try {
        // --- THIS IS THE FIX ---
        // The final status is ALWAYS 'completed' if the worker finishes.
        // The failure reason field will indicate if sub-tasks had issues.
        // This makes the document usable even if optional analyses fail.
        await KnowledgeSource.updateOne(
            { _id: sourceId },
            {
                $set: {
                    "analysis.faq": analysisResults.faq,
                    "analysis.topics": analysisResults.topics,
                    "analysis.mindmap": analysisResults.mindmap,
                    "status": "completed", // Always set to completed
                    "failureReason": allIndividualAnalysesSuccessful ? "" : "One or more optional analyses (e.g., mindmap) failed to generate, but the core content is ready."
                }
            }
        );
        // --- END OF FIX ---
        console.log(`${logPrefix} Analysis results stored in DB.`);
        return { success: allIndividualAnalysesSuccessful, message: `Analysis ${allIndividualAnalysesSuccessful ? 'completed' : 'completed with some failures'}.` };
    } catch (dbError) {
        console.error(`${logPrefix} DB Error storing analysis results:`, dbError);
        // If DB update fails, we should throw to indicate a critical failure
        throw new Error(`DB Error storing analysis: ${dbError.message}`);
    }
}


async function run() {
    const { sourceId, textForAnalysis, llmProvider, ollamaModel, apiKey, ollamaUrl } = workerData;
    let dbConnected = false;

    try {
        if (!process.env.MONGO_URI || !sourceId) {
            throw new Error("Worker started with incomplete data (MONGO_URI or sourceId missing).");
        }
        
        await connectDB(process.env.MONGO_URI);
        dbConnected = true;

        if (!textForAnalysis || textForAnalysis.trim() === '') {
            await KnowledgeSource.updateOne({ _id: sourceId }, {
                $set: { status: "failed", failureReason: "Analysis skipped: No text content was extracted." }
            });
        } else {
            await performFullAnalysis(
                sourceId, textForAnalysis, llmProvider, ollamaModel, apiKey, ollamaUrl
            );
        }

    } catch (error) {
        console.error(`[Analysis Worker] Critical error for sourceId '${sourceId}':`, error);
        if (dbConnected && sourceId) {
            try {
                await KnowledgeSource.updateOne(
                    { _id: sourceId },
                    { $set: { status: "failed", failureReason: `Critical worker error: ${error.message}` } }
                );
            } catch (dbUpdateError) {
                console.error(`[Analysis Worker] Failed to update status to 'failed_critical':`, dbUpdateError);
            }
        }
    } finally {
        if (dbConnected) {
            await mongoose.disconnect();
        }
        console.log(`[Analysis Worker] Finished task for sourceId ${sourceId}.`);
    }
}

run();