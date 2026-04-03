import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, TableContainer, CircularProgress, Alert,
    Button, Chip, Avatar, FormControl, InputLabel, Select, MenuItem,
    TablePagination,
} from '@mui/material';
import RefreshIcon    from '@mui/icons-material/Refresh';
import HistoryIcon    from '@mui/icons-material/History';
import PersonIcon     from '@mui/icons-material/Person';
import SchoolIcon     from '@mui/icons-material/School';
import SmartToyIcon   from '@mui/icons-material/SmartToy';


const ROLE_COLORS = { Admin: 'primary', Teacher: 'secondary', System: 'default' };
const ROLE_ICONS  = { Admin: <PersonIcon fontSize="small" />, Teacher: <SchoolIcon fontSize="small" />, System: <SmartToyIcon fontSize="small" /> };

const timeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

const ActivityLog = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [logs,    setLogs]    = useState([]);
    const [total,   setTotal]   = useState(0);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');
    const [page,    setPage]    = useState(0);
    const [roleFilter, setRoleFilter]     = useState('');
    const [typeFilter, setTypeFilter]     = useState('');

    const LIMIT = 50;

    const fetchLogs = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const params = { limit: LIMIT, page: page + 1 };
            if (roleFilter) params.actorRole  = roleFilter;
            if (typeFilter) params.targetType = typeFilter;
            const { data } = await axiosInstance.get(`/Admin/activity/${schoolId}`, { params });
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } catch { setError('Failed to load activity logs'); }
        finally { setLoading(false); }
    }, [schoolId, page, roleFilter, typeFilter]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Activity Log
                </Typography>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchLogs} disabled={loading}>Refresh</Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Role</InputLabel>
                    <Select value={roleFilter} label="Role" onChange={e => { setRoleFilter(e.target.value); setPage(0); }}>
                        <MenuItem value=""><em>All</em></MenuItem>
                        {['Admin', 'Teacher', 'System'].map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Target Type</InputLabel>
                    <Select value={typeFilter} label="Target Type" onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
                        <MenuItem value=""><em>All</em></MenuItem>
                        {['student', 'teacher', 'assignment', 'test', 'class', 'subject'].map(t => (
                            <MenuItem key={t} value={t}>{t}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Typography variant="body2" sx={{ alignSelf: 'center', color: 'text.secondary', ml: 'auto' }}>
                    {total} events
                </Typography>
            </Box>

            {loading ? <CircularProgress /> : (
                <Paper>
                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'grey.100' }}>
                                <TableRow>
                                    {['Actor', 'Action', 'Target', 'Details', 'When'].map(h => (
                                        <TableCell key={h}><strong>{h}</strong></TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} align="center">No activity yet.</TableCell></TableRow>
                                ) : logs.map(log => (
                                    <TableRow key={log._id} hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                                                    {log.actorName?.charAt(0) || '?'}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>{log.actorName}</Typography>
                                                    <Chip icon={ROLE_ICONS[log.actorRole]} label={log.actorRole} size="small" color={ROLE_COLORS[log.actorRole] || 'default'} variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">{log.action}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            {log.target && <Chip label={log.target} size="small" variant="outlined" />}
                                            {log.targetType && <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{log.targetType}</Typography>}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">{log.details || '—'}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary" title={new Date(log.createdAt).toLocaleString()}>
                                                {timeAgo(log.createdAt)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div" count={total} page={page} rowsPerPage={LIMIT}
                        rowsPerPageOptions={[LIMIT]}
                        onPageChange={(_, p) => setPage(p)}
                    />
                </Paper>
            )}
        </Container>
    );
};

export default ActivityLog;
