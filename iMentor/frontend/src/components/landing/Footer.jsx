// frontend/src/components/landing/Footer.jsx
import React from 'react';
import { Server, Twitter, Github, Linkedin } from 'lucide-react';

const Footer = () => {
    return (
        <footer className="bg-surface-light dark:bg-slate-900 border-t border-border-light dark:border-border-dark">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2 text-xl font-bold text-text-light dark:text-text-dark">
                        <Server className="text-primary" />
                        <span>iMentor</span>
                    </div>
                    <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                        © {new Date().getFullYear()} iMentor. All Rights Reserved.
                    </p>
                    <div className="flex items-center space-x-4">
                        <a href="#" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary transition-colors"><Twitter size={20} /></a>
                        <a href="#" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary transition-colors"><Github size={20} /></a>
                        <a href="#" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary transition-colors"><Linkedin size={20} /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;