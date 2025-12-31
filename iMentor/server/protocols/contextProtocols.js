// server/protocols/contextProtocols.js

const createModelContext = ({ availableTools, currentMode = 'chat' }) => ({
  current_mode: currentMode,
  available_tools: Object.entries(availableTools).map(([name, details]) => ({
    name,
    description: details.description,
    parameters: details.requiredParams,
  })),
});

const createAgenticContext = ({ systemPrompt }) => ({
  agent_role: "AI Engineering Tutor",
  agent_objectives: ["Provide accurate, clear, and helpful answers.", "Intelligently use available tools to fulfill user requests."],
  long_term_goals: ["Help the user learn and solve complex engineering problems."],
  constraints: ["Base answers on provided context when available.", "Do not hallucinate facts.", "Adhere to safety guidelines."],
  base_instructions: systemPrompt,
});

const createThreadContext = ({ sessionId, userId, history }) => ({
  thread_id: sessionId,
  user_id: userId,
  prior_interactions_summary: null,
});

module.exports = {
    createModelContext,
    createAgenticContext,
    createThreadContext,
};