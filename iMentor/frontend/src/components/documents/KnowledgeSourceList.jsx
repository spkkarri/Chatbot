// frontend/src/components/documents/KnowledgeSourceList.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import {
    FileText, CheckCircle, Loader2, AlertTriangle, Trash2,
    Youtube, Globe, Library
} from 'lucide-react';
import IconButton from '../core/IconButton.jsx';
import { formatDistanceToNow } from 'date-fns';

const getSourceIcon = (sourceType) => {
    const icons = {
        'document': FileText, 'youtube': Youtube, 'webpage': Globe,
        'subject': Library, 'audio': FileText, 'video': FileText, 'image': FileText
    };
    return icons[sourceType] || FileText;
};

const formatRelativeTime = (dateString) => {
    if (!dateString) return 'date unknown';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'invalid date';
        return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
        return 'date error';
    }
};

function KnowledgeSourceList({ onSelectSource, selectedSource, onRefreshNeeded }) {
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const pollingIntervalRef = useRef(null);

    const fetchSources = useCallback(async (isPolling = false) => {
        if (!isPolling) setLoading(true);
        setError('');
        try {
            const response = await api.getKnowledgeSources();
            const fetchedSources = Array.isArray(response) ? response : [];
            const userOnlySources = fetchedSources.filter(source => source.sourceType !== 'subject');
            setSources(userOnlySources)
            // Check if there are any sources still processing to decide if we need to continue polling.
            const stillProcessing = fetchedSources.some(s => s.status && s.status.startsWith('processing'));
            
            if (pollingIntervalRef.current && !stillProcessing) {
                console.log("[Polling] All sources processed. Stopping polling.");
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        } catch (err) {
            setError(err.message || "Failed to fetch knowledge sources.");
            if (!isPolling) toast.error("Could not load knowledge base.");
            // Stop polling on error
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        } finally {
            if (!isPolling) setLoading(false);
        }
    }, []);

    // Effect for initial load and manual refresh
    useEffect(() => {
        fetchSources();
    }, [fetchSources, onRefreshNeeded]);

    // --- NEW: Effect for automatic polling ---
    useEffect(() => {
        // Stop any existing polling interval when the component mounts or sources change
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        // Check if there are any sources currently in a processing state
        const isProcessing = sources.some(s => s.status && s.status.startsWith('processing'));

        if (isProcessing) {
            console.log("[Polling] Detected processing sources. Starting polling every 5 seconds.");
            pollingIntervalRef.current = setInterval(() => {
                console.log("[Polling] Fetching source statuses...");
                fetchSources(true); // `true` indicates this is a silent background poll
            }, 5000); // Poll every 5 seconds
        }

        // Cleanup function to clear the interval when the component unmounts
        // or when the dependencies (sources array) change.
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [sources, fetchSources]); // This effect depends on the `sources` array

    const handleDelete = async (sourceId, sourceTitle, sourceType) => {
        // ... (handleDelete logic remains exactly the same) ...
        if (sourceType === 'subject') {
            toast.error("Admin-provided subjects cannot be deleted by users.");
            return;
        }
        if (!window.confirm(`Are you sure you want to delete "${sourceTitle}"? This will remove it and all its associated data.`)) return;
        
        const toastId = toast.loading(`Deleting ${sourceTitle}...`);
        try {
            await api.deleteKnowledgeSource(sourceId);
            toast.success(`"${sourceTitle}" deleted.`, { id: toastId });
            fetchSources();
            if (selectedSource === sourceTitle) {
                onSelectSource(null);
            }
        } catch (err) {
            toast.error(`Delete failed: ${err.message}`, { id: toastId });
        }
    };

    if (loading) {
        // ... (loading JSX remains the same) ...
        return (
            <div className="flex items-center justify-center p-4 text-text-muted-light dark:text-text-muted-dark">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading knowledge base...
            </div>
        );
    }

    if (error) {
        // ... (error JSX remains the same) ...
        return (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                <AlertTriangle size={18} /> {error}
                <button onClick={() => fetchSources()} className="ml-auto text-xs underline hover:text-red-400">Retry</button>
            </div>
        );
    }

    if (sources.length === 0) {
        // ... (empty JSX remains the same) ...
        return <p className="text-center text-xs text-text-muted-light dark:text-text-muted-dark p-4">Your knowledge base is empty.</p>;
    }

    return (
        // ... (the main return JSX with the list mapping remains exactly the same) ...
        <div className="space-y-1.5 text-xs custom-scrollbar pr-1">
            {sources.map(source => {
                const isSelected = selectedSource === source.title;
                const isProcessing = source.status && source.status.startsWith('processing');
                const isFailed = source.status === 'failed';
                const isSelectable = source.status === 'completed';
                const Icon = getSourceIcon(source.sourceType);

                return (
                    <div
                        key={source._id}
                        onClick={() => isSelectable && onSelectSource(isSelected ? null : source.title)}
                        className={`p-2.5 bg-surface-light dark:bg-gray-800 border rounded-md flex items-center justify-between transition-all duration-150
                                    ${isSelectable ? 'cursor-pointer hover:shadow-md' : 'cursor-default opacity-80'}
                                    ${isSelected ? 'ring-2 ring-primary dark:ring-primary-light shadow-lg border-primary dark:border-primary-light' : 'border-border-light dark:border-border-dark'}`}
                        title={isSelectable ? `Select ${source.title}` : `Status: ${source.status} - ${source.failureReason || ''}`}
                    >
                        <div className="flex items-center gap-2 truncate">
                            {isSelected ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" /> : <Icon size={16} className="text-primary dark:text-primary-light flex-shrink-0" />}
                            <div className="truncate">
                                <span className={`block truncate ${isSelected ? 'font-semibold text-primary dark:text-primary-light' : 'text-text-light dark:text-text-dark'}`}>{source.title}</span>
                                <span className="text-[0.7rem] text-text-muted-light dark:text-text-muted-dark">
                                    {formatRelativeTime(source.createdAt)}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                             {isProcessing && <Loader2 size={14} className="animate-spin text-accent" title={`Processing... (${source.status})`} />}
                             {isFailed && <AlertTriangle size={14} className="text-red-500" title={`Processing failed: ${source.failureReason || 'Unknown error'}`} />}
                             {source.sourceType !== 'subject' && (
                                <IconButton icon={Trash2} size="sm" variant="ghost" title="Delete"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(source._id, source.title, source.sourceType); }}
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                                />
                             )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default KnowledgeSourceList;