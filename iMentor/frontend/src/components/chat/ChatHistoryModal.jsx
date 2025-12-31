// src/components/chat/ChatHistoryModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { X, MessageSquareText, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '../core/Modal.jsx';
import IconButton from '../core/IconButton.jsx';
import ConfirmationModal from '../core/ConfirmationModal.jsx';


const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString(undefined, { 
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    } catch (e) {
        return 'Invalid Date';
    }
};

function ChatHistoryModal({ isOpen, onClose, onSelectSession }) {
    const [sessions, setSessions] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [sessionMessages, setSessionMessages] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState('');
    const [sessionToDelete, setSessionToDelete] = useState(null);

    const fetchSessions = useCallback(async () => {
        if (!isOpen) return; 
        setLoadingSessions(true);
        setError('');
        try {
            const data = await api.getChatSessions();
            setSessions(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Failed to load chat sessions.");
            setError(err.message || "Could not fetch sessions.");
        } finally {
            setLoadingSessions(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            fetchSessions();
            setSelectedSessionId(null); 
            setSessionMessages([]);
        }
    }, [isOpen, fetchSessions]); 

    const handleSessionSelectForPreview = async (sessionId) => {
        if (selectedSessionId === sessionId && sessionMessages.length > 0) return; 

        setSelectedSessionId(sessionId);
        setLoadingMessages(true);
        setSessionMessages([]);
        setError(''); 
        try {
            const sessionData = await api.getChatHistory(sessionId);
            
            // --- THIS IS THE CORRECTED LOGIC ---
            // We trust the API to send correctly formatted data with the 'sender' property.
            const messagesArray = Array.isArray(sessionData.messages) ? sessionData.messages : [];
            setSessionMessages(messagesArray);
            // --- END OF CORRECTION ---

        } catch (err) {
            toast.error("Failed to load messages for this session.");
            setError(`Error loading messages: ${err.message}`);
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleLoadSessionAndClose = () => {
        if (selectedSessionId) {
            onSelectSession(selectedSessionId); 
            onClose();
        } else {
            toast.error("Please select a session to load.");
        }
    };
    

    const handleDeleteRequest = (session, e) => {
        e.stopPropagation(); // Prevent the session from being selected
        setSessionToDelete(session); // Set the session to be deleted, which opens the modal
    };

    const handleConfirmDelete = async () => {
        if (!sessionToDelete) return;

        const sessionIdToDelete = sessionToDelete.sessionId;
        const toastId = toast.loading(`Deleting session...`);
        try {
            await api.deleteChatSession(sessionIdToDelete);
            toast.success(`Session deleted.`, { id: toastId });
            setSessions(prev => prev.filter(s => s.sessionId !== sessionIdToDelete)); 
            if (selectedSessionId === sessionIdToDelete) {
                setSelectedSessionId(null);
                setSessionMessages([]);
            }
        } catch (err) {
            toast.error(`Delete failed: ${err.response?.data?.message || err.message}`, { id: toastId });
        } finally {
            setSessionToDelete(null); // Close the modal by resetting the state
        }
    };


    const handleDeleteSession = async (sessionIdToDelete, e) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete this session? This action cannot be undone.`)) return;
        
        const toastId = toast.loading(`Deleting session...`);
        try {
            await api.deleteChatSession(sessionIdToDelete);
            toast.success(`Session deleted.`, { id: toastId });
            setSessions(prev => prev.filter(s => s.sessionId !== sessionIdToDelete)); 
            if (selectedSessionId === sessionIdToDelete) {
                setSelectedSessionId(null);
                setSessionMessages([]);
            }
        } catch (err) {
            toast.error(`Delete failed: ${err.response?.data?.message || err.message}`, { id: toastId });
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Chat History" size="2xl">
                <div className="flex flex-col md:flex-row gap-4 max-h-[70vh] h-[70vh]">
                    <div className="w-full md:w-1/3 border-r border-border-light dark:border-border-dark pr-0 md:pr-2 overflow-y-auto custom-scrollbar">
                        <h3 className="text-sm font-semibold mb-2 text-text-light dark:text-text-dark px-1">Your Sessions</h3>
                        {loadingSessions && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" size={24}/></div>}
                        {!loadingSessions && !sessions.length && <p className="text-xs text-text-muted-light dark:text-text-muted-dark p-2">No past sessions found.</p>}
                        <ul className="space-y-1">
                            {sessions.map(session => (
                                <li key={session.sessionId} onClick={() => handleSessionSelectForPreview(session.sessionId)}
                                    className={`p-2.5 rounded-md cursor-pointer text-xs transition-colors group relative hover:shadow-md
                                                ${selectedSessionId === session.sessionId ? 'bg-primary text-white' : 'bg-surface-light dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`} >
                                    <div className="font-medium truncate" title={session.preview}>{session.preview || `Session ${session.sessionId.substring(0,8)}`}</div>
                                    <div className={`text-[0.7rem] ${selectedSessionId === session.sessionId ? 'text-blue-200' : 'text-text-muted-light dark:text-text-muted-dark'}`}>
                                        {formatDate(session.updatedAt)} - {session.messageCount} msgs
                                    </div>
                                    {/* --- START OF FIX: Update onClick handler --- */}
                                    <IconButton icon={Trash2} size="sm" variant="ghost" title="Delete session"
                                        className="absolute top-1 right-1 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                                        onClick={(e) => handleDeleteRequest(session, e)} />
                                    {/* --- END OF FIX --- */}
                                </li>
                            ))}
                        </ul>
                    </div>
<div className="w-full md:w-2/3 flex flex-col overflow-hidden mt-4 md:mt-0">
                    <h3 className="text-sm font-semibold mb-2 text-text-light dark:text-text-dark">Preview</h3>
                    <div className="flex-grow bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md overflow-y-auto custom-scrollbar border border-border-light dark:border-border-dark">
                        {loadingMessages && <div className="flex justify-center p-4"><Loader2 className="animate-spin text-primary" size={24} /></div>}
                        
                        <div className="space-y-3 flex flex-col">
                            {sessionMessages.map(msg => {
                                const isUser = msg.sender === 'user';
                                return (
                                    <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`p-2.5 rounded-lg shadow-sm w-fit max-w-[90%] text-xs
                                            ${isUser 
                                                ? 'bg-blue-500 text-white' 
                                                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                                            }`}>
                                            <p className="font-semibold text-[0.7rem] mb-0.5">{isUser ? 'You' : 'AI Tutor'}</p>
                                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                            <p className={`text-[0.65rem] mt-1 text-right ${isUser ? 'opacity-70' : 'opacity-50'}`}>{formatDate(msg.timestamp)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!loadingMessages && !selectedSessionId && (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted-light dark:text-text-muted-dark text-sm">
                                <MessageSquareText size={40} className="mb-3 opacity-50" />
                                <p>Select a session to view its messages.</p>
                            </div>
                        )}
                    </div>
                </div>
                </div>
                <div className="mt-6 pt-4 border-t border-border-light dark:border-border-dark flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary !text-xs !py-1.5 !px-3">Cancel</button>
                    <button onClick={handleLoadSessionAndClose} className="btn-primary !text-xs !py-1.5 !px-3" disabled={!selectedSessionId || loadingMessages || loadingSessions}>Load Session</button>
                </div>
            </Modal>
            {/* Add the new confirmation modal here */}
            <ConfirmationModal
                isOpen={!!sessionToDelete}
                onClose={() => setSessionToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Chat Session"
                message={`Are you sure you want to permanently delete this chat session? This action cannot be undone.`}
                confirmText="Delete"
                confirmVariant="danger"
            />
        </>
    );
}
export default ChatHistoryModal;