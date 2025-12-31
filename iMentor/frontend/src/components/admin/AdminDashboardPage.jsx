// frontend/src/components/admin/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import adminApi from '../../services/adminApi.js';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import Modal from '../core/Modal.jsx';
import ApiKeyRequestManager from './ApiKeyRequestManager.jsx';
import UserChatManager from './UserChatManager.jsx';
import AdminInsights from './AdminInsights.jsx';
import LLMConfigManager from './LLMConfigManager.jsx';
import ModelFeedbackStats from './ModelFeedbackStats.jsx'; 
import DatasetManager from './DatasetManager.jsx';
import { Trash2, Eye, LogOut, Loader2, AlertTriangle, CheckCircle, RefreshCw, Shield, Users, HelpCircle, Cog, Database, BarChart2, BookCopy } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import CourseManager from './CourseManager.jsx';

// Helper functions can remain as they are
const localParseAnalysisOutput = (rawOutput) => { 
    if (!rawOutput || typeof rawOutput !== 'string') return { content: '' };
    const thinkingMatch = rawOutput.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    let mainContent = rawOutput;
    if (thinkingMatch && thinkingMatch[1]) {
        mainContent = rawOutput.replace(/<thinking>[\s\S]*?<\/thinking>\s*/i, '').trim();
    }
    return { content: mainContent };
};
const createMarkup = (markdownText) => { 
    if (!markdownText) return { __html: '' };
    const html = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    return { __html: cleanHtml };
};

function AdminDashboardPage() {
    const { setIsAdminSessionActive, setSessionId } = useAppState();
    const { logout: regularUserLogout } = useAuth();
    const navigate = useNavigate();

    const [keyRequests, setKeyRequests] = useState([]);
    const [usersWithChats, setUsersWithChats] = useState([]);
    const [dashboardStats, setDashboardStats] = useState({});
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [loadingError, setLoadingError] = useState('');
    const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
    const [isUserChatsModalOpen, setIsUserChatsModalOpen] = useState(false);
    const [isLlmModalOpen, setIsLlmModalOpen] = useState(false);
    const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);
    
    const adminLogoutHandler = () => {
        setIsAdminSessionActive(false);
        regularUserLogout();
        setSessionId(null);
        toast.success("Admin logged out.");
        navigate('/');
    };

    const fetchAdminData = useCallback(async (isRefresh = false) => {
        let toastId;
        if (isRefresh) toastId = toast.loading("Refreshing admin data...");
        else setIsInitialLoading(true);
        setLoadingError('');
        
        try {
            const [requestsResponse, usersResponse, statsResponse] = await Promise.all([
                adminApi.getApiKeyRequests(),
                adminApi.getUsersAndChats(),
                adminApi.getDashboardStats()
            ]);

            setKeyRequests(Array.isArray(requestsResponse) ? requestsResponse : []);
            setUsersWithChats(Array.isArray(usersResponse) ? usersResponse : []);
            setDashboardStats(statsResponse || {});

            if (isRefresh) toast.success("Admin data refreshed.", { id: toastId });
        } catch (err) {
            const errorMessage = err.message || "Failed to fetch admin data.";
            setLoadingError(errorMessage);
            if (isRefresh) toast.error(errorMessage, { id: toastId });
            else toast.error(errorMessage);
        } finally {
            if (!isRefresh) setIsInitialLoading(false);
        }
    }, []);

    useEffect(() => { fetchAdminData(); }, [fetchAdminData]);

    return (
        <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
            <header className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-border-light dark:border-border-dark">
                <h1 className="text-2xl font-bold">Professor's Dashboard</h1>
                <div className="flex items-center gap-2">
                    <IconButton icon={RefreshCw} onClick={() => fetchAdminData(true)} title="Refresh Data" variant="ghost" size="md" />
                    <IconButton icon={BarChart2} onClick={() => navigate('/admin/analytics')} title="Platform Analytics" variant="ghost" size="md" />
                    <IconButton icon={Shield} onClick={() => setIsSecurityModalOpen(true)} title="Security & API Requests" variant="ghost" size="md" />
                    <IconButton icon={Users} onClick={() => setIsUserChatsModalOpen(true)} title="User Chats" variant="ghost" size="md" />
                    <IconButton icon={Database} onClick={() => setIsDatasetModalOpen(true)} title="Dataset Management" variant="ghost" size="md" />
                    <IconButton icon={Cog} onClick={() => setIsLlmModalOpen(true)} title="LLM Configuration" variant="ghost" size="md" />
                    <Button onClick={adminLogoutHandler} variant="danger" size="sm" leftIcon={<LogOut size={16}/>}> Logout</Button>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                <AdminInsights stats={dashboardStats} isLoading={isInitialLoading} error={loadingError} />
                
                <div className="card-base p-4">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <BookCopy className="text-primary" />
                        Course Management
                    </h2>
                    <CourseManager />
                </div>
                
                <ModelFeedbackStats />
            </main>

            {/* Modals */}
            <Modal isOpen={isSecurityModalOpen} onClose={() => setIsSecurityModalOpen(false)} title="Security Center" size="3xl"><ApiKeyRequestManager requests={keyRequests} onAction={() => fetchAdminData(true)} /></Modal>
            <Modal isOpen={isUserChatsModalOpen} onClose={() => setIsUserChatsModalOpen(false)} title="User Chats" size="4xl"><UserChatManager usersWithChats={usersWithChats} /></Modal>
            <Modal isOpen={isLlmModalOpen} onClose={() => setIsLlmModalOpen(false)} title="LLM Configuration" size="4xl"><LLMConfigManager /></Modal>
            <Modal isOpen={isDatasetModalOpen} onClose={() => setIsDatasetModalOpen(false)} title="Dataset Management" size="5xl"><DatasetManager /></Modal>
        </div>
    );
}

export default AdminDashboardPage;
