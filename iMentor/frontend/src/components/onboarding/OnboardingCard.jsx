// frontend/src/components/onboarding/OnboardingCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import Button from '../core/Button';

const cardVariants = {
    enter: (direction) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0,
        scale: 0.95
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
        scale: 1
    },
    exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? 300 : -300,
        opacity: 0,
        scale: 0.95
    })
};

const OnboardingCard = ({
    icon: Icon, title, description, visual,
    isFinalStep, isFirstStep, onNext, onPrev, onSkip, onFinish
}) => {
    const [direction, setDirection] = React.useState(0);

    const handleNext = () => { setDirection(1); onNext(); };
    const handlePrev = () => { setDirection(-1); onPrev(); };

    return (
        <motion.div
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
            }}
            className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden"
        >
            <div className="text-center">
                <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-4">
                    <Icon className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">{title}</h2>
                <p className="mt-2 text-base text-text-muted-light dark:text-text-muted-dark max-w-md mx-auto">{description}</p>
            </div>

            <div className="my-8 h-32 flex items-center justify-center">
                <div className="w-48 h-full flex items-center justify-center text-center bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-lg">
                    {visual}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={onSkip} className="text-text-muted-light dark:text-text-muted-dark">
                    {isFinalStep ? "Go to App" : "Skip Tutorial"}
                </Button>
                <div className="flex items-center gap-2">
                    {!isFirstStep && (
                        <Button variant="outline" size="sm" onClick={handlePrev}>
                            Back
                        </Button>
                    )}
                    {isFinalStep ? (
                        <Button size="sm" onClick={onFinish}>
                            Start Learning!
                        </Button>
                    ) : (
                         <Button size="sm" onClick={handleNext}>
                            Next
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default OnboardingCard;