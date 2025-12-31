import React, { useState, useEffect, useRef, useCallback } from 'react';
import ThinkingDropdown from './ThinkingDropdown';
import TypingIndicator from './TypingIndicator';
import { useTypingEffect } from '../../hooks/useTypingEffect';

function StreamingResponse({ streamingResponse }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [thoughtChunks, setThoughtChunks] = useState([]);       
  const [queuedChunks, setQueuedChunks] = useState([]);         
  const [currentTyping, setCurrentTyping] = useState('');       
  const isTyping = useRef(false);                               
  const lastProcessed = useRef('');                             

  // 🔓 Open dropdown when thinking begins
  useEffect(() => {
    if (streamingResponse?.thinking && !isDropdownOpen) {
      setIsDropdownOpen(true);
    }
  }, [streamingResponse?.thinking, isDropdownOpen]);

  // 🧠 Queue new streamed chunks (append-only)
  useEffect(() => {
    const fullText = streamingResponse?.thinking || '';
    if (!fullText || fullText === lastProcessed.current) return;

    const allChunks = fullText.split('\n\n').filter(Boolean);
    const newChunks = allChunks.slice(thoughtChunks.length + queuedChunks.length);
    if (newChunks.length > 0) {
      setQueuedChunks(prev => [...prev, ...newChunks]);
    }

    lastProcessed.current = fullText;
  }, [streamingResponse?.thinking, thoughtChunks.length, queuedChunks.length]);

  // ✅ Start next typing only when current finishes
  const handleTypingComplete = useCallback(() => {
  if (currentTyping.trim()) {
    setThoughtChunks(prev => [...prev, currentTyping.trim()]);
  }
  setCurrentTyping('');
  isTyping.current = false;

  // ✅ Immediately start next typing
  if (queuedChunks.length > 0) {
    const next = queuedChunks[0];
    isTyping.current = true;
    setCurrentTyping(next);
    setQueuedChunks(prev => prev.slice(1));
  }
}, [currentTyping, queuedChunks]);


  // 🔁 Initial trigger when first chunk is available
  useEffect(() => {
    if (!isTyping.current && currentTyping === '' && queuedChunks.length > 0) {
      const next = queuedChunks[0];
      isTyping.current = true;
      setCurrentTyping(next);
      setQueuedChunks(prev => prev.slice(1));
    }
  }, [queuedChunks, currentTyping]);

  const animatedCurrentChunk = useTypingEffect(currentTyping, 4, handleTypingComplete);

  const { isThinkingStreaming } = streamingResponse || {};
  const showThinking = thoughtChunks.length > 0 || currentTyping || isThinkingStreaming;

  return (
    <div className="flex flex-col items-start w-full group space-y-1.5">
      {showThinking && (
        <div className="max-w-[85%] md:max-w-[75%] w-full">
          <ThinkingDropdown
            isOpen={isDropdownOpen}
            setIsOpen={setIsDropdownOpen}
            isStreaming={isThinkingStreaming}
          >
            <pre className="text-xs text-text-muted-light dark:text-text-muted-dark whitespace-pre-wrap font-sans leading-relaxed">
              {[...thoughtChunks, animatedCurrentChunk].filter(Boolean).join('\n\n')}
              {(!animatedCurrentChunk && isThinkingStreaming) && (
                <span className="animate-pulse"> Thinking...</span>
              )}
            </pre>
          </ThinkingDropdown>
        </div>
      )}
      <TypingIndicator />
    </div>
  );
}

export default StreamingResponse;
