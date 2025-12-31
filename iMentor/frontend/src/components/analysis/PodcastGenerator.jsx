// frontend/src/components/analysis/PodcastGenerator.jsx
import React, { useState } from 'react';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import { Headphones, ChevronDown, ChevronUp } from 'lucide-react';
import Button from '../core/Button.jsx';
import { motion, AnimatePresence } from 'framer-motion';

function PodcastGenerator({ selectedDocumentFilename }) {
    const [isSectionOpen, setIsSectionOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [podcastPurpose, setPodcastPurpose] = useState('review');
    const [podcastLength, setPodcastLength] = useState('standard');

    const handleGeneratePodcast = async () => {
        if (!selectedDocumentFilename) {
            toast.error("Please select a document first.");
            return;
        }
        setIsLoading(true);
        const toastId = toast.loading("Generating high-quality podcast script & audio. This may take a moment...");
        try {
            const { audioBlob, sourceDocumentName } = await api.generatePodcast({
                analysisContent: `A study session on: ${selectedDocumentFilename}`,
                sourceDocumentName: selectedDocumentFilename,
                podcastOptions: { studyPurpose: podcastPurpose, sessionLength: podcastLength }
            });
            
            toast.success("High-Quality Podcast is ready for download!", { id: toastId, duration: 5000 });

            const url = window.URL.createObjectURL(audioBlob);
            const link = document.createElement('a');
            const safeFilename = sourceDocumentName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
            link.href = url;
            link.setAttribute('download', `AI_Podcast_${safeFilename}.mp3`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || "Failed to generate podcast.";
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="card-base p-3">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsSectionOpen(!isSectionOpen)}>
                <div className="flex items-center gap-2 text-sm font-medium text-text-light dark:text-text-dark">
                    <Headphones size={16} className="text-accent" />
                    <span className="flex-grow">HQ Podcast Generator</span>
                </div>
                {isSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
            <AnimatePresence>
                {isSectionOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="mt-2 pt-2 border-t border-border-light dark:border-border-dark overflow-hidden">
                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-3">
                            Generate a high-quality, conversational audio study session from the selected document.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2 mb-3">
                            <div className="flex-1">
                                <label htmlFor="podcast-purpose" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Purpose</label>
                                <select id="podcast-purpose" value={podcastPurpose} onChange={(e) => setPodcastPurpose(e.target.value)} className="input-field !text-xs !py-1.5 !px-2 w-full" disabled={isLoading}>
                                    <option value="review">General Review</option>
                                    <option value="introduction">Introduction</option>
                                    <option value="exam_prep">Exam Prep</option>
                                    <option value="deep_dive">Deep Dive</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="podcast-length" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Length</label>
                                <select id="podcast-length" value={podcastLength} onChange={(e) => setPodcastLength(e.target.value)} className="input-field !text-xs !py-1.5 !px-2 w-full" disabled={isLoading}>
                                    <option value="quick">Quick (~5-7m)</option>
                                    <option value="standard">Standard (~10-15m)</option>
                                    <option value="comprehensive">Comprehensive (~15-25m)</option>
                                </select>
                            </div>
                        </div>
                        <Button
                            onClick={handleGeneratePodcast}
                            variant="primary"
                            size="sm"
                            fullWidth
                            isLoading={isLoading}
                            disabled={!selectedDocumentFilename || isLoading}
                            title={!selectedDocumentFilename ? "Select a document first" : "Generate Podcast"}
                        >
                           {isLoading ? 'Generating Audio...' : 'Generate High-Quality Podcast'}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default PodcastGenerator;
// This code defines a React component for generating podcasts from selected documents.
