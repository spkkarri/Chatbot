// server/services/totOrchestrator.js

const { processAgenticRequest } = require('./agentService');
const geminiService = require('./geminiService');
const ollamaService = require('./ollamaService');
const { availableTools } = require('./toolRegistry');
const { PLANNER_PROMPT_TEMPLATE, EVALUATOR_PROMPT_TEMPLATE, createSynthesizerPrompt, CHAT_MAIN_SYSTEM_PROMPT } = require('../config/promptTemplates');

async function isQueryComplex(query, requestContext) {
    if (requestContext.documentContextName) {
        console.log(`[ToT] Step 1: Complexity Gate. Decision: COMPLEX (Document context '${requestContext.documentContextName}' is active).`);
        return true;
    }

    const isComplex = (query.match(/\?/g) || []).length > 1 || query.split(' ').length > 20;
    console.log(`[ToT] Step 1: Complexity Gate. Query: "${query.substring(0, 30)}...". Decision: ${isComplex ? 'COMPLEX' : 'SIMPLE'}`);
    return isComplex;
}

async function generatePlans(query, requestContext) {
    console.log('[ToT] Step 2: Planner. Generating plans via LLM...');
    const { llmProvider, isWebSearchEnabled, isAcademicSearchEnabled, documentContextName, ...llmOptions } = requestContext;
    const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;

    const modelContext = require('../protocols/contextProtocols').createModelContext({ availableTools });
    
    let currentModeInstruction = "";
    let enforcedTool = null;

    if (isWebSearchEnabled) {
        enforcedTool = "web_search";
        currentModeInstruction = `The user has explicitly enabled Web Search. Therefore, ALL steps in ALL plans MUST use the 'web_search' tool. Do NOT use 'rag_search', 'academic_search', or 'direct_answer' tools. For every step, your tool_call MUST be 'web_search' with the appropriate parameters.`;
    } else if (isAcademicSearchEnabled) {
        enforcedTool = "academic_search";
        currentModeInstruction = `The user has explicitly enabled Academic Search. Therefore, ALL steps in ALL plans MUST use the 'academic_search' tool. Do NOT use 'rag_search', 'web_search', or 'direct_answer' tools. For every step, your tool_call MUST be 'academic_search' with the appropriate parameters.`;
    } else if (documentContextName) {
        enforcedTool = "rag_search";
        currentModeInstruction = `The user has selected a document for RAG search: "${documentContextName}". Therefore, ALL steps in ALL plans MUST use the 'rag_search' tool. Do NOT use 'web_search', 'academic_search', or 'direct_answer' tools. For every step, your tool_call MUST be 'rag_search' with the appropriate parameters, specifying the document context if applicable.`;
    } else {
        currentModeInstruction = `No specific tool mode is enforced by the user. For each step, analyze its description and decide the BEST tool to use ('web_search', 'academic_search') or if a 'direct_answer' (tool_call: null) is most appropriate for that specific sub-task.

        **CRITICAL RULES FOR TOOL SELECTION IN DEFAULT MODE (Adhere to these strictly):**
        1.  **Prioritize Direct Answer:** Unless a step explicitly requires *real-time external information* (for 'web_search') or *scholarly papers* (for 'academic_search'), your default choice for tool_call should be \`null\` (for a direct answer using the LLM's internal knowledge). Do not use 'web_search' or 'academic_search' for general definitions, common knowledge, or concepts that the AI should inherently know.
        2.  **Limit External Searches (Maximum One of Each):** In any single plan, you should generate a maximum of **one** 'web_search' tool call and a maximum of **one** 'academic_search' tool call. If a plan requires multiple external searches, use only the most critical one of each type. This constraint applies UNLESS the user's original query explicitly asks for multiple, distinct web or academic searches (e.g., "Find 3 different websites about X"). If the user's original query directly states multiple unique search needs, you may exceed this limit for those specific, explicit requirements.
        3.  **Tool-Specific Queries:** When using 'web_search' or 'academic_search', ensure the 'parameters.query' is very specific and optimized for that search.
        4.  **No RAG Search:** Do NOT use 'rag_search' as a tool when no document is selected by the user.
        `;
    }

    const plannerPrompt = PLANNER_PROMPT_TEMPLATE
        .replace("{userQuery}", query)
        .replace("{available_tools_json}", JSON.stringify(modelContext.available_tools, null, 2))
        .replace("{current_mode_tool_instruction}", currentModeInstruction);

    try {
        const responseText = await llmService.generateContentWithHistory(
            [], plannerPrompt, "You are a meticulous AI planning agent.", llmOptions
        );
        const jsonMatch = responseText.match(/```(json)?\s*([\s\S]+?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[2] : responseText;
        const parsedResponse = JSON.parse(jsonString);

        if (parsedResponse.plans && Array.isArray(parsedResponse.plans) && parsedResponse.plans.length > 0) {
            parsedResponse.plans.forEach(plan => {
                if (plan.steps && Array.isArray(plan.steps)) {
                    plan.steps = plan.steps.map(step => {
                        if (typeof step === 'string') {
                            step = { description: step, tool_call: null };
                        }
                        
                        if (enforcedTool) {
                            return {
                                description: step.description,
                                tool_call: {
                                    tool_name: enforcedTool,
                                    parameters: { query: step.description } 
                                }
                            };
                        }

                        if (step.tool_call) {
                            if (typeof step.tool_call !== 'object' || !step.tool_call.tool_name || !step.tool_call.parameters) {
                                console.warn(`[ToT Planner] Invalid tool_call structure for step:`, step);
                                step.tool_call = null; // Invalidate if malformed
                            }
                        }
                        return step;
                    });
                }
            });
            console.log(`[ToT] Planner: Successfully generated and validated ${parsedResponse.plans.length} plans.`);
            return parsedResponse.plans;
        }
    } catch (error) {
        console.error(`[ToT] Planner: LLM call failed or returned invalid JSON. Error: ${error.message}. Falling back to default plan.`);
        // Ensure fallback plan also matches the new step object format, applying enforcement if needed
        const defaultToolCall = enforcedTool ? 
            { tool_name: enforcedTool, parameters: { query: query } } : null; // Apply enforcement to fallback too
        return [{
            name: "Default Direct Answer Plan",
            steps: [{ description: `Directly address the user's query: "${query}"`, tool_call: defaultToolCall }]
        }];
    }
}

