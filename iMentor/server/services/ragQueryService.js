// server/services/ragQueryService.js
const axios = require('axios');

async function queryPythonRagService(
    query, documentContextNameToPass, criticalThinkingEnabled, clientFilter = null, k = 5
) {
    // ... (function logic is identical) ...
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        console.error("PYTHON_RAG_SERVICE_URL is not set. RAG features disabled for this request.");
        return { references: [], toolOutput: "RAG service is not configured on the server." };
    }
    const searchUrl = `${pythonServiceUrl}/query`;
    console.log(`[ragQueryService] Querying Python RAG: Query="${query.substring(0, 50)}...", DocContext=${documentContextNameToPass}`);

    const payload = {
        query: query,
        k: k,
        user_id: "agent_user",
        use_kg_critical_thinking: !!criticalThinkingEnabled,
        documentContextName: documentContextNameToPass || null
    };
    if (clientFilter && typeof clientFilter === 'object' && Object.keys(clientFilter).length > 0) {
        payload.filter = clientFilter;
    }

    try {
        const response = await axios.post(searchUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: process.env.PYTHON_RAG_TIMEOUT || 30000
        });

        const relevantDocs = response.data?.retrieved_documents_list || [];
        const references = relevantDocs.map((doc, index) => ({
            number: index + 1,
            source: doc.metadata?.file_name || doc.metadata?.original_name || 'Unknown Document',
            content_preview: (doc.page_content || "").substring(0, 100) + "...",
        }));
        
        const toolOutput = relevantDocs.length > 0
            ? response.data.formatted_context_snippet
            : "No relevant context was found in the specified documents for this query.";

        return { references, toolOutput };

    } catch (error) {
        let errorMsg = error.message;
        if (error.response?.data?.error) errorMsg = `Python Service Error: ${error.response.data.error}`;
        else if (error.code === 'ECONNABORTED') errorMsg = 'Python RAG service request timed out.';
        console.error(`[ragQueryService] Error calling Python RAG service at ${searchUrl}:`, errorMsg);
        throw new Error(errorMsg);
    }
}

module.exports = {
    queryPythonRagService,
};
