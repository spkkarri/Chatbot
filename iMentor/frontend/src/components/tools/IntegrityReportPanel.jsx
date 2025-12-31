// frontend/src/components/tools/IntegrityReportPanel.jsx
import React from 'react';
import { Loader2, AlertTriangle, ShieldCheck, CheckCircle, Percent, Lightbulb, Scale, BookOpen, Wand2 } from 'lucide-react'; // Import Wand2
import ReadabilityMetrics from './ReadabilityMetrics';
import Button from '../core/Button'; // Import Button


const Section = ({ title, icon: Icon, children }) => (
    <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
        <h3 className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark font-semibold">
            <Icon className="text-primary" size={18} /> {title}
        </h3>
        <div className="p-4 text-sm">{children}</div>
    </div>
);

const IntegrityReportPanel = ({ report, isLoading, error, steps, currentStep, onFindingSelect, onApplySuggestion }) => { // Add onApplySuggestion prop
    
    if (isLoading) {
        
        const stepInfo = steps[currentStep];
        return (
            <div className="h-full flex flex-col justify-center items-center text-center p-4">
                <Loader2 className="animate-spin text-primary" size={40} />
                <h3 className="mt-4 text-lg font-semibold">Analysis in Progress...</h3>
                <div className="w-full max-w-sm bg-gray-200 dark:bg-gray-700 rounded-full h-2 my-3">
                    <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${stepInfo.progress}%` }}></div>
                </div>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">{stepInfo.name}</p>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="h-full flex flex-col justify-center items-center text-center p-4 text-red-500">
                <AlertTriangle size={40} />
                <h3 className="mt-4 text-lg font-semibold">Analysis Failed</h3>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="h-full flex flex-col justify-center items-center text-center p-4">
                <ShieldCheck className="text-gray-400" size={40} />
                <h3 className="mt-4 text-lg font-semibold">Analysis Report</h3>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                    Your academic integrity report will appear here once the analysis is complete.
                </p>
            </div>
        );
    }

    const { plagiarism, bias, readability } = report; // <-- ADDED readability

    return (
        <div className="h-full flex flex-col bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg">
            <header className="flex-shrink-0 p-4 border-b border-border-light dark:border-border-dark">
                <h2 className="font-semibold">Analysis Report</h2>
            </header>
            <div className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar">
                
                {/* Plagiarism Section */}
                <Section title="Plagiarism Check" icon={Percent}>
                    {plagiarism?.status === 'pending' && <p className="text-text-muted-light dark:text-text-muted-dark">Awaiting report...</p>}
                    {plagiarism?.status === 'error' && <p className="text-red-500">{plagiarism.message}</p>}
                    {plagiarism?.status === 'completed' && plagiarism.report && (
                        <div className="space-y-2">
                             <p><strong>Overall Similarity Score:</strong> {plagiarism.report.overall_score}%</p>
                             <a href={plagiarism.report.full_report_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Full Turnitin Report</a>
                        </div>
                    )}
                </Section>
                
                {/* Bias Section */}
                <Section title="Bias & Inclusivity" icon={Scale}>
                    {Array.isArray(bias) ? (
                        bias.length === 0 ? (
                            <p className="flex items-center gap-2 text-green-600"><CheckCircle size={16}/> No potential issues found.</p>
                        ) : (
                            <ul className="space-y-3">
                                {bias.map((item, i) => (
                                    // --- START OF CHANGES FOR THIS COMPONENT ---
                                    <li key={i} className="p-3 bg-yellow-400/10 rounded-md">
                                        <div 
                                            className="cursor-pointer hover:bg-yellow-400/20 -m-1 p-1 rounded" 
                                            onClick={() => onFindingSelect(item)}
                                            title="Click to highlight in editor"
                                        >
                                            <p><strong>Found:</strong> "{item.text}"</p>
                                            <p><strong>Suggestion:</strong> "{item.suggestion}"</p>
                                            <p className="text-xs mt-1 text-text-muted-light dark:text-text-muted-dark"><strong>Reason:</strong> {item.reason}</p>
                                        </div>
                                        <div className="mt-2 text-right">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="!text-xs !py-1 !px-2"
                                                leftIcon={<Wand2 size={12} />}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent the li's onClick from firing
                                                    onApplySuggestion(item);
                                                }}
                                            >
                                                Apply Suggestion
                                            </Button>
                                        </div>
                                    </li>
                                    // --- END OF CHANGES FOR THIS COMPONENT ---
                                ))}
                            </ul>
                        )
                    ) : (
                        <p className="text-red-500">{bias?.message || "An error occurred during the bias check."}</p>
                    )}
                </Section>

                {/* --- NEW Readability Section --- */}
                <Section title="Readability Analysis" icon={BookOpen}>
                    {readability?.status === 'error' ? (
                        <p className="text-red-500">{readability.message}</p>
                    ) : (
                        <ReadabilityMetrics metrics={readability} />
                    )}
                </Section>
            </div>
        </div>
    );
};

export default IntegrityReportPanel;