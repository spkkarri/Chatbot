

// frontend/src/components/documents/DocumentUpload.jsx
import React, { useState, useRef, useEffect } from 'react';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import { UploadCloud, FileText, XCircle, Paperclip, Link as LinkIcon } from 'lucide-react';
import Button from '../core/Button.jsx';
import { motion } from 'framer-motion';

// Define the stages for our static simulation
const RAG_STAGES = [
    { name: "Uploading", duration: 1500, message: "Transferring your document to the server..." },
    { name: "Processing", duration: 2000, message: "Validating file format and structure..." },
    { name: "Extracting", duration: 3000, message: "Extracting text and content from your document..." },
    { name: "Chunking", duration: 1500, message: "Breaking document into manageable segments..." },
    { name: "Embedding", duration: 4000, message: "Converting content to searchable vectors..." },
    { name: "Analyzing", duration: 3000, message: "Indexing content for optimal retrieval..." },
];
// MODIFIED: Renamed 'onUploadSuccess' prop to 'onSourceAdded'
function DocumentUpload({ onSourceAdded }) { 
    const [selectedFile, setSelectedFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStage, setCurrentStage] = useState('');
    const [stageMessage, setStageMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [isIngestingUrl, setIsIngestingUrl] = useState(false);

    const fileInputRef = useRef(null);
    const processingTimeoutRef = useRef(null);
    
    useEffect(() => {
        return () => {
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
        };
    }, []);

    const handleFileChange = (e) => {
        if (isProcessing) return;
        const file = e.target.files && e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setErrorMessage('');
        }
    };

    const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); if (isProcessing) return; setDragActive(e.type === "dragenter" || e.type === "dragover"); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); if (isProcessing) return; setDragActive(false); const file = e.dataTransfer.files && e.dataTransfer.files[0]; if (file) { setSelectedFile(file); setErrorMessage(''); }};

    const resetState = () => {
        setSelectedFile(null);
        setIsProcessing(false);
        setProgress(0);
        setCurrentStage('');
        setStageMessage('');
        setErrorMessage('');
        if (fileInputRef.current) fileInputRef.current.value = null;
    };
    
    const runProgressSimulation = (stageIndex = 0) => {
        if (stageIndex >= RAG_STAGES.length) return;

        const stage = RAG_STAGES[stageIndex];
        setCurrentStage(stage.name);
        setStageMessage(stage.message);
        
        const totalDuration = RAG_STAGES.reduce((acc, s) => acc + s.duration, 0);
        const elapsedDuration = RAG_STAGES.slice(0, stageIndex).reduce((acc, s) => acc + s.duration, 0);
        setProgress(Math.round((elapsedDuration / totalDuration) * 100));

        processingTimeoutRef.current = setTimeout(() => {
            runProgressSimulation(stageIndex + 1);
        }, stage.duration);
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error("Please select a file first.");
            return;
        }
        setIsProcessing(true);
        setErrorMessage('');
        runProgressSimulation(0);

        const formData = new FormData();
        formData.append("file", selectedFile);
        
        try {
            await api.uploadFile(formData);
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
            setProgress(100);
            toast.success(`'${selectedFile.name}' accepted! Processing has begun.`, { duration: 4000 });
            
            setTimeout(() => {
                resetState();
                if (onSourceAdded) onSourceAdded(); // Now correctly calls onSourceAdded
            }, 1500);

        } catch (error) {
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
            const msg = error.response?.data?.message || error.message || "Upload failed.";
            setErrorMessage(msg);
            toast.error(`Upload failed: ${msg}`);
            setIsProcessing(false);
            setCurrentStage('Failed');
            setProgress(100);
        }
    };

    const handleIngestUrl = async () => {
        const url = urlInput.trim();
        if (!url) {
            toast.error("Please enter a valid URL.");
            return;
        }
        setIsIngestingUrl(true);
        const toastId = toast.loading(`Ingesting URL: ${url.substring(0, 30)}...`);
        try {
            await api.addUrlSource(url);
            toast.success("URL accepted! Processing has begun in the background.", { id: toastId });
            setUrlInput('');
            if (onSourceAdded) onSourceAdded(); // Now correctly calls onSourceAdded
        } catch (error) {
            const msg = error.response?.data?.message || error.message || "Failed to ingest URL.";
            toast.error(msg, { id: toastId });
        } finally {
            setIsIngestingUrl(false);
        }
    };

    if (isProcessing) {
        return (
            <div className="card-base p-4 mb-4">
                <h3 className="font-semibold text-text-light dark:text-text-dark">
                    📄 Processing: <span className="font-normal truncate">{selectedFile.name}</span>
                </h3>
                <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 my-2">
                    <motion.div
                        className={`h-2.5 rounded-full ${errorMessage ? 'bg-red-500' : 'bg-primary'}`}
                        initial={{ width: '0%' }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: 'linear' }}
                    />
                </div>
                <div className="flex justify-between text-xs text-text-muted-light dark:text-text-muted-dark">
                    <span>{errorMessage ? 'Error' : `Stage: ${currentStage}`} ({progress}%)</span>
                </div>
                <p className="text-xs text-center mt-2 h-4">{errorMessage || stageMessage}</p>
                {errorMessage && (
                    <Button onClick={resetState} fullWidth variant="danger" size="sm" className="mt-3">
                        Close
                    </Button>
                )}
            </div>
        );
    }
    
    return (
        <div className="mb-4 space-y-4">
            {/* --- File Upload Section (Existing JSX, no changes needed) --- */}
            <div>
                <label
                    htmlFor="file-upload-input"
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center w-full h-28 px-4 transition-colors duration-200 ease-in-out bg-surface-light dark:bg-gray-800 border-2 border-dashed rounded-lg cursor-pointer border-border-light dark:border-border-dark hover:border-primary dark:hover:border-primary-light ${dragActive ? "border-primary dark:border-primary-light ring-2 ring-primary dark:ring-primary-light bg-primary/10 dark:bg-primary-dark/20" : ""}`}
                >
                    <div className="flex flex-col items-center justify-center text-center">
                        <Paperclip size={28} className={`mb-1 transition-colors ${dragActive ? 'text-primary dark:text-primary-light' : 'text-text-muted-light dark:text-text-muted-dark'}`} />
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark"><span className="font-semibold text-primary dark:text-primary-light">Upload a file</span> or drag & drop</p>
                        <p className="text-xs text-text-muted-light/70 dark:text-text-muted-dark/70">PDF, DOCX, TXT, Media, etc.</p>
                    </div>
                    <input ref={fileInputRef} id="file-upload-input" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.txt,.md,.mp3,.wav,.mp4,.mov,.png,.jpg,.jpeg" />
                </label>
                {selectedFile && ( <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-between text-sm animate-fadeIn"> <div className="flex items-center gap-2 truncate"> <FileText size={18} className="text-primary flex-shrink-0" /> <span className="truncate text-text-light dark:text-text-dark" title={selectedFile.name}>{selectedFile.name}</span> <span className="text-text-muted-light dark:text-text-muted-dark text-xs whitespace-nowrap"> ({(selectedFile.size / 1024).toFixed(1)} KB) </span> </div> <button onClick={() => setSelectedFile(null)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-500/10"> <XCircle size={18} /> </button> </div> )}
                <Button onClick={handleUpload} fullWidth className="mt-2 text-sm" variant="primary" disabled={!selectedFile} leftIcon={<UploadCloud size={16} />}> Process File </Button>
            </div>

            {/* --- NEW URL INGESTION SECTION --- */}
            <div className="relative pt-4 border-t border-border-light dark:border-border-dark">
                <p className="text-center text-xs text-text-muted-light dark:text-text-muted-dark absolute -top-2.5 left-1/2 -translate-x-1/2 bg-surface-light dark:bg-surface-dark px-2">OR</p>
                <label htmlFor="url-input" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">Add from URL</label>
                <div className="flex items-center gap-2">
                    <div className="relative flex-grow">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted-light dark:text-text-muted-dark" />
                        <input
                            id="url-input"
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="Enter YouTube or webpage URL..."
                            className="input-field !pl-9 !py-2 !text-sm w-full"
                            disabled={isIngestingUrl}
                        />
                    </div>
                    <Button
                        onClick={handleIngestUrl}
                        size="md"
                        className="!px-3 !py-2"
                        isLoading={isIngestingUrl}
                        disabled={!urlInput.trim() || isIngestingUrl}
                    >
                        Ingest
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default DocumentUpload;