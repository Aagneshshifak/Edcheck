import axios from 'axios';

/**
 * Central axios instance.
 * Request interceptor automatically attaches the JWT from localStorage
 * to every outgoing request as a Bearer token.
 * Response interceptor handles 401/403 by clearing the session.
 */
const axiosInstance = axios.create({
    baseURL: process.env.REACT_APP_BASE_URL,
});

// ── Request interceptor — attach token ────────────────────────────────────────
axiosInstance.interceptors.request.use(
    (config) => {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        const token = user?.token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response interceptor — handle expired / invalid token ─────────────────────
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            // Token expired or invalid — clear session and reload to login
            localStorage.removeItem('user');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
