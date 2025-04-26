// client/src/components/FileManagerWidget.js
import React, { useState, useEffect, useCallback } from 'react';
import { getUserFiles, renameUserFile, deleteUserFile } from '../services/api';

const getFileIcon = (type) => {
  switch (type) {
    case 'docs': return '📄';
    case 'images': return '🖼️';
    case 'code': return '💻';
    default: return '📁';
  }
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (typeof bytes !== 'number' || bytes < 0) return 'N/A';
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.max(0, Math.min(i, sizes.length - 1));
  return parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + ' ' + sizes[index];
};


const FileManagerWidget = ({ refreshTrigger }) => {
  const [userFiles, setUserFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [renamingFile, setRenamingFile] = useState(null);
  const [newName, setNewName] = useState('');

  const fetchUserFiles = useCallback(async () => {
    // Ensure userId exists before fetching
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
        console.log("FileManager: Skipping fetch, no userId.");
        setUserFiles([]); // Clear files if no user
        return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Interceptor adds user ID
      const response = await getUserFiles();
      setUserFiles(response.data || []);
    } catch (err) {
      console.error("Error fetching user files:", err);
      setError(err.response?.data?.message || 'Failed to load files.');
      setUserFiles([]);
      // Handle potential logout if 401
      if (err.response?.status === 401) {
          console.warn("FileManager: Received 401, potential logout needed.");
          // Consider calling a logout function passed via props or context
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed userId dependency, check inside

  useEffect(() => {
    fetchUserFiles();
  }, [refreshTrigger, fetchUserFiles]);

  const handleRenameClick = (file) => {
    setRenamingFile(file.serverFilename);
    setNewName(file.originalName);
    setError('');
  };

  const handleRenameCancel = () => {
    setRenamingFile(null);
    setNewName('');
    setError('');
  };

  const handleRenameSave = async () => {
    if (!renamingFile || !newName.trim()) {
         setError('New name cannot be empty.');
         return;
    }
    if (newName.includes('/') || newName.includes('\\')) {
        setError('New name cannot contain slashes.');
        return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Interceptor adds user ID
      await renameUserFile(renamingFile, newName.trim());
      setRenamingFile(null);
      setNewName('');
      fetchUserFiles();
    } catch (err) {
      console.error("Error renaming file:", err);
      setError(err.response?.data?.message || 'Failed to rename file.');
       if (err.response?.status === 401) {
          console.warn("FileManager: Received 401 during rename.");
      }
    } finally {
       setIsLoading(false);
    }
  };

  const handleRenameInputKeyDown = (e) => {
      if (e.key === 'Enter') {
          handleRenameSave();
      } else if (e.key === 'Escape') {
          handleRenameCancel();
      }
  };

  const handleDeleteFile = async (serverFilename, originalName) => {
    if (!window.confirm(`Are you sure you want to delete "${originalName}"? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Interceptor adds user ID
      await deleteUserFile(serverFilename);
      fetchUserFiles();
    } catch (err) {
      console.error("Error deleting file:", err);
      setError(err.response?.data?.message || 'Failed to delete file.');
       if (err.response?.status === 401) {
          console.warn("FileManager: Received 401 during delete.");
      }
    } finally {
       setIsLoading(false);
    }
  };

  return (
    <div className="file-manager-widget">
      <div className="fm-header">
        <h4>Your Uploaded Files</h4>
        <button
            onClick={fetchUserFiles}
            disabled={isLoading}
            className="fm-refresh-btn"
            title="Refresh File List"
        >
            🔄
        </button>
      </div>

      {error && <div className="fm-error">{error}</div>}

      <div className="fm-file-list-container">
        {isLoading && userFiles.length === 0 ? (
          <p className="fm-loading">Loading files...</p>
        ) : userFiles.length === 0 && !isLoading ? (
          <p className="fm-empty">No files uploaded yet.</p>
        ) : (
          <ul className="fm-file-list">
            {userFiles.map((file) => (
              <li key={file.serverFilename} className="fm-file-item">
                <span className="fm-file-icon">{getFileIcon(file.type)}</span>
                <div className="fm-file-details">
                  {renamingFile === file.serverFilename ? (
                    <div className="fm-rename-section">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={handleRenameInputKeyDown}
                        autoFocus
                        className="fm-rename-input"
                        aria-label={`New name for ${file.originalName}`}
                      />
                      <button onClick={handleRenameSave} disabled={isLoading || !newName.trim()} className="fm-action-btn fm-save-btn" title="Save Name">✔️</button>
                      <button onClick={handleRenameCancel} disabled={isLoading} className="fm-action-btn fm-cancel-btn" title="Cancel Rename">❌</button>
                    </div>
                  ) : (
                    <>
                      <span className="fm-file-name" title={file.originalName}>{file.originalName}</span>
                      <span className="fm-file-size">{formatFileSize(file.size)}</span>
                    </>
                  )}
                </div>
                {renamingFile !== file.serverFilename && (
                  <div className="fm-file-actions">
                    <button
                        onClick={() => handleRenameClick(file)}
                        disabled={isLoading || !!renamingFile}
                        className="fm-action-btn fm-rename-btn"
                        title="Rename"
                    >
                       ✏️
                    </button>
                    <button
                        onClick={() => handleDeleteFile(file.serverFilename, file.originalName)}
                        disabled={isLoading || !!renamingFile}
                        className="fm-action-btn fm-delete-btn"
                        title="Delete"
                    >
                        🗑️
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
         {isLoading && userFiles.length > 0 && <p className="fm-loading fm-loading-bottom">Processing...</p>}
      </div>
    </div>
  );
};

// --- CSS for FileManagerWidget ---
const FileManagerWidgetCSS = `
/* client/src/components/FileManagerWidget.css */
.file-manager-widget { display: flex; flex-direction: column; gap: 10px; padding: 15px 0px 15px 20px; box-sizing: border-box; height: 100%; overflow: hidden; }
.fm-header { display: flex; justify-content: space-between; align-items: center; padding-right: 20px; flex-shrink: 0; }
.file-manager-widget h4 { margin: 0; color: var(--text-primary); font-size: 0.95rem; font-weight: 600; }
.fm-refresh-btn { background: none; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 3px 6px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; line-height: 1; transition: color 0.2s, border-color 0.2s, background-color 0.2s; }
.fm-refresh-btn:hover:not(:disabled) { color: var(--text-primary); border-color: #555; background-color: #3a3a40; }
.fm-refresh-btn:disabled { cursor: not-allowed; opacity: 0.5; }
.fm-error, .fm-loading, .fm-empty { font-size: 0.85rem; padding: 10px 15px; border-radius: 4px; text-align: center; margin: 5px 20px 5px 0; flex-shrink: 0; }
.fm-error { color: var(--error-color); border: 1px solid var(--error-color); background-color: var(--error-bg); }
.fm-loading, .fm-empty { color: var(--text-secondary); font-style: italic; }
.fm-loading-bottom { margin-top: auto; padding: 5px; }
.fm-file-list-container { flex-grow: 1; overflow-y: auto; padding-right: 10px; margin-right: 10px; position: relative; }
.fm-file-list-container::-webkit-scrollbar { width: 8px; }
.fm-file-list-container::-webkit-scrollbar-track { background: transparent; }
.fm-file-list-container::-webkit-scrollbar-thumb { background-color: #4a4a50; border-radius: 10px; }
.fm-file-list-container { scrollbar-width: thin; scrollbar-color: #4a4a50 transparent; }
.fm-file-list { list-style: none; padding: 0; margin: 0; }
.fm-file-item { display: flex; align-items: center; padding: 8px 5px; margin-bottom: 5px; border-radius: 4px; background-color: #2f2f34; transition: background-color 0.2s ease; gap: 10px; }
.fm-file-item:hover { background-color: #3a3a40; }
.fm-file-icon { flex-shrink: 0; font-size: 1.1rem; line-height: 1; }
.fm-file-details { flex-grow: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center; min-height: 30px; }
.fm-file-name { font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fm-file-size { font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px; }
.fm-file-actions { display: flex; gap: 5px; flex-shrink: 0; margin-left: auto; }
.fm-action-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 3px; font-size: 1rem; line-height: 1; border-radius: 3px; transition: color 0.2s ease, background-color 0.2s ease; }
.fm-action-btn:hover:not(:disabled) { color: var(--text-primary); background-color: #4a4a50; }
.fm-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fm-delete-btn:hover:not(:disabled) { color: var(--error-color); }
.fm-rename-btn:hover:not(:disabled) { color: var(--accent-blue-light); }
.fm-save-btn:hover:not(:disabled) { color: #52c41a; } /* Green */
.fm-cancel-btn:hover:not(:disabled) { color: #ffc107; } /* Orange/Yellow */
.fm-rename-section { display: flex; align-items: center; gap: 5px; width: 100%; }
.fm-rename-input { flex-grow: 1; padding: 4px 8px; background-color: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.85rem; outline: none; min-width: 50px; }
.fm-rename-input:focus { border-color: var(--accent-blue); }
`;
// --- Inject CSS ---
const styleTagFileManagerId = 'file-manager-widget-styles';
if (!document.getElementById(styleTagFileManagerId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagFileManagerId;
    styleTag.type = "text/css";
    styleTag.innerText = FileManagerWidgetCSS;
    document.head.appendChild(styleTag);
}
// --- End CSS Injection ---

export default FileManagerWidget;
