// frontend/src/components/tools/AIAssistantBot.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Loader2, AlertTriangle, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import IconButton from '../core/IconButton';
import Button from '../core/Button';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import Prism from 'prismjs';

const createMarkup = (markdownText) => {
    if (!markdownText) return { __html: '' };
    const rawHtml = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
    return { __html: cleanHtml };
};

const AIAssistantBot = ({ code, language }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [analysis, setAnalysis] = useState('');
    const [error, setError] = useState('');
    const contentRef = useRef(null);

    useEffect(() => {
        if (isOpen && analysis && contentRef.current) {
            const timer = setTimeout(() => Prism.highlightAllUnder(contentRef.current), 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, analysis]);
    
    const handleAnalyze = async () => {
        if (!code.trim()) {
            toast.error("There is no code to analyze.");
            return;
        }
        setIsLoading(true);
        setError('');
        setAnalysis('');
        const toastId = toast.loading("AI is analyzing your code...");

        try {
            const response = await api.analyzeCode({ code, language });
            setAnalysis(response.analysis);
            toast.success("Code analysis complete!", { id: toastId });
        } catch (err) {
            const errorMessage = err.response?.data?.message || "Failed to get AI analysis.";
            setError(errorMessage);
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="fixed bottom-6 right-6 z-50">
                <motion.button
                    whileHover={{ scale: 1.1, backgroundColor: "var(--color-primary-dark)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(true)}
                    title="AI Assistant"
                    className="bg-primary text-white rounded-full p-4 shadow-lg flex items-center justify-center"
                    style={{'--color-primary-dark': '#2563eb'}} // For tailwind color access in motion
                >
                    <Bot size={28} />
                </motion.button>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-surface-light dark:bg-surface-dark w-full max-w-2xl h-[70vh] rounded-lg shadow-2xl flex flex-col"
                        >
                            <header className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
                                <h3 className="font-semibold flex items-center gap-2 text-text-light dark:text-text-dark">
                                    <Sparkles className="text-primary"/> AI Assistant
                                </h3>
                                <IconButton icon={X} onClick={() => setIsOpen(false)} title="Close" />
                            </header>

                            <div className="p-4 flex-shrink-0">
                                <Button onClick={handleAnalyze} size="sm" variant="primary" isLoading={isLoading} disabled={!code.trim()}>
                                    Analyze Current Code
                                </Button>
                            </div>
                            
                            <div className="flex-grow p-4 border-t border-border-light dark:border-border-dark overflow-y-auto custom-scrollbar">
                                {isLoading && (
                                    <div className="flex justify-center items-center h-full text-text-muted-light dark:text-text-muted-dark">
                                        <Loader2 size={24} className="animate-spin mr-2" /> Analyzing...
                                    </div>
                                )}
                                {error && !isLoading && (
                                    <div className="p-3 text-red-400 text-sm"><AlertTriangle className="inline mr-2" />{error}</div>
                                )}
                                {!isLoading && !error && !analysis && (
                                     <div className="flex justify-center items-center h-full text-center text-sm text-text-muted-light dark:text-text-muted-dark p-4">
                                        Click "Analyze Code" to get an AI-powered review.
                                    </div>
                                )}
                                {analysis && !isLoading && (
                                    <div 
                                        ref={contentRef}
                                        className="prose prose-sm dark:prose-invert max-w-none text-text-light dark:text-text-dark"
                                        dangerouslySetInnerHTML={createMarkup(analysis)}
                                    />
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default AIAssistantBot;