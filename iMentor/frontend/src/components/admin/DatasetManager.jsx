// frontend/src/components/admin/DatasetManager.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import adminApi from '../../services/adminApi.js';
import toast from 'react-hot-toast';
import axios from 'axios';
import { UploadCloud, File, Download, Loader2, AlertTriangle, Trash2, Database, Tag, GitBranch } from 'lucide-react';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

// Helper to format file size
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

function DatasetManager() {
    const [datasets, setDatasets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [category, setCategory] = useState('');
    const [version, setVersion] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [downloadingId, setDownloadingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [dragActive, setDragActive] = useState(false); // For drag-and-drop UI
    const fileInputRef = useRef(null);

    const fetchDatasets = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await adminApi.getDatasets();
            setDatasets(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'Failed to fetch datasets.');
            toast.error('Could not load datasets.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDatasets();
    }, [fetchDatasets]);

    const handleFileSelect = (files) => {
        if (isUploading || !files || files.length === 0) return;
        const file = files[0];
        // Optional: Add file type/size validation here
        setSelectedFile(file);
    };
    
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isUploading) return;
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !category.trim() || !version.trim()) {
            toast.error('Please select a file and provide a category and version.');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        const toastId = toast.loading('Preparing secure upload...');

        try {
            const { url, key } = await adminApi.getPresignedUploadUrl(selectedFile.name, selectedFile.type);
            toast.loading('Uploading file directly to secure storage...', { id: toastId });

            await axios.put(url, selectedFile, {
                headers: { 'Content-Type': selectedFile.type },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(percentCompleted);
                },
            });
            toast.loading('Finalizing upload...', { id: toastId });

            await adminApi.finalizeUpload({
                originalName: selectedFile.name, s3Key: key, category: category.trim(),
                version: version.trim(), fileType: selectedFile.type, size: selectedFile.size,
            });

            toast.success('Dataset uploaded successfully!', { id: toastId });
            setSelectedFile(null);
            setCategory('');
            setVersion('');
            fetchDatasets();
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Upload failed.';
            toast.error(errorMsg, { id: toastId });
            setError(errorMsg);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDownload = async (datasetId) => {
        setDownloadingId(datasetId);
        const toastId = toast.loading('Preparing secure download...');
        try {
            const { url } = await adminApi.getPresignedDownloadUrl(datasetId);
            window.location.href = url;
            toast.success('Download will begin shortly!', { id: toastId });
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Download failed.';
            toast.error(errorMsg, { id: toastId });
        } finally {
            setDownloadingId(null);
        }
    };

    const handleDelete = async (dataset) => {
        if (!window.confirm(`Are you sure you want to permanently delete "${dataset.originalName}" (v${dataset.version})? This action cannot be undone.`)) return;
        setDeletingId(dataset._id);
        const toastId = toast.loading(`Deleting '${dataset.originalName}'...`);
        try {
            await adminApi.deleteDataset(dataset._id);
            toast.success(`'${dataset.originalName}' deleted successfully.`, { id: toastId });
            fetchDatasets();
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Delete failed.';
            toast.error(errorMsg, { id: toastId });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* --- ENHANCED Upload Form Section --- */}
            <div className="card-base p-4">
                <h3 className="text-lg font-semibold mb-4">Upload New Dataset</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-text-muted-light dark:text-text-muted-dark">1. Select File</label>
                        <label
                            htmlFor="dataset-upload-input"
                            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                            className={`flex flex-col items-center justify-center w-full h-32 px-4 transition-colors duration-200 ease-in-out bg-surface-light dark:bg-gray-800 border-2 border-dashed rounded-lg cursor-pointer border-border-light dark:border-border-dark hover:border-primary dark:hover:border-primary-light ${dragActive ? "border-primary dark:border-primary-light ring-2 ring-primary/20 dark:ring-primary-light/20 bg-primary/5 dark:bg-primary-dark/10" : ""}`}
                        >
                            <div className="flex flex-col items-center justify-center text-center">
                                <UploadCloud size={32} className={`mb-2 transition-colors ${dragActive ? 'text-primary' : 'text-text-muted-light'}`} />
                                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                                    <span className="font-semibold text-primary dark:text-primary-light">Click to upload</span> or drag and drop
                                </p>
                            </div>
                            <input ref={fileInputRef} id="dataset-upload-input" type="file" className="hidden" onChange={(e) => handleFileSelect(e.target.files)} disabled={isUploading} />
                        </label>
                        {selectedFile && !isUploading && (
                            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-between text-sm animate-fadeIn">
                                <div className="flex items-center gap-2 truncate min-w-0">
                                    <File size={18} className="text-primary flex-shrink-0" />
                                    <span className="truncate" title={selectedFile.name}>{selectedFile.name}</span>
                                    <span className="text-text-muted-light dark:text-text-muted-dark text-xs whitespace-nowrap">({formatFileSize(selectedFile.size)})</span>
                                </div>
                                <IconButton icon={Trash2} size="sm" variant="danger" onClick={() => setSelectedFile(null)} title="Remove selection" />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1 text-text-muted-light dark:text-text-muted-dark">2. Add Details</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light" />
                                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g., Physics)" className="input-field !pl-10" disabled={isUploading} />
                            </div>
                            <div className="relative">
                                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light" />
                                <input type="text" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version (e.g., 1.0.0)" className="input-field !pl-10" disabled={isUploading} />
                            </div>
                        </div>
                    </div>
                </div>

                {isUploading && (
                     <div className="mt-4">
                        <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <p className="text-center text-sm mt-1 text-text-muted-light dark:text-text-muted-dark">Uploading... {uploadProgress}%</p>
                    </div>
                )}
                <Button onClick={handleUpload} isLoading={isUploading} disabled={!selectedFile || !category || !version || isUploading} leftIcon={<UploadCloud size={16} />} className="mt-4 w-full md:w-auto">
                    {isUploading ? 'Uploading...' : 'Upload Dataset'}
                </Button>
            </div>

            {/* --- ENHANCED Datasets List Section --- */}
            <div className="card-base p-0 sm:p-4">
                <h3 className="text-lg font-semibold mb-3 px-4 pt-4 sm:px-0 sm:pt-0">Managed Datasets</h3>
                {isLoading && <div className="p-6 text-center"><Loader2 className="animate-spin inline-block text-primary" size={28}/></div>}
                {error && <div className="p-4 text-red-500 bg-red-500/10 rounded-md"><AlertTriangle className="inline mr-2" />{error}</div>}
                {!isLoading && !error && datasets.length === 0 && (
                    <div className="py-10 text-center text-text-muted-light dark:text-text-muted-dark">
                        <Database size={40} className="mx-auto opacity-50 mb-2" />
                        <p>No datasets have been uploaded yet.</p>
                        <p className="text-xs">Use the form above to add your first dataset.</p>
                    </div>
                )}
                {!isLoading && !error && datasets.length > 0 && (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-2.5 font-semibold">Filename</th>
                                    <th className="px-4 py-2.5 font-semibold">Category</th>
                                    <th className="px-4 py-2.5 font-semibold">Version</th>
                                    <th className="px-4 py-2.5 font-semibold">Size</th>
                                    <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Uploaded On</th>
                                    <th className="px-4 py-2.5 font-semibold text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {datasets.map((ds) => (
                                    <tr key={ds._id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                        <td className="px-4 py-3 truncate max-w-xs font-medium" title={ds.originalName}>
                                            <File size={14} className="inline mr-2 text-primary" />
                                            {ds.originalName}
                                        </td>
                                        <td className="px-4 py-3">{ds.category}</td>
                                        <td className="px-4 py-3 font-mono text-xs bg-gray-100 dark:bg-gray-700 rounded-full w-fit">{ds.version}</td>
                                        <td className="px-4 py-3">{formatFileSize(ds.size)}</td>
                                        <td className="px-4 py-3 hidden md:table-cell">{format(new Date(ds.uploadDate), 'MMM d, yyyy HH:mm')}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center items-center gap-1">
                                                <Button size="sm" variant="outline" onClick={() => handleDownload(ds._id)} isLoading={downloadingId === ds._id} disabled={!!deletingId} leftIcon={<Download size={14} />}>
                                                    Download
                                                </Button>
                                                <IconButton
                                                    icon={Trash2}
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => handleDelete(ds)}
                                                    isLoading={deletingId === ds._id}
                                                    disabled={!!downloadingId}
                                                    title="Delete Dataset"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DatasetManager;