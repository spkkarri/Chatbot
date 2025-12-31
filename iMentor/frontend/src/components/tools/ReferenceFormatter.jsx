// frontend/src/components/tools/ReferenceFormatter.jsx
import React, { useState } from 'react';
import { Clipboard, Check, Sparkles, Loader2 } from 'lucide-react';
import Button from '../core/Button';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ReferenceFormatter = () => {
    const [rawText, setRawText] = useState('');
    const [formattedText, setFormattedText] = useState('');
    const [style, setStyle] = useState('APA');
    const [isLoading, setIsLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const handleFormat = async () => {
        if (!rawText.trim()) {
            toast.error("Please paste your references to format.");
            return;
        }
        setIsLoading(true);
        setFormattedText('');
        try {
            const response = await api.formatReferences({ text: rawText, style });
            const formattedResult = response.formatted_references.join('\n\n');
            setFormattedText(formattedResult);
        } catch (error) {
            toast.error(error.message || "Failed to format references.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(formattedText).then(() => {
            setIsCopied(true);
            toast.success("Formatted references copied!");
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="p-4 md:p-6 h-full flex flex-col">
            <div className="flex-shrink-0 mb-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                    <h2 className="text-lg font-bold">AI-Powered Reference Formatter</h2>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Paste your bibliography and let AI format it into a consistent style.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select value={style} onChange={(e) => setStyle(e.target.value)} className="input-field w-full sm:w-auto">
                        <option>APA</option>
                        <option>MLA</option>
                        <option>Chicago</option>
                        <option>IEEE</option>
                    </select>
                    <Button onClick={handleFormat} isLoading={isLoading} leftIcon={<Sparkles size={16}/>}>
                        Format
                    </Button>
                </div>
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
                <div className="flex flex-col">
                    <label className="font-semibold mb-1">Paste Raw References Here</label>
                    <textarea
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="Paste your messy references, bibliography, or works cited here..."
                        className="input-field flex-grow resize-none custom-scrollbar"
                    />
                </div>
                <div className="flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold">Formatted Result</label>
                        {formattedText && (
                            <Button onClick={handleCopy} variant="ghost" size="sm" leftIcon={isCopied ? <Check size={14}/> : <Clipboard size={14}/>}>
                                {isCopied ? 'Copied' : 'Copy'}
                            </Button>
                        )}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md p-3 flex-grow overflow-auto custom-scrollbar relative">
                        {isLoading && (
                             <div className="absolute inset-0 flex items-center justify-center bg-surface-light/50 dark:bg-surface-dark/50">
                                <Loader2 size={24} className="animate-spin text-primary"/>
                            </div>
                        )}
                        <pre className="whitespace-pre-wrap text-sm">{formattedText}</pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReferenceFormatter;