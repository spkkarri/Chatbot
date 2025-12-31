// frontend/src/components/tools/OutputDisplay.jsx
import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import Button from '../core/Button';
import IconButton from '../core/IconButton';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const createMarkup = (markdownText) => {
    if (!markdownText) return { __html: '' };
    const rawHtml = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
    return { __html: cleanHtml };
};

const CopyablePre = ({ content }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="relative group">
            <pre className="bg-gray-200 dark:bg-gray-900 p-2 rounded whitespace-pre-wrap font-mono">{content || '(empty)'}</pre>
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <IconButton
                    icon={copied ? Check : Copy}
                    onClick={handleCopy}
                    title={copied ? 'Copied!' : 'Copy'}
                    size="sm"
                    className={copied ? 'text-green-500' : ''}
                />
            </div>
        </div>
    );
};


const OutputDisplay = ({ results, compilationError, code, language }) => {
    const [explanation, setExplanation] = useState(null);
    const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
    const [explanationFor, setExplanationFor] = useState(null); // 'compilation' or test case index

    const handleExplainError = async (errorContext, errorMessage) => {
        setIsLoadingExplanation(true);
        setExplanation(null);
        setExplanationFor(errorContext);
        try {
            const response = await api.explainError({ code, language, errorMessage });
            setExplanation(response.explanation);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to get explanation.");
        } finally {
            setIsLoadingExplanation(false);
        }
    };

    if (compilationError) {
        return (
            <div className="p-4 bg-red-900/10 text-red-400 border-t border-red-500/30 h-full flex flex-col">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle /> Compilation Error</h3>
                    {!explanation && (
                        <Button size="sm" variant="ghost" className="!text-xs" leftIcon={<Sparkles size={12}/>} onClick={() => handleExplainError('compilation', compilationError)} isLoading={isLoadingExplanation && explanationFor === 'compilation'}>
                            Explain Error
                        </Button>
                    )}
                </div>
                 <div className="flex-grow overflow-auto custom-scrollbar">
                    <CopyablePre content={compilationError} />
                </div>
                {isLoadingExplanation && explanationFor === 'compilation' && (
                    <div className="mt-2 p-3 text-sm text-center text-text-muted-light dark:text-text-muted-dark"><Loader2 className="animate-spin inline mr-2"/>AI is explaining the error...</div>
                )}
                {explanation && explanationFor === 'compilation' && (
                    <div className="mt-2 p-3 bg-primary/10 rounded-md border border-primary/30 flex-shrink-0">
                        <h5 className="font-bold text-sm mb-1 text-primary dark:text-primary-light flex items-center gap-1.5"><Sparkles size={14}/> AI Explanation</h5>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-text-light dark:text-text-dark" dangerouslySetInnerHTML={createMarkup(explanation)} />
                    </div>
                )}
            </div>
        );
    }
    
    if (!results || results.length === 0) {
        return (
            <div className="p-4 text-center text-text-muted-light dark:text-text-muted-dark border-t border-border-light dark:border-border-dark h-full flex items-center justify-center">
                <p>Run the code to see the output and test case results here.</p>
            </div>
        );
    }

    const getStatusIcon = (status) => {
        if (status === 'pass') return <CheckCircle className="text-green-500" />;
        if (status === 'fail') return <XCircle className="text-yellow-500" />;
        return <AlertTriangle className="text-red-500" />;
    };

    const score = results.filter(r => r.status === 'pass').length;

    return (
        <div className="p-4 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark h-full flex flex-col">
            <h3 className="text-lg font-semibold mb-3 flex-shrink-0 flex justify-between items-center">
                <span>Execution Results</span>
                <span className="text-base font-bold text-green-500 bg-green-500/10 px-3 py-1 rounded-md">
                    {score} / {results.length} Passed
                </span>
            </h3>
            <div className="flex-grow space-y-4 overflow-y-auto custom-scrollbar pr-2">
                {results.map((res, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-border-light dark:border-border-dark">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold flex items-center gap-2">
                                {getStatusIcon(res.status)}
                                Test Case #{index + 1}: <span className="uppercase">{res.status}</span>
                            </h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                                <strong className="block mb-1 text-text-light dark:text-text-dark">Input:</strong>
                                <CopyablePre content={res.input} />
                            </div>
                            <div>
                                <strong className="block mb-1 text-text-light dark:text-text-dark">Expected Output:</strong>
                                <CopyablePre content={res.expected} />
                            </div>
                            <div className="md:col-span-2">
                                <strong className="block mb-1 text-text-light dark:text-text-dark">Actual Output:</strong>
                                <div className={`relative group ${res.status === 'pass' ? 'bg-green-900/20' : 'bg-yellow-900/20'} rounded`}>
                                    <CopyablePre content={res.output} />
                                </div>
                            </div>
                            {res.error && (
                                <div className="md:col-span-2">
                                    <div className="flex justify-between items-center">
                                        <strong className="block mb-1 text-red-500 dark:text-red-400">Error:</strong>
                                        {explanationFor !== index && (
                                            <Button size="sm" variant="ghost" className="!text-xs" leftIcon={<Sparkles size={12}/>} onClick={() => handleExplainError(index, res.error)} isLoading={isLoadingExplanation && explanationFor === index}>
                                                Explain Error
                                            </Button>
                                        )}
                                    </div>
                                     <div className="relative group bg-red-900/20 rounded">
                                        <CopyablePre content={res.error} />
                                    </div>
                                </div>
                            )}
                            {isLoadingExplanation && explanationFor === index && (
                                <div className="md:col-span-2 p-3 text-sm text-center text-text-muted-light dark:text-text-muted-dark"><Loader2 className="animate-spin inline mr-2"/>AI is explaining the error...</div>
                            )}
                            {explanation && explanationFor === index && (
                                <div className="md:col-span-2 mt-2 p-3 bg-primary/10 rounded-md border border-primary/30">
                                    <h5 className="font-bold text-sm mb-1 text-primary dark:text-primary-light flex items-center gap-1.5"><Sparkles size={14}/> AI Explanation</h5>
                                    <div className="prose prose-sm dark:prose-invert max-w-none text-text-light dark:text-text-dark" dangerouslySetInnerHTML={createMarkup(explanation)} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OutputDisplay;