// frontend/src/components/chat/TypingIndicator.jsx
import React from 'react';

function TypingIndicator() {
  return (
    <div className="flex items-center justify-start w-full group">
      <div className="flex items-center space-x-1.5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-md px-4 py-3">
        <div className="w-2 h-2 bg-text-muted-light dark:bg-text-muted-dark rounded-full animate-pulseDot1"></div>
        <div className="w-2 h-2 bg-text-muted-light dark:bg-text-muted-dark rounded-full animate-pulseDot2"></div>
        <div className="w-2 h-2 bg-text-muted-light dark:bg-text-muted-dark rounded-full animate-pulseDot3"></div>
      </div>
    </div>
  );
}

export default TypingIndicator;