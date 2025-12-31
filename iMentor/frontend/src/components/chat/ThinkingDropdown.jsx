// frontend/src/components/chat/ThinkingDropdown.jsx
import React from 'react';
import { ChevronDown, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';

function ThinkingDropdown({ children, isOpen, setIsOpen, isStreaming }) {
    return (
        <div className="w-full">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors py-1 group"
                aria-expanded={isOpen}
            >
                <BrainCircuit size={14} className="text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />

                {/* --- THIS SPAN IS THE ONLY CHANGE --- */}
                <span className={isStreaming ? 'shimmer-container' : ''}>
                    Thinking Process
                </span>

                <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>


            {/* ✅ Always render motion.div, but animate visibility */}
            <motion.div
                animate={isOpen ? 'open' : 'collapsed'}
                variants={{
                    open: { opacity: 1, height: 'auto', marginTop: '0.25rem' },
                    collapsed: { opacity: 0, height: 0, marginTop: '0' }
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
            >
                <div className="pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                    {children}
                </div>
            </motion.div>
        </div>
    );
}

export default ThinkingDropdown;
