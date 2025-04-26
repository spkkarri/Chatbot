// client/src/services/api.js
import axios from 'axios';

// Dynamically determine API Base URL
const getApiBaseUrl = () => {
    // Use REACT_APP_BACKEND_PORT environment variable if set during build, otherwise default
    // This allows overriding the port via build environment if needed.
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5001;
    const hostname = window.location.hostname; // Get hostname browser is accessing

    // Use http protocol by default for local development
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';

    // If hostname is localhost or 127.0.0.1, construct URL with localhost
    // Otherwise, use the hostname the frontend was accessed with (e.g., LAN IP)
    const backendHost = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'localhost'
        : hostname;

    return `${protocol}//${backendHost}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();
console.log("API Base URL:", API_BASE_URL); // Log the dynamically determined URL

// Create Axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
});

// --- Interceptor to add User ID header (TEMP AUTH) ---
api.interceptors.request.use(
    (config) => {
        const userId = localStorage.getItem('userId');
        // Add header only if userId exists
        if (userId) {
            config.headers['x-user-id'] = userId;
        } else if (!config.url.includes('/auth/')) {
             // Only warn if it's NOT an authentication request
             console.warn("API Interceptor: userId not found in localStorage for non-auth request to", config.url);
             // Consider rejecting the request if userId is absolutely mandatory for the endpoint
             // return Promise.reject(new Error("User ID not found. Please log in."));
        }

        // Handle FormData content type specifically
        if (config.data instanceof FormData) {
            // Let Axios set the correct 'multipart/form-data' header with boundary
            // Deleting it ensures Axios handles it automatically.
            delete config.headers['Content-Type'];
        } else if (!config.headers['Content-Type']) {
             // Set default Content-Type for other requests (like JSON) if not already set
             config.headers['Content-Type'] = 'application/json';
        }
        // console.log("API Request Config:", config); // Debug: Log outgoing request config
        return config;
    },
    (error) => {
        console.error("API Request Interceptor Error:", error);
        return Promise.reject(error);
    }
);

// --- Interceptor to handle 401 Unauthorized responses ---
api.interceptors.response.use(
    (response) => {
        // Any status code within the range of 2xx cause this function to trigger
        return response;
    },
    (error) => {
        // Any status codes outside the range of 2xx cause this function to trigger
        if (error.response && error.response.status === 401) {
            console.warn("API Response Interceptor: Received 401 Unauthorized. Clearing auth data and redirecting to login.");
            // Clear potentially invalid auth tokens/user info
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            localStorage.removeItem('userId');

            // Use window.location to redirect outside of React Router context if needed
            // Check if already on login page to prevent loop
            if (!window.location.pathname.includes('/login')) {
                 window.location.href = '/login?sessionExpired=true'; // Redirect to login page
            }
        }
        // Return the error so that the calling code can handle it (e.g., display message)
        return Promise.reject(error);
    }
);
// --- End Interceptors ---


// --- NAMED EXPORTS for API functions ---

// Authentication
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);

// Chat Interaction
// messageData includes { message, history, sessionId, systemPrompt, isRagEnabled, relevantDocs }
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);

// RAG Query
// queryData includes { message }
export const queryRagService = (queryData) => api.post('/chat/rag', queryData);

// Chat History Retrieval
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);

// File Upload
// Pass FormData directly
export const uploadFile = (formData) => api.post('/upload', formData);

// File Management
export const getUserFiles = () => api.get('/files');
export const renameUserFile = (serverFilename, newOriginalName) => api.patch(`/files/${serverFilename}`, { newOriginalName });
export const deleteUserFile = (serverFilename) => api.delete(`/files/${serverFilename}`);


// --- DEFAULT EXPORT ---
// Export the configured Axios instance if needed for direct use elsewhere
export default api;
