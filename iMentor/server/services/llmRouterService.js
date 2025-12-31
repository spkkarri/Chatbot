// server/services/llmRouterService.js
const LLMConfiguration = require('../models/LLMConfiguration');

/**
 * Intelligently selects the best LLM for a given query and context.
 * @param {string} query - The user's query text.
 * @param {object} context - An object containing context like userId, subject, etc.
 * @returns {Promise<{chosenModel: object, logic: string}>} An object with the selected model's configuration and the reasoning for the choice.
 */
async function selectLLM(query, context) {
  const { subject, user } = context;
  const preferredProvider = user?.preferredLlmProvider || 'gemini';
  const lowerQuery = query.toLowerCase();
  console.log(`[LLMRouter] Selecting LLM for query. User preference: ${preferredProvider}`);

  const baseFilter = { provider: preferredProvider };

  // PRIORITY 1: Subject-Specific Fine-Tuned Model (for P2.8)
  // If the user has selected a subject in the UI (e.g., "Physics"), we look for a model specifically fine-tuned for it.
   if (subject) {
        // Fine-tuned models are a separate provider type
        const fineTunedModel = await LLMConfiguration.findOne({ provider: 'fine-tuned', subjectFocus: subject });
        if (fineTunedModel) {
            console.log(`[LLMRouter] Decision: Found specialized fine-tuned model '${fineTunedModel.modelId}' for subject '${subject}'.`);
            return { chosenModel: fineTunedModel, logic: 'subject_match_finetuned' };
        }
    }

  // PRIORITY 2: Heuristic-based routing for specific tasks based on query keywords.
  // Logic for highly technical, math, or advanced coding tasks
  const technicalKeywords = ['calculate', 'derive', 'equation', 'theorem', 'proof', 'algorithm', 'data structure'];
    if (technicalKeywords.some(keyword => lowerQuery.includes(keyword))) {
        const techModel = await LLMConfiguration.findOne({ ...baseFilter, strengths: 'technical' });
        if (techModel) return { chosenModel: techModel, logic: `heuristic_technical_${preferredProvider}` };
    }
  
  // Logic for standard coding tasks
  const codeKeywords = ['code', 'python', 'javascript', 'java', 'script', 'function', 'class', 'debug'];
  if (codeKeywords.some(keyword => lowerQuery.includes(keyword))) {
     const codeModel = await LLMConfiguration.findOne({ ...baseFilter, strengths: 'code' });
     if (codeModel) {
        console.log(`[LLMRouter] Decision: Query suggests coding. Using model '${codeModel.modelId}'.`);
        return { chosenModel: codeModel, logic: `heuristic_code_${preferredProvider}` };
     }
  }

  // Logic for creative writing tasks
  const creativeKeywords = ['write a story', 'imagine', 'create a poem', 'act as a character'];
  if (creativeKeywords.some(keyword => lowerQuery.includes(keyword))) {
     const creativeModel = await LLMConfiguration.findOne({ ...baseFilter, strengths: 'creative' });
     if (creativeModel) {
        console.log(`[LLMRouter] Decision: Query suggests a creative task. Using model '${creativeModel.modelId}'.`);
        return { chosenModel: creativeModel, logic: `heuristic_code_${preferredProvider}` };
     }
  }

  // Logic for multilingual tasks
  const multilingualKeywords = ['translate', 'in spanish', 'in french', 'in german', 'in japanese'];
  if (multilingualKeywords.some(keyword => lowerQuery.includes(keyword))) {
     const multilingualModel = await LLMConfiguration.findOne({ ...baseFilter, strengths: 'multilingual' });
     if (multilingualModel) {
        console.log(`[LLMRouter] Decision: Query suggests a multilingual task. Using model '${multilingualModel.modelId}'.`);
        return { chosenModel: multilingualModel, logic: `heuristic_code_${preferredProvider}` };
     }
  }
  
  // PRIORITY 3: Fallback to the designated default model
  const defaultModelInProvider = await LLMConfiguration.findOne({ ...baseFilter, isDefault: true });
    if (defaultModelInProvider) {
        console.log(`[LLMRouter] Decision: No specific heuristic met. Using default model '${defaultModelInProvider.modelId}' for provider '${preferredProvider}'.`);
        return { chosenModel: defaultModelInProvider, logic: `default_provider_fallback_${preferredProvider}` };
    }

    // PRIORITY 4: If no default is set for the provider, find ANY model from that provider
    const anyModelInProvider = await LLMConfiguration.findOne(baseFilter);
    if (anyModelInProvider) {
         console.warn(`[LLMRouter] No default model found for provider '${preferredProvider}'. Falling back to first available model: '${anyModelInProvider.modelId}'`);
         return { chosenModel: anyModelInProvider, logic: `any_provider_fallback_${preferredProvider}` };
    }

  // ABSOLUTE FALLBACK: If no models for the preferred provider exist, use the absolute system default
    const absoluteDefault = await LLMConfiguration.findOne({ isDefault: true });
    if (absoluteDefault) {
        console.error(`[LLMRouter] CRITICAL: No models found for user's preferred provider '${preferredProvider}'. Falling back to absolute system default '${absoluteDefault.modelId}'.`);
        return { chosenModel: absoluteDefault, logic: 'absolute_system_default_fallback' };
    }

    // Hardcoded fallback if DB is completely misconfigured
    console.error("[LLMRouter] CRITICAL: No models found for preferred provider AND no system default! Using hardcoded default.");
    return {
        chosenModel: { modelId: 'gemini-1.5-flash-latest', provider: 'gemini' },
        logic: 'absolute_hardcoded_fallback'
    };
}

module.exports = { selectLLM };
