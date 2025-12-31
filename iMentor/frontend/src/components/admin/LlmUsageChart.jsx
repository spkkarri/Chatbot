// frontend/src/components/admin/LlmUsageChart.jsx
import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useTheme } from '../../hooks/useTheme';

ChartJS.register(ArcElement, Tooltip, Legend);

const LlmUsageChart = ({ data }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const chartLabels = data.map(d => d.provider.charAt(0).toUpperCase() + d.provider.slice(1));
    const chartDataPoints = data.map(d => d.count);
    
    // Define a consistent color map for providers
    const colorMap = {
        gemini: 'rgba(59, 130, 246, 0.7)', // blue-500
        ollama: 'rgba(16, 185, 129, 0.7)', // emerald-500
        'fine-tuned': 'rgba(239, 68, 68, 0.7)', // red-500
    };
    const borderColorMap = {
        gemini: 'rgba(59, 130, 246, 1)',
        ollama: 'rgba(16, 185, 129, 1)',
        'fine-tuned': 'rgba(239, 68, 68, 1)',
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: isDarkMode ? '#E2E8F0' : '#0F172A',
                    font: { size: 12 },
                },
            },
            title: {
                display: true,
                text: 'LLM Provider Usage Distribution',
                color: isDarkMode ? '#E2E8F0' : '#0F172A',
                font: { size: 16, weight: 'bold' }
            },
            tooltip: {
                 backgroundColor: isDarkMode ? '#334155' : '#FFFFFF',
                 titleColor: isDarkMode ? '#E2E8F0' : '#0F172A',
                 bodyColor: isDarkMode ? '#CBD5E1' : '#475569',
            }
        },
    };

    const pieChartData = {
        labels: chartLabels,
        datasets: [{
            label: 'Query Count',
            data: chartDataPoints,
            backgroundColor: data.map(d => colorMap[d.provider] || 'rgba(107, 114, 128, 0.7)'),
            borderColor: data.map(d => borderColorMap[d.provider] || 'rgba(107, 114, 128, 1)'),
            borderWidth: 1,
        }],
    };

    return (
        <div className="card-base p-4 h-96">
            <Pie options={chartOptions} data={pieChartData} />
        </div>
    );
};

export default LlmUsageChart;