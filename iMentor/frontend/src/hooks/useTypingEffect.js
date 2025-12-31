// frontend/src/hooks/useTypingEffect.js
import { useState, useEffect, useRef } from 'react';
import GraphemeSplitter from 'grapheme-splitter';

export const useTypingEffect = (textToType, speed = 20, onComplete) => {
    const [displayedText, setDisplayedText] = useState('');
    const onCompleteRef = useRef(onComplete);
    const animationFrameRef = useRef();

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        if (textToType) {
            const splitter = new GraphemeSplitter();
            const graphemes = splitter.splitGraphemes(textToType);
            let startTime = null;

            const animate = (timestamp) => {
                if (startTime === null) {
                    startTime = timestamp;
                }

                const elapsedTime = timestamp - startTime;
                const charactersToShow = Math.min(
                    Math.floor(elapsedTime / speed),
                    graphemes.length
                );

                setDisplayedText(graphemes.slice(0, charactersToShow).join(''));
                
                if (charactersToShow < graphemes.length) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                } else {
                    setDisplayedText(textToType); 
                    if (onCompleteRef.current) {
                        onCompleteRef.current();
                    }
                }
            };

            animationFrameRef.current = requestAnimationFrame(animate);

            return () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };
        } else {
            setDisplayedText('');
        }
    }, [textToType, speed]);

    return displayedText;
};