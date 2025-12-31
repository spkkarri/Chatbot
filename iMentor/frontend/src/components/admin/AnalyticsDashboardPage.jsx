// frontend/src/components/admin/AnalyticsDashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Loader2, AlertTriangle, Users, UserCheck, MessagesSquare, UploadCloud, FileBarChart2, FileText, BarChart3, PieChart } from 'lucide-react';
import * as adminApi from '../../services/adminApi.js';
import toast from 'react-hot-toast';
import AnalyticsKpiCard from './AnalyticsKpiCard.jsx';
import UserSignupsChart from './UserSignupsChart.jsx';
import FeatureUsageChart from './FeatureUsageChart.jsx';
import ContentInsightsChart from './ContentInsightsChart.jsx';
import LlmUsageChart from './LlmUsageChart.jsx';
import ExternalServicesNav from './ExternalServicesNav.jsx';

const AnalyticsDashboardPage = () => {
    const [kpiData, setKpiData] = useState(null);
    const [userEngagementData, setUserEngagementData] = useState(null);
    const [featureUsageData, setFeatureUsageData] = useState(null);
    const [contentInsightsData, setContentInsightsData] = useState(null);
    const [llmUsageData, setLlmUsageData] = useState(null);
    const [generatedContentData, setGeneratedContentData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError('');
            try {
                // Simplified Promise.all - featureUsageData is now fetched in one go.
                const [
                    kpiStats,
                    engagementStats, 
                    featureStats, 
                    contentStats,
                    llmStats,
                    pptxStats,
                    docxStats
                ] = await Promise.all([
                    Promise.all([
                        adminApi.getTotalQueries(),
                        adminApi.getActiveUsersToday(),
                        adminApi.getTotalSources()
                    ]).then(([queries, activeUsers, sources]) => ({
                        totalQueries: queries.count,
                        activeUsersToday: activeUsers.count,
                        totalSources: sources.count
                    })),
                    adminApi.getUserEngagementStats(),
                    adminApi.getFeatureUsageStats(), // This now returns the combined data
                    adminApi.getContentInsightStats(),
                    adminApi.getLlmUsageStats(),
                    adminApi.getPptxGeneratedCount(),
                    adminApi.getDocxGeneratedCount()
                ]);
                
                setKpiData(kpiStats);
                setUserEngagementData(engagementStats);
                setFeatureUsageData(featureStats); // Set the combined data directly
                setContentInsightsData(contentStats);
                setLlmUsageData(llmStats);
                setGeneratedContentData({ pptx: pptxStats.count, docx: docxStats.count });
            } catch (err) {
                const errorMessage = err.message || "Failed to fetch analytics data.";
                setError(errorMessage);
                toast.error(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);
    
    const renderTopLevelKpis = () => {
        if (!kpiData || !userEngagementData) return null;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnalyticsKpiCard title="Total Registered Users" value={userEngagementData.totalUsers} icon={Users} colorClass="blue" />
                <AnalyticsKpiCard title="Active Users (Today)" value={kpiData.activeUsersToday} icon={UserCheck} colorClass="indigo" />
                <AnalyticsKpiCard title="Total User Queries" value={kpiData.totalQueries} icon={MessagesSquare} colorClass="green" />
                <AnalyticsKpiCard title="Total Sources Ingested" value={kpiData.totalSources} icon={UploadCloud} colorClass="yellow" />
            </div>
        );
    };

    const renderUserGrowthSection = () => {
        if (!userEngagementData) return null;
        return (
            <section>
                <h2 className="text-xl font-semibold mb-4 text-text-light dark:text-text-dark flex items-center gap-2"><BarChart3/> User Growth & Engagement</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        {userEngagementData.dailySignupsLast30Days.length > 0 ? (
                            <UserSignupsChart data={userEngagementData.dailySignupsLast30Days} />
                        ) : (
                            <div className="card-base p-4 h-80 flex items-center justify-center text-text-muted-light dark:text-text-muted-dark">
                                No new user signups in the last 30 days.
                            </div>
                        )}
                    </div>
                    <div className="space-y-6">
                         <AnalyticsKpiCard title="New Signups (Last 7 Days)" value={userEngagementData.newSignupsLast7Days} icon={UserCheck} colorClass="green" />
                         <AnalyticsKpiCard title="All-Time Signups" value={userEngagementData.totalUsers} icon={Users} colorClass="blue" />
                    </div>
                </div>
            </section>
        );
    };

    const renderFeatureAdoptionSection = () => {
        if (!featureUsageData || !llmUsageData) return null;
        return (
             <section>
                <h2 className="text-xl font-semibold mb-4 text-text-light dark:text-text-dark flex items-center gap-2"><PieChart/> Feature & Tool Adoption</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        {featureUsageData.length > 0 ? (
                            <FeatureUsageChart data={featureUsageData} />
                        ) : (
                            <div className="card-base p-4 h-96 flex items-center justify-center text-text-muted-light dark:text-text-muted-dark">
                                No feature usage data has been logged yet.
                            </div>
                        )}
                    </div>
                    <div>
                         {llmUsageData.length > 0 ? (
                            <LlmUsageChart data={llmUsageData} />
                        ) : (
                            <div className="card-base p-4 h-96 flex items-center justify-center text-text-muted-light dark:text-text-muted-dark">
                                No LLM usage data has been logged yet.
                            </div>
                        )}
                    </div>
                </div>
            </section>
        );
    };
    
    const renderContentInsightsSection = () => {
        if (!contentInsightsData || !generatedContentData) return null;
        return (
            <section>
                 <h2 className="text-xl font-semibold mb-4 text-text-light dark:text-text-dark flex items-center gap-2"><FileText/> Content & Document Insights</h2>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        {contentInsightsData.length > 0 ? (
                            <ContentInsightsChart data={contentInsightsData} />
                        ) : (
                            <div className="card-base p-4 h-96 flex items-center justify-center text-text-muted-light dark:text-text-muted-dark">
                                No document/subject specific chats have been logged yet.
                            </div>
                        )}
                    </div>
                    <div className="space-y-6">
                        <AnalyticsKpiCard title="PPTX Generated" value={generatedContentData.pptx} icon={FileBarChart2} colorClass="orange" />
                        <AnalyticsKpiCard title="DOCX Generated" value={generatedContentData.docx} icon={FileText} colorClass="sky" />
                    </div>
                </div>
            </section>
        );
    };

    return (
        <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-sans">
            <header className="flex-shrink-0 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark h-16 flex items-center justify-between px-6 z-10">
                <h1 className="text-xl font-bold">Platform Analytics</h1>
                <Link to="/admin/dashboard" className="flex items-center gap-2 text-sm btn btn-ghost">
                    <Home size={16} /> Back to Main Dashboard
                </Link>
            </header>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar">
                <div className="max-w-7xl mx-auto space-y-8">
                    {isLoading && (
                        <div className="text-center p-8">
                            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                        </div>
                    )}
                    {error && !isLoading && (
                        <div className="p-4 bg-red-500/10 text-red-500 rounded-md text-center">
                            <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                            <p>{error}</p>
                        </div>
                    )}
                    {!isLoading && !error && (
                        <>
                            <ExternalServicesNav />
                            {renderTopLevelKpis()}
                            {renderUserGrowthSection()}
                            {renderFeatureAdoptionSection()}
                            {renderContentInsightsSection()}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AnalyticsDashboardPage;