// server/services/learning/curriculumOrchestrator.js
const LearningPath = require('../../models/LearningPath');
const User = require('../../models/User');
const geminiService = require('../geminiService');
const ollamaService = require('../ollamaService');
const { decrypt } = require('../../utils/crypto');
const { queryPythonRagService } = require('../toolExecutionService');


const GOAL_ANALYSIS_PROMPT = `You are an expert curriculum designer. Your first task is to analyze a user's learning goal to determine if it's specific enough to build a detailed plan, or if it's too broad and requires clarification.

**User's Goal:** "{goal}"

**Instructions:**
Analyze the goal and return a single JSON object with one key, "isSpecific".
- If the goal is specific and actionable (e.g., "learn python decorators", "prepare for my networking exam on the OSI model"), set "isSpecific" to true.
- If the goal is broad and requires more user input to create a meaningful plan (e.g., "learn programming", "get better at math", "learn full stack development"), set "isSpecific" to false.

Your output MUST be ONLY the JSON object.
Example for a specific goal: { "isSpecific": true }
Example for a broad goal: { "isSpecific": false }
`;

const CLARIFICATION_QUESTIONS_PROMPT = `You are an expert curriculum designer. A user has stated a broad learning goal: "{goal}". To create a personalized and effective study plan, you need to ask them a few clarifying questions.

**Instructions:**
1. Generate 2-3 essential multiple-choice or short-answer questions to narrow down the user's goal.
2. The questions should help you understand their preferred technologies, current skill level, and specific interests within the broad topic.
3. Your entire output MUST be a single, valid JSON object with one key, "questions".
4. The "questions" key must hold an array of question objects. Each object must have:
   - "questionText": The question to ask the user.
   - "type": Either "multiple_choice" or "text_input".
   - "options" (for multiple_choice only): An array of strings representing the choices.

**Example JSON Output for "Learn Full Stack Development":**
{
  "questions": [
    {
      "questionText": "Great goal! To start, which technology stack interests you most?",
      "type": "multiple_choice",
      "options": ["MERN Stack (React, Node.js)", "MEAN Stack (Angular, Node.js)", "Something else"]
    },
    {
      "questionText": "What is your current comfort level with frontend development?",
      "type": "multiple_choice",
      "options": ["Complete beginner", "I know some HTML/CSS", "I have experience with a framework"]
    }
  ]
}
`;

const PLAN_GENERATION_PROMPT = `You are a world-class AI academic advisor and curriculum designer for a prestigious university. Your task is to create a detailed, comprehensive, and actionable learning path for a student.

**CONTEXT:**
- **User Profile:**
  - **Level:** {degreeType}, {year}
  - **Field:** {branch}
  - **Preferred Learning Style:** {learningStyle}
  - **Identified Weaknesses:** {knowledgeGaps}
- **User's Ultimate Goal:** "{goal}"

**CRITICAL INSTRUCTIONS:**
1.  **ADAPT PLAN SCALE:** Analyze the user's goal.
    -   If the goal is **broad and long-term** (e.g., "learn full stack development", "master machine learning"), you MUST generate a comprehensive curriculum with **10-15 modules**, broken into logical phases (e.g., "Phase 1: Frontend Fundamentals").
    -   If the goal is **specific and short-term** (e.g., "understand python decorators", "learn how TCP works"), you MUST generate a concise, focused plan of **3-5 modules** that directly addresses the concept.
2.  **MODULE DESIGN:** Each module must be a clear, actionable step. For each module, provide:
    -   A "title" that is specific and descriptive.
    -   A brief "objective" explaining the learning outcome for that module.
    -   An "activity" object containing:
        -   "type": The best tool for the task. Your default choice should be 'direct_answer' (approx. 80% of the time). Use 'web_search' for very modern topics, libraries, or practical tutorials. Use 'academic_search' only for deep, theoretical concepts. Use 'code_executor' for hands-on programming tasks. **DO NOT generate a 'document_review' type.**
        -   "suggestedPrompt": A clear, effective prompt the user can send to the AI to begin the activity. This prompt should be a complete instruction.
3.  **LOGICAL STRUCTURE:** The sequence of modules MUST be pedagogically sound. Start with fundamentals and build complexity. Prioritize modules that address the user's "Identified Weaknesses".

**OUTPUT FORMAT (ABSOLUTELY STRICT):**
-   Your entire output must be a single, valid JSON object.
-   The root object must have one key: "modules".
-   "modules" must be an array of module objects as described above.
-   Do NOT include any extra text, markdown, or explanations outside of the JSON structure.

**EXAMPLE FOR A BROAD GOAL ("Learn MERN Stack"):**
{
  "modules": [
    {
      "title": "Phase 1: Frontend Fundamentals - Module 1: JavaScript ES6+ Core Concepts",
      "objective": "Master the modern JavaScript features essential for React development.",
      "activity": { "type": "direct_answer", "suggestedPrompt": "Explain the following ES6+ JavaScript concepts with code examples: let/const, arrow functions, destructuring, and modules." }
    },
    {
      "title": "Phase 1: Frontend Fundamentals - Module 2: Introduction to React & JSX",
      "objective": "Understand the core concepts of React, components, and JSX syntax.",
      "activity": { "type": "direct_answer", "suggestedPrompt": "What is React and JSX? Provide a simple 'Hello World' example of a React component." }
    },
    {
      "title": "Phase 2: Backend Development - Module 1: Building a Basic Express Server",
      "objective": "Learn to create a simple web server using Node.js and Express.",
      "activity": { "type": "code_executor", "suggestedPrompt": "Guide me step-by-step in building a basic 'Hello World' server with Node.js and Express that listens on port 3000." }
    }
  ]
}`;


