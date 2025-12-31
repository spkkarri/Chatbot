// frontend/src/components/tools/CodeEditorWrapper.jsx
import React, { useState } from 'react';
import { Play, Copy, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../core/Button';
import IconButton from '../core/IconButton';
import CodeEditor from './CodeEditor';
import toast from 'react-hot-toast';
import { copyToClipboard } from '../../utils/helpers';

const CodeEditorWrapper = ({ code, setCode, language, setLanguage, onExecute, isExecuting }) => {
    
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const success = await copyToClipboard(code);
        if (success) {
            toast.success("Code copied to clipboard!");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        } else {
            toast.error("Failed to copy code.");
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
            <header className="flex items-center justify-between p-2 border-b border-border-light dark:border-border-dark flex-shrink-0">
                <div className="relative">
                    <select 
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="input-field !text-xs !py-1 !pl-3 !pr-8 appearance-none"
                    >
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                        <option value="c">C</option>
                        <option value="cpp">C++</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted-light dark:text-text-muted-dark" />
                </div>
                <div className="flex items-center gap-2">
                    <IconButton 
                        icon={() => (
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                    key={copied ? 'check' : 'copy'}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {copied ? <Check className="text-green-500" /> : <Copy />}
                                </motion.span>
                            </AnimatePresence>
                        )} 
                        size="sm" 
                        onClick={handleCopy} 
                        title="Copy Code" 
                    />
                    <Button onClick={onExecute} size="sm" leftIcon={<Play size={14}/>} isLoading={isExecuting}>
                        Run
                    </Button>
                </div>
            </header>
            <div className="flex-grow overflow-hidden">
                <CodeEditor code={code} setCode={setCode} language={language} />
            </div>
        </div>
    );
};

export default CodeEditorWrapper;