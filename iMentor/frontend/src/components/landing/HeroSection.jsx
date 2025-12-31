// frontend/src/components/landing/HeroSection.jsx
import React from 'react';
import Button from '../core/Button';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const HeroSection = ({ onLoginClick }) => {
    return (
        <section id="home" className="relative pt-32 pb-20 lg:pt-48 lg:pb-28 overflow-hidden">
            <div className="absolute inset-0 -z-10 bg-grid-slate-300/[0.2] dark:bg-grid-slate-700/[0.2] [mask-image:linear-gradient(to_bottom,white_40%,transparent_100%)]"></div>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight text-text-light dark:text-text-dark">
                        Your Personal AI Mentor for
                        <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mt-2">
                            Higher Education
                        </span>
                    </h1>
                    <p className="mt-6 max-w-2xl mx-auto text-lg text-text-muted-light dark:text-text-muted-dark">
                        Go beyond simple answers. Generate study plans, analyze research, practice coding, and get personalized feedback on any subject.
                    </p>
                    <div className="mt-8 flex justify-center items-center gap-4">
                        <Button size="lg" onClick={() => onLoginClick(false)} rightIcon={<ArrowRight size={18} />}>
                            Get Started for Free
                        </Button>
                        <a href="#features">
                            <Button size="lg" variant="outline">
                                Explore Features
                            </Button>
                        </a>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default HeroSection;