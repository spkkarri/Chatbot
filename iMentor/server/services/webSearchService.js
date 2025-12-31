// server/services/webSearchService.js
const axios = require('axios');

async function performWebSearch(query) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;

    if (!pythonServiceUrl) {
        console.warn("[WebSearch Service] PYTHON_RAG_SERVICE_URL is not set. Web search is disabled.");
        throw new Error("Web search tool is not configured on the server.");
    }

    const searchUrl = `${pythonServiceUrl}/web_search`;

    try {
        console.log(`[WebSearch Service] Calling Python endpoint for search: ${searchUrl}`);
        const response = await axios.post(searchUrl, { query: query }, { timeout: 45000 });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const topResults = response.data;

            // 1. Create the `references` array for the UI
            const references = topResults.map((result, index) => ({
                number: index + 1,
                source: result.title || 'Untitled Web Page',
                url: result.url || '#',
                content_preview: (result.content || "").substring(0, 150) + "..."
            }));

            // 2. Format the `toolOutput` string for the synthesizer prompt
            const toolOutput = "[WEB SEARCH RESULTS]\n" + topResults.map((result, index) => {
                const title = result.title || 'No Title';
                const url = result.url || '#';
                const content = result.content ? result.content.replace(/[\n\r]+/g, ' ').trim() : 'No content preview.';
                return `[${index + 1}] Title: ${title}\nSource: ${url}\nContent: ${content}`;
            }).join('\n\n');
            
            // 3. Return the object with both properties
            return { toolOutput, references };
            
        } else {
            console.log(`[WebSearch Service] Python service returned no results for query: "${query}"`);
            // Return the correct object structure even on no results
            return { 
                toolOutput: "Web search did not return any results for this query.",
                references: []
            };
        }
    } catch (error) {
        let errorMessage = `Error calling Python service for query "${query}": `;
        if (error.response) {
            errorMessage += `Status ${error.response.status} - ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            errorMessage += `No response received from Python service at ${searchUrl}.`;
        } else {
            errorMessage += error.message;
        }
        console.error(errorMessage);
        // Throw the error to be caught by the agent service
        throw new Error(error.message);
    }
}

module.exports = { performWebSearch };