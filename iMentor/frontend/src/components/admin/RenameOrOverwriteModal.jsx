// frontend/src/components/admin/RenameOrOverwriteModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from '../core/Modal';
import Button from '../core/Button';
import { AlertTriangle, Edit } from 'lucide-react';

const RenameOrOverwriteModal = ({ isOpen, onClose, onConfirm, file }) => {
    const [newName, setNewName] = useState(file?.name || '');

    useEffect(() => {
        if (file) {
            setNewName(file.name);
        }
    }, [file]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={() => onClose('cancel')} title="File Conflict" size="md">
            <div className="p-4 text-center">
                <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                <h3 className="text-lg font-medium">File Already Exists</h3>
                <p className="mt-2 text-sm text-text-muted-light dark:text-text-muted-dark">
                    A file named <strong>{file?.name}</strong> already exists for this course.
                </p>
            </div>
            <div className="p-4 space-y-4">
                <div>
                    <label htmlFor="new-filename" className="text-sm font-medium">Rename the file before uploading:</label>
                    <div className="relative mt-1">
                        <Edit className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            id="new-filename"
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="input-field w-full !pl-9"
                        />
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-border-light dark:border-border-dark">
                <Button variant="secondary" onClick={() => onClose('cancel')}>Cancel Upload</Button>
                <Button variant="outline" onClick={() => onConfirm({ action: 'rename', newName })}>Rename & Upload</Button>
                <Button variant="danger" onClick={() => onConfirm({ action: 'overwrite' })}>Overwrite Existing</Button>
            </div>
        </Modal>
    );
};

export default RenameOrOverwriteModal;
