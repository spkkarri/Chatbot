// frontend/src/components/onboarding/OnboardingFlow.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, UploadCloud, MessagesSquare, BrainCircuit, Telescope, Wrench, GraduationCap, PartyPopper, Plus, Sparkles, ArrowRight
} from 'lucide-react';
import OnboardingCard from './OnboardingCard';
import OnboardingProgress from './OnboardingProgress';
import OnboardingVisual from './OnboardingVisual';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ONBOARDING_STEPS = [
    {
        icon: LayoutDashboard,
        title: "Welcome to Your AI Mentor!",
        description: "This quick tour will show you how to get the most out of iMentor. Let's explore your new personal learning assistant.",
        visual: <div className="text-6xl animate-bounce">👋</div>
    },
    {
        icon: UploadCloud,
        title: "Build Your Knowledge Base",
        description: "Start by uploading your own documents or pasting URLs. Your AI will use these as its primary source of truth for answering your questions.",
        visual: <OnboardingVisual icon={UploadCloud} label="Located in Left Panel" subLabel="Add Files & URLs" />
    },
    {
        icon: MessagesSquare,
        title: "Master the Conversation",
        description: "Use the '+' menu to enable Web Search for current events. Click the '✨' icon to ask the Prompt Coach for help asking better questions!",
        visual: (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                <p className="text-xs font-semibold mb-2">In the Chat Input Bar:</p>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                        <Plus className="w-8 h-8 text-primary p-1 bg-primary/10 rounded" />
                        <span className="text-xs mt-1">Options</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <Sparkles className="w-8 h-8 text-amber-500 p-1 bg-amber-500/10 rounded" />
                        <span className="text-xs mt-1">Coach</span>
                    </div>
                </div>
            </div>
        )
    },
    {
        icon: BrainCircuit,
        title: "Enable Critical Thinking Mode",
        description: "Click the '🧠' icon to activate a more advanced reasoning engine. The AI will think step-by-step and provide prompts to challenge its own answers.",
        visual: <OnboardingVisual icon={BrainCircuit} label="Located in Chat Input" subLabel="Click the Brain Icon" />
    },
    {
        icon: Telescope,
        title: "Analyze & Synthesize Content",
        description: "After selecting a source from your Knowledge Base, use the Right Panel to instantly generate FAQs, Mind Maps, and even full audio podcasts.",
        visual: (
             <div className="w-full h-full flex items-center justify-center p-2 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                <div className="flex items-center gap-2 text-center text-xs font-semibold text-text-muted-light dark:text-text-muted-dark">
                    <span>Select Source<br/>(Left Panel)</span>
                    <ArrowRight className="w-6 h-6 text-primary flex-shrink-0" />
                    <span>Run Analysis<br/>(Right Panel)</span>
                </div>
            </div>
        )
    },
    {
        icon: Wrench,
        title: "Explore the Toolbox",
        description: "Access powerful standalone utilities like the Secure Code Executor, AI Quiz Generator, and Academic Integrity Checker from the top navigation bar.",
        visual: <OnboardingVisual icon={Wrench} label="Located in Top Navigation" subLabel="Click the 'Tools' Button" />
    },
    {
        icon: GraduationCap,
        title: "Create Your Study Plan",
        description: "Based on your chats, iMentor can suggest personalized study plans. Visit the 'Study Plan' page to generate a step-by-step curriculum for any goal.",
        visual: <OnboardingVisual icon={GraduationCap} label="Located in Top Navigation" subLabel="Click the 'Study Plan' Button" />
    },
    {
        icon: PartyPopper,
        title: "You're All Set!",
        description: "You've mastered the basics. Now it's time to start your personalized learning journey. Let's begin!",
        visual: <div className="text-6xl animate-pulse">🚀</div>
    }
];

const OnboardingFlow = ({ onComplete }) => {
    const [step, setStep] = useState(0);

    const handleNext = () => setStep(prev => Math.min(prev + 1, ONBOARDING_STEPS.length - 1));
    const handlePrev = () => setStep(prev => Math.max(prev - 1, 0));
    
    const handleFinish = async () => {
        try {
            await api.completeOnboarding();
            toast.success("Welcome aboard!");
            onComplete();
        } catch (error) {
            toast.error("Could not save onboarding status, but you can proceed.");
            onComplete();
        }
    };
    
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') handleFinish();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const currentStepData = ONBOARDING_STEPS[step];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
        >
            <div className="w-full max-w-2xl">
                <OnboardingProgress current={step + 1} total={ONBOARDING_STEPS.length} />
                <AnimatePresence mode="wait">
                    <OnboardingCard
                        key={step}
                        icon={currentStepData.icon}
                        title={currentStepData.title}
                        description={currentStepData.description}
                        visual={currentStepData.visual}
                        isFinalStep={step === ONBOARDING_STEPS.length - 1}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        onSkip={handleFinish}
                        onFinish={handleFinish}
                        isFirstStep={step === 0}
                    />
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default OnboardingFlow;