// frontend/src/components/onboarding/OnboardingVisual.jsx
import React from 'react';

const OnboardingVisual = ({ icon: Icon, label, subLabel }) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
            <div className="p-3 bg-primary/10 rounded-lg">
                <Icon className="w-8 h-8 text-primary" />
            </div>
            <p className="mt-2 font-semibold text-sm text-text-light dark:text-text-dark">{label}</p>
            {subLabel && <p className="text-xs text-text-muted-light dark:text-text-muted-dark">{subLabel}</p>}
        </div>
    );
};

export default OnboardingVisual;