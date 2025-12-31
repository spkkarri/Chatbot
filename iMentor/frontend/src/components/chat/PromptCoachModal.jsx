// frontend/src/components/chat/PromptCoachModal.jsx
import React from 'react';
import Modal from '../core/Modal';
import Button from '../core/Button';
import { Sparkles, Check } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// This function will safely render the Markdown explanation from the AI
const createMarkup = (markdownText) => {
    if (!markdownText) return { __html: '' };
    const rawHtml = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
    return { __html: cleanHtml };
};

const PromptCoachModal = ({ isOpen, onClose, onApply, data }) => {
    if (!isOpen || !data) return null;

    const { original, improved, explanation } = data;

    const handleApply = () => {
        onApply(improved);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Prompt Coach Suggestion"
            size="xl"
            footerContent={
                <>
                    <Button variant="secondary" onClick={onClose}>Keep Original</Button>
                    <Button onClick={handleApply} leftIcon={<Check size={16} />}>Use Suggestion</Button>
                </>
            }
        >
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark">Your Original Prompt</label>
                        <p className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-sm italic">
                            "{original}"
                        </p>
                    </div>
                    
                    <div>
                        <label className="text-sm font-semibold text-primary dark:text-primary-light flex items-center gap-1.5">
                            <Sparkles size={16} />
                            Suggested Improvement
                        </label>
                        <p className="mt-1 p-3 bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-md text-sm font-medium">
                            "{improved}"
                        </p>
                    </div>
                    
                    <div>
                        <label className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark">Reasoning</label>
                        <div
                            className="prose prose-sm dark:prose-invert max-w-none mt-1 text-text-light dark:text-text-dark text-sm"
                            dangerouslySetInnerHTML={createMarkup(explanation)}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default PromptCoachModal;