async function evaluatePlans(plans, query, requestContext) {
    console.log('[ToT] Step 3: Evaluator. Evaluating plans via LLM...');
    if (!plans || plans.length === 0) throw new Error("No plans provided to evaluate.");
    if (plans.length === 1) {
        console.log('[ToT] Evaluator: Only one plan available. Selecting it by default.');
        return plans[0];
    }

    const { llmProvider, ...llmOptions } = requestContext;
    const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;
    const plansJsonString = JSON.stringify(plans, null, 2);

    const evaluatorPrompt = EVALUATOR_PROMPT_TEMPLATE.replace("{userQuery}", query).replace("{plansJsonString}", plansJsonString);

    try {
        const responseText = await llmService.generateContentWithHistory(
            [], evaluatorPrompt, "You are an evaluating agent.", llmOptions
        );
        const jsonMatch = responseText.match(/```(json)?\s*([\s\S]+?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[2] : responseText;
        const parsedResponse = JSON.parse(jsonString);

        if (parsedResponse.best_plan_name) {
            const winningPlan = plans.find(p => p.name === parsedResponse.best_plan_name);
            if (winningPlan) {
                console.log(`[ToT] Evaluator: LLM selected winning plan: "${winningPlan.name}"`);
                return winningPlan;
            }
        }
    } catch (error) {
        console.error(`[ToT] Evaluator: LLM call failed or returned invalid JSON. Error: ${error.message}. Falling back to first plan.`);
    }
    
    console.log(`[ToT] Evaluator: Fallback selected. Winning plan: "${plans[0].name}"`);
    return plans[0];
}



async function executePlan(winningPlan, originalQuery, requestContext, streamCallback) {
    console.log('[ToT] Step 4: Executor. Starting execution of plan...');
    let collectedContexts = [];
    let cumulativeContext = ""; 
    const uniqueReferences = new Map();

    for (let i = 0; i < winningPlan.steps.length; i++) {
        const step = winningPlan.steps[i]; // 'step' is now an object { description, tool_call }
        const stepDescription = step.description;
        const stepToolCall = step.tool_call; // This will be null for direct answers or an object for tools

        let agentResponse; // This will hold the result of the tool execution or direct answer

        // --- MODIFICATION START: Direct Tool Execution Logic ---
        if (stepToolCall && stepToolCall.tool_name) {
            // This step requires a specific tool as decided by the Planner
            const toolName = stepToolCall.tool_name;
            const toolParams = stepToolCall.parameters;

            const tool = availableTools[toolName]; // Access from the availableTools import
            if (!tool) {
                console.error(`[ToT Executor] Planner specified unknown tool: ${toolName}. Falling back to direct answer.`);
                // Fallback if Planner hallucinated a tool
                agentResponse = {
                    finalAnswer: `I attempted to use a tool called '${toolName}' but it doesn't exist. Please try again or refine your query.`,
                    thinking: null,
                    references: [],
                    sourcePipeline: `tot-error-unknown-tool`
                };
            } else {
                try {
                    console.log(`[ToT Executor] Executing Planner-selected tool: ${toolName} with params:`, toolParams);
                    // Dynamically execute the tool, passing necessary context
                    const toolResult = await tool.execute(toolParams, requestContext); 
                    
                    // Format tool output for 'finalAnswer' and 'thinking' fields in agentResponse structure
                    agentResponse = {
                        finalAnswer: toolResult.toolOutput || `No specific output from ${toolName}.`,
                        thinking: `Successfully executed tool: ${toolName}.`,
                        references: toolResult.references || [],
                        sourcePipeline: `tot-planner-${toolName}`
                    };

                } catch (toolError) {
                    console.error(`[ToT Executor] Error executing Planner-selected tool '${toolName}':`, toolError);
                    agentResponse = {
                        finalAnswer: `I attempted to use the '${toolName}' tool as planned, but it failed. Error: ${toolError.message}.`,
                        thinking: null,
                        references: [],
                        sourcePipeline: `tot-error-tool-failed`
                    };
                }
            }
        } else {
            // This step is a 'direct_answer' as decided by the Planner (tool_call is null)
            console.log(`[ToT Executor] Performing direct answer for step: "${stepDescription}"`);
            
            // Use a simplified direct answer approach, as agentService does for 'forceSimple'
            // Need the LLM Service and options from requestContext
            const llmService = requestContext.llmProvider === 'ollama' ? ollamaService : geminiService;
            const llmOptions = { 
                model: requestContext.ollamaModel, 
                apiKey: requestContext.apiKey, 
                ollamaUrl: requestContext.ollamaUrl 
            };

            const directAnswerText = await llmService.generateContentWithHistory(
                [], // No history here, each step is self-contained for execution
                stepDescription, // The prompt for this step
                CHAT_MAIN_SYSTEM_PROMPT(), // Use the main system prompt for direct answers
                llmOptions
            );
            
            const thinkingMatch = directAnswerText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
            const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
            const mainContent = thinking ? directAnswerText.replace(/<thinking>[\s\S]*?<\/thinking>\s*/i, "").trim() : directAnswerText;

            agentResponse = {
                finalAnswer: mainContent,
                thinking: thinking,
                references: [],
                sourcePipeline: `tot-planner-direct-answer`
            };
        }
        // --- MODIFICATION END ---

        const monologue = agentResponse.thinking || `The step was executed, but no detailed thinking was provided.`;
        const thoughtContent = `**Step ${i + 1}/${winningPlan.steps.length}: ${stepDescription}**\n*Thinking:* ${monologue}\n\n`;
        streamCallback({ type: 'thought', content: thoughtContent });
        
        console.log(`[ToT] Executor: Step ${i+1} completed.`);
        
        const stepResult = `--- Context from Step ${i + 1} (${agentResponse.sourcePipeline}) ---\n${agentResponse.finalAnswer}`;
        collectedContexts.push(stepResult);

        cumulativeContext += stepResult + "\n\n";

        // Add new, unique references to our map. Using URL as the key for de-duplication.
        if (agentResponse.references && agentResponse.references.length > 0) {
            agentResponse.references.forEach(ref => {
                if (ref.url && !uniqueReferences.has(ref.url)) {
                    uniqueReferences.set(ref.url, ref);
                } else if (!ref.url && ref.source && !uniqueReferences.has(ref.source)) {
                    // Fallback to source text for de-duplication if URL is missing
                    uniqueReferences.set(ref.source, ref);
                }
            });
        }
    }
    
    const allReferences = Array.from(uniqueReferences.values()).map((ref, index) => ({
        ...ref,
        number: index + 1
    }));
    
    console.log(`[ToT] Step 4: Executor. All steps executed. Collected ${allReferences.length} de-duplicated references.`);
    
    return {
        finalContext: collectedContexts.join('\n\n'),
        allReferences: allReferences
    };
}

