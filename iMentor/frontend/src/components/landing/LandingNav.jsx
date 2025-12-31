// frontend/src/components/landing/LandingNav.jsx
import React, { useState } from 'react';
import { Server, Menu, X } from 'lucide-react';
import Button from '../core/Button';
import { motion, AnimatePresence } from 'framer-motion';

const LandingNav = ({ onLoginClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navItems = ["Features", "How It Works", "For Whom"];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-lg border-b border-border-light dark:border-border-dark">
            <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <a href="#home" className="flex items-center gap-2 text-xl font-bold text-text-light dark:text-text-dark">
                        <Server className="text-primary" />
                        <span>iMentor</span>
                    </a>
                    <div className="hidden md:flex items-center space-x-8">
                        {navItems.map(item => (
                            <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light transition-colors">
                                {item}
                            </a>
                        ))}
                    </div>
                    <div className="hidden md:flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => onLoginClick(true)}>Login</Button>
                        <Button variant="primary" size="sm" onClick={() => onLoginClick(false)}>Sign Up</Button>
                    </div>
                    <div className="md:hidden">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </nav>
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden border-t border-border-light dark:border-border-dark"
                    >
                        <div className="px-4 py-3 space-y-2">
                             {navItems.map(item => (
                                <a key={item} href={`#${item.toLowerCase().replace(' ', '-')}`} onClick={() => setIsMenuOpen(false)} className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light transition-colors py-1">
                                    {item}
                                </a>
                            ))}
                            <div className="flex items-center space-x-2 pt-2">
                                <Button fullWidth variant="ghost" size="sm" onClick={() => { onLoginClick(true); setIsMenuOpen(false); }}>Login</Button>
                                <Button fullWidth variant="primary" size="sm" onClick={() => { onLoginClick(false); setIsMenuOpen(false); }}>Sign Up</Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};

export default LandingNav;