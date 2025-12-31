// frontend/src/components/layout/LeftCollapsedNav.jsx
import React from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { Edit3, UploadCloud, FileText, ChevronRight, Settings2 } from 'lucide-react'; // Settings2 for fallback
import IconButton from '../core/IconButton.jsx'; 
import { motion } from 'framer-motion';

// Mapping icon names (or IDs) to Lucide components
const iconMap = {
    prompt: Edit3,       // Icon for "Custom Prompt"
    upload: UploadCloud, // Icon for "Upload Document"
    docs: FileText,      // Icon for "Document List"
};

function LeftCollapsedNav({ isChatProcessing }) {
    const { setIsLeftPanelOpen } = useAppState();

    // Define the items for the collapsed navigation bar
    const navItems = [
        { 
            id: 'prompt', 
            label: 'Custom Prompt', 
            iconName: 'prompt', // Matches key in iconMap
            action: () => { 
                setIsLeftPanelOpen(true); 
                // TODO: Optionally, also scroll to/focus the prompt section in LeftPanel
            } 
        },
        { 
            id: 'upload', 
            label: 'Upload Document', 
            iconName: 'upload', 
            action: () => { 
                setIsLeftPanelOpen(true);
                // TODO: Optionally, open LeftPanel and focus/highlight upload area
            } 
        },
        { 
            id: 'docs', 
            label: 'Document List', 
            iconName: 'docs', 
            action: () => { 
                setIsLeftPanelOpen(true); 
                // TODO: Optionally, open LeftPanel scrolled to document list
            } 
        },
    ];

    return (
        <motion.aside
            key="left-collapsed-nav" // Unique key for AnimatePresence
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: '0%', opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            // Styling for the thin vertical bar
            className={`fixed left-0 top-16 bottom-0 z-30 w-14 sm:w-16 
                       bg-surface-light dark:bg-surface-dark 
                       border-r border-border-light dark:border-border-dark 
                       shadow-lg flex flex-col items-center py-3 space-y-2 custom-scrollbar
                       ${isChatProcessing ? 'processing-overlay' : ''}`}
        >
            {/* Button to open the full LeftPanel - Placed at the top */}
            <IconButton 
                icon={ChevronRight} 
                onClick={() => setIsLeftPanelOpen(true)} 
                title="Open Assistant Panel"
                ariaLabel="Open Assistant Panel"
                variant="ghost" 
                size="lg" // Make it prominent
                className="mb-2 text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                disabled={isChatProcessing}
            />

            {/* Icons for different sections of LeftPanel */}
            {navItems.map(item => {
                const IconComponent = iconMap[item.iconName] || Settings2; // Fallback icon
                return (
                    <IconButton 
                        key={item.id}
                        icon={IconComponent}
                        onClick={item.action} // Action currently just opens the panel
                        title={item.label}
                        ariaLabel={item.label}
                        variant="ghost"
                        size="md" 
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                        disabled={isChatProcessing}
                    />
                );
            })}
            {/* Add a flexible spacer if you want the open button pushed further down from items */}
            {/* <div className="flex-grow"></div> */}
        </motion.aside>
    );
}
export default LeftCollapsedNav;