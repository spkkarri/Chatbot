// frontend/src/components/layout/RightCollapsedNav.jsx
import React from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { HelpCircle, GitFork, Tags, ChevronLeft } from 'lucide-react';
import IconButton from '../core/IconButton.jsx';
import { motion } from 'framer-motion';

const iconMap = {
    HelpCircle: HelpCircle,
    Tags: Tags,
    GitFork: GitFork,
};

function RightCollapsedNav({ isChatProcessing }) {
    const { setIsRightPanelOpen } = useAppState();

    const navItems = [
        { id: 'faq', label: 'FAQ Generator', iconName: 'HelpCircle', action: () => { setIsRightPanelOpen(true); /* TODO: set analysis type contextually */ } },
        { id: 'topics', label: 'Key Topics Extractor', iconName: 'Tags', action: () => { setIsRightPanelOpen(true); } },
        { id: 'mindmap', label: 'Mind Map Creator', iconName: 'GitFork', action: () => { setIsRightPanelOpen(true); } },
    ];

    return (
        <motion.aside
            key="right-collapsed-nav"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: '0%', opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`fixed right-0 top-16 bottom-0 z-30 w-14 sm:w-16 bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark shadow-lg flex-col items-center py-3 space-y-2 hidden md:flex
                       ${isChatProcessing ? 'processing-overlay' : ''}`}
        >
            {/* Open Panel Button AT THE TOP */}
            <IconButton 
                icon={ChevronLeft} 
                onClick={() => setIsRightPanelOpen(true)} 
                title="Open Analyzer Panel"
                ariaLabel="Open Analyzer Panel"
                variant="ghost" 
                size="lg"
                className="mb-2 text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                disabled={isChatProcessing}
            />
            {navItems.map(item => {
                 const Icon = iconMap[item.iconName] || HelpCircle;
                return (
                    <IconButton 
                        key={item.id}
                        icon={Icon}
                        onClick={item.action}
                        title={item.label}
                        ariaLabel={item.label}
                        variant="ghost"
                        size="md"
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                        disabled={isChatProcessing}
                    />
                );
            })}
        </motion.aside>
    );
}
export default RightCollapsedNav;