// frontend/src/components/tools/QuizGeneratorPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Loader2, AlertTriangle } from 'lucide-react';
import QuizSetup from './QuizSetup';
import QuizInProgress from './QuizInProgress';
import QuizResults from './QuizResults';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// --- NEW: Simulated stages for the loading UI ---
const GENERATION_STAGES = [
    { name: "Analyzing Document", duration: 2500, message: "Reading and understanding the structure of your document..." },
    { name: "Identifying Key Concepts", duration: 3000, message: "Extracting the most important topics and facts..." },
    { name: "Formulating Questions", duration: 4000, message: "Crafting questions based on the key concepts..." },
    { name: "Crafting Distractors", duration: 2000, message: "Creating plausible incorrect answers for each question..." },
    { name: "Finalizing Quiz", duration: 1500, message: "Assembling the final quiz..." }
];

const QuizGeneratorPage = () => {
    const [quizState, setQuizState] = useState('setup'); // 'setup', 'generating', 'in_progress', 'finished'
    const [quizData, setQuizData] = useState([]);
    const [userAnswers, setUserAnswers] = useState([]);
    const [error, setError] = useState('');

    // --- NEW: State for the progress simulation ---
    const [progress, setProgress] = useState(0);
    const [currentStageMessage, setCurrentStageMessage] = useState('');

    // --- NEW: Effect to run the progress simulation ---
    useEffect(() => {
        let timeoutId;
        if (quizState === 'generating') {
            let elapsed = 0;
            const totalDuration = GENERATION_STAGES.reduce((acc, stage) => acc + stage.duration, 0);

            const runStage = (stageIndex = 0) => {
                if (stageIndex >= GENERATION_STAGES.length) {
                    setProgress(100);
                    setCurrentStageMessage("Waiting for AI response...");
                    return;
                }
                const stage = GENERATION_STAGES[stageIndex];
                setCurrentStageMessage(stage.message);
                
                const updateProgress = setInterval(() => {
                    elapsed += 100;
                    setProgress(Math.min(99, Math.floor((elapsed / totalDuration) * 100)));
                }, 100);

                timeoutId = setTimeout(() => {
                    clearInterval(updateProgress);
                    runStage(stageIndex + 1);
                }, stage.duration);
            };
            runStage(0);
        }
        return () => clearTimeout(timeoutId);
    }, [quizState]);

    const handleGenerateQuiz = async (file, quizOption) => {
        if (!file) {
            toast.error("Please select a file to generate the quiz from.");
            return;
        }
        setQuizState('generating');
        setError('');
        try {
            const data = await api.generateQuiz(file, quizOption);
            if (!data.quiz || data.quiz.length === 0) {
                throw new Error("The AI was unable to generate a quiz from this document.");
            }
            setQuizData(data.quiz);
            setUserAnswers(new Array(data.quiz.length).fill(null));
            setQuizState('in_progress');
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message;
            setError(errorMessage);
            setQuizState('setup');
            toast.error(errorMessage);
        }
    };

    const handleQuizSubmit = (finalAnswers) => {
        setUserAnswers(finalAnswers);
        setQuizState('finished');
    };

    const handleRestart = () => {
        setQuizState('setup');
        setQuizData([]);
        setUserAnswers([]);
        setError('');
    };

    const renderContent = () => {
        switch (quizState) {
            case 'generating':
                return (
                    <div className="flex flex-col items-center justify-center text-center p-8 bg-surface-light dark:bg-surface-dark rounded-lg shadow-panel">
                        <h2 className="text-xl font-semibold mb-4">Generating Your Quiz...</h2>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 my-2 max-w-md">
                            <motion.div
                                className="bg-primary h-2.5 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, ease: 'linear' }}
                            />
                        </div>
                        <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-2 h-5 w-full">
                            {currentStageMessage || "Initializing..."}
                        </p>
                        {progress >= 99 && <Loader2 size={24} className="animate-spin text-primary my-4" />}
                    </div>
                );
            case 'in_progress':
                return <QuizInProgress quizData={quizData} onSubmit={handleQuizSubmit} />;
            case 'finished':
                return <QuizResults quizData={quizData} userAnswers={userAnswers} onRestart={handleRestart} />;
            case 'setup':
            default:
                return <QuizSetup onGenerate={handleGenerateQuiz} />;
        }
    };

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans">
            <header className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-16 flex items-center justify-between px-6 z-10">
                <h1 className="text-xl font-bold">AI Quiz Generator</h1>
                <Link to="/" className="flex items-center gap-2 text-sm btn btn-ghost">
                    <Home size={16} />
                    Back to Main App
                </Link>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="max-w-4xl mx-auto">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default QuizGeneratorPage;