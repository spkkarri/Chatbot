// client/src/components/SystemPromptWidget.js
import React from 'react';
// Removed CSS import

// Define the THREE required system prompts + a Custom option
export const availablePrompts = [
  {
    id: 'friendly',
    title: 'Friendly Tutor',
    prompt: 'You are a friendly, patient, and encouraging tutor specializing in engineering and scientific topics for PhD students. Explain concepts clearly, break down complex ideas, use analogies, and offer positive reinforcement. Ask follow-up questions to ensure understanding.',
  },
  {
    id: 'explorer', // Changed ID slightly for clarity
    title: 'Concept Explorer',
    prompt: 'You are an expert academic lecturer introducing a new, complex engineering or scientific concept. Your goal is to provide a deep, structured explanation. Define terms rigorously, outline the theory, provide relevant mathematical formulations (using Markdown), illustrative examples, and discuss applications or limitations pertinent to PhD-level research.',
  },
  {
    id: 'knowledge_check',
    title: 'Knowledge Check',
    prompt: 'You are assessing understanding of engineering/scientific topics. Ask targeted questions to test knowledge, identify misconceptions, and provide feedback on the answers. Start by asking the user what topic they want to be quizzed on.',
  },
   {
    id: 'custom', // Represents user-edited state
    title: 'Custom Prompt',
    prompt: '', // Placeholder, actual text comes from textarea
  },
];

// Helper to find prompt text by ID - Export if needed elsewhere
export const getPromptTextById = (id) => {
  const prompt = availablePrompts.find(p => p.id === id);
  return prompt ? prompt.prompt : ''; // Return empty string if not found
};


/**
 * Renders a sidebar widget with a dropdown for preset prompts
 * and an editable textarea for the current system prompt.
 * @param {object} props - Component props.
 * @param {string} props.selectedPromptId - The ID of the currently active preset (or 'custom').
 * @param {string} props.promptText - The current text of the system prompt (potentially edited).
 * @param {function} props.onSelectChange - Callback when dropdown selection changes. Passes the new ID.
 * @param {function} props.onTextChange - Callback when the textarea content changes. Passes the new text.
 */
const SystemPromptWidget = ({ selectedPromptId, promptText, onSelectChange, onTextChange }) => {

  const handleDropdownChange = (event) => {
    const newId = event.target.value;
    onSelectChange(newId); // Notify parent of the ID change
  };

  const handleTextareaChange = (event) => {
    onTextChange(event.target.value); // Notify parent of the text change
  };

  return (
    <div className="system-prompt-widget">
      <h3>Assistant Mode</h3>

      {/* Dropdown for selecting presets */}
      <select
        className="prompt-select"
        value={selectedPromptId} // Control the selected option via state
        onChange={handleDropdownChange}
        aria-label="Select Assistant Mode"
      >
        {/* Filter out 'custom' from being a selectable option initially */}
        {availablePrompts.filter(p => p.id !== 'custom').map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
        {/* Add Custom option dynamically if the current ID is 'custom' */}
        {/* This ensures "Custom Prompt" appears in the dropdown only when it's actually active */}
        {selectedPromptId === 'custom' && (
            <option key="custom" value="custom">
                Custom Prompt
            </option>
        )}
      </select>

      {/* Editable Textarea for the actual prompt */}
      <label htmlFor="system-prompt-text" className="prompt-label">
        System Prompt (Editable)
      </label>
      <textarea
        id="system-prompt-text"
        className="prompt-textarea"
        value={promptText} // Display the current prompt text (could be preset or edited)
        onChange={handleTextareaChange}
        rows="5" // Suggests initial height, CSS controls actual fixed height
        maxLength="2000" // Optional: Limit character count if desired
        placeholder="The current system prompt will appear here. You can edit it directly."
        aria-label="Editable System Prompt Text"
      />
       {/* Optional: Character count indicator
       <div className="char-count">{promptText?.length || 0} / 2000</div> */}
    </div>
  );
};

// --- CSS for SystemPromptWidget ---
const SystemPromptWidgetCSS = `
/* client/src/components/SystemPromptWidget.css */
.system-prompt-widget { padding: 20px; background-color: var(--bg-header); box-sizing: border-box; display: flex; flex-direction: column; flex-shrink: 0; }
.system-prompt-widget h3 { margin-top: 0; margin-bottom: 15px; color: var(--text-primary); font-size: 1rem; font-weight: 600; padding-bottom: 10px; }
.prompt-select { width: 100%; padding: 10px 12px; margin-bottom: 15px; background-color: #2a2a30; color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; cursor: pointer; appearance: none; -webkit-appearance: none; -moz-appearance: none; background-image: url('data:image/svg+xml;utf8,<svg fill="%23b0b3b8" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>'); background-repeat: no-repeat; background-position: right 10px center; background-size: 18px; }
.prompt-select:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 2px rgba(0, 132, 255, 0.3); }
.prompt-label { display: block; margin-bottom: 8px; color: var(--text-secondary); font-size: 0.85rem; font-weight: 500; }
.prompt-textarea { width: 100%; background-color: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px; font-size: 0.85rem; line-height: 1.5; box-sizing: border-box; font-family: inherit; resize: none; height: 100px; overflow-y: auto; }
.prompt-textarea:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 2px rgba(0, 132, 255, 0.3); }
.prompt-textarea::placeholder { color: var(--text-secondary); opacity: 0.7; }
.char-count { text-align: right; font-size: 0.75rem; color: var(--text-secondary); margin-top: 5px; }
`;
// --- Inject CSS ---
const styleTagPromptId = 'system-prompt-widget-styles';
if (!document.getElementById(styleTagPromptId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagPromptId;
    styleTag.type = "text/css";
    styleTag.innerText = SystemPromptWidgetCSS;
    document.head.appendChild(styleTag);
}
// --- End CSS Injection ---


export default SystemPromptWidget;
