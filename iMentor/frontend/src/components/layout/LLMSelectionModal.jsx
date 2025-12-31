// frontend/src/components/layout/LLMSelectionModal.jsx
import React, { useState, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import { X, Save, KeyRound, AlertCircle, HardDrive } from 'lucide-react';
import Modal from '../core/Modal.jsx';
import Button from '../core/Button.jsx';
import LLMSelection from '../auth/LLMSelection.jsx';
import { motion } from 'framer-motion';

function LLMSelectionModal({ isOpen, onClose }) {
    const { selectedLLM: currentLLM, switchLLM: setGlobalLLMPreference } = useAppState();
    
    // State for the provider selection
    const [locallySelectedLLM, setLocallySelectedLLM] = useState(currentLLM);
    
    // Separate state for each input field
    const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
    const [ollamaUrlInput, setOllamaUrlInput] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Reset state every time the modal opens
        if (isOpen) {
            setLocallySelectedLLM(currentLLM);
            setGeminiApiKeyInput(''); 
            setOllamaUrlInput(''); 
            setError('');
        }
    }, [isOpen, currentLLM]);

    const handleSavePreference = async () => {
        setLoading(true); 
        setError('');
        
        try {
            // Start with the provider selection
            const configData = { llmProvider: locallySelectedLLM };

            // Only add other fields if the user actually typed something into them
            if (geminiApiKeyInput.trim()) {
                configData.apiKey = geminiApiKeyInput.trim();
            }
            if (ollamaUrlInput.trim()) {
                configData.ollamaUrl = ollamaUrlInput.trim();
            }
            
            await api.updateUserLLMConfig(configData);
            setGlobalLLMPreference(locallySelectedLLM);
            
            toast.success(`LLM preference updated to ${locallySelectedLLM.toUpperCase()}.`);
            onClose();
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to update preference.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };
    
    const inputWrapperClass = "relative";
    const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light dark:text-text-muted-dark";
    const inputFieldStyledClass = "input-field pl-10 py-2 text-sm w-full";

    return (
         <Modal isOpen={isOpen} onClose={onClose} title="Switch LLM Provider & Credentials" size="lg"
            footerContent={
                <>
                    <Button onClick={onClose} variant="secondary" size="sm" className="text-xs">Cancel</Button>
                    <Button onClick={handleSavePreference} isLoading={loading} size="sm" className="text-xs">
                        <Save size={14} className="mr-1.5"/> Save Preference
                    </Button>
                </>
            }
        >
            <div className="space-y-5"> 
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                    Select your preferred LLM. You can also update your credentials here. <br/><strong>Leave a field blank to keep your existing setting.</strong>
                </p>
                <LLMSelection 
                    selectedLLM={locallySelectedLLM} 
                    onLlmChange={setLocallySelectedLLM}
                    disabled={loading}
                />
                
                <motion.div key="gemini-config-modal" className="mt-4 space-y-1">
                    <label htmlFor="modalGeminiApiKey" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark">
                        Update Gemini API Key (Optional)
                    </label>
                    <div className={inputWrapperClass}>
                        <KeyRound className={inputIconClass} />
                        <input type="password" id="modalGeminiApiKey" className={inputFieldStyledClass} placeholder="Leave blank to keep existing key" value={geminiApiKeyInput} onChange={(e) => setGeminiApiKeyInput(e.target.value)} disabled={loading} />
                    </div>
                </motion.div>
                
                <motion.div key="ollama-config-modal" className="mt-4 space-y-1">
                    <label htmlFor="modalOllamaUrl" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark">
                        Update Ollama URL (Optional)
                    </label>
                     <div className={inputWrapperClass}>
                        <HardDrive className={inputIconClass} />
                        <input type="text" id="modalOllamaUrl" className={inputFieldStyledClass} placeholder="Leave blank to keep existing URL" value={ollamaUrlInput} onChange={(e) => setOllamaUrlInput(e.target.value)} disabled={loading} />
                    </div>
                </motion.div>

                {error && (
                    <div className="flex items-center gap-2 p-2 text-xs text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-md">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default LLMSelectionModal;