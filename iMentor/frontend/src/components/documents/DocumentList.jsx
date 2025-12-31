

// frontend/src/components/documents/DocumentList.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api.js'; // Mocked for V1
import toast from 'react-hot-toast';
import { FileText, Edit3, Trash2, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import IconButton from '../core/IconButton.jsx'; // Make sure IconButton is imported
import { useAuth } from '../../hooks/useAuth.jsx';

// Props from LeftPanel: onSelectDocument is selectDocumentForAnalysis from AppStateContext
// selectedDocument is selectedDocumentForAnalysis from AppStateContext
function DocumentList({ onSelectDocument, selectedDocument }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      
      const response = await api.getFiles(); // Returns { filenames: ["A.txt", "B.pdf"] }
      const filenames = Array.isArray(response.filenames) ? response.filenames : [];
      setFiles(filenames);
      
    } catch (err) {
      console.error("Failed to fetch files:", err);
      setError(err.message || "Failed to fetch files.");
      toast.error("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, []);



  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;
    const toastId = toast.loading(`Deleting ${filename}...`);
    try {
      await api.deleteFile(filename); // Assumes this works with filename
      toast.success(`${filename} deleted.`, { id: toastId });
      fetchFiles();
      if (selectedDocument === filename) {
        onSelectDocument(null);
      }
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`, { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 text-text-muted-light dark:text-text-muted-dark">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading documents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
        <AlertTriangle size={18} /> {error}
        <button onClick={fetchFiles} className="ml-auto text-xs underline hover:text-red-400">Retry</button>
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="text-center text-xs text-text-muted-light dark:text-text-muted-dark p-4">No documents uploaded.</p>;
  }

  return (
    <div className="space-y-1.5 text-xs custom-scrollbar pr-1">
      {files.map(filename => {
        const isSelected = selectedDocument === filename;

        return (
          <div
            key={filename}
            onClick={() => onSelectDocument(isSelected ? null : filename)}
            className={`p-2.5 bg-surface-light dark:bg-gray-800 border rounded-md flex items-center justify-between hover:shadow-md transition-all duration-150 cursor-pointer
                        ${isSelected
                          ? 'ring-2 ring-primary dark:ring-primary-light shadow-lg border-primary dark:border-primary-light'
                          : 'border-border-light dark:border-border-dark hover:border-gray-400 dark:hover:border-gray-500'}`}
            title={`Select ${filename}`}
          >
            <div className="flex items-center gap-2 truncate">
              {isSelected ? (
                <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
              ) : (
                <FileText size={16} className="text-primary dark:text-primary-light flex-shrink-0" />
              )}
              <span className={`truncate ${isSelected ? 'font-semibold text-primary dark:text-primary-light' : 'text-text-light dark:text-text-dark'}`}>
                {filename}
              </span>
            </div>
            <div className="flex-shrink-0 flex items-center gap-0.5">
              <IconButton
                icon={Trash2}
                size="sm"
                variant="ghost"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(filename);
                }}
                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}


export default DocumentList;