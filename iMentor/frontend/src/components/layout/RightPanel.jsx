// frontend/src/components/layout/RightPanel.jsx
import React, { useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import AnalysisToolRunner from '../analysis/AnalysisToolRunner.jsx';
import PodcastGenerator from '../analysis/PodcastGenerator.jsx';
import KnowledgeGraphViewer from '../analysis/KnowledgeGraphViewer.jsx';
import RealtimeKgPanel from '../analysis/RealtimeKgPanel.jsx';
import api from '../../services/api.js';
import { PanelRightClose, ChevronDown, ChevronUp, Telescope, Radio, BrainCircuit, Share2 } from 'lucide-react';
import IconButton from '../core/IconButton.jsx';
import Modal from '../core/Modal.jsx';
import Button from '../core/Button.jsx';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

function RightPanel({ isChatProcessing }) {
    const { setIsRightPanelOpen, selectedDocumentForAnalysis, selectedSubject } = useAppState();
    const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(true);
    
    // --- THIS IS THE NEW STATE FOR THE LIVE KG MODAL ---
    const [isLiveKgModalOpen, setIsLiveKgModalOpen] = useState(false);


    const currentSelectedDocFilename = selectedDocumentForAnalysis || selectedSubject || null;
    const isTargetAdminSubject = !!(selectedSubject && currentSelectedDocFilename && selectedSubject === currentSelectedDocFilename);

   

    return (
        <>
                <div className={`flex flex-col h-full p-3 sm:p-4 bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark custom-scrollbar ${isChatProcessing ? 'processing-overlay' : ''}`}>                <div className="flex items-center justify-between pb-2 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-base font-semibold">Advanced Tools</h2>
                    <IconButton
                        icon={PanelRightClose}
                        onClick={() => setIsRightPanelOpen(false)}
                        title="Close Panel"
                        variant="ghost" size="sm"
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                    />
                </div>
                
                <div className="flex-grow space-y-4 overflow-y-auto custom-scrollbar pr-1 pt-4">
                    {/* --- THIS IS THE NEW BUTTON TO LAUNCH THE MODAL --- */}
                    <div className="card-base p-3">
                         <div className="flex items-center gap-2 text-sm font-medium mb-2">
                            <Share2 size={16} className="text-primary dark:text-primary-light" />
                            <span>Live Concept Map</span>
                        </div>
                        <p className="text-xs text-text-muted-light dark:text-text-muted-dark mb-3">
                            Visualize concepts from your current conversation in real-time.
                        </p>
                        <Button onClick={() => setIsLiveKgModalOpen(true)} variant="primary" size="sm" fullWidth leftIcon={<Share2 size={16} />}>
                            Show Live Map
                        </Button>
                    </div>

                    {/* --- EXISTING STATIC ANALYSIS TOOLS (Conditional) --- */}
                    {currentSelectedDocFilename ? (
                        <>
                            <div>
                                <button onClick={() => setIsAnalyzerOpen(!isAnalyzerOpen)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none shadow-sm border border-border-light dark:border-border-dark">
                                    <span className="flex items-center gap-2"><Telescope size={16} /> Document Analysis</span>
                                    {isAnalyzerOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                {isAnalyzerOpen && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="mt-2 space-y-3 overflow-hidden">
                                        <AnalysisToolRunner toolType="faq" title="FAQ Generator" iconName="HelpCircle" selectedDocumentFilename={currentSelectedDocFilename} isTargetAdminDoc={isTargetAdminSubject} />
                                        <AnalysisToolRunner toolType="topics" title="Key Topics Extractor" iconName="Tags" selectedDocumentFilename={currentSelectedDocFilename} isTargetAdminDoc={isTargetAdminSubject} />
                                        <AnalysisToolRunner toolType="mindmap" title="Mind Map Creator" iconName="GitFork" selectedDocumentFilename={currentSelectedDocFilename} isTargetAdminDoc={isTargetAdminSubject} />
                                    </motion.div>
                                )}
                            </div>
                            <div>
                                <div className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left bg-gray-50 dark:bg-gray-800 rounded-md border border-border-light dark:border-border-dark">
                                   <span className="flex items-center gap-2"><Radio size={16} /> Content Exporters</span>
                                </div>
                                 <div className="mt-2 space-y-3">
                                    <PodcastGenerator selectedDocumentFilename={currentSelectedDocFilename} />
                                    
                                </div>
                            </div>
                        </>
                    ) : (
                         <div className="p-4 mt-4 text-xs text-center text-text-muted-light dark:text-text-muted-dark bg-gray-50 dark:bg-gray-800 rounded-md border border-dashed border-border-light dark:border-border-dark">
                            <p>Select a document from the left panel to enable static analysis tools.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODAL FOR THE LIVE KG --- */}
            <Modal isOpen={isLiveKgModalOpen} onClose={() => setIsLiveKgModalOpen(false)} title="Live Concept Map (From Conversation)" size="5xl">
                <div className="h-[70vh]">
                   <RealtimeKgPanel />
                </div>
            </Modal>
        </>
    );
}
export default RightPanel; 