import axiosInstance from './axiosInstance';

/**
 * Call once with the addLog function from DevLogContext to attach
 * a global axios response interceptor that logs API errors.
 */
export const attachAxiosLogger = (addLog) => {
    const interceptor = axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            const url    = error.config?.url || 'unknown URL';
            const method = (error.config?.method || 'GET').toUpperCase();
            const status = error.response?.status;
            const msg    = error.response?.data?.message || error.message || 'Network error';

            const label  = status ? `[${status}] ${method} ${url}` : `${method} ${url} — ${msg}`;
            const detail = error.response?.data
                ? JSON.stringify(error.response.data, null, 2)
                : error.stack || '';

            addLog('error', label, detail);
            return Promise.reject(error);
        }
    );

    // Return cleanup function
    return () => axiosInstance.interceptors.response.eject(interceptor);
};
