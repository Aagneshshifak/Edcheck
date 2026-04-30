import { useEffect, useState, useCallback } from 'react';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Paper, Typography, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, CircularProgress,
    Alert, Select, MenuItem, FormControl, InputLabel, Button,
    Grid, TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CachedIcon from '@mui/icons-material/Cached';

const ENDPOINT_OPTIONS = [
    '', 'generate-notes', 'detect-weak-topics', 'generate-questions',
    'generate-class-notes', 'generate-study-plan', 'generate-daily-routine',
    'prepare-next-test', 'assignment-help',
    'predict-student-risk', 'class-performance-analysis',
    'teacher-performance-analysis', 'school-performance-summary',
    'generate-recommendations',
];

const ROLE_OPTIONS = ['', 'teacher', 'student', 'admin', 'system'];

const msColor = (ms) => {
    if (ms === 0) return '#64748b';
    if (ms < 1000) return '#34d399';
    if (ms < 3000) return '#f59e0b';
    return '#ef4444';
};

const StatCard = ({ label, value, sub, color = '#0ea5e9' }) => (
    <Paper sx={{ p: 2, bgcolor: '#000000', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
        </Typography>
        <Typography sx={{ color, fontWeight: 700, fontSize: '1.6rem', mt: 0.3 }}>{value}</Typography>
        {sub && <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>{sub}</Typography>}
    </Paper>
);

const AILogViewer = () => {
    const [logs, setLogs]         = useState([]);
    const [stats, setStats]       = useState(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [page, setPage]         = useState(1);
    const [total, setTotal]       = useState(0);
    const [endpoint, setEndpoint] = useState('');
    const [role, setRole]         = useState('');
    const [success, setSuccess]   = useState('');
    const LIMIT = 50;

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page, limit: LIMIT });
            if (endpoint) params.set('endpoint', endpoint);
            if (role)     params.set('role', role);
            if (success !== '') params.set('success', success);

            const [logsRes, statsRes] = await Promise.all([
                axiosInstance.get(`/api/ai/logs?${params}`),
                axiosInstance.get('/api/ai/logs/stats'),
            ]);
            setLogs(logsRes.data.logs || []);
            setTotal(logsRes.data.pagination?.total || 0);
            setStats(statsRes.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load AI logs');
        } finally {
            setLoading(false);
        }
    }, [page, endpoint, role, success]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <Box sx={{ p: 3, bgcolor: '#111111', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 700 }}>
                    🤖 AI Call Logs
                </Typography>
                <Button
                    variant="outlined" size="small" startIcon={<RefreshIcon />}
                    onClick={fetchLogs} disabled={loading}
                    sx={{ color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.4)' }}
                >
                    Refresh
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Stats row */}
            {stats && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} sm={4} md={2}>
                        <StatCard label="Total Calls" value={stats.totals.totalCalls?.toLocaleString()} />
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <StatCard label="Total Tokens" value={stats.totals.totalTokens?.toLocaleString()} color="#a78bfa" />
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <StatCard label="Avg Response" value={`${Math.round(stats.totals.avgResponseMs || 0)}ms`} color={msColor(stats.totals.avgResponseMs)} />
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <StatCard label="Errors" value={stats.totals.errorCount} color={stats.totals.errorCount > 0 ? '#ef4444' : '#34d399'} />
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <StatCard label="Cache Hits" value={stats.totals.cacheHits} color="#34d399" />
                    </Grid>
                    <Grid item xs={6} sm={4} md={2}>
                        <StatCard
                            label="Success Rate"
                            value={stats.totals.totalCalls > 0
                                ? `${Math.round((stats.totals.successCount / stats.totals.totalCalls) * 100)}%`
                                : '—'}
                            color="#34d399"
                        />
                    </Grid>
                </Grid>
            )}

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#000000', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Endpoint</InputLabel>
                        <Select
                            value={endpoint} label="Endpoint"
                            onChange={e => { setEndpoint(e.target.value); setPage(1); }}
                            sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}
                        >
                            {ENDPOINT_OPTIONS.map(o => (
                                <MenuItem key={o} value={o}>{o || 'All Endpoints'}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Role</InputLabel>
                        <Select
                            value={role} label="Role"
                            onChange={e => { setRole(e.target.value); setPage(1); }}
                            sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}
                        >
                            {ROLE_OPTIONS.map(o => (
                                <MenuItem key={o} value={o}>{o || 'All Roles'}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>Status</InputLabel>
                        <Select
                            value={success} label="Status"
                            onChange={e => { setSuccess(e.target.value); setPage(1); }}
                            sx={{ color: '#ffffff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } }}
                        >
                            <MenuItem value="">All</MenuItem>
                            <MenuItem value="true">Success</MenuItem>
                            <MenuItem value="false">Error</MenuItem>
                        </Select>
                    </FormControl>
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', ml: 'auto' }}>
                        {total.toLocaleString()} total logs
                    </Typography>
                </Box>
            </Paper>

            {/* Table */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress sx={{ color: '#0ea5e9' }} />
                </Box>
            ) : (
                <Paper sx={{ bgcolor: '#000000', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#0a0a0a' }}>
                                    {['Time', 'Endpoint', 'Role', 'Model', 'Tokens', 'Response Time', 'Status', 'Cache'].map(h => (
                                        <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '0.72rem', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                            {h}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'rgba(255,255,255,0.3)', borderBottom: 'none' }}>
                                            No AI logs yet. Logs appear after AI endpoints are called.
                                        </TableCell>
                                    </TableRow>
                                ) : logs.map(log => (
                                    <TableRow key={log._id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            {new Date(log.createdAt).toLocaleString()}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <Typography sx={{ color: '#0ea5e9', fontSize: '0.78rem', fontWeight: 600 }}>
                                                {log.endpointName}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <Chip label={log.userRole} size="small" sx={{
                                                bgcolor: log.userRole === 'admin' ? 'rgba(239,68,68,0.15)' : log.userRole === 'teacher' ? 'rgba(245,158,11,0.15)' : 'rgba(52,211,153,0.15)',
                                                color: log.userRole === 'admin' ? '#ef4444' : log.userRole === 'teacher' ? '#f59e0b' : '#34d399',
                                                fontSize: '0.68rem',
                                            }} />
                                        </TableCell>
                                        <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            {log.model ? log.model.split('-').slice(0, 3).join('-') : '—'}
                                        </TableCell>
                                        <TableCell sx={{ color: '#a78bfa', fontSize: '0.78rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            {log.totalTokens > 0 ? log.totalTokens.toLocaleString() : '—'}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <Typography sx={{ color: msColor(log.responseTimeMs), fontSize: '0.78rem', fontWeight: 600 }}>
                                                {log.responseTimeMs > 0 ? `${log.responseTimeMs}ms` : '—'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            {log.success
                                                ? <CheckCircleIcon sx={{ color: '#34d399', fontSize: 16 }} />
                                                : (
                                                    <Box>
                                                        <ErrorIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                                                        <Typography sx={{ color: '#ef4444', fontSize: '0.65rem' }}>
                                                            {log.errorMessage?.slice(0, 40)}
                                                        </Typography>
                                                    </Box>
                                                )
                                            }
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            {log.fromCache && <CachedIcon sx={{ color: '#34d399', fontSize: 16 }} />}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <Button size="small" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                sx={{ color: '#0ea5e9' }}>← Prev</Button>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', alignSelf: 'center', fontSize: '0.8rem' }}>
                                Page {page} of {totalPages}
                            </Typography>
                            <Button size="small" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                                sx={{ color: '#0ea5e9' }}>Next →</Button>
                        </Box>
                    )}
                </Paper>
            )}
        </Box>
    );
};

export default AILogViewer;
