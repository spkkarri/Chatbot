// src/hooks/useTextToSpeech.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked'; // To parse markdown for plain text

// Configure marked (if not already globally configured for this specific use)
// It's generally better if marked is configured once, e.g. in MessageBubble or a central place.
// Assuming marked is available and configured.

const getPlainTextFromMarkdown = (markdown) => {
  if (!markdown) return '';
  try {
    // A simpler approach for plain text extraction for TTS:
    // Render to a temporary element and get its text content.
    // This handles complex markdown structures reasonably well for speech.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = marked.parse(markdown); // marked.parse() is synchronous
    let text = tempDiv.textContent || tempDiv.innerText || '';
    
    // Basic cleanup: remove excessive newlines/spaces that might make speech awkward
    text = text.replace(/\n+/g, ' '); // Replace newlines with spaces
    text = text.replace(/\s\s+/g, ' '); // Replace multiple spaces with single
    return text.trim();
  } catch (error) {
    console.error("Error parsing markdown for TTS:", error);
    return markdown; // Fallback to raw markdown if parsing fails
  }
};


export const useTextToSpeech = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const utteranceRef = useRef(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            setIsSupported(true);
        }

        const handleEnd = () => {
            setIsSpeaking(false);
            utteranceRef.current = null;
        };
        
        const synth = window.speechSynthesis;
        if (synth) {
            // Add event listeners if needed, but onend on utterance is usually sufficient
        }

        return () => {
            if (synth) {
                synth.cancel(); // Cancel any speech on component unmount or hook cleanup
            }
        };
    }, []);

    const speak = useCallback(({ text, lang = 'en-US', voiceURI = null, rate = 1, pitch = 1, volume = 1 }) => {
        if (!isSupported || !text) return;

        const synth = window.speechSynthesis;
        if (synth.speaking) {
            synth.cancel(); // Stop any currently playing speech
        }
        
        const plainText = getPlainTextFromMarkdown(text);
        if (!plainText) {
            console.warn("TTS: No text content to speak after parsing markdown.");
            return;
        }

        const newUtterance = new SpeechSynthesisUtterance(plainText);
        newUtterance.lang = lang;
        newUtterance.rate = rate;
        newUtterance.pitch = pitch;
        newUtterance.volume = volume;

        if (voiceURI) {
            const voices = synth.getVoices();
            const selectedVoice = voices.find(voice => voice.voiceURI === voiceURI);
            if (selectedVoice) {
                newUtterance.voice = selectedVoice;
            }
        }
        
        newUtterance.onstart = () => {
            setIsSpeaking(true);
        };
        newUtterance.onend = () => {
            setIsSpeaking(false);
            utteranceRef.current = null;
        };
        newUtterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
            setIsSpeaking(false);
            utteranceRef.current = null;
        };

        utteranceRef.current = newUtterance;
        synth.speak(newUtterance);
    }, [isSupported]);

    const cancel = useCallback(() => {
        if (!isSupported) return;
        const synth = window.speechSynthesis;
        if (synth.speaking) {
            synth.cancel();
        }
        // onend should fire and set isSpeaking to false.
        // If it doesn't (e.g. cancel is abrupt), manually reset:
        if (isSpeaking) {
            setIsSpeaking(false);
            utteranceRef.current = null;
        }
    }, [isSupported, isSpeaking]);

    // Optional: Get available voices
    const getVoices = useCallback(() => {
        if (!isSupported) return [];
        return window.speechSynthesis.getVoices();
    }, [isSupported]);

    // Voices might load asynchronously. Listen for 'voiceschanged' event.
    useEffect(() => {
        if (!isSupported) return;
        const synth = window.speechSynthesis;
        const loadVoices = () => {
            // You might want to store voices in state if your UI allows voice selection
            // console.log("Voices loaded:", synth.getVoices());
        };
        synth.addEventListener('voiceschanged', loadVoices);
        // Initial load if voices are already available
        if (synth.getVoices().length > 0) {
            loadVoices();
        }
        return () => synth.removeEventListener('voiceschanged', loadVoices);
    }, [isSupported]);


    return {
        speak,
        cancel,
        isSpeaking,
        isSupported,
        getVoices,
        currentlySpeakingUtterance: utteranceRef.current
    };
};