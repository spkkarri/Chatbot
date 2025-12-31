import React, { createContext, useState, useContext, useEffect } from 'react';

export const AppStateContext = createContext(null);

export const useAppState = () => {
    const context = useContext(AppStateContext);
    if (!context) throw new Error('useAppState must be used within an AppStateProvider');
    return context;
};

const defaultSystemPromptText = "You are a friendly, patient, and encouraging tutor specializing in engineering and scientific topics for PhD students. Explain concepts clearly, break down complex ideas, use analogies, and offer positive reinforcement. Ask follow-up questions to ensure understanding.";

export const AppStateProvider = ({ children }) => {
    const [theme, setThemeState] = useState(() => {
        const storedTheme = localStorage.getItem('theme') || 'dark';
        if (typeof window !== 'undefined') {
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(storedTheme);
        }
        return storedTheme;
    });

    const [selectedLLM, setSelectedLLM] = useState(localStorage.getItem('selectedLLM') || 'gemini');
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

    const [currentSessionId, setCurrentSessionIdState] = useState(() => {
        return localStorage.getItem('aiTutorSessionId') || null;
    });
    const [systemPrompt, setSystemPromptState] = useState(
        localStorage.getItem('aiTutorSystemPrompt') || defaultSystemPromptText
    );

    const [selectedDocumentForAnalysis, setSelectedDocumentForAnalysisState] = useState(null);
    const [selectedSubject, setSelectedSubjectState] = useState(
        localStorage.getItem('aiTutorSelectedSubject') || null
    );

    const [isAdminSessionActive, setIsAdminSessionActiveState] = useState(() => {
        return sessionStorage.getItem('isAdminSessionActive') === 'true';
    });

    const [initialPromptForNewSession, setInitialPromptForNewSession] = useState(null);
    const [initialActivityForNewSession, setInitialActivityForNewSession] = useState(null);

    const toggleTheme = () => {
        setThemeState(prevTheme => {
            const newTheme = prevTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newTheme);
            return newTheme;
        });
    };

    const switchLLM = (llm) => {
         setSelectedLLM(llm);
         localStorage.setItem('selectedLLM', llm);
         console.log("AppStateContext: Switched LLM to:", llm);
    };

    const setSessionId = (sessionId) => {
        if (sessionId) {
            localStorage.setItem('aiTutorSessionId', sessionId);
        } else {
            console.log("AppStateContext: Clearing session and related context (logout).");
            localStorage.removeItem('aiTutorSessionId');
            
            localStorage.removeItem('aiTutorSelectedSubject'); 
            setSelectedSubjectState(null);
            
            setSelectedDocumentForAnalysisState(null);
        }
        setCurrentSessionIdState(sessionId);
        console.log("AppStateContext: Regular user session ID updated to:", sessionId);
    };

    const setSystemPrompt = (promptText) => {
        setSystemPromptState(promptText);
        localStorage.setItem('aiTutorSystemPrompt', promptText);
    };

    const selectDocumentForAnalysis = (documentFilename) => {
        setSelectedDocumentForAnalysisState(documentFilename);
        console.log("AppStateContext: Document for analysis tools set to:", documentFilename || "None");
        if (documentFilename && selectedSubject !== documentFilename) {
            if (selectedSubject !== null) {
                console.log("AppStateContext: Clearing selected subject because a specific user document was chosen for analysis tools.");
                setSelectedSubjectState(null);
                localStorage.removeItem('aiTutorSelectedSubject');
            }
        }
    };

    const setSelectedSubject = (subjectName) => {
        const newSubject = subjectName === "none" || !subjectName ? null : subjectName;
        if (newSubject) {
            localStorage.setItem('aiTutorSelectedSubject', newSubject);
        } else {
            localStorage.removeItem('aiTutorSelectedSubject');
        }
        setSelectedSubjectState(newSubject);
        console.log("AppStateContext: Selected subject (for chat RAG) updated to:", newSubject || "None");

        setSelectedDocumentForAnalysisState(newSubject);
        if (newSubject) {
             console.log("AppStateContext: Also set document for analysis tools to (admin subject):", newSubject);
        } else {
            if (selectedDocumentForAnalysis === subjectName) {
                 setSelectedDocumentForAnalysisState(null);
                 console.log("AppStateContext: Cleared document for analysis tools as linked subject was cleared.");
            }
        }
    };

    const setIsAdminSessionActive = (isActive) => {
        if (isActive) {
            sessionStorage.setItem('isAdminSessionActive', 'true');
            setSessionId(null); 
        } else {
            sessionStorage.removeItem('isAdminSessionActive');
        }
        setIsAdminSessionActiveState(isActive);
        console.log("AppStateContext: Admin session active status set to:", isActive);
    };

    useEffect(() => {
        const rootHtmlElement = document.documentElement;
        rootHtmlElement.classList.remove('light', 'dark');
        rootHtmlElement.classList.add(theme);
        document.body.className = '';
        document.body.classList.add(theme === 'dark' ? 'bg-background-dark' : 'bg-background-light');
    }, [theme]);

    return (
        <AppStateContext.Provider value={{
            theme, toggleTheme,
            selectedLLM, switchLLM,
            isLeftPanelOpen, setIsLeftPanelOpen,
            isRightPanelOpen, setIsRightPanelOpen,
            currentSessionId, setSessionId,
            systemPrompt, setSystemPrompt,
            selectedDocumentForAnalysis, selectDocumentForAnalysis,
            selectedSubject, setSelectedSubject,
            isAdminSessionActive, setIsAdminSessionActive,
            initialPromptForNewSession, setInitialPromptForNewSession,
            initialActivityForNewSession, setInitialActivityForNewSession
        }}>
            {children}
        </AppStateContext.Provider>
    );

};