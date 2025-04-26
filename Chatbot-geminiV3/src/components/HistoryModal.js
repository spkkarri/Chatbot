// client/src/components/HistoryModal.js
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getChatSessions, getSessionDetails } from '../services/api';

const HistoryModal = ({ isOpen, onClose }) => {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchSessions = async () => {
        // Ensure userId exists before fetching
        const currentUserId = localStorage.getItem('userId');
        if (!currentUserId) {
            setError('Cannot load history: User not logged in.');
            setSessions([]);
            return;
        }

        setIsLoadingSessions(true);
        setError('');
        setSelectedSession(null);
        setSessions([]);
        try {
          // Interceptor adds user ID
          const response = await getChatSessions();
          setSessions(response.data || []);
        } catch (err) {
          console.error("Error fetching sessions:", err);
          setError(err.response?.data?.message || 'Failed to load chat history sessions.');
          setSessions([]);
          if (err.response?.status === 401) {
              console.warn("HistoryModal: Received 401 fetching sessions.");
              // Optionally close modal or trigger logout
              onClose();
          }
        } finally {
          setIsLoadingSessions(false);
        }
      };
      fetchSessions();
    } else {
      setSessions([]);
      setSelectedSession(null);
      setError('');
      setIsLoadingSessions(false);
      setIsLoadingDetails(false);
    }
  }, [isOpen, onClose]); // Added onClose to dependency array

  const handleSelectSession = async (sessionId) => {
     // Ensure userId exists before fetching
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
        setError('Cannot load session details: User not logged in.');
        return;
    }
    if (!sessionId || isLoadingDetails || selectedSession?.sessionId === sessionId) return;

    setIsLoadingDetails(true);
    setError('');
    try {
      // Interceptor adds user ID
      const response = await getSessionDetails(sessionId);
      setSelectedSession(response.data);
    } catch (err) {
      console.error(`Error fetching session ${sessionId}:`, err);
      setError(err.response?.data?.message || `Failed to load details for session ${sessionId}.`);
      setSelectedSession(null);
      if (err.response?.status === 401) {
          console.warn("HistoryModal: Received 401 fetching session details.");
          // Optionally close modal or trigger logout
          onClose();
      }
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
          throw new Error("Invalid date string");
      }
      return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      console.warn("Error formatting date:", dateString, e);
      return dateString;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="history-modal-close-btn" onClick={onClose} aria-label="Close history">×</button>
        <h2>Chat History</h2>

        {error && !isLoadingDetails && !isLoadingSessions && <div className="history-error">{error}</div>}

        <div className="history-layout">
          <div className="history-session-list">
            <h3>Sessions</h3>
            {isLoadingSessions ? (
              <p className="history-loading">Loading sessions...</p>
            ) : sessions.length === 0 && !error ? (
              <p className="history-empty">No past sessions found.</p>
            ) : (
              <ul>
                {sessions.map((session) => (
                  <li
                    key={session.sessionId}
                    className={selectedSession?.sessionId === session.sessionId ? 'active' : ''}
                    onClick={() => handleSelectSession(session.sessionId)}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelectSession(session.sessionId)}
                    role="button"
                  >
                    <div className="session-preview" title={session.preview || 'Chat session'}>
                      {session.preview || 'Chat session'}
                    </div>
                    <div className="session-date">
                      {formatDate(session.updatedAt || session.createdAt)} ({session.messageCount || 0} msgs)
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="history-session-details">
            <h3>Session Details</h3>
            {isLoadingDetails ? (
              <p className="history-loading">Loading details...</p>
            ) : !selectedSession ? (
              <p className="history-empty">Select a session from the left to view its messages.</p>
            ) : (
              <div className="history-messages-area">
                {selectedSession.messages && selectedSession.messages.length > 0 ? (
                  selectedSession.messages.map((msg, index) => (
                    !msg?.role || !msg?.parts?.length ?
                      <div key={`${selectedSession.sessionId}-err-${index}`} className="history-message-error">Invalid message data</div>
                    :
                    <div key={`${selectedSession.sessionId}-${index}`} className={`history-message ${msg.role}`}>
                      <div className="history-message-content">
                        <ReactMarkdown children={msg.parts[0]?.text || ''} />
                      </div>
                      <span className="history-message-timestamp">
                        {formatDate(msg.timestamp)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="history-empty">This session appears to have no messages.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// --- CSS for HistoryModal ---
const HistoryModalCSS = `
/* client/src/components/HistoryModal.css */
.history-modal-overlay { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.75); display: flex; justify-content: center; align-items: center; z-index: 1000; backdrop-filter: blur(4px); padding: 20px; box-sizing: border-box; }
.history-modal-content { background-color: var(--bg-header); color: var(--text-primary); padding: 20px 25px; border-radius: 10px; width: 90%; max-width: 1200px; height: 85vh; max-height: 800px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5); position: relative; display: flex; flex-direction: column; overflow: hidden; }
.history-modal-close-btn { position: absolute; top: 10px; right: 10px; background: transparent; border: none; font-size: 2.2rem; font-weight: bold; color: var(--text-secondary); cursor: pointer; line-height: 1; padding: 5px; transition: color 0.2s ease; }
.history-modal-close-btn:hover { color: var(--text-primary); }
.history-modal-content h2 { margin: 0 0 15px 0; padding-bottom: 10px; text-align: center; font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-color); flex-shrink: 0; }
.history-error, .history-loading, .history-empty { color: var(--text-secondary); padding: 12px 15px; border-radius: 6px; margin-bottom: 15px; text-align: center; font-size: 0.9rem; font-style: italic; }
.history-error { color: var(--error-color); background-color: var(--error-bg); border: 1px solid var(--error-color); font-style: normal; }
.history-layout { display: flex; flex-grow: 1; gap: 20px; overflow: hidden; }
.history-session-list { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; overflow-y: auto; padding-right: 10px; border-right: 1px solid var(--border-color); }
.history-session-list h3 { margin: 0 0 12px 0; padding: 0 5px; font-size: 1rem; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }
.history-session-list ul { list-style: none; padding: 0; margin: 0; flex-grow: 1; overflow-y: auto; }
.history-session-list li { padding: 10px 12px; margin-bottom: 8px; border: 1px solid transparent; border-radius: 6px; cursor: pointer; transition: background-color 0.15s ease, border-color 0.15s ease; background-color: #2f2f34; }
.history-session-list li:hover { background-color: #3a3a40; border-color: #4a4a50; }
.history-session-list li.active { background-color: var(--accent-blue); border-color: var(--accent-blue); color: var(--user-message-text); }
.history-session-list li.active .session-date { color: rgba(255, 255, 255, 0.85); }
.session-preview { font-size: 0.9rem; font-weight: 500; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.session-date { font-size: 0.75rem; color: var(--text-secondary); }
.history-session-details { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; background-color: var(--bg-messages); border-radius: 8px; }
.history-session-details h3 { margin: 0; padding: 12px 20px; font-size: 1rem; font-weight: 600; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); background-color: var(--bg-header); border-top-left-radius: 8px; border-top-right-radius: 8px; flex-shrink: 0; }
.history-session-details > .history-empty, .history-session-details > .history-loading { padding: 30px; text-align: center; flex-grow: 1; display: flex; align-items: center; justify-content: center; }
.history-messages-area { flex-grow: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 18px; }
.history-message { display: flex; max-width: 85%; position: relative; word-wrap: break-word; flex-direction: column; }
.history-message.user { align-self: flex-end; align-items: flex-end; }
.history-message.model { align-self: flex-start; align-items: flex-start; }
.history-message-content { padding: 10px 15px; border-radius: 16px; font-size: 0.9rem; line-height: 1.6; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); text-align: left; }
.history-message.user .history-message-content { background-color: var(--user-message-bg); color: var(--user-message-text); border-bottom-right-radius: 5px; }
.history-message.model .history-message-content { background-color: var(--model-message-bg); color: var(--model-message-text); border-bottom-left-radius: 5px; }
.history-message-content p { margin: 0 0 0.5em 0; }
.history-message-content p:last-child { margin-bottom: 0; }
.history-message-content pre { background-color: var(--code-bg); border: 1px solid var(--code-border); border-radius: 6px; padding: 12px; overflow-x: auto; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 0.88rem; margin: 0.8em 0; white-space: pre; color: var(--code-text); }
.history-message-content code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 0.88rem; background-color: rgba(255, 255, 255, 0.08); padding: 0.2em 0.4em; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-secondary); }
.history-message-content pre code { background-color: transparent; padding: 0; border: none; font-size: inherit; color: inherit; }
.history-message-timestamp { font-size: 0.7rem; color: var(--text-secondary); margin-top: 5px; }
.history-message-error { color: var(--error-color); font-style: italic; padding: 5px 0; text-align: center; font-size: 0.8rem; }
.history-session-list::-webkit-scrollbar, .history-session-list ul::-webkit-scrollbar, .history-messages-area::-webkit-scrollbar { width: 8px; }
.history-session-list::-webkit-scrollbar-track, .history-session-list ul::-webkit-scrollbar-track, .history-messages-area::-webkit-scrollbar-track { background: transparent; }
.history-session-list::-webkit-scrollbar-thumb, .history-session-list ul::-webkit-scrollbar-thumb, .history-messages-area::-webkit-scrollbar-thumb { background-color: #4a4a50; border-radius: 10px; }
.history-session-list, .history-session-list ul, .history-messages-area { scrollbar-width: thin; scrollbar-color: #4a4a50 transparent; }
`;
// --- Inject CSS ---
const styleTagHistoryId = 'history-modal-styles';
if (!document.getElementById(styleTagHistoryId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagHistoryId;
    styleTag.type = "text/css";
    styleTag.innerText = HistoryModalCSS;
    document.head.appendChild(styleTag);
}
// --- End CSS Injection ---

export default HistoryModal;
