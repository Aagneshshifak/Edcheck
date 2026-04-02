import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, TableContainer, Chip, LinearProgress,
    CircularProgress, Alert, Button, TextField, InputAdornment,
    Collapse, IconButton,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const BASE = process.env.REACT_APP_BASE_URL;

const riskLevel = (score) => {
    if (score == null) return { label: 'Unknown', color: 'default' };
    if (score >= 70)   return { label: 'High Risk',    color: 'error'   };
    if (score >= 50)   return { label: 'Medium Risk',  color: 'warning' };
    return                    { label: 'Low Risk',     color: 'success' };
};

const StudentRow = ({ s }) => {
    const [open, setOpen] = useState(false);
    const { label, color } = riskLevel(s.riskScore);
    const isHigh = s.riskScore >= 70;

    return (
        <>
            <TableRow
                hover
                sx={{ bgcolor: isHigh ? 'rgba(244,67,54,0.06)' : 'inherit' }}
            >
                <TableCell padding="checkbox">
                    <IconButton size="small" onClick={() => setOpen(o => !o)}>
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {isHigh && <WarningAmberIcon fontSize="small" color="error" />}
                        <Box>
                            <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                            <Typography variant="caption" color="text.secondary">Roll: {s.rollNum}</Typography>
                        </Box>
                    </Box>
                </TableCell>
                <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress
                            variant="determinate"
                            value={s.riskScore ?? 0}
                            sx={{
                                width: 70, height: 6, borderRadius: 3,
                                '& .MuiLinearProgress-bar': {
                                    bgcolor: s.riskScore >= 70 ? '#f44336' : s.riskScore >= 50 ? '#ff9800' : '#4caf50',
                                },
                            }}
                        />
                        <Typography variant="body2" fontWeight={700}>
                            {s.riskScore != null ? `${s.riskScore}%` : '—'}
                        </Typography>
                    </Box>
                </TableCell>
                <TableCell>
                    <Chip label={label} color={color} size="small" />
                </TableCell>
                <TableCell>
                    {s.attendancePercent != null ? `${s.attendancePercent}%` : '—'}
                </TableCell>
                <TableCell>
                    {s.overallAvg != null ? `${s.overallAvg}%` : '—'}
                </TableCell>
                <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {s.weakSubjects.length === 0
                            ? <Typography variant="caption" color="text.secondary">None</Typography>
                            : s.weakSubjects.map(sub => (
                                <Chip key={sub} label={sub} size="small" color="error" variant="outlined" />
                            ))
                        }
                    </Box>
                </TableCell>
            </TableRow>

            {/* Expandable subject breakdown */}
            <TableRow>
                <TableCell colSpan={7} sx={{ py: 0 }}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ m: 1.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                Subject-wise average scores
                            </Typography>
                            {s.subjectAvgs.length === 0 ? (
                                <Typography variant="caption" color="text.secondary">No test data</Typography>
                            ) : s.subjectAvgs.map(sub => (
                                <Box key={sub.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.8 }}>
                                    <Typography variant="caption" sx={{ width: 140, flexShrink: 0 }}>{sub.name}</Typography>
                                    <LinearProgress
                                        variant="determinate"
                                        value={sub.avg}
                                        sx={{
                                            flex: 1, height: 6, borderRadius: 3,
                                            '& .MuiLinearProgress-bar': {
                                                bgcolor: sub.avg < 50 ? '#f44336' : sub.avg < 75 ? '#ff9800' : '#4caf50',
                                            },
                                        }}
                                    />
                                    <Typography variant="caption" fontWeight={600} sx={{ width: 36, textAlign: 'right' }}>
                                        {sub.avg}%
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};

const WeakStudentsPanel = () => {
    const { currentUser } = useSelector(s => s.user);
    const classId = currentUser.teachSclass?._id
        || currentUser.teachClasses?.[0]?._id
        || currentUser.teachClasses?.[0]
        || '';

    const [students, setStudents] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [search, setSearch]     = useState('');
    const [filter, setFilter]     = useState('all'); // all | high | medium | low

    const fetchInsights = useCallback(async () => {
        if (!classId) return;
        setLoading(true); setError('');
        try {
            const { data } = await axios.get(`${BASE}/Teacher/class/${classId}/insights`);
            setStudents(Array.isArray(data) ? data : []);
        } catch {
            setError('Failed to load student insights');
        } finally { setLoading(false); }
    }, [classId]);

    useEffect(() => { fetchInsights(); }, [fetchInsights]);

    const visible = students.filter(s => {
        if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'high'   && s.riskScore < 70)  return false;
        if (filter === 'medium' && (s.riskScore < 50 || s.riskScore >= 70)) return false;
        if (filter === 'low'    && s.riskScore >= 50)  return false;
        return true;
    });

    const highCount   = students.filter(s => s.riskScore >= 70).length;
    const mediumCount = students.filter(s => s.riskScore >= 50 && s.riskScore < 70).length;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon color="warning" />
                    <Typography variant="h5">Weak Students Monitor</Typography>
                </Box>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchInsights} disabled={loading}>
                    Refresh
                </Button>
            </Box>

            {/* Summary chips */}
            {!loading && students.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip label={`${students.length} total`} onClick={() => setFilter('all')} variant={filter === 'all' ? 'filled' : 'outlined'} />
                    <Chip label={`${highCount} high risk`} color="error" onClick={() => setFilter('high')} variant={filter === 'high' ? 'filled' : 'outlined'} />
                    <Chip label={`${mediumCount} medium risk`} color="warning" onClick={() => setFilter('medium')} variant={filter === 'medium' ? 'filled' : 'outlined'} />
                    <Chip label={`${students.length - highCount - mediumCount} low risk`} color="success" onClick={() => setFilter('low')} variant={filter === 'low' ? 'filled' : 'outlined'} />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <TextField
                size="small" placeholder="Search student..." value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ mb: 2, width: 280 }}
            />

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell />
                                <TableCell><strong>Student</strong></TableCell>
                                <TableCell><strong>Risk Score</strong></TableCell>
                                <TableCell><strong>Level</strong></TableCell>
                                <TableCell><strong>Attendance</strong></TableCell>
                                <TableCell><strong>Avg Score</strong></TableCell>
                                <TableCell><strong>Weak Subjects</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        {students.length === 0 ? 'No student data available' : 'No students match the current filter'}
                                    </TableCell>
                                </TableRow>
                            ) : visible.map(s => <StudentRow key={s.studentId} s={s} />)}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default WeakStudentsPanel;
