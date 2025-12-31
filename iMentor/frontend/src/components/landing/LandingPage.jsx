// frontend/src/components/landing/LandingPage.jsx
import React from 'react';
import LandingNav from './LandingNav';
import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import HowItWorksSection from './HowItWorksSection';
import AudienceSection from './AudienceSection';
import CtaSection from './CtaSection';
import Footer from './Footer';

// The LandingPage component receives a function to open the AuthModal
// This keeps the modal state managed by the main App.jsx component.
const LandingPage = ({ onLoginClick }) => {
    return (
        <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans custom-scrollbar overflow-y-auto h-screen">
            <LandingNav onLoginClick={onLoginClick} />
            <main>
                <HeroSection onLoginClick={onLoginClick} />
                <FeaturesSection />
                <HowItWorksSection />
                <AudienceSection />
                <CtaSection onLoginClick={onLoginClick} />
            </main>
            <Footer />
        </div>
    );
};

export default LandingPage;