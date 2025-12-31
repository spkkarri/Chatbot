// frontend/src/components/admin/UserSignupsChart.jsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useTheme } from '../../hooks/useTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const UserSignupsChart = ({ data }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    const chartLabels = data.map(d => d.date);
    const chartDataPoints = data.map(d => d.count);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: isDarkMode ? '#334155' : '#FFFFFF',
                titleColor: isDarkMode ? '#E2E8F0' : '#0F172A',
                bodyColor: isDarkMode ? '#CBD5E1' : '#475569',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: isDarkMode ? '#94A3B8' : '#64748B',
                    precision: 0,
                },
                grid: {
                    color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                },
            },
            x: {
                ticks: {
                    color: isDarkMode ? '#94A3B8' : '#64748B',
                },
                grid: {
                    display: false,
                },
            },
        },
    };

    const lineChartData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'New Signups',
                data: chartDataPoints,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
                pointBackgroundColor: '#3b82f6',
            },
        ],
    };

    return (
        <div className="card-base p-4 h-80">
            <Line options={chartOptions} data={lineChartData} />
        </div>
    );
};

export default UserSignupsChart;