// frontend/src/components/landing/FeaturesSection.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { 
    GraduationCap, BookOpen, BrainCircuit, Code, FileQuestion, Headphones
} from 'lucide-react';

const features = [
    {
        icon: GraduationCap,
        title: "Personalized Study Plans",
        description: "Describe your learning goals and get a custom, step-by-step curriculum with actionable modules designed to address your knowledge gaps.",
    },
    {
        icon: BookOpen,
        title: "Advanced Research Assistant",
        description: "Engage with academic papers, search the web for real-time information, and chat with your own documents and URLs as your primary knowledge base.",
    },
    {
        icon: BrainCircuit,
        title: "Deep Analysis & Visualization",
        description: "Automatically generate FAQs, key topic summaries, and mind maps from any document. Visualize concepts as interactive knowledge graphs.",
    },
    {
        icon: Code,
        title: "Secure Code Executor",
        description: "Write, run, and test code in multiple languages within a secure sandbox. Get AI-powered feedback, error explanations, and test case generation.",
    },
    {
        icon: FileQuestion,
        title: "AI-Powered Quiz Generator",
        description: "Upload any document (PDF, DOCX) and instantly generate a multiple-choice quiz to test your comprehension and prepare for exams.",
    },
    {
        icon: Headphones,
        title: "Content Creation Tools",
        description: "Transform your study materials into engaging content. Generate high-quality audio podcasts or export detailed analysis into DOCX and PPTX formats.",
    }
];

const FeatureCard = ({ icon: Icon, title, description, index }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="card-base p-6 text-center"
    >
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-lg mb-4">
            <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">{description}</p>
    </motion.div>
);

const FeaturesSection = () => {
    return (
        <section id="features" className="py-20 lg:py-28 bg-background-light dark:bg-slate-900">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold">A Smarter Way to Learn</h2>
                    <p className="mt-4 text-lg text-text-muted-light dark:text-text-muted-dark">
                        iMentor is more than a chatbot. It's an all-in-one platform with specialized tools built for the demands of higher education and technical fields.
                    </p>
                </div>
                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <FeatureCard key={feature.title} index={index} {...feature} />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;