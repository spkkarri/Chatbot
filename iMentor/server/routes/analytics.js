// server/routes/analytics.js
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const esClient = require('../config/elasticsearchClient');
const User = require('../models/User');
const KnowledgeSource = require('../models/KnowledgeSource');

// --- KPI & User Growth Routes (Unchanged) ---
router.get('/total-queries', async (req, res) => {
    if (!esClient) { return res.status(503).json({ message: "Analytics service unavailable." }); }
    try {
        const response = await esClient.count({
            index: 'filebeat-*',
            body: { query: { "match_phrase": { "message": "User Event: CHAT_MESSAGE_SENT" } } }
        });
        res.json({ count: response.count });
    } catch (error) {
        logger.error('ES query for total queries failed', { errorMessage: error.message });
        res.status(500).json({ message: "Failed to retrieve total query analytics." });
    }
});

router.get('/active-users-today', async (req, res) => {
    if (!esClient) {
        return res.status(503).json({ message: "Analytics service (Elasticsearch) is currently unavailable." });
    }
    try {
        const response = await esClient.search({
            index: 'filebeat-*',
            body: {
                size: 0,
                query: {
                    range: {
                        "@timestamp": {
                            "gte": "now-24h/h",
                            "lte": "now/h"
                        }
                    }
                },
                aggs: {
                    unique_active_users: {
                        "cardinality": {
                            "script": {
                                "source": `
                                    if (doc.containsKey('payload') && !doc['payload'].empty) {
                                        String payload = doc['payload'].value;
                                        if (payload == null) return null;
                                        def m = /"userId":"([^"]+)"/.matcher(payload);
                                        if (m.find()) {
                                            String userId = m.group(1);
                                            if (userId != 'SYSTEM') {
                                                return userId;
                                            }
                                        }
                                    }
                                    return null;
                                `,
                                "lang": "painless"
                            }
                        }
                    }
                }
            }
        });

        const activeUserCount = response.aggregations?.unique_active_users?.value || 0;

        res.json({
            title: "Active Users (Today)",
            count: activeUserCount
        });

    } catch (error) {
        logger.error('Elasticsearch query for active users failed', { 
            errorMessage: error.message, 
            meta: error.meta?.body 
        });
        res.status(500).json({ message: "Failed to retrieve active users analytics." });
    }
});

router.get('/total-sources', async (req, res) => {
    try {
        const count = await KnowledgeSource.countDocuments();
        res.json({ count: count });
    } catch (error) {
        logger.error('MongoDB query for total sources failed', { errorMessage: error.message });
        res.status(500).json({ message: "Failed to retrieve total sources." });
    }
});

router.get('/user-engagement', async (req, res) => {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [totalUsers, newSignupsLast7Days, dailySignupsResponse] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            User.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
                { $project: { date: "$_id", count: 1, _id: 0 } }
            ])
        ]);
        res.json({ totalUsers, newSignupsLast7Days, dailySignupsLast30Days: dailySignupsResponse });
    } catch (error) {
        logger.error('Error fetching user engagement', { errorMessage: error.message });
        res.status(500).json({ message: 'Failed to retrieve user engagement.' });
    }
});

// --- Chart Data Routes (REVISED AND CONSOLIDATED) ---

