// frontend/src/components/landing/HowItWorksSection.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, MessagesSquare, BrainCircuit, GraduationCap } from 'lucide-react';

const steps = [
    {
        icon: UploadCloud,
        title: "1. Build Your Knowledge Base",
        description: "Upload your lecture notes, research papers, textbooks, or even YouTube URLs to create a personalized knowledge source."
    },
    {
        icon: MessagesSquare,
        title: "2. Interact & Analyze",
        description: "Chat with your documents, ask complex questions, and use advanced tools to generate summaries, mind maps, and FAQs."
    },
    {
        icon: BrainCircuit,
        title: "3. Generate & Create",
        description: "Transform your knowledge into practical assets. Create podcasts for auditory learning, presentations for review, or quizzes for self-assessment."
    },
    {
        icon: GraduationCap,
        title: "4. Plan Your Success",
        description: "Based on your interactions, iMentor suggests and helps you build personalized study plans to tackle your weakest areas and achieve your goals."
    }
];

const HowItWorksSection = () => {
    return (
        <section id="how-it-works" className="py-20 lg:py-28">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold">Get Started in Minutes</h2>
                    <p className="mt-4 text-lg text-text-muted-light dark:text-text-muted-dark">
                        Unlock a powerful new way to study and research with a simple, intuitive workflow.
                    </p>
                </div>
                <div className="relative mt-16">
                    <div className="absolute left-1/2 -translate-x-1/2 top-5 bottom-5 w-px bg-border-light dark:bg-border-dark hidden md:block"></div>
                    <div className="space-y-12">
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.title}
                                initial={{ opacity: 0, y: 50 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.5 }}
                                transition={{ duration: 0.5 }}
                                className={`flex flex-col md:flex-row items-center gap-8 ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                            >
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-2xl font-bold">{step.title}</h3>
                                    <p className="mt-2 text-text-muted-light dark:text-text-muted-dark">{step.description}</p>
                                </div>
                                <div className="relative flex-shrink-0">
                                    <div className="absolute -inset-2.5 bg-primary/20 blur-xl rounded-full"></div>
                                    <div className="relative w-20 h-20 bg-surface-light dark:bg-surface-dark border-2 border-primary rounded-full flex items-center justify-center">
                                        <step.icon className="w-10 h-10 text-primary" />
                                    </div>
                                </div>
                                <div className="flex-1 hidden md:block"></div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HowItWorksSection;