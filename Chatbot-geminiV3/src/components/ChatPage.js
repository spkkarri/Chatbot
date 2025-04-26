// client/src/components/ChatPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendMessage, saveChatHistory, getUserFiles, queryRagService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

import SystemPromptWidget, { availablePrompts, getPromptTextById } from './SystemPromptWidget';
import HistoryModal from './HistoryModal';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';

import './ChatPage.css';

const ChatPage = ({ setIsAuthenticated }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRagLoading, setIsRagLoading] = useState(false);
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState(''); // Initialize empty, set from localStorage
    const [userId, setUserId] = useState(''); // Initialize empty, set from localStorage
    const [username, setUsername] = useState(''); // Initialize empty, set from localStorage
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);
    const [hasFiles, setHasFiles] = useState(false);
    const [isRagEnabled, setIsRagEnabled] = useState(false);

    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // --- Effects ---
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Validate auth info on mount
    useEffect(() => {
        const storedSessionId = localStorage.getItem('sessionId');
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');

        if (!storedUserId || !storedSessionId || !storedUsername) {
            console.warn("ChatPage Mount: Missing auth info in localStorage. Redirecting to login.");
            handleLogout(true); // Use logout function for cleanup
        } else {
            console.log("ChatPage Mount: Auth info found. Setting state.");
            setSessionId(storedSessionId);
            setUserId(storedUserId);
            setUsername(storedUsername);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run ONCE on mount

    // Check for user files on mount and refresh, only if userId is set
    useEffect(() => {
        const checkUserFiles = async () => {
            // Ensure userId is available before fetching
            const currentUserId = localStorage.getItem('userId');
            if (!currentUserId) {
                console.log("User files check skipped: No userId available.");
                setHasFiles(false);
                setIsRagEnabled(false);
                return;
            }
            console.log("Checking user files for userId:", currentUserId);
            try {
                const response = await getUserFiles(); // API interceptor adds the header
                const filesExist = response.data && response.data.length > 0;
                setHasFiles(filesExist);
                setIsRagEnabled(filesExist); // Enable RAG by default if files exist
                console.log("User files check successful:", filesExist ? `${response.data.length} files found. RAG default: ${filesExist}` : "No files found. RAG default: false");
            } catch (err) {
                console.error("Error checking user files:", err);
                if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
                     console.warn("Received 401 checking files, logging out.");
                     handleLogout(true);
                } else {
                    setError("Could not check user files.");
                    setHasFiles(false);
                    setIsRagEnabled(false);
                }
            }
        };

        // Only run if userId is set (from the initial mount effect)
        if (userId) {
            checkUserFiles();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, fileRefreshTrigger]); // Re-check when userId is set or file list might change

    // --- Callback Definitions ---
    const triggerFileRefresh = useCallback(() => setFileRefreshTrigger(prev => prev + 1), []);
    const handlePromptSelectChange = useCallback((newId) => {
        setCurrentSystemPromptId(newId); setEditableSystemPromptText(getPromptTextById(newId));
        setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : `Assistant mode changed.`);
        setTimeout(() => { setError(prev => prev === `Assistant mode changed.` ? '' : prev); }, 3000);
    }, []);
    const handlePromptTextChange = useCallback((newText) => {
        setEditableSystemPromptText(newText);
        const matchingPreset = availablePrompts.find(p => p.id !== 'custom' && p.prompt === newText);
        setCurrentSystemPromptId(matchingPreset ? matchingPreset.id : 'custom');
    }, []);
    const handleHistory = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);

    const saveAndReset = useCallback(async (isLoggingOut = false, onCompleteCallback = null) => {
        const currentSessionId = localStorage.getItem('sessionId'); // Get fresh ID
        const currentUserId = localStorage.getItem('userId'); // Get fresh ID
        const messagesToSave = [...messages];

        if (!currentSessionId || !currentUserId) {
             console.error("Save Error: Session ID or User ID missing.");
             setError("Critical Error: Session info missing.");
             if (onCompleteCallback) onCompleteCallback();
             return;
        }
        if (isLoading || isRagLoading || messagesToSave.length === 0) {
             if (onCompleteCallback) onCompleteCallback();
             return;
        }

        let newSessionId = null;
        setIsLoading(true);
        setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : '');

        try {
            console.log(`Saving history for session: ${currentSessionId} (User: ${currentUserId})`);
            // API interceptor will add the x-user-id header
            const response = await saveChatHistory({ sessionId: currentSessionId, messages: messagesToSave });
            newSessionId = response.data.newSessionId;
            if (!newSessionId) throw new Error("Backend failed to provide new session ID.");

            localStorage.setItem('sessionId', newSessionId);
            setSessionId(newSessionId);
            setMessages([]);
            if (!isLoggingOut) {
                handlePromptSelectChange('friendly');
                setError('');
            }
            console.log(`History saved. New session ID: ${newSessionId}`);

        } catch (err) {
            const failErrorMsg = err.response?.data?.message || err.message || 'Failed to save/reset session.';
            console.error("Save/Reset Error:", err.response || err);
            setError(`Session Error: ${failErrorMsg}`);
            if (err.response?.status === 401 && !isLoggingOut) {
                 console.warn("Received 401 saving history, logging out.");
                 handleLogout(true); // Force logout if save fails due to auth
                 // Don't proceed with client-side session generation if auth failed
            } else if (!newSessionId && !isLoggingOut) {
                 newSessionId = uuidv4();
                 localStorage.setItem('sessionId', newSessionId);
                 setSessionId(newSessionId);
                 setMessages([]);
                 handlePromptSelectChange('friendly');
                 console.warn("Save failed, generated new client-side session ID:", newSessionId);
            } else if (isLoggingOut && !newSessionId) {
                 console.error("Save failed during logout.");
            }
        } finally {
            setIsLoading(false);
            if (onCompleteCallback) onCompleteCallback();
        }
    }, [messages, isLoading, isRagLoading, handlePromptSelectChange]); // Removed userId/sessionId state deps, use localStorage directly

    const handleLogout = useCallback((skipSave = false) => {
        const performCleanup = () => {
            console.log("Performing logout cleanup...");
            localStorage.clear(); // Clear everything
            setIsAuthenticated(false);
            setMessages([]); setSessionId(''); setUserId(''); setUsername(''); // Clear state
            setCurrentSystemPromptId('friendly');
            setEditableSystemPromptText(getPromptTextById('friendly')); setError('');
            setHasFiles(false); setIsRagEnabled(false);
            // Ensure navigation happens after state updates
            requestAnimationFrame(() => {
                 if (window.location.pathname !== '/login') {
                     navigate('/login', { replace: true });
                 }
            });
        };
        if (!skipSave && messages.length > 0) {
             saveAndReset(true, performCleanup);
        } else {
             performCleanup();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, setIsAuthenticated, saveAndReset, messages.length]);

    const handleNewChat = useCallback(() => {
        if (!isLoading && !isRagLoading) {
             saveAndReset(false);
        }
     }, [isLoading, isRagLoading, saveAndReset]);

    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const textToSend = inputText.trim();
        const currentSessionId = localStorage.getItem('sessionId'); // Get fresh ID
        const currentUserId = localStorage.getItem('userId'); // Get fresh ID

        if (!textToSend || isLoading || isRagLoading || !currentSessionId || !currentUserId) {
            if (!currentSessionId || !currentUserId) {
                 setError("Session invalid. Please refresh or log in again.");
                 // Optionally trigger logout if auth info is missing
                 if (!currentUserId) handleLogout(true);
            }
            return;
        }

        const newUserMessage = { role: 'user', parts: [{ text: textToSend }], timestamp: new Date() };
        const previousMessages = messages;
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setError('');

        let relevantDocs = [];
        let ragError = null;

        if (isRagEnabled) {
            setIsRagLoading(true);
            try {
                console.log("RAG Enabled: Querying backend /rag endpoint...");
                // Interceptor adds user ID header
                const ragResponse = await queryRagService({ message: textToSend });
                relevantDocs = ragResponse.data.relevantDocs || [];
                console.log(`RAG Query returned ${relevantDocs.length} documents.`);
            } catch (err) {
                console.error("RAG Query Error:", err.response || err);
                ragError = err.response?.data?.message || "Failed to retrieve documents for RAG.";
                if (err.response?.status === 401) {
                     console.warn("Received 401 during RAG query, logging out.");
                     handleLogout(true);
                     setIsRagLoading(false); // Stop loading before returning
                     return; // Stop processing if auth failed
                }
            } finally {
                setIsRagLoading(false);
            }
        } else {
            console.log("RAG Disabled: Skipping RAG query.");
        }

        setIsLoading(true);
        const historyForAPI = previousMessages;
        const systemPromptToSend = editableSystemPromptText;

        try {
            if (ragError) {
                 setError(prev => prev ? `${prev} | RAG Error: ${ragError}` : `RAG Error: ${ragError}`);
            }

            console.log(`Sending message to backend /message. RAG Enabled: ${isRagEnabled}, Docs Found: ${relevantDocs.length}`);
            // Interceptor adds user ID header
            const sendMessageResponse = await sendMessage({
                message: textToSend,
                history: historyForAPI,
                sessionId: currentSessionId,
                systemPrompt: systemPromptToSend,
                isRagEnabled: isRagEnabled,
                relevantDocs: relevantDocs
            });

            const modelReply = sendMessageResponse.data.reply;
            if (modelReply?.role && modelReply?.parts?.length > 0) {
                setMessages(prev => [...prev, modelReply]);
            } else {
                throw new Error("Invalid reply structure received from backend.");
            }
            setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : '');

        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to get response.';
            setError(prev => prev ? `${prev} | Chat Error: ${errorMessage}` : `Chat Error: ${errorMessage}`);
            console.error("Send Message Error:", err.response || err);
            setMessages(previousMessages); // Rollback UI
            if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
                 console.warn("Received 401 sending message, logging out.");
                 handleLogout(true);
            }
        } finally {
            setIsLoading(false);
        }
    }, [inputText, isLoading, isRagLoading, messages, editableSystemPromptText, isRagEnabled, handleLogout]); // Removed sessionId/userId state deps

    const handleEnterKey = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    const handleRagToggle = (event) => {
        setIsRagEnabled(event.target.checked);
    };

    const isProcessing = isLoading || isRagLoading;

    // Render loading or null if userId isn't set yet
    if (!userId) {
        return <div className="loading-indicator"><span>Initializing...</span></div>; // Or some other placeholder
    }

    return (
        <div className="chat-page-container">
            <div className="sidebar-area">
                 <SystemPromptWidget
                    selectedPromptId={currentSystemPromptId} promptText={editableSystemPromptText}
                    onSelectChange={handlePromptSelectChange} onTextChange={handlePromptTextChange}
                 />
                <FileUploadWidget onUploadSuccess={triggerFileRefresh} />
                <FileManagerWidget refreshTrigger={fileRefreshTrigger} />
            </div>

            <div className="chat-container">
                 <header className="chat-header">
                    <h1>Engineering Tutor</h1>
                    <div className="header-controls">
                        <span className="username-display">Hi, {username}!</span>
                        <button onClick={handleHistory} className="header-button history-button" disabled={isProcessing}>History</button>
                        <button onClick={handleNewChat} className="header-button newchat-button" disabled={isProcessing}>New Chat</button>
                        <button onClick={() => handleLogout(false)} className="header-button logout-button" disabled={isProcessing}>Logout</button>
                    </div>
                </header>

                 <div className="messages-area">
                    {messages.map((msg, index) => {
                         if (!msg?.role || !msg?.parts?.length || !msg.timestamp) {
                            console.warn("Rendering invalid message structure at index", index, msg);
                            return <div key={`error-${index}`} className="message-error">Msg Error</div>;
                         }
                         const messageText = msg.parts[0]?.text || '';
                         return (
                            <div key={`${sessionId}-${index}`} className={`message ${msg.role}`}>
                                <div className="message-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {messageText}
                                    </ReactMarkdown>
                                </div>
                                <span className="message-timestamp">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                         );
                    })}
                    <div ref={messagesEndRef} />
                 </div>

                {isProcessing && <div className="loading-indicator"><span>{isRagLoading ? 'Searching documents...' : 'Thinking...'}</span></div>}
                {!isProcessing && error && <div className="error-indicator">{error}</div>}

                <footer className="input-area">
                    <textarea
                        value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleEnterKey}
                        placeholder="Ask your tutor..." rows="1" disabled={isProcessing} aria-label="Chat input"
                    />
                    <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : (isRagEnabled ? "Disable RAG (Retrieval-Augmented Generation)" : "Enable RAG (Retrieval-Augmented Generation)")}>
                        <input type="checkbox" id="rag-toggle" checked={isRagEnabled} onChange={handleRagToggle}
                               disabled={!hasFiles || isProcessing} aria-label="Enable RAG" />
                        <label htmlFor="rag-toggle">RAG</label>
                    </div>
                    <button onClick={handleSendMessage} disabled={isProcessing || !inputText.trim()} title="Send Message" aria-label="Send message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </footer>
            </div>

            <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} />

        </div>
    );
};

export default ChatPage;
