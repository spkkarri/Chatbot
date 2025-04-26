// client/src/components/FileUploadWidget.js
import React, { useState, useRef } from 'react';
import { uploadFile } from '../services/api';

const FileUploadWidget = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(''); // 'uploading', 'success', 'error', ''
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef(null);

  const allowedFileTypesString = ".pdf,.txt,.docx,.doc,.pptx,.ppt,.py,.js,.bmp,.png,.jpg,.jpeg";

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileExt = "." + file.name.split('.').pop().toLowerCase();
      if (!allowedFileTypesString.includes(fileExt)) {
           setStatusMessage(`Error: File type (${fileExt}) not allowed.`);
           setUploadStatus('error');
           setSelectedFile(null);
           if (fileInputRef.current) fileInputRef.current.value = '';
           return;
      }

      const MAX_SIZE_MB = 20;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
          setStatusMessage(`Error: File exceeds ${MAX_SIZE_MB}MB limit.`);
          setUploadStatus('error');
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      setSelectedFile(file);
      setStatusMessage(`Selected: ${file.name}`);
      setUploadStatus('');

    } else {
        // Handle user cancelling file selection if needed
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatusMessage('Please select a file first.');
      setUploadStatus('error');
      return;
    }
    // Ensure userId exists before uploading
     const currentUserId = localStorage.getItem('userId');
     if (!currentUserId) {
         setStatusMessage('Error: Not logged in. Cannot upload file.');
         setUploadStatus('error');
         return;
     }

    setUploadStatus('uploading');
    setStatusMessage(`Uploading ${selectedFile.name}...`);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Interceptor adds user ID header
      const response = await uploadFile(formData);

      setUploadStatus('success');
      setStatusMessage(response.data.message || 'Upload successful!');
      console.log('Upload successful:', response.data);

      setSelectedFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }

      if (onUploadSuccess && typeof onUploadSuccess === 'function') {
          onUploadSuccess();
      }

      setTimeout(() => {
          // Check if status is still success before clearing
          setUploadStatus(prevStatus => prevStatus === 'success' ? '' : prevStatus);
          setStatusMessage(prevMsg => prevMsg === (response.data.message || 'Upload successful!') ? '' : prevMsg);
      }, 4000);


    } catch (err) {
      console.error("Upload Error:", err.response || err);
      setUploadStatus('error');
      setStatusMessage(err.response?.data?.message || 'Upload failed. Please check the file or try again.');
      if (err.response?.status === 401) {
          console.warn("FileUpload: Received 401 during upload.");
          // Consider calling a logout function passed via props or context
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-widget">
      <h4>Upload File</h4>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={allowedFileTypesString}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <button
        type="button"
        className="select-file-btn"
        onClick={triggerFileInput}
        disabled={uploadStatus === 'uploading'}
      >
        Choose File
      </button>
      <div className={`status-message ${uploadStatus}`}>
        {statusMessage || 'No file selected.'}
      </div>
      <button
        type="button"
        className="upload-btn"
        onClick={handleUpload}
        disabled={!selectedFile || uploadStatus === 'uploading'}
      >
        {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
};

// --- CSS for FileUploadWidget ---
const FileUploadWidgetCSS = `
/* client/src/components/FileUploadWidget.css */
.file-upload-widget { display: flex; flex-direction: column; gap: 12px; padding: 20px; box-sizing: border-box; }
.file-upload-widget h4 { margin-top: 0; margin-bottom: 10px; color: var(--text-primary); font-size: 0.95rem; font-weight: 600; }
.select-file-btn, .upload-btn { width: 100%; padding: 9px 15px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, opacity 0.2s ease; background-color: #2a2a30; color: var(--text-primary); text-align: center; box-sizing: border-box; }
.select-file-btn:hover:not(:disabled), .upload-btn:hover:not(:disabled) { background-color: #3a3a40; border-color: #4a4a50; }
.select-file-btn:disabled, .upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.upload-btn { background-color: var(--accent-blue); border-color: var(--accent-blue); color: var(--user-message-text); }
.upload-btn:hover:not(:disabled) { background-color: var(--accent-blue-light); border-color: var(--accent-blue-light); }
.upload-btn:disabled { background-color: #3a3a40; border-color: var(--border-color); color: var(--text-secondary); opacity: 0.7; }
.status-message { font-size: 0.8rem; color: var(--text-secondary); padding: 8px 10px; background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: 4px; text-align: center; min-height: 1.6em; line-height: 1.4; word-break: break-word; transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease; }
.status-message.uploading { color: var(--accent-blue-light); border-color: var(--accent-blue); }
.status-message.success { color: #52c41a; border-color: #52c41a; background-color: rgba(82, 196, 26, 0.1); }
.status-message.error { color: var(--error-color); border-color: var(--error-color); background-color: var(--error-bg); }
`;
// --- Inject CSS ---
const styleTagUploadId = 'file-upload-widget-styles';
if (!document.getElementById(styleTagUploadId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagUploadId;
    styleTag.type = "text/css";
    styleTag.innerText = FileUploadWidgetCSS;
    document.head.appendChild(styleTag);
}
// --- End CSS Injection ---

export default FileUploadWidget;
