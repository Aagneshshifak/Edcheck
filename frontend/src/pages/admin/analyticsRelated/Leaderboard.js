import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, TableContainer, CircularProgress, Alert,
    Button, FormControl, InputLabel, Select, MenuItem, Chip, Avatar,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';


const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const Leaderboard = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [rows, setRows]         = useState([]);
    const [classes, setClasses]   = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [classFilter, setClassFilter] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [lbRes, clRes] = await Promise.all([
                axiosInstance.get(`/Admin/analytics/leaderboard/${schoolId}`),
                axiosInstance.get(`/SclassList/${schoolId}`),
            ]);
            setRows(Array.isArray(lbRes.data) ? lbRes.data : []);
            setClasses(Array.isArray(clRes.data) ? clRes.data : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load leaderboard');
        } finally { setLoading(false); }
    }, [schoolId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const visible = classFilter
        ? rows.filter(r => r.className === classFilter)
        : rows;

    const classOptions = [...new Set(rows.map(r => r.className).filter(Boolean))];

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmojiEventsIcon sx={{ fontSize: 32, color: '#FFD700' }} />
                    <Typography variant="h4">Student Leaderboard</Typography>
                </Box>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData} disabled={loading}>
                    Refresh
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Class filter */}
            <Box sx={{ mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Filter by Class</InputLabel>
                    <Select value={classFilter} label="Filter by Class" onChange={e => setClassFilter(e.target.value)}>
                        <MenuItem value="">All Classes</MenuItem>
                        {classOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : visible.length === 0 ? (
                <Alert severity="info">
                    No leaderboard data yet. Data appears once students complete tests.
                </Alert>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(14,165,233,0.12)' }}>
                                <TableCell sx={{ fontWeight: 700, width: 60 }}>Rank</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Student</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Class</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="center">Roll No</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="right">Avg Score</TableCell>
                                <TableCell sx={{ fontWeight: 700 }} align="right">Attempts</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map((s, i) => {
                                const rank = i + 1;
                                const isTop3 = rank <= 3;
                                return (
                                    <TableRow
                                        key={String(s.studentId)}
                                        hover
                                        sx={{
                                            bgcolor: rank === 1 ? 'rgba(255,215,0,0.06)'
                                                   : rank === 2 ? 'rgba(192,192,192,0.06)'
                                                   : rank === 3 ? 'rgba(205,127,50,0.06)'
                                                   : 'inherit',
                                        }}
                                    >
                                        <TableCell>
                                            {isTop3 ? (
                                                <Typography fontSize={22} lineHeight={1}>{MEDAL[rank - 1]}</Typography>
                                            ) : (
                                                <Typography
                                                    variant="body2"
                                                    fontWeight={600}
                                                    sx={{ color: 'text.secondary', pl: 0.5 }}
                                                >
                                                    {rank}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    sx={{
                                                        width: 34, height: 34,
                                                        fontSize: '0.85rem',
                                                        bgcolor: isTop3 ? MEDAL_COLORS[rank - 1] : 'primary.main',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {s.studentName?.charAt(0) || '?'}
                                                </Avatar>
                                                <Typography variant="body2" fontWeight={isTop3 ? 700 : 400}>
                                                    {s.studentName}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {s.className || '—'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2">{s.rollNum}</Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Chip
                                                label={`${s.avgScore}%`}
                                                size="small"
                                                color={s.avgScore >= 75 ? 'success' : s.avgScore >= 50 ? 'warning' : 'error'}
                                                sx={{ fontWeight: 700, minWidth: 60 }}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography variant="body2" color="text.secondary">
                                                {s.attemptCount}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default Leaderboard;
