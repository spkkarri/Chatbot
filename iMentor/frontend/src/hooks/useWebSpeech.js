// src/hooks/useWebSpeech.js
import { useState, useEffect, useCallback } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useWebSpeech = () => {
    const [transcript, setTranscript] = useState('');
    const [listening, setListening] = useState(false);
    const [recognitionInstance, setRecognitionInstance] = useState(null);
    const [error, setError] = useState(null); // Added error state
    const isSpeechSupported = !!SpeechRecognition;

    useEffect(() => {
        if (!isSpeechSupported) {
            console.warn("Web Speech API is not supported by this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Set to true if you want it to keep listening
        recognition.interimResults = false; // Set to true for live results
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const currentTranscript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            setTranscript(currentTranscript);
            setError(null); // Clear error on successful result
            // console.log("Voice input result:", currentTranscript);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            let errorMessage = event.error;
            if (event.error === 'no-speech') errorMessage = "No speech detected. Please try again.";
            else if (event.error === 'audio-capture') errorMessage = "Audio capture failed. Check microphone.";
            else if (event.error === 'not-allowed') errorMessage = "Microphone permission denied.";
            else if (event.error === 'network') errorMessage = "Network error during speech recognition.";
            // Add more specific error messages as needed
            
            setError(errorMessage);
            setListening(false);
        };

        recognition.onend = () => {
            setListening(false);
            // console.log("Speech recognition ended.");
        };
        
        setRecognitionInstance(recognition);

        // Cleanup
        return () => {
            if (recognition) {
                recognition.abort(); // Use abort to stop and discard results if component unmounts
            }
        };
    }, [isSpeechSupported]);

    const startListening = useCallback(() => {
        if (recognitionInstance && !listening) {
            try {
                setTranscript(''); // Clear previous transcript
                setError(null); // Clear previous errors
                recognitionInstance.start();
                setListening(true);
                // console.log("Speech recognition started.");
            } catch (e) {
                // This catch might be for synchronous errors during .start() call,
                // most errors are handled by recognition.onerror
                console.error("Error starting speech recognition:", e);
                setError("Could not start voice input.");
                setListening(false); // Ensure listening state is correct
            }
        }
    }, [recognitionInstance, listening]);

    const stopListening = useCallback(() => {
        if (recognitionInstance && listening) {
            recognitionInstance.stop(); // Stop and process any captured audio
            // setListening(false) will be called by onend event
            // console.log("Speech recognition stopped manually.");
        }
    }, [recognitionInstance, listening]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
    }, []);


    return {
        transcript,
        listening,
        isSpeechSupported,
        startListening,
        stopListening,
        resetTranscript,
        error // Expose error state
    };
};