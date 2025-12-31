// frontend/src/components/admin/DocumentStatusManager.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import adminApi from '../../services/adminApi.js';
import toast from 'react-hot-toast';
import { Loader2, AlertTriangle, FileText, Trash2, RefreshCw, Cloud, HardDrive } from 'lucide-react';
import IconButton from '../core/IconButton.jsx';
import ConfirmationModal from '../core/ConfirmationModal.jsx';
import StatusPill from './StatusPill.jsx';

const DocumentStatusManager = ({ courseCode, refreshTrigger }) => {
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [docToDelete, setDocToDelete] = useState(null);
    const [reprocessingId, setReprocessingId] = useState(null);
    const pollingIntervalRef = useRef(null);

    const fetchDocuments = useCallback(async (isPolling = false) => {
        if (!courseCode) return;
        if (!isPolling) setIsLoading(true);
        try {
            const data = await adminApi.getDocumentsByCourse(courseCode);
            setDocuments(data);
            
            const stillProcessing = data.some(d => d.overallStatus === 'processing' || d.overallStatus === 'staged');
            if (!stillProcessing && pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            } else if (stillProcessing && !pollingIntervalRef.current) {
                pollingIntervalRef.current = setInterval(() => fetchDocuments(true), 5000);
            }
        } catch (err) {
            setError(err.message);
            toast.error('Failed to load document statuses.');
        } finally {
            if (!isPolling) setIsLoading(false);
        }
    }, [courseCode]);

    useEffect(() => {
        fetchDocuments();
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [fetchDocuments, refreshTrigger]);

    const handleReprocess = async (doc) => {
        setReprocessingId(doc._id);
        const toastId = toast.loading(`Initiating reprocessing for "${doc.originalName}"...`);
        try {
            await adminApi.reprocessDocument(doc._id);
            toast.success("Reprocessing started. Status will update shortly.", { id: toastId });
            fetchDocuments();
        } catch (err) {
            toast.error(`Failed to start reprocessing: ${err.message}`, { id: toastId });
        } finally {
            setReprocessingId(null);
        }
    };

    const handleDelete = async () => {
        if (!docToDelete) return;
        const toastId = toast.loading(`Deleting "${docToDelete.originalName}"...`);
        try {
            await adminApi.deleteAdminDocumentById(docToDelete._id);
            toast.success("Document deleted successfully.", { id: toastId });
            fetchDocuments();
        } catch (err) {
            toast.error(`Deletion failed: ${err.message}`, { id: toastId });
        } finally {
            setDocToDelete(null);
        }
    };

    const ProviderIcon = ({ provider }) => {
        if (provider === 'gemini') return <Cloud size={14} className="text-blue-500" title="Processed with Gemini" />;
        if (provider === 'ollama') return <HardDrive size={14} className="text-green-500" title="Processed with Ollama" />;
        return null;
    };

    if (isLoading && documents.length === 0) return <div className="card-base h-full flex justify-center items-center"><Loader2 className="animate-spin text-primary" /></div>;
    if (error) return <div className="card-base h-full flex justify-center items-center text-red-500 p-4"><AlertTriangle className="inline mr-2" />{error}</div>;

    return (
        <div className="card-base p-4 h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-3 flex-shrink-0">Document Processing Status</h2>
            <div className="flex-grow overflow-auto custom-scrollbar">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                        <tr>
                            <th className="p-2 text-left">Filename</th>
                            <th className="p-2 text-center">Provider</th>
                            <th className="p-2 text-center">Parsing</th>
                            <th className="p-2 text-center">Vectorization</th>
                            <th className="p-2 text-center">KG Gen.</th>
                            <th className="p-2 text-center">AI Analysis</th>
                            <th className="p-2 text-center">Actions</th>
                        </tr>
                    </thead>
                    {/* --- THIS IS THE FIX for the hydration warning --- */}
                    <tbody>
                        {documents.length > 0 ? (
                            documents.map(doc => (
                                <tr key={doc._id} className="border-b border-border-light dark:border-border-dark">
                                    <td className="p-2 font-medium truncate max-w-xs" title={doc.originalName}>
                                        <FileText size={14} className="inline mr-2 text-primary" />
                                        {doc.originalName.replace(`${courseCode}_`, '')}
                                    </td>
                                    <td className="p-2 text-center"><ProviderIcon provider={doc.processingProvider} /></td>
                                    <td className="p-2 text-center"><StatusPill stage={doc.processingStages?.parsing} onRestart={() => handleReprocess(doc)} /></td>
                                    <td className="p-2 text-center"><StatusPill stage={doc.processingStages?.vectorization} onRestart={() => handleReprocess(doc)} /></td>
                                    <td className="p-2 text-center"><StatusPill stage={doc.processingStages?.kg_generation} onRestart={() => handleReprocess(doc)} /></td>
                                    <td className="p-2 text-center"><StatusPill stage={doc.processingStages?.analysis} onRestart={() => handleReprocess(doc)} /></td>
                                    <td className="p-2 text-center">
                                        <div className="flex justify-center items-center gap-1">
                                            <IconButton icon={RefreshCw} size="sm" onClick={() => handleReprocess(doc)} title="Reprocess All Stages" isLoading={reprocessingId === doc._id} />
                                            <IconButton icon={Trash2} size="sm" variant="danger" onClick={() => setDocToDelete(doc)} title="Delete Document" />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-text-muted-light dark:text-text-muted-dark">
                                    No materials uploaded for this course yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    {/* --- END OF FIX --- */}
                </table>
            </div>
            <ConfirmationModal
                isOpen={!!docToDelete}
                onClose={() => setDocToDelete(null)}
                onConfirm={handleDelete}
                title="Confirm Document Deletion"
                message={`Are you sure you want to delete "${docToDelete?.originalName.replace(`${courseCode}_`, '')}" and all its processed data? This action cannot be undone.`}
            />
        </div>
    );
};

export default DocumentStatusManager;
