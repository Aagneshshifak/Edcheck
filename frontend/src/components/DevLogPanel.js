import { useState, useEffect, useRef } from 'react';
import {
    Box, Paper, Typography, IconButton, Chip, Collapse,
    Tooltip, Divider, Button, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloseIcon from '@mui/icons-material/Close';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useDevLog } from '../context/DevLogContext';
import API_URL from '../config/api';

const LEVEL_COLORS = {
    error: '#d32f2f',
    warn:  '#ed6c02',
    info:  '#0288d1',
    debug: '#7b1fa2',
};

const SERVER_LOG_URL = `${API_URL}/api/logs/stream`;

const DevLogPanel = () => {
    const { logs, addLog, clearLogs } = useDevLog();
    const [open, setOpen]           = useState(false);
    const [expanded, setExpanded]   = useState(null);
    const [filter, setFilter]       = useState('all');
    const [connected, setConnected] = useState(false);
    const bottomRef = useRef(null);

    // SSE connection to backend log stream
    useEffect(() => {
        const es = new EventSource(SERVER_LOG_URL);

        es.onopen = () => setConnected(true);

        es.onmessage = (e) => {
            try {
                const { level, message, meta, time } = JSON.parse(e.data);
                const detail = meta && Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                addLog(level || 'info', `[SERVER] ${message}`, detail, time);
            } catch (_) { /* malformed frame */ }
        };

        es.onerror = () => setConnected(false);

        return () => { es.close(); setConnected(false); };
    }, [addLog]);

    // Auto-scroll to bottom when panel is open and logs change
    useEffect(() => {
        if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs, open]);

    const errorCount = logs.filter((l) => l.level === 'error').length;
    const warnCount  = logs.filter((l) => l.level === 'warn').length;
    const visible    = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

    return (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1300, maxWidth: 520, width: open ? '100%' : 'auto' }}>

            {/* Floating toggle button */}
            {!open && (
                <Tooltip title="Server Log">
                    <IconButton
                        onClick={() => setOpen(true)}
                        sx={{
                            bgcolor: errorCount > 0 ? '#d32f2f' : warnCount > 0 ? '#ed6c02' : '#424242',
                            color: '#fff',
                            '&:hover': { bgcolor: '#616161' },
                            boxShadow: 3,
                        }}
                    >
                        <BugReportIcon />
                        {(errorCount > 0 || warnCount > 0) && (
                            <Box sx={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', bgcolor: '#fff' }} />
                        )}
                    </IconButton>
                </Tooltip>
            )}

            {/* Log panel */}
            {open && (
                <Paper elevation={6} sx={{ borderRadius: 2, overflow: 'hidden' }}>

                    {/* Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, bgcolor: '#212121', color: '#fff', gap: 1 }}>
                        <BugReportIcon fontSize="small" />
                        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Server Log</Typography>

                        <Tooltip title={connected ? 'Stream connected' : 'Reconnecting…'}>
                            {connected
                                ? <WifiIcon    sx={{ fontSize: 16, color: '#4caf50' }} />
                                : <WifiOffIcon sx={{ fontSize: 16, color: '#f44336' }} />
                            }
                        </Tooltip>

                        {errorCount > 0 && <Chip label={`${errorCount} err`}  size="small" sx={{ bgcolor: '#d32f2f', color: '#fff', fontSize: 11 }} />}
                        {warnCount  > 0 && <Chip label={`${warnCount} warn`}  size="small" sx={{ bgcolor: '#ed6c02', color: '#fff', fontSize: 11 }} />}

                        <Tooltip title="Clear logs">
                            <IconButton size="small" onClick={clearLogs} sx={{ color: '#aaa' }}>
                                <DeleteSweepIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: '#aaa' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Filter bar */}
                    <Box sx={{ bgcolor: '#1a1a1a', px: 2, py: 0.5 }}>
                        <ToggleButtonGroup
                            value={filter}
                            exclusive
                            onChange={(_, v) => v && setFilter(v)}
                            size="small"
                            sx={{
                                '& .MuiToggleButton-root': { color: '#aaa', border: 'none', fontSize: 11, py: 0.25, px: 1 },
                                '& .Mui-selected': { color: '#fff !important', bgcolor: '#333 !important' },
                            }}
                        >
                            <ToggleButton value="all">All ({logs.length})</ToggleButton>
                            <ToggleButton value="error" sx={{ color: `${LEVEL_COLORS.error} !important` }}>Error ({errorCount})</ToggleButton>
                            <ToggleButton value="warn"  sx={{ color: `${LEVEL_COLORS.warn}  !important` }}>Warn ({warnCount})</ToggleButton>
                            <ToggleButton value="info">Info</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <Divider />

                    {/* Log entries */}
                    <Box sx={{ maxHeight: 360, overflowY: 'auto', bgcolor: '#1e1e1e' }}>
                        {visible.length === 0 ? (
                            <Typography sx={{ color: '#888', p: 2, fontSize: 13 }}>No logs yet.</Typography>
                        ) : (
                            visible.map((log) => (
                                <Box key={log.id}>
                                    <Box
                                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                                        sx={{
                                            display: 'flex', alignItems: 'flex-start', gap: 1,
                                            px: 2, py: 0.75,
                                            cursor: log.detail ? 'pointer' : 'default',
                                            '&:hover': { bgcolor: '#2a2a2a' },
                                            borderLeft: `3px solid ${LEVEL_COLORS[log.level] || '#888'}`,
                                        }}
                                    >
                                        <Typography sx={{ color: LEVEL_COLORS[log.level] || '#888', fontSize: 11, minWidth: 40, mt: '2px' }}>
                                            {(log.level || 'info').toUpperCase()}
                                        </Typography>
                                        <Typography sx={{ color: '#e0e0e0', fontSize: 12, flexGrow: 1, wordBreak: 'break-word' }}>
                                            {log.message}
                                        </Typography>
                                        <Typography sx={{ color: '#666', fontSize: 11, whiteSpace: 'nowrap' }}>
                                            {log.time}
                                        </Typography>
                                        {log.detail && (
                                            expanded === log.id
                                                ? <ExpandLessIcon sx={{ color: '#888', fontSize: 16 }} />
                                                : <ExpandMoreIcon sx={{ color: '#888', fontSize: 16 }} />
                                        )}
                                    </Box>
                                    {log.detail && (
                                        <Collapse in={expanded === log.id}>
                                            <Box sx={{ px: 2, pb: 1, bgcolor: '#161616' }}>
                                                <Typography component="pre" sx={{ color: '#aaa', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0 }}>
                                                    {log.detail}
                                                </Typography>
                                            </Box>
                                        </Collapse>
                                    )}
                                    <Divider sx={{ borderColor: '#2a2a2a' }} />
                                </Box>
                            ))
                        )}
                        <div ref={bottomRef} />
                    </Box>

                    {logs.length > 0 && (
                        <Box sx={{ bgcolor: '#1e1e1e', px: 2, py: 0.5, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button size="small" onClick={clearLogs} sx={{ color: '#888', fontSize: 11 }}>Clear all</Button>
                        </Box>
                    )}
                </Paper>
            )}
        </Box>
    );
};

export default DevLogPanel;
