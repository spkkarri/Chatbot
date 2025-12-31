// server/routes/learning.js
const express = require('express');
const router = express.Router();
const { redisClient } = require('../config/redisClient');
const axios = require('axios');

// @route   GET /api/learning/recommendations/:sessionId
// @desc    Get cached recommendations for a new session.
// @access  Private
router.get('/recommendations/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const cacheKey = `recommendations:${sessionId}`;

    try {
        if (redisClient && redisClient.isOpen) {
            const cachedData = await redisClient.get(cacheKey);

            console.log(`[Learning Route] GET recommendations for session ${sessionId}:`);
            console.log(`  - Cache Key: ${cacheKey}`);
            console.log(`  - Data from Redis: ${cachedData ? cachedData.substring(0, 100) + '...' : 'null'}`);

            
            if (cachedData) {
                console.log(`[Learning Route] Cache HIT for recommendations on session ${sessionId}.`);
                // Once read, we can remove it from the cache
                await redisClient.del(cacheKey); 
                return res.status(200).json({ recommendations: JSON.parse(cachedData) });
            }
        }
        console.log(`[Learning Route] Cache MISS for recommendations on session ${sessionId}.`);
        res.status(200).json({ recommendations: [] }); // Return empty array if not found
    } catch (error) {
        console.error(`Error fetching recommendations from cache for session ${sessionId}:`, error);
        res.status(500).json({ message: 'Server error retrieving recommendations.' });
    }
});

// @route   POST /api/learning/find-document
// @desc    Perform a JIT RAG search for a recommended topic.
// @access  Private
router.post('/find-document', async (req, res) => {
    const { topic } = req.body;
    const userId = req.user._id.toString();

    if (!topic) {
        return res.status(400).json({ message: 'Topic is required.' });
    }

    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        return res.status(500).json({ message: 'RAG service is not configured.' });
    }
    const searchUrl = `${pythonServiceUrl}/query`;

    try {
        console.log(`[Learning Route] Performing JIT RAG search for topic: "${topic}" for user ${userId}`);
        const response = await axios.post(searchUrl, {
            query: topic,
            user_id: userId, // Pass user ID to search their docs and admin docs
            k: 1 // We only want the single best document for this topic
        });

        const docs = response.data?.retrieved_documents_list;
        if (docs && docs.length > 0) {
            const bestDoc = docs[0].metadata?.file_name || docs[0].metadata?.original_name;
            if (bestDoc) {
                return res.status(200).json({ documentName: bestDoc });
            }
        }

        res.status(404).json({ message: 'No relevant document could be found for that topic.' });

    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message;
        console.error(`[Learning Route] RAG search failed for topic "${topic}":`, errorMsg);
        res.status(500).json({ message: 'Failed to find a relevant document.' });
    }
});

module.exports = router;