async function synthesizeFinalAnswer(originalQuery, finalContext, chatHistory, requestContext) {
    console.log('[ToT] Step 5: Synthesizer. Creating final response...');
    const { llmProvider, ...llmOptions } = requestContext;
    const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;

    const synthesizerUserQuery = createSynthesizerPrompt(
        originalQuery, finalContext, 'tree_of_thought_synthesis'
    );

    const finalSystemPrompt = CHAT_MAIN_SYSTEM_PROMPT();

    const finalAnswer = await llmService.generateContentWithHistory(
        chatHistory, synthesizerUserQuery, finalSystemPrompt, llmOptions
    );
    return finalAnswer;
}

async function processQueryWithToT_Streaming(query, chatHistory, requestContext, streamCallback) {
    const allThoughts = [];
    const streamAndStoreThought = (content) => {
        streamCallback({ type: 'thought', content });
        allThoughts.push(content);
    };

    const isComplex = await isQueryComplex(query,requestContext);

    if (!isComplex) {
        // Step 1: Stream the initial classification thought. This gives immediate feedback.
        streamAndStoreThought(`**Analyzing Query**\nQuery is simple. No need of Complex thinking process my Love 😊.\n\n`);
        
        // Step 2: Get the direct response. This now includes the LLM's own thinking process.
        const directResponse = await processAgenticRequest(
            query,
            chatHistory,
            requestContext.systemPrompt,
            { ...requestContext, forceSimple: true }
        );

        // Step 3: Check for and stream the detailed thinking from the direct answer.
        if (directResponse.thinking) {
            // This is the new, crucial part. We stream the thinking we just received.
            const thinkingHeader = `**Direct Response Plan**\n`;
            streamAndStoreThought(thinkingHeader + directResponse.thinking);
        }

        // Step 4: The final object is now built from all thoughts that were streamed.
        const finalThoughts = allThoughts.join(''); // Join without extra separators, as they are in the content.

        return { 
            finalAnswer: directResponse.finalAnswer, 
            thoughts: finalThoughts, 
            references: directResponse.references, 
            sourcePipeline: directResponse.sourcePipeline 
        };
    }


    streamAndStoreThought("**Starting Complex Reasoning**\nQuery detected as complex. Initiating multi-step thought process.\n\n**Hang on, We are doing our best to give the best outcome**\n\n\n");
    
    const plans = await generatePlans(query, requestContext);
    streamAndStoreThought(`**Planning Stage**\nGenerated ${plans.length} potential plans. Now evaluating the best approach.\n\n`);
    
    const winningPlan = await evaluatePlans(plans, query, requestContext);
    streamAndStoreThought(`**Evaluation Stage**\nBest plan selected: "${winningPlan.name}". Beginning execution.\n\n`);

    const { finalContext, allReferences } = await executePlan(winningPlan, query, requestContext, streamCallback);
    
    streamAndStoreThought("**Synthesizing Final Answer**\nAll information has been gathered. Compiling the final, comprehensive response.\n\n");

    const finalAnswerWithThinking = await synthesizeFinalAnswer(query, finalContext, chatHistory, requestContext);

    const thinkingMatch = finalAnswerWithThinking.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
    const finalAnswer = thinking ? finalAnswerWithThinking.replace(/<thinking>[\s\S]*?<\/thinking>\s*/i, '').trim() : finalAnswerWithThinking;

    allThoughts.push(thinking);
    const finalThoughts = allThoughts.filter(Boolean).join('');
    
    console.log('--- ToT Streaming Orchestration Finished ---');
    return {
        finalAnswer,
        thoughts: finalThoughts,
        references: allReferences,
        sourcePipeline: `tot-${requestContext.llmProvider}`
    };
}

module.exports = {  
    processQueryWithToT_Streaming
};