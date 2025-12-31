// frontend/src/components/landing/AudienceSection.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const studentsBenefits = [
    "Personalized 24/7 AI tutor for any subject.",
    "Generate quizzes from lecture notes for exam prep.",
    "Practice coding with AI-powered feedback.",
    "Turn dense papers into easy-to-understand podcasts.",
];

const educatorsBenefits = [
    "Provide curated 'Subject' materials for your class.",
    "Monitor student engagement through chat summaries.",
    "Analyze common questions and content gaps.",
    "Promote academic integrity with built-in tools.",
];

const AudienceCard = ({ title, benefits, color }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
        className="card-base p-8 h-full"
    >
        <h3 className={`text-2xl font-bold mb-6 text-${color}-500 dark:text-${color}-400`}>{title}</h3>
        <ul className="space-y-4">
            {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                    <Check className={`flex-shrink-0 w-5 h-5 mt-1 text-${color}-500 dark:text-${color}-400`} />
                    <span className="text-text-light dark:text-text-dark">{benefit}</span>
                </li>
            ))}
        </ul>
    </motion.div>
);

const AudienceSection = () => {
    return (
        <section id="for-whom" className="py-20 lg:py-28 bg-background-light dark:bg-slate-900">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl font-extrabold">Built for the Academic Community</h2>
                    <p className="mt-4 text-lg text-text-muted-light dark:text-text-muted-dark">
                        Whether you're a student striving for excellence or an educator fostering it, iMentor has tools for you.
                    </p>
                </div>
                <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <AudienceCard title="For Students" benefits={studentsBenefits} color="primary" />
                    <AudienceCard title="For Educators" benefits={educatorsBenefits} color="accent" />
                </div>
            </div>
        </section>
    );
};

export default AudienceSection;