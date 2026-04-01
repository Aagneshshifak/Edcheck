import { createContext, useContext, useState, useCallback } from 'react';

const DevLogContext = createContext(null);

export const useDevLog = () => useContext(DevLogContext);

export const DevLogProvider = ({ children }) => {
    const [logs, setLogs] = useState([]);

    const addLog = useCallback((level, message, detail = '', isoTime = null) => {
        const time = isoTime
            ? new Date(isoTime).toLocaleTimeString()
            : new Date().toLocaleTimeString();
        setLogs((prev) => [
            { id: Date.now() + Math.random(), level, message, detail, time },
            ...prev.slice(0, 99),
        ]);
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);

    return (
        <DevLogContext.Provider value={{ logs, addLog, clearLogs }}>
            {children}
        </DevLogContext.Provider>
    );
};
