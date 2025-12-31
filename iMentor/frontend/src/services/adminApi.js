// frontend/src/services/adminApi.js
import axios from 'axios';

// --- CONFIGURATION ---
const ADMIN_API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'}/admin`;

const adminApiClient = axios.create({
    baseURL: ADMIN_API_BASE_URL,
});

// --- HELPER FUNCTIONS ---
const getAuthHeaders = () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error("Admin action requires a login token, but none was found.");
        return {}; 
    }
    return { 'Authorization': `Bearer ${token}` };
};

const makeAdminApiRequest = async (method, endpoint, data = null, customHeaders = {}) => {
    console.log(`[Admin API] Request ==> ${method.toUpperCase()} ${endpoint}`, { data });
    try {
        const config = {
            method,
            url: endpoint,
            headers: {
                ...getAuthHeaders(),
                ...customHeaders,
            },
        };
        if (data) config.data = data;
        if (data instanceof FormData) config.headers['Content-Type'] = 'multipart/form-data';

        const response = await adminApiClient(config);
        console.log(`[Admin API] Response <== ${method.toUpperCase()} ${endpoint}`, { status: response.status, data: response.data });
        return response.data;
    } catch (error) {
        let errorMessage = 'Admin API request failed.';
        if (error.response) {
            errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
            console.error(`[Admin API] Error <== ${method.toUpperCase()} ${endpoint}`, { status: error.response.status, error: error.response.data });
        } else if (error.request) {
            errorMessage = 'No response from admin API server.';
            console.error(`[Admin API] Error <== No response for ${method.toUpperCase()} ${endpoint}`);
        } else {
            errorMessage = error.message || 'Error setting up request.';
            console.error(`[Admin API] Error <== Request setup failed for ${method.toUpperCase()} ${endpoint}`, error.message);
        }
        throw new Error(errorMessage);
    }
};

// --- API OBJECT WITH ALL FUNCTIONS ---
const adminApi = {
    getFixedAdminAuthHeaders: getAuthHeaders,

    // Dashboard & General
    getDashboardStats: () => makeAdminApiRequest('get', '/dashboard-stats'),

    // --- Document Management (NEW AND REVISED) ---
    stageUpload: (formData) => makeAdminApiRequest('post', '/documents/stage-upload', formData),
    processStagedFile: (payload) => makeAdminApiRequest('post', '/documents/process-staged', payload),
    getDocumentsByCourse: (courseCode) => makeAdminApiRequest('get', `/documents/by-course/${courseCode}`),
    reprocessDocument: (docId) => makeAdminApiRequest('post', `/documents/${docId}/reprocess`),
    deleteAdminDocumentById: (docId) => makeAdminApiRequest('delete', `/documents/${docId}`),
    getUnlinkedDocuments: () => makeAdminApiRequest('get', '/documents/unlinked'),
    getAdminDocumentAnalysisByOriginalName: (originalName) => makeAdminApiRequest('get', `/documents/by-original-name/${encodeURIComponent(originalName)}/analysis`),

    // API Key Management
    getApiKeyRequests: () => makeAdminApiRequest('get', '/key-requests'),
    approveApiKeyRequest: (userId) => makeAdminApiRequest('post', '/key-requests/approve', { userId }),
    rejectApiKeyRequest: (userId) => makeAdminApiRequest('post', '/key-requests/reject', { userId }),

    // User & Chat Management
    getUsersAndChats: () => makeAdminApiRequest('get', '/users-with-chats'),
    getNegativeFeedback: () => makeAdminApiRequest('get', '/negative-feedback'),

    // LLM Management
    getLlmConfigs: () => makeAdminApiRequest('get', '/llms'),
    createLlmConfig: (data) => makeAdminApiRequest('post', '/llms', data),
    updateLlmConfig: (id, data) => makeAdminApiRequest('put', `/llms/${id}`, data),
    deleteLlmConfig: (id) => makeAdminApiRequest('delete', `/llms/${id}`),

    // Feedback & Finetuning
    getFeedbackStats: () => makeAdminApiRequest('get', '/feedback-stats'),
    startFineTuningJob: (payload) => makeAdminApiRequest('post', '/finetuning/start', payload),

    // Dataset Management
    getDatasets: () => makeAdminApiRequest('get', '/datasets'),
    getPresignedUploadUrl: (fileName, fileType) => makeAdminApiRequest('post', '/datasets/presigned-url', { fileName, fileType }),
    finalizeUpload: (datasetMetadata) => makeAdminApiRequest('post', '/datasets/finalize-upload', datasetMetadata),
    getPresignedDownloadUrl: (datasetId) => makeAdminApiRequest('get', `/datasets/${datasetId}/download-url`),
    deleteDataset: (datasetId) => makeAdminApiRequest('delete', `/datasets/${datasetId}`),

    // Analytics
    getUserEngagementStats: () => makeAdminApiRequest('get', '/analytics/user-engagement'),
    getContentInsightStats: () => makeAdminApiRequest('get', '/analytics/content-insights'),
    getFeatureUsageStats: () => makeAdminApiRequest('get', '/analytics/feature-usage'),
    getLlmUsageStats: () => makeAdminApiRequest('get', '/analytics/llm-usage'),
    getPptxGeneratedCount: () => makeAdminApiRequest('get', '/analytics/pptx-generated-count'),
    getDocxGeneratedCount: () => makeAdminApiRequest('get', '/analytics/docx-generated-count'),
    getActiveUsersToday: () => makeAdminApiRequest('get', '/analytics/active-users-today'),
    getTotalQueries: () => makeAdminApiRequest('get', '/analytics/total-queries'),
    getTotalSources: () => makeAdminApiRequest('get', '/analytics/total-sources'),

    // Course Management API Functions
    getCourses: () => makeAdminApiRequest('get', '/courses'),
    getCourseById: (id) => makeAdminApiRequest('get', `/courses/${id}`),
    createCourse: (data) => makeAdminApiRequest('post', '/courses', data),
    updateCourse: (id, data) => makeAdminApiRequest('put', `/courses/${id}`, data),
    deleteCourse: (id) => makeAdminApiRequest('delete', `/courses/${id}`),
};

export default adminApi;
