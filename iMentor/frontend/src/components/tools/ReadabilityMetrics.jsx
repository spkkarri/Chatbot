// frontend/src/components/tools/ReadabilityMetrics.jsx
import React from 'react';
import './ReadabilityMetrics.css';

const Gauge = ({ value, maxValue, label, tooltip, higherIsBetter = true }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.75; // Use 3/4 of the circle
    
    let progress = Math.max(0, Math.min(value / maxValue, 1));
    if (!higherIsBetter) {
        progress = 1 - progress; // Invert progress for metrics where lower is better
    }

    const offset = arcLength - progress * arcLength;

    let colorClass = 'stroke-green-500';
    if (progress < 0.66) colorClass = 'stroke-yellow-500';
    if (progress < 0.33) colorClass = 'stroke-red-500';

    return (
        <div className="flex flex-col items-center group relative" title={tooltip}>
            <svg width="120" height="120" viewBox="0 0 120 120">
                {/* Background arc */}
                <circle
                    className="text-gray-200 dark:text-gray-700"
                    strokeWidth="10" stroke="currentColor" fill="transparent"
                    r={radius} cx="60" cy="60"
                    strokeDasharray={arcLength} strokeDashoffset="0"
                    strokeLinecap="round" transform="rotate(135, 60, 60)"
                />
                {/* Progress arc */}
                <circle
                    className={`gauge-progress-circle ${colorClass}`}
                    strokeWidth="10" stroke="currentColor" fill="transparent"
                    r={radius} cx="60" cy="60"
                    strokeDasharray={arcLength} strokeDashoffset={offset}
                    strokeLinecap="round" transform="rotate(135, 60, 60)"
                />
                <text x="50%" y="50%" textAnchor="middle" dy=".3em" className="text-2xl font-bold fill-current text-text-light dark:text-text-dark">
                    {value.toFixed(1)}
                </text>
            </svg>
            <span className="text-xs font-semibold mt-1 text-center">{label}</span>
        </div>
    );
};

const ReadabilityMetrics = ({ metrics }) => {
    if (!metrics || Object.keys(metrics).length === 0) {
        return <p className="text-text-muted-light dark:text-text-muted-dark">No readability data available.</p>;
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Simple Stat Cards */}
                <div className="p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-center">
                    <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark">Word Count</p>
                    <p className="text-2xl font-bold">{metrics.wordCount}</p>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-center">
                    <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark">Sentence Count</p>
                    <p className="text-2xl font-bold">{metrics.sentenceCount}</p>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-center">
                    <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark">Avg. Sentence</p>
                    <p className="text-2xl font-bold">{metrics.avgSentenceLength} words</p>
                </div>
                 <div className="p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-center">
                    <p className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark">Dale-Chall Score</p>
                    <p className="text-2xl font-bold" title="Scores 9.0-9.9 are understandable by an average 11th/12th grader. Lower is easier.">{metrics.daleChall.toFixed(1)}</p>
                </div>
            </div>
            {/* Gauge Visualizations */}
             <div className="flex justify-around items-center flex-wrap gap-4 pt-4 border-t border-dashed border-border-light dark:border-border-dark">
                <Gauge value={metrics.fleschReadingEase} maxValue={100} label="Reading Ease" tooltip="Higher scores are easier to read. 60-70 is standard for most documents." higherIsBetter={true} />
                <Gauge value={metrics.fleschKincaidGrade} maxValue={20} label="Grade Level" tooltip="Indicates the US school-grade level needed to understand the text. Lower is easier." higherIsBetter={false} />
                <Gauge value={metrics.gunningFog} maxValue={20} label="Gunning Fog Index" tooltip="Estimates the years of formal education needed. A score around 12 is widely readable." higherIsBetter={false} />
            </div>
        </div>
    );
};

export default ReadabilityMetrics;