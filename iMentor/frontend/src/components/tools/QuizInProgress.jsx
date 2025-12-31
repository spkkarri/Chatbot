// frontend/src/components/tools/QuizInProgress.jsx
import React, { useState, useEffect } from 'react';
import Button from '../core/Button';
import ConfirmationModal from '../core/ConfirmationModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const QuizInProgress = ({ quizData, onSubmit }) => {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState(new Array(quizData.length).fill(null));
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const currentQuestion = quizData[currentQuestionIndex];
    const totalQuestions = quizData.length;

    const handleSelectOption = (option) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestionIndex] = option;
        setAnswers(newAnswers);
    };

    const goToNext = () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        }
    };

    const goToPrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };
    
    const handleSubmit = () => {
        setIsConfirmModalOpen(true);
    };

    const handleConfirmSubmit = () => {
        // This is called when the user clicks "Confirm" in the modal
        onSubmit(answers);
        setIsConfirmModalOpen(false);
    };

    
    return (
        <>
            <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-lg shadow-panel border border-border-light dark:border-border-dark">
                <div className="mb-4">
                    <p className="text-sm font-semibold text-primary">Question {currentQuestionIndex + 1} of {totalQuestions}</p>
                    <h3 className="text-xl font-bold mt-1">{currentQuestion.question}</h3>
                </div>
                <div className="space-y-3 my-6">
                    {currentQuestion.options.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelectOption(option)}
                            className={`w-full text-left p-4 border rounded-lg transition-all duration-150 flex items-center
                                ${answers[currentQuestionIndex] === option
                                    ? 'bg-primary/20 border-primary ring-2 ring-primary'
                                    : 'bg-gray-50 dark:bg-gray-800 border-border-light dark:border-border-dark hover:bg-primary/10 hover:border-primary/50'
                                }`}
                        >
                            <span className="font-bold mr-3 text-primary">{(index + 10).toString(36).toUpperCase()}</span>
                            <span>{option}</span>
                        </button>
                    ))}
                </div>
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-light dark:border-border-dark">
                    <Button onClick={goToPrevious} disabled={currentQuestionIndex === 0} variant="outline" leftIcon={<ChevronLeft />}>
                        Previous
                    </Button>

                    {currentQuestionIndex === totalQuestions - 1 ? (
                        <Button onClick={handleSubmit} disabled={answers.some(a => a === null)}>
                            Submit Answers
                        </Button>
                    ) : (
                        <Button onClick={goToNext} disabled={currentQuestionIndex === totalQuestions - 1} rightIcon={<ChevronRight />}>
                            Next
                        </Button>
                    )}
                </div>
            </div>
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmSubmit}
                title="Submit Quiz"
                message="Are you sure you want to submit your answers? You won't be able to change them."
                confirmText="Submit"
                confirmVariant="primary"
            />
        </>
    );
};

export default QuizInProgress;