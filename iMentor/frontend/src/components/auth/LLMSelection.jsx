// frontend/src/components/auth/LLMSelection.jsx
import React from 'react';
import { HardDrive, Cloud } from 'lucide-react';

function LLMSelection({ selectedLLM, onLlmChange, disabled = false }) {
    const llms = [
        { id: 'ollama', name: 'Ollama LLM', description: 'Local & Private. Requires Ollama running.', Icon: HardDrive },
        { id: 'gemini', name: 'Gemini LLM', description: 'Cloud-based by Google. API Key may be required.', Icon: Cloud },
    ];

    return (
        <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Choose Your LLM Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {llms.map((llm) => {
                    const isSelected = selectedLLM === llm.id;
                    return (
                        <button
                            key={llm.id}
                            type="button"
                            onClick={() => onLlmChange(llm.id)}
                            disabled={disabled}
                            className={`p-4 border rounded-lg text-left transition-all duration-150 focus:outline-none group focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-surface-dark focus:ring-primary
                                ${isSelected 
                                    ? 'bg-primary dark:bg-primary border-primary dark:border-primary-dark ring-2 ring-primary dark:ring-primary-dark shadow-lg' 
                                    : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-primary-light dark:hover:border-primary-dark hover:shadow-md'
                                }
                                ${disabled ? 'opacity-70 cursor-not-allowed' : ''}
                            `}
                        >
                            <div className="flex items-center mb-1">
                                <llm.Icon size={20} className={`mr-2 transition-colors 
                                    ${isSelected 
                                        ? 'text-white dark:text-blue-100' // High contrast for selected
                                        : 'text-text-muted-light dark:text-text-muted-dark group-hover:text-primary dark:group-hover:text-primary-light'}`} />
                                <span className={`font-semibold transition-colors 
                                    ${isSelected 
                                        ? 'text-white dark:text-white' // High contrast for selected
                                        : 'text-text-light dark:text-text-dark group-hover:text-primary dark:group-hover:text-primary-light'}`}>
                                    {llm.name}
                                </span>
                            </div>
                            <p className={`text-xs transition-colors 
                                ${isSelected 
                                    ? 'text-blue-100 dark:text-blue-200' // High contrast for selected
                                    : 'text-text-muted-light dark:text-text-muted-dark'}`}>
                                {llm.description}
                            </p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default LLMSelection;