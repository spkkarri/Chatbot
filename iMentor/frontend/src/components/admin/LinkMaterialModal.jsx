// frontend/src/components/admin/LinkMaterialModal.jsx
import React, { useState, useEffect } from 'react';
import * as adminApi from '../../services/adminApi.js';
import Modal from '../core/Modal';
import Button from '../core/Button';
import { Loader2, Search } from 'lucide-react';

const LinkMaterialModal = ({ isOpen, onClose, onLink }) => {
    const [documents, setDocuments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDocId, setSelectedDocId] = useState(null);

    useEffect(() => {
        if (isOpen) {
            const fetchUnlinked = async () => {
                setIsLoading(true);
                try {
                    const data = await adminApi.getUnlinkedDocuments();
                    setDocuments(data);
                } catch (error) {
                    console.error(error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchUnlinked();
        }
    }, [isOpen]);

    const filteredDocuments = documents.filter(doc =>
        doc.originalName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleLink = () => {
        onLink(selectedDocId);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Link Lecture Material" size="lg">
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search available materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field w-full !pl-9"
                />
            </div>
            <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2">
                {isLoading && <div className="text-center p-4"><Loader2 className="animate-spin" /></div>}
                {!isLoading && filteredDocuments.map(doc => (
                    <div
                        key={doc._id}
                        onClick={() => setSelectedDocId(doc._id)}
                        className={`p-3 border rounded-md cursor-pointer ${selectedDocId === doc._id ? 'border-primary bg-primary/10' : 'border-border-light dark:border-border-dark'}`}
                    >
                        {doc.originalName}
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleLink} disabled={!selectedDocId}>Link Selected</Button>
            </div>
        </Modal>
    );
};

export default LinkMaterialModal;
