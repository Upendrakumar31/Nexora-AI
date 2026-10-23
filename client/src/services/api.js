import axios from 'axios';

// Variable to store dynamic token getter function registered by Clerk Auth provider
let tokenGetter = null;

/**
 * Register a token getter function (e.g. from useAuth().getToken).
 * Called once at app initialization or auth state change.
 */
export const setTokenGetter = (fn) => {
    tokenGetter = fn;
};

// Centralized Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || '',
    timeout: 60000,
});

// Request interceptor: automatically inject Clerk Bearer token
api.interceptors.request.use(
    async (config) => {
        try {
            let token = null;

            // 1. Try registered token getter hook
            if (typeof tokenGetter === 'function') {
                token = await tokenGetter();
            }

            // 2. Fallback to global window.Clerk session if available
            if (!token && typeof window !== 'undefined' && window.Clerk?.session) {
                token = await window.Clerk.session.getToken();
            }

            if (token) {
                config.headers = config.headers || {};
                // Attach Bearer token if not explicitly overridden
                if (!config.headers.Authorization && !config.headers.authorization) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            }
        } catch (error) {
            // Safe fallback: never break outgoing requests on token failure
            console.warn('[Nexora API Client] Token resolution warning:', error?.message || error);
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and errors cleanly
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('[Nexora API Client] 401 Unauthorized - authentication may be expired or missing.');
        }
        return Promise.reject(error);
    }
);

export default api;
