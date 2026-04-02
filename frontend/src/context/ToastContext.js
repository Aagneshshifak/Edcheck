import { createContext, useContext, useState, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
    const showSuccess = useCallback((msg) => {
        setToast({ open: true, message: msg, severity: 'success' });
    }, []);

    const showError = useCallback((msg) => {
        setToast({ open: true, message: msg, severity: 'error' });
    }, []);

    const handleClose = useCallback((event, reason) => {
        if (reason === 'clickaway') return;
        setToast((prev) => ({ ...prev, open: false }));
    }, []);

    const autoHideDuration = toast.severity === 'success' ? 3000 : null;

    return (
        <ToastContext.Provider value={{ showSuccess, showError }}>
            {children}
            <Snackbar
                open={toast.open}
                autoHideDuration={autoHideDuration}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={handleClose}
                    severity={toast.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
};