/**
 * The intelligent "brain" of the feature. Generates a personalized learning plan.
 * @param {string} goal - The user's learning goal.
 * @param {object} user - The full user object from MongoDB.
 * @returns {Promise<Array>} A promise that resolves to an array of module objects.
 */
async function generateModulesForGoal(goal, user, context) {
    console.log(`[CurriculumOrchestrator] Generating ADVANCED modules for goal: "${goal}"`);

    const { profile, preferredLlmProvider, ollamaUrl, ollamaModel, encryptedApiKey } = user;
    const knowledgeGaps = profile.performanceMetrics && profile.performanceMetrics.size > 0 
        ? Array.from(profile.performanceMetrics.keys()).join(', ') 
        : "None identified yet.";

    const prompt = PLAN_GENERATION_PROMPT
        .replace('{degreeType}', profile.degreeType || 'N/A')
        .replace('{year}', profile.year || 'N/A')
        .replace('{branch}', profile.branch || 'N/A')
        .replace('{learningStyle}', profile.learningStyle || 'N/A')
        .replace('{knowledgeGaps}', knowledgeGaps)
        .replace('{goal}', goal);

    const llmService = preferredLlmProvider === 'ollama' ? ollamaService : geminiService;
    const apiKey = encryptedApiKey ? decrypt(encryptedApiKey) : null;

    if (preferredLlmProvider === 'gemini' && !apiKey) {
        throw new Error("Cannot generate plan: User has selected Gemini but has no API key configured.");
    }

    const llmOptions = { apiKey, ollamaUrl, model: ollamaModel, temperature: 0.5 };
    const responseText = await llmService.generateContentWithHistory([], prompt, null, llmOptions);
    
    // Find and parse the JSON object from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error("LLM did not return a valid JSON object. Response:", responseText);
        throw new Error("The AI failed to generate a structured learning plan. Please try rephrasing your goal.");
    }
    const jsonString = jsonMatch[0];
    const result = JSON.parse(jsonString);

    if (!result.modules || !Array.isArray(result.modules)) {
        throw new Error("LLM returned an invalid format for the learning plan's modules.");
    }
    
    // ** The flawed RAG search post-processing step has been REMOVED **

    // Set initial status for the modules
    if (result.modules.length > 0) {
        result.modules[0].status = 'not_started';
        for (let i = 1; i < result.modules.length; i++) {
            result.modules[i].status = 'locked';
        }
    }

    return result.modules;
}


