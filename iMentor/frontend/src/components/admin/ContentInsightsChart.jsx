// frontend/src/components/admin/ContentInsightsChart.jsx
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useTheme } from '../../hooks/useTheme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ContentInsightsChart = ({ data }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const sortedData = [...data].sort((a, b) => b.count - a.count);
    const chartLabels = sortedData.map(d => d.documentName);
    const chartDataPoints = sortedData.map(d => d.count);

    const chartOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: 'Most Used Documents & Subjects in Chats',
                color: isDarkMode ? '#E2E8F0' : '#0F172A',
                font: { size: 16, weight: 'bold' }
            },
            tooltip: {
                 backgroundColor: isDarkMode ? '#334155' : '#FFFFFF',
                 titleColor: isDarkMode ? '#E2E8F0' : '#0F172A',
                 bodyColor: isDarkMode ? '#CBD5E1' : '#475569',
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                ticks: { color: isDarkMode ? '#94A3B8' : '#64748B', precision: 0 },
                grid: { color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
            },
            y: {
                ticks: { color: isDarkMode ? '#94A3B8' : '#64748B' },
                grid: { display: false },
            },
        },
    };

    const barChartData = {
        labels: chartLabels,
        datasets: [{
            label: 'Chat Count',
            data: chartDataPoints,
            backgroundColor: 'rgba(45, 212, 191, 0.7)',
            borderColor: 'rgba(45, 212, 191, 1)',
            borderWidth: 1,
            borderRadius: 4,
        }],
    };

    return (
        <div className="card-base p-4 h-96">
            <Bar options={chartOptions} data={barChartData} />
        </div>
    );
};

export default ContentInsightsChart;