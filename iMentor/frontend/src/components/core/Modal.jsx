// src/components/core/Modal.jsx
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footerContent,
    size = 'md', // 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', 'full'
    closeOnOverlayClick = true,
    initialFocusRef, // Optional ref for focusing an element inside the modal on open
}) => {
    const modalRef = useRef(null);

    // Handle Escape key for closing
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
        }
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen, onClose]);

    // Handle focus trapping and initial focus
    useEffect(() => {
        if (isOpen) {
            // Set focus to the initialFocusRef or the modal itself
            if (initialFocusRef && initialFocusRef.current) {
                initialFocusRef.current.focus();
            } else if (modalRef.current) {
                modalRef.current.focus(); // Fallback to modal itself
            }

            // Basic focus trapping (can be made more robust with a library)
            const focusableElements = modalRef.current?.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements && focusableElements.length > 0) {
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                const onKeyDown = (e) => {
                    if (e.key === 'Tab') {
                        if (e.shiftKey) { // Shift + Tab
                            if (document.activeElement === firstElement) {
                                lastElement.focus();
                                e.preventDefault();
                            }
                        } else { // Tab
                            if (document.activeElement === lastElement) {
                                firstElement.focus();
                                e.preventDefault();
                            }
                        }
                    }
                };
                modalRef.current?.addEventListener('keydown', onKeyDown);
                return () => modalRef.current?.removeEventListener('keydown', onKeyDown);
            }
        }
    }, [isOpen, initialFocusRef]);


    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        full: 'max-w-full h-full rounded-none sm:rounded-lg sm:max-h-[95vh]', // Special case for full screen like
    };

    const backdropVariants = {
        visible: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
        hidden: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" } },
    };

    const modalVariants = {
        hidden: { y: "-30px", opacity: 0, scale: 0.98, transition: { duration: 0.15, ease: "easeIn" } },
        visible: { y: "0", opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 30, duration: 0.3 } },
        exit: { y: "30px", opacity: 0, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.div
                    key="modal-backdrop"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 dark:bg-black/80 backdrop-blur-sm"
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={backdropVariants}
                    onClick={closeOnOverlayClick ? onClose : undefined}
                    aria-labelledby="modal-title" // For screen readers
                    role="dialog" // Role for the backdrop itself, more specific roles on content
                    aria-modal="true" // Indicate it's a modal overlaying other content
                >
                    <motion.div
                        key="modal-content-wrapper" // Changed key for potential AnimatePresence behavior
                        ref={modalRef}
                        tabIndex={-1} // Make the modal itself focusable for fallback
                        className={`bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl w-full ${sizeClasses[size]} flex flex-col overflow-hidden
                                    ${size === 'full' ? '' : 'max-h-[90vh] sm:max-h-[85vh]'}`} 
                                    // Apply max-h unless it's 'full' size
                        role="document" // The actual dialog content
                        aria-modal="true"
                        aria-labelledby={title ? "modal-title-text" : undefined} // Point to title if exists
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={modalVariants}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light dark:border-border-dark sticky top-0 bg-surface-light dark:bg-surface-dark z-10 flex-shrink-0">
                            {title && (
                                <h2 id="modal-title-text" className="text-lg font-semibold text-text-light dark:text-text-dark truncate pr-4">
                                    {title}
                                </h2>
                            )}
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-full text-text-muted-light dark:text-text-muted-dark 
                                           hover:bg-gray-200/80 dark:hover:bg-gray-700/80 
                                           hover:text-red-500 dark:hover:text-red-400 
                                           focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:ring-offset-1 dark:focus:ring-offset-surface-dark"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-5 py-4 overflow-y-auto flex-grow custom-scrollbar">
                            {children}
                        </div>

                        {/* Modal Footer */}
                        {footerContent && (
                            <div className="px-5 py-3.5 border-t border-border-light dark:border-border-dark flex justify-end gap-3 sticky bottom-0 bg-surface-light dark:bg-surface-dark z-10 flex-shrink-0">
                                {footerContent}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Modal;