// frontend/src/components/core/ConfirmationModal.jsx
import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed? This action cannot be undone.",
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmVariant = "danger",
    isLoading = false
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <div className="text-center p-4">
                <AlertTriangle
                    className={`mx-auto mb-4 h-12 w-12 ${
                        confirmVariant === 'danger' ? 'text-red-500' : 'text-yellow-500'
                    }`}
                />
                <p className="text-base text-text-light dark:text-text-dark">{message}</p>
            </div>
            <div className="flex justify-center gap-4 p-4 border-t border-border-light dark:border-border-dark">
                <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                    {cancelText}
                </Button>
                <Button variant={confirmVariant} onClick={onConfirm} isLoading={isLoading}>
                    {confirmText}
                </Button>
            </div>
        </Modal>
    );
};

export default ConfirmationModal;