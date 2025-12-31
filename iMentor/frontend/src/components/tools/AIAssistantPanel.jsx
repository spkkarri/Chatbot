// frontend/src/components/tools/AIAssistantPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Bot, Loader2, AlertTriangle } from 'lucide-react';
import Button from '../core/Button.jsx';
import api from '../../services/api.js';
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

const AIAssistantPanel = ({ code, language }) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const contentRef = useRef(null);

    useEffect(() => {
        if (analysis && contentRef.current) {
            const timer = setTimeout(() => {
                Prism.highlightAllUnder(contentRef.current);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [analysis]);

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
        <div className="p-4 h-full flex flex-col bg-surface-light dark:bg-surface-dark">
            <h3 className="text-lg font-semibold mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Bot className="text-primary"/> AI Assistant
                </span>
                <Button onClick={handleAnalyze} size="sm" variant="outline" isLoading={isLoading} disabled={!code.trim()}>
                    Analyze Code
                </Button>
            </h3>
            <div className="flex-grow bg-gray-50 dark:bg-gray-800/50 rounded-md p-1 border border-border-light dark:border-border-dark overflow-y-auto custom-scrollbar">
                {isLoading && (
                    <div className="flex justify-center items-center h-full text-text-muted-light dark:text-text-muted-dark">
                        <Loader2 size={24} className="animate-spin mr-2" /> Analyzing...
                    </div>
                )}
                {error && !isLoading && (
                    <div className="p-3 text-red-400 text-sm">
                        <AlertTriangle className="inline mr-2" /> {error}
                    </div>
                )}
                {!isLoading && !error && !analysis && (
                     <div className="flex justify-center items-center h-full text-center text-sm text-text-muted-light dark:text-text-muted-dark p-4">
                        Click "Analyze Code" to get an AI-powered review of your code.
                    </div>
                )}
                {analysis && !isLoading && (
                    <div 
                        ref={contentRef}
                        className="prose prose-sm dark:prose-invert max-w-none p-3 text-text-light dark:text-text-dark"
                        dangerouslySetInnerHTML={createMarkup(analysis)}
                    />
                )}
            </div>
        </div>
    );
};

export default AIAssistantPanel;