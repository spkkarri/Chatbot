// frontend/src/components/chat/ChatHistory.jsx

import React, { useRef, useEffect, useState } from 'react';
import MessageBubble from './MessageBubble';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownCircle } from 'lucide-react';

function ChatHistory({ messages, onCueClick }) {
    
    const scrollRef = useRef(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        if (!scrollRef.current) return;
        if (scrollHeight - scrollTop > clientHeight + 200) {
            setShowScrollButton(true);
        } else {
            setShowScrollButton(false);
        }
    };

    const scrollToBottom = (behavior = 'smooth') => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: behavior,
            });
        }
    };

    useEffect(() => {
        scrollToBottom('auto');
    }, [messages]);
    

    return (
        <div className="relative flex-1">
            <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto custom-scrollbar p-4 space-y-4">
                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <motion.div
                        key={msg.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            <MessageBubble
                                id={msg.id}
                                sender={msg.sender}
                                text={msg.text}
                                thinking={msg.thinking}
                                references={msg.references}
                                timestamp={msg.timestamp}
                                sourcePipeline={msg.source_pipeline}
                                isStreaming={msg.isStreaming}
                                criticalThinkingCues={msg.criticalThinkingCues}
                                onCueClick={onCueClick}
                                messageId={msg.id}
                                logId={msg.logId} 
                            />
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {showScrollButton && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        onClick={() => scrollToBottom('smooth')}
                        className="absolute bottom-5 right-5 z-20 p-2 bg-primary dark:bg-primary-dark text-white rounded-full shadow-lg hover:scale-110 transition-transform"
                        title="Scroll to bottom"
                    >
                        <ArrowDownCircle size={24} />
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

export default ChatHistory;