// --- START OF FIX ---
router.get('/feature-usage', async (req, res) => {
    if (!esClient) { return res.status(503).json({ message: "Analytics service unavailable." }); }
    try {
        // Run all queries concurrently
        const [
            toolUsageResponse,
            criticalThinkingResponse,
            searchUsageResponse // Correctly named response
        ] = await Promise.all([
            // 1. Query for Tool Usage (Quiz, Code Executor, etc.)
            esClient.search({
                index: 'filebeat-*',
                body: {
                    size: 0,
                    query: { "wildcard": { "payload": "*TOOL_USAGE_*" } },
                    aggs: {
                        feature_counts: {
                            "terms": {
                                "script": {
                                    "source": `if (doc.containsKey('payload') && !doc['payload'].empty) { def payload = doc['payload'].value; def m = /"eventType":"([^"]+)"/.matcher(payload); if (m.find()) { return m.group(1); } } return 'N/A';`,
                                    "lang": "painless"
                                }, "size": 20
                            }
                        }
                    }
                }
            }),
            // 2. Query for Critical Thinking Usage (using the validated query)
            esClient.count({
                index: 'filebeat-*',
                body: { query: { "query_string": { "query": "message:\"User Event: CHAT_MESSAGE_SENT\" AND payload:*\"criticalThinkingEnabled\"\\:true*" } } }
            }),
            // 3. Query for Web/Academic Search usage
            esClient.search({
                index: 'filebeat-*',
                body: {
                    size: 0,
                    query: { "match_phrase": { "message": "AI Response Sent" } },
                    aggs: {
                        search_tool_counts: {
                            "terms": {
                                "field": "source_pipeline.keyword", "size": 10
                            }
                        }
                    }
                }
            })
        ]);

        // Process Tool Usage
        const toolUsageData = toolUsageResponse.aggregations.feature_counts.buckets
            .filter(bucket => bucket.key.startsWith('TOOL_USAGE_'))
            .map(bucket => ({
                feature: bucket.key.replace('TOOL_USAGE_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                count: bucket.doc_count
            }));

        // Process Search Usage from the correct response variable
        const searchUsageData = searchUsageResponse.aggregations.search_tool_counts.buckets
            .filter(bucket => bucket.key.includes('web_search') || bucket.key.includes('academic_search'))
            .map(bucket => ({
                feature: bucket.key.includes('web_search') ? 'Web Search' : 'Academic Search',
                count: bucket.doc_count
            }));
        
        // Combine all data into the final array
        const finalData = [
            ...toolUsageData,
            ...searchUsageData,
            { feature: 'Critical Thinking Mode', count: criticalThinkingResponse.count }
        ];

        res.json(finalData);

    } catch (error) {
        logger.error('ES query for feature usage failed', { errorMessage: error.message, meta: error.meta?.body });
        res.status(500).json({ message: "Failed to retrieve feature usage analytics." });
    }
});
// --- END OF FIX ---


// ... (Other routes like content-insights, llm-usage, etc. remain the same) ...
router.get('/content-insights', async (req, res) => {
    if (!esClient) { return res.status(503).json({ message: "Analytics service unavailable." }); }
    try {
        const response = await esClient.search({
            index: 'filebeat-*',
            body: {
                size: 0,
                query: { "query_string": { "query": "message:\"User Event: CHAT_MESSAGE_SENT\" AND payload:*documentContext* AND NOT payload:*documentContext*null*" } },
                aggs: { document_counts: { "terms": { "script": { "source": `if (doc.containsKey('payload') && !doc['payload'].empty) { String payloadStr = doc['payload'].value; if (payloadStr == null) return 'N/A'; def m = /"documentContext":"([^"]+)"/.matcher(payloadStr); if (m.find()) { return m.group(1); } } return 'N/A';`, "lang": "painless" }, "size": 10 } } }
            }
        });
        const formattedData = response.aggregations.document_counts.buckets.filter(b => b.key !== 'N/A').map(b => ({ documentName: b.key, count: b.doc_count }));
        res.json(formattedData);
    } catch (error) {
        logger.error('ES query for content insights failed', { errorMessage: error.message, meta: error.meta?.body });
        res.status(500).json({ message: "Failed to retrieve content insights." });
    }
});

router.get('/llm-usage', async (req, res) => {
    if (!esClient) { return res.status(503).json({ message: "Analytics service unavailable." }); }
    try {
        const response = await esClient.search({
            index: 'filebeat-*',
            body: {
                size: 0,
                query: { "query_string": { "query": "message:\"User Event: CHAT_MESSAGE_SENT\" AND payload:*llmProvider*" } },
                aggs: { llm_provider_counts: { "terms": { "script": { "source": `if (doc.containsKey('payload') && !doc['payload'].empty) { String payloadStr = doc['payload'].value; if (payloadStr == null) return 'N/A'; def m = /"llmProvider":"([^"]+)"/.matcher(payloadStr); if (m.find()) { return m.group(1); } } return 'N/A';`, "lang": "painless" }, "size": 10 } } }
            }
        });
        const formattedData = response.aggregations.llm_provider_counts.buckets.filter(b => b.key !== 'N/A').map(b => ({ provider: b.key, count: b.doc_count }));
        res.json(formattedData);
    } catch (error) {
        logger.error('ES query for LLM usage failed', { errorMessage: error.message, meta: error.meta?.body });
        res.status(500).json({ message: "Failed to retrieve LLM usage analytics." });
    }
});

router.get('/pptx-generated-count', async (req, res) => {
    if (!esClient) { return res.status(503).json({ message: "Analytics service unavailable." }); }
    try {
        const response = await esClient.count({ index: 'filebeat-*', body: { query: { "query_string": { "query": "message:*CONTENT_GENERATION* AND payload:*docType* AND payload:*pptx*" } } } });
        res.json({ count: response.count });
    } catch (error) {
        logger.error('ES query for PPTX count failed', { errorMessage: error.message });
        res.status(500).json({ message: "Failed to retrieve PPTX generation analytics." });
    }
});

router.get('/docx-generated-count', async (req, res) => {
    if (!esClient) { return res.status(503).json({ message: "Analytics service unavailable." }); }
    try {
        const response = await esClient.count({ index: 'filebeat-*', body: { query: { "query_string": { "query": "message:*CONTENT_GENERATION* AND payload:*docType* AND payload:*docx*" } } } });
        res.json({ count: response.count });
    } catch (error) {
        logger.error('ES query for DOCX count failed', { errorMessage: error.message });
        res.status(500).json({ message: "Failed to retrieve DOCX generation analytics." });
    }
});

module.exports = router;