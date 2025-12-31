// frontend/src/components/admin/LLMConfigManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../services/adminApi.js';
import toast from 'react-hot-toast';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import Modal from '../core/Modal.jsx';
import { Plus, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';

const LLMConfigManager = () => {
    const [configs, setConfigs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);

    const fetchConfigs = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await adminApi.getLlmConfigs();
            setConfigs(data);
        } catch (err) {
            setError(err.message);
            toast.error('Failed to load LLM configurations.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const handleOpenForm = (config = null) => {
        setEditingConfig(config);
        setIsFormModalOpen(true);
    };

    const handleDelete = async (config) => {
        if (!window.confirm(`Are you sure you want to delete the LLM configuration for "${config.displayName}"?`)) return;
        try {
            await adminApi.deleteLlmConfig(config._id);
            toast.success('Configuration deleted.');
            fetchConfigs();
        } catch (err) {
            toast.error(`Deletion failed: ${err.message}`);
        }
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;
    if (error) return <div className="text-red-500 p-4"><AlertTriangle className="inline mr-2" />{error}</div>;

    return (
        <div>
            <div className="flex justify-end mb-4">
                <Button onClick={() => handleOpenForm(null)} leftIcon={<Plus />}>Add New LLM Config</Button>
            </div>
            <div className="space-y-3">
                {configs.length > 0 ? configs.map(config => (
                    <div key={config._id} className="card-base p-4 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                        <div>
                            <h4 className="font-bold text-text-light dark:text-text-dark">{config.displayName} {config.isDefault && <span className="text-xs font-semibold bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">Default</span>}</h4>
                            <p className="text-sm font-mono text-text-muted-light dark:text-text-muted-dark">{config.modelId} ({config.provider})</p>
                            <p className="text-xs mt-1">Strengths: {config.strengths?.join(', ') || 'N/A'}</p>
                        </div>
                        <div className="flex gap-2">
                            <IconButton icon={Edit} onClick={() => handleOpenForm(config)} title="Edit" />
                            <IconButton icon={Trash2} onClick={() => handleDelete(config)} title="Delete" variant="danger" />
                        </div>
                    </div>
                )) : <p className="text-center text-text-muted-light dark:text-text-muted-dark">No LLM configurations found. Add one to get started.</p>}
            </div>
            {isFormModalOpen && (
                <ConfigFormModal
                    isOpen={isFormModalOpen}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={fetchConfigs}
                    config={editingConfig}
                />
            )}
        </div>
    );
};

const ConfigFormModal = ({ isOpen, onClose, onSuccess, config }) => {
    const [formData, setFormData] = useState({
        modelId: config?.modelId || '',
        provider: config?.provider || 'gemini',
        displayName: config?.displayName || '',
        description: config?.description || '',
        isDefault: config?.isDefault || false,
        strengths: config?.strengths?.join(', ') || '',
        subjectFocus: config?.subjectFocus || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                strengths: formData.strengths.split(',').map(s => s.trim()).filter(Boolean)
            };
            if (config) {
                await adminApi.updateLlmConfig(config._id, payload);
                toast.success('Configuration updated!');
            } else {
                await adminApi.createLlmConfig(payload);
                toast.success('New configuration created!');
            }
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(`Save failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={config ? 'Edit LLM Configuration' : 'Add New LLM'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium">Display Name</label><input name="displayName" value={formData.displayName} onChange={handleChange} className="input-field" required /></div>
                <div><label className="block text-sm font-medium">Model ID</label><input name="modelId" value={formData.modelId} onChange={handleChange} className="input-field" placeholder="e.g., gemini-1.5-pro or ollama/qwen2" required /></div>
                <div><label className="block text-sm font-medium">Provider</label><select name="provider" value={formData.provider} onChange={handleChange} className="input-field"><option value="gemini">gemini</option><option value="ollama">ollama</option><option value="fine-tuned">fine-tuned</option></select></div>
                <div><label className="block text-sm font-medium">Strengths (comma-separated)</label><input name="strengths" value={formData.strengths} onChange={handleChange} className="input-field" placeholder="e.g., code, reasoning, chat" /></div>
                <div><label className="block text-sm font-medium">Subject Focus (for fine-tuned models)</label><input name="subjectFocus" value={formData.subjectFocus} onChange={handleChange} className="input-field" /></div>
                <div className="flex items-center gap-2"><input type="checkbox" name="isDefault" checked={formData.isDefault} onChange={handleChange} className="form-checkbox" /><label>Is Default Model?</label></div>
                <div className="flex justify-end gap-2 pt-4 border-t border-border-light dark:border-border-dark">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={isSaving}>Save Configuration</Button>
                </div>
            </form>
        </Modal>
    );
};

export default LLMConfigManager;