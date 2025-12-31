// frontend/src/components/chat/ChatInput.jsx
import { useAppState } from '../../contexts/AppStateContext.jsx';
import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api.js';
import { Send, Mic, Plus, Brain, Zap, Globe, BookMarked, Sparkles } from 'lucide-react';
import { useWebSpeech } from '../../hooks/useWebSpeech';
import Button from '../core/Button.jsx'; 
import IconButton from '../core/IconButton.jsx';
import toast from 'react-hot-toast';
import blueBrain from "./../../assets/blueBrain.svg";
import { motion, AnimatePresence } from 'framer-motion';

function ChatInput({ 
    onSendMessage, 
    isLoading,
    useWebSearch,
    setUseWebSearch,
    useAcademicSearch,
    setUseAcademicSearch,
    criticalThinkingEnabled,
    setCriticalThinkingEnabled,
    initialPrompt,
    setInitialPromptForNewSession,
    openCoachModalWithData,
    setCoachModalOpen
}) {
    const [inputValue, setInputValue] = useState('');
    const { transcript, listening, isSpeechSupported, startListening, stopListening, resetTranscript } = useWebSpeech();
    const textareaRef = useRef(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const [isCoaching, setIsCoaching] = useState(false);

    const handleRequestPromptCoaching = async () => {
        const trimmedInput = inputValue.trim();

        if (!trimmedInput) return;
        
        if (trimmedInput.length < 3) {
            toast("Prompt is too short for coaching. Please provide a bit more detail.", {
                icon: '❤️',
                style: { background: '#FBBF24', color: '#ffffff' },
            });
            return;
        }
        
        if (isCoaching) return;

        setIsCoaching(true);

        const promise = api.analyzePrompt(trimmedInput);

        toast.promise(
            promise,
            {
                loading: 'Asking the coach for advice...',
                success: 'Suggestion received!',
                error: (err) => err.message || "The Prompt Coach is unavailable.",
            }
        );

        try {
            const response = await promise;
            openCoachModalWithData({
                original: trimmedInput,
                improved: response.improvedPrompt,
                explanation: response.explanation
            });
            setCoachModalOpen(true);
        } catch (error) {
            // toast.promise already handled displaying the error.
            console.error("Error requesting prompt coaching:", error.message);
        } finally {
            setIsCoaching(false);
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();

        const pastedText = e.clipboardData.getData('text/plain');

        const trimmedText = pastedText.trim();

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newValue = inputValue.substring(0, start) + trimmedText + inputValue.substring(end);
        setInputValue(newValue);

        setTimeout(() => {
            const newCursorPosition = start + trimmedText.length;
            textarea.selectionStart = newCursorPosition;
            textarea.selectionEnd = newCursorPosition;
        }, 0);
    };

    useEffect(() => {
    if (initialPrompt) {
        console.log("[ChatInput] Received initial prompt via props:", initialPrompt);
        setInputValue(initialPrompt); // Set the text in the input box
        setInitialPromptForNewSession(null); // Clear the global state immediately
    }
    }, [initialPrompt, setInitialPromptForNewSession]);

    useEffect(() => {
        if (transcript) {
            setInputValue(prev => prev + (prev ? " " : "") + transcript);
            resetTranscript(); 
        }
    }, [transcript, resetTranscript]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
        }
    }, [inputValue]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            handleSubmit(e);
        }
    };
    
    const handleWebSearchToggle = () => {
        const newWebSearchState = !useWebSearch;
        setUseWebSearch(newWebSearchState);
        if (newWebSearchState) setUseAcademicSearch(false);
        toast(newWebSearchState ? "Web Search enabled." : "Web Search disabled.", { icon: newWebSearchState ? "🌐" : "📄" });
        setIsMenuOpen(false);
    };

    const handleAcademicSearchToggle = () => {
        const newState = !useAcademicSearch;
        setUseAcademicSearch(newState);
        if (newState) setUseWebSearch(false);
        toast(newState ? "Academic Search enabled." : "Academic Search disabled.", { icon: newState ? "🎓" : "📄" });
        setIsMenuOpen(false);
    };

    const icon = criticalThinkingEnabled ? () => <img src={blueBrain} alt="Blue Brain" className="w-5 h-5" /> : Brain;

    return (
        <div className="p-2 sm:p-3 bg-surface-light dark:bg-surface-dark/50 backdrop-blur-sm rounded-b-lg shadow-inner">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <div className="relative" ref={menuRef}>
                    <IconButton
                        icon={Plus}
                        title="More Options"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        variant="ghost"
                        size="md" 
                        className="p-2 text-text-muted-light dark:text-text-muted-dark hover:text-primary"
                        disabled={isLoading}
                    />
                    <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-2 w-56 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl border border-border-light dark:border-border-dark p-1 z-10"
                        >
                            <button
                                onClick={handleWebSearchToggle}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                                    useWebSearch
                                    ? 'bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light'
                                    : 'text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <Globe size={16} />
                                {useWebSearch ? 'Disable Web Search' : 'Enable Web Search'}
                            </button>
                            <button
                                onClick={handleAcademicSearchToggle}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                                    useAcademicSearch
                                    ? 'bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300'
                                    : 'text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <BookMarked size={16} />
                                {useAcademicSearch ? 'Disable Academic Search' : 'Enable Academic Search'}
                            </button>
                             <button
                                onClick={() => {toast("File attachment coming soon!", { icon: "📎" }); setIsMenuOpen(false);}}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <Zap size={16} />
                                Attach File (soon)
                            </button>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>
                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isLoading ? "Waiting for response..." : "Type your message or ask a question..."}
                    className="input-field flex-1 p-2.5 resize-none min-h-[44px] max-h-32 custom-scrollbar text-sm" 
                    rows="1"
                    disabled={isLoading}
                />

                {isSpeechSupported && (
                    <IconButton
                        icon={Mic}
                        onClick={() => listening ? stopListening() : startListening()}
                        title={listening ? "Stop listening" : "Start voice input"}
                        variant={listening ? "danger" : "ghost"} 
                        size="md"
                        className={`p-2 ${listening ? 'text-red-500 animate-pulse' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary'}`}
                        disabled={isLoading}
                    />
                )}
                
                {/* --- NEW BUTTON --- */}
                <IconButton
                    icon={Sparkles}
                    onClick={handleRequestPromptCoaching}
                    title="Ask Prompt Coach for Improvement"
                    variant="ghost"
                    size="md"
                    className="p-2 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                    isLoading={isCoaching}
                    disabled={isLoading || isCoaching || !inputValue.trim()}
                />

               <IconButton
                    icon={icon}
                    onClick={() => setCriticalThinkingEnabled(!criticalThinkingEnabled)}
                    title={criticalThinkingEnabled ? "Disable Critical Thinking" : "Enable Critical Thinking"}
                    variant="ghost"
                    size="md"
                    className={`p-2 ${criticalThinkingEnabled ? 'text-purple-500' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary'}`}
                    disabled={isLoading}
                />

                <Button 
                    type="submit"
                    variant="primary"
                    size="md" 
                    className="!p-2.5" 
                    disabled={isLoading || !inputValue.trim()}
                    isLoading={isLoading && !!inputValue.trim()} 
                    title="Send message"
                >
                    {(!isLoading || !inputValue.trim()) ? <Send size={20} /> : null}
                </Button>
            </form>
            
            <div className="flex flex-wrap items-center justify-center mt-2 px-2 text-center h-4 gap-x-4">
                <AnimatePresence>
                    {useWebSearch && (
                        <motion.p
                            key="web-search-indicator"
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                            className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1.5 font-medium"
                        >
                            <Globe size={12} /> Web Search is ON
                        </motion.p>
                    )}
                    {useAcademicSearch && (
                        <motion.p
                            key="academic-search-indicator"
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                            className="text-xs text-purple-500 dark:text-purple-400 flex items-center gap-1.5 font-medium"
                        >
                            <BookMarked size={12} /> Academic Search is ON
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
export default ChatInput;