/**
 * Main orchestrator function. Creates and saves a new learning path OR returns clarification questions.
 * @param {string} userId - The ID of the user.
 * @param {string} goal - The user's stated learning goal.
 * @param {object} [context] - Optional context, including answers to clarification questions.
 * @returns {Promise<Object>} Either the newly created LearningPath document or a questionnaire object.
 */
async function createLearningPath(userId, goal, context = {}) {
    if (!userId || !goal) {
        throw new Error("User ID and a learning goal are required.");
    }

    const user = await User.findById(userId).select(
        'profile preferredLlmProvider ollamaUrl ollamaModel +encryptedApiKey apiKeyRequestStatus'
    );

    if (!user) {
        throw new Error("User not found.");
    }

    if (user?.preferredLlmProvider === 'gemini' && user?.apiKeyRequestStatus === 'pending' && !user?.encryptedApiKey) {
        throw new Error("Cannot process plan: User's API key request is pending approval.");
    }


    const { preferredLlmProvider, ollamaUrl, ollamaModel, encryptedApiKey } = user;
    const llmService = preferredLlmProvider === 'ollama' ? ollamaService : geminiService;
    const apiKey = encryptedApiKey ? decrypt(encryptedApiKey) : null;

    if (preferredLlmProvider === 'gemini' && !apiKey) {
        throw new Error("Cannot process plan: User has selected Gemini but has no API key.");
    }
    const llmOptions = { apiKey, ollamaUrl, model: ollamaModel, temperature: 0.3 };

    // --- RESTRUCTURED LOGIC ---

    // SCENARIO 1: The frontend has provided answers, so we must generate the final plan.
    if (context && context.clarificationAnswers) {
        console.log(`[CurriculumOrchestrator] Received clarification answers. Generating final plan.`);
        const refinedGoal = `${goal} - Specifics: ${JSON.stringify(context.clarificationAnswers)}`;
        const modules = await generateModulesForGoal(refinedGoal, user, context);

        if (!modules || modules.length === 0) {
            throw new Error("The curriculum orchestrator failed to generate any modules for this goal.");
        }

        const newLearningPath = new LearningPath({ userId, title: goal, modules });
        await newLearningPath.save();
        
        await User.updateOne({ _id: userId }, { $push: { learningPaths: newLearningPath._id } });

        console.log(`[CurriculumOrchestrator] Saved new intelligent learning path "${goal}" for user ${userId}.`);
        return newLearningPath;
    }

    // SCENARIO 2: This is the initial request. Analyze the goal's specificity.
    console.log(`[CurriculumOrchestrator] Analyzing initial goal for specificity: "${goal}"`);
    const analysisPrompt = GOAL_ANALYSIS_PROMPT.replace('{goal}', goal);
    const analysisResponseText = await llmService.generateContentWithHistory([], analysisPrompt, null, llmOptions);
    const analysisResult = JSON.parse(analysisResponseText.match(/\{[\s\S]*\}/)[0]);

    if (analysisResult.isSpecific === false) {
        // Goal is broad, generate and return the questionnaire.
        console.log(`[CurriculumOrchestrator] Goal is broad. Generating clarification questions.`);
        const questionsPrompt = CLARIFICATION_QUESTIONS_PROMPT.replace('{goal}', goal);
        const questionsResponseText = await llmService.generateContentWithHistory([], questionsPrompt, null, llmOptions);
        const questionsResult = JSON.parse(questionsResponseText.match(/\{[\s\S]*\}/)[0]);
        return { isQuestionnaire: true, ...questionsResult };
    } else {
        // Goal is specific, generate the plan directly.
        console.log(`[CurriculumOrchestrator] Goal is specific. Proceeding to generate modules directly.`);
        const modules = await generateModulesForGoal(goal, user, context);
        
        if (!modules || modules.length === 0) {
            throw new Error("The curriculum orchestrator failed to generate any modules for this goal.");
        }
        
        const newLearningPath = new LearningPath({ userId, title: goal, modules });
        await newLearningPath.save();
        
        await User.updateOne({ _id: userId }, { $push: { learningPaths: newLearningPath._id } });

        console.log(`[CurriculumOrchestrator] Saved new intelligent learning path "${goal}" for user ${userId}.`);
        return newLearningPath;
    }
}


module.exports = {
    createLearningPath,
};
