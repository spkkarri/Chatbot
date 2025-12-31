// frontend/src/components/tools/QuizResults.jsx
import React, { useMemo } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import Button from '../core/Button';

const QuizResults = ({ quizData, userAnswers, onRestart }) => {
    const score = useMemo(() => {
        return userAnswers.reduce((acc, answer, index) => {
            return acc + (answer === quizData[index].correctAnswer ? 1 : 0);
        }, 0);
    }, [quizData, userAnswers]);

    const totalQuestions = quizData.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-lg shadow-panel border border-border-light dark:border-border-dark">
            <h2 className="text-2xl font-bold text-center mb-2">Quiz Results</h2>
            <div className="text-center p-6 bg-primary/10 rounded-lg mb-6">
                <p className="text-lg">You Scored</p>
                <p className="text-6xl font-bold my-2 text-primary">{percentage}%</p>
                <p className="text-text-muted-light dark:text-text-muted-dark">{score} out of {totalQuestions} correct</p>
            </div>
            
            <h3 className="text-xl font-semibold mb-4">Review Your Answers</h3>
            <div className="space-y-4">
                {quizData.map((questionData, index) => {
                    const userAnswer = userAnswers[index];
                    const isCorrect = userAnswer === questionData.correctAnswer;
                    
                    return (
                        <div key={index} className={`p-4 border rounded-lg ${isCorrect ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1">
                                    {isCorrect ? <CheckCircle className="text-green-500" /> : <XCircle className="text-red-500" />}
                                </div>
                                <div>
                                    <p className="font-semibold">{index + 1}. {questionData.question}</p>
                                    <p className={`text-sm mt-2 ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                        Your answer: <span className="font-semibold">{userAnswer}</span>
                                    </p>
                                    {!isCorrect && (
                                        <p className="text-sm mt-1 text-green-700 dark:text-green-400">
                                            Correct answer: <span className="font-semibold">{questionData.correctAnswer}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 text-center">
                <Button onClick={onRestart} variant="outline" leftIcon={<RefreshCw />}>
                    Create a New Quiz
                </Button>
            </div>
        </div>
    );
};

export default QuizResults;