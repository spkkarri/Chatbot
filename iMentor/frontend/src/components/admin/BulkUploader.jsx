// frontend/src/components/admin/BulkUploader.jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import adminApi from '../../services/adminApi.js';
import toast from 'react-hot-toast';
import { UploadCloud, FileText, Loader2, CheckCircle, XCircle, Cloud, HardDrive } from 'lucide-react';
import Button from '../core/Button.jsx';
import RenameOrOverwriteModal from './RenameOrOverwriteModal.jsx';

const BulkUploader = ({ onUploadComplete, courseCode }) => {
    const [files, setFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [conflict, setConflict] = useState({ isOpen: false, file: null, resolve: null });
    // --- THIS IS THE NEW STATE ---
    const [llmProvider, setLlmProvider] = useState('gemini');

    const onDrop = useCallback((acceptedFiles) => {
        const newFiles = acceptedFiles.map(file => Object.assign(file, {
            id: `${file.name}-${file.size}`,
            status: 'queued',
            error: null,
        }));
        setFiles(prev => [...prev, ...newFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'text/plain': ['.txt'], 'text/markdown': ['.md'] }
    });

    const updateFileStatus = (fileId, status, error = null) => {
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status, error } : f));
    };

    const processFile = async (file, isOverwrite = false, customName = null) => {
        updateFileStatus(file.id, 'uploading');
        const finalName = customName || file.name;

        try {
            const stageFormData = new FormData();
            stageFormData.append('file', file, file.name);
            const stageResponse = await adminApi.stageUpload(stageFormData);

            // --- PASS THE llmProvider IN THE PAYLOAD ---
            const processPayload = {
                stagedPath: stageResponse.stagedPath,
                originalName: finalName,
                serverFilename: stageResponse.serverFilename,
                courseCode: courseCode,
                overwrite: isOverwrite,
                llmProvider: llmProvider, // Include the selected provider
            };
            await adminApi.processStagedFile(processPayload);
            updateFileStatus(file.id, 'success');

        } catch (error) {
            if (error.message.includes('already exists')) {
                const userChoice = await new Promise(resolve => {
                    setConflict({ isOpen: true, file: file, resolve });
                });
                setConflict({ isOpen: false, file: null, resolve: null });

                if (userChoice.action === 'overwrite') {
                    await processFile(file, true);
                } else if (userChoice.action === 'rename' && userChoice.newName) {
                    await processFile(file, false, userChoice.newName);
                } else {
                    throw new Error('Upload cancelled by user.');
                }
            } else {
                throw error;
            }
        }
    };

    const handleStartUploads = async () => {
        const queuedFiles = files.filter(f => f.status === 'queued');
        if (queuedFiles.length === 0) return toast('No new files to upload.', { icon: '🤷' });

        setIsProcessing(true);
        const toastId = toast.loading(`Starting processing for ${queuedFiles.length} file(s) using ${llmProvider}...`);

        const uploadPromises = queuedFiles.map(file =>
            processFile(file).catch(err => {
                updateFileStatus(file.id, 'error', err.message);
                return { error: true };
            })
        );

        await Promise.all(uploadPromises);

        setIsProcessing(false);
        const failedCount = files.filter(f => f.status === 'error').length;
        if (failedCount > 0) {
            toast.error(`${failedCount} file(s) failed to process.`, { id: toastId });
        } else {
            toast.success('All files queued for processing. Status will update automatically.', { id: toastId });
            // Clear successful and queued files, keep errored ones for visibility
            setFiles(prev => prev.filter(f => f.status === 'error'));
        }
        onUploadComplete();
    };

    return (
        <div className="card-base p-4 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-3">Course Materials Uploader</h2>
            
            {/* --- NEW PROVIDER TOGGLE UI --- */}
            <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5 text-text-muted-light dark:text-text-muted-dark">Processing Provider</label>
                <div className="flex w-full border border-border-light dark:border-border-dark rounded-lg p-1 bg-gray-100 dark:bg-gray-900">
                    <button
                        onClick={() => setLlmProvider('gemini')}
                        disabled={isProcessing}
                        className={`flex-1 text-sm font-semibold p-1.5 rounded-md flex items-center justify-center gap-2 transition-colors ${llmProvider === 'gemini' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-text-muted-light dark:text-text-muted-dark'}`}
                    >
                        <Cloud size={16} /> Gemini
                    </button>
                    <button
                        onClick={() => setLlmProvider('ollama')}
                        disabled={isProcessing}
                        className={`flex-1 text-sm font-semibold p-1.5 rounded-md flex items-center justify-center gap-2 transition-colors ${llmProvider === 'ollama' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-text-muted-light dark:text-text-muted-dark'}`}
                    >
                        <HardDrive size={16} /> Ollama
                    </button>
                </div>
            </div>

            <div {...getRootProps()} className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border-light dark:border-border-dark'}`}>
                <input {...getInputProps()} />
                <UploadCloud className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-text-muted-light dark:text-text-muted-dark">Drag & drop materials here, or click to select</p>
                <p className="text-xs text-gray-400">PDF, DOCX, TXT, MD allowed</p>
            </div>
            
            {files.length > 0 && (
                <div className="mt-4 space-y-2 flex-grow overflow-y-auto custom-scrollbar">
                    {files.map(file => (
                        <div key={file.id} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md">
                            <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                            <span className="flex-grow truncate text-sm">{file.name}</span>
                            {file.status === 'queued' && <span className="text-xs text-gray-500">Queued</span>}
                            {file.status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" title="Processing..."/>}
                            {file.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" title="Queued for background processing"/>}
                            {file.status === 'error' && <XCircle className="h-5 w-5 text-red-500" title={file.error} />}
                        </div>
                    ))}
                </div>
            )}
            
            <Button onClick={handleStartUploads} disabled={isProcessing || files.filter(f => f.status === 'queued').length === 0} className="mt-4 w-full">
                {isProcessing ? 'Processing...' : `Start Processing (${files.filter(f => f.status === 'queued').length})`}
            </Button>
            
            <RenameOrOverwriteModal
                isOpen={conflict.isOpen}
                file={conflict.file}
                onClose={() => {
                    if (conflict.resolve) conflict.resolve({ action: 'cancel' });
                    setConflict({ isOpen: false, file: null, resolve: null });
                }}
                onConfirm={(resolution) => {
                    if (conflict.resolve) conflict.resolve(resolution);
                }}
            />
        </div>
    );
};

export default BulkUploader;
