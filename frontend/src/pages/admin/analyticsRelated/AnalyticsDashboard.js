import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    Button, TextField, MenuItem, Select, FormControl, InputLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Grid,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
    LineChart, Line, Legend,
} from 'recharts';

const BASE = process.env.REACT_APP_BASE_URL;
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── helpers ────────────────────────────────────────────────────────────────

const difficultyLabel = (avg) => {
    if (avg == null) return { label: 'N/A', color: 'default' };
    if (avg >= 75) return { label: 'Easy', color: 'success' };
    if (avg >= 50) return { label: 'Medium', color: 'warning' };
    return { label: 'Hard', color: 'error' };
};

// ─── Main component ──────────────────────────────────────────────────────────

const AnalyticsDashboard = () => {
    const schoolId = useSelector((state) => state.user.currentUser._id);

    // data state
    const [overview, setOverview] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [subjectDifficulty, setSubjectDifficulty] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastFetched, setLastFetched] = useState(null);

    // filter state
    const [selectedClass, setSelectedClass] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const isStale = lastFetched && Date.now() - lastFetched > STALE_MS;

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [ovRes, lbRes, sdRes] = await Promise.all([
                axios.get(`${BASE}/Admin/analytics/overview/${schoolId}`),
                axios.get(`${BASE}/Admin/analytics/leaderboard/${schoolId}`),
                axios.get(`${BASE}/Admin/analytics/subjectDifficulty/${schoolId}`),
            ]);
            setOverview(ovRes.data);
            setLeaderboard(lbRes.data);
            setSubjectDifficulty(sdRes.data);
            setLastFetched(Date.now());
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── derived / filtered data ──────────────────────────────────────────────

    const classOptions = overview
        ? [...new Map(overview.avgScoresByClass.map((c) => [String(c.classId), c.className])).entries()]
        : [];

    const filteredScores = overview
        ? (selectedClass
            ? overview.avgScoresByClass.filter((c) => String(c.classId) === selectedClass)
            : overview.avgScoresByClass)
        : [];

    const filteredTrend = overview
        ? overview.attendanceTrend30d.filter((d) => {
            if (fromDate && d.date < fromDate) return false;
            if (toDate && d.date > toDate) return false;
            return true;
        })
        : [];

    // ── render ───────────────────────────────────────────────────────────────

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h4">Analytics Dashboard</Typography>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={fetchAll}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </Box>

            {/* Stale data warning */}
            {isStale && (
                <Alert
                    severity="warning"
                    icon={<WarningAmberIcon />}
                    sx={{ mb: 2 }}
                    action={
                        <Button color="inherit" size="small" onClick={fetchAll}>
                            Refresh Now
                        </Button>
                    }
                >
                    Analytics data was last refreshed more than 24 hours ago. Data may be outdated.
                </Alert>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>Filters</Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Class</InputLabel>
                        <Select
                            value={selectedClass}
                            label="Class"
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <MenuItem value="">All Classes</MenuItem>
                            {classOptions.map(([id, name]) => (
                                <MenuItem key={id} value={id}>{name || id}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="From"
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                    />
                    <TextField
                        label="To"
                        type="date"
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                    />
                    <Button
                        size="small"
                        onClick={() => { setSelectedClass(''); setFromDate(''); setToDate(''); }}
                    >
                        Clear
                    </Button>
                </Box>
            </Paper>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && overview && (
                <Grid container spacing={3}>
                    {/* Bar chart — avg test scores by class */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Avg Test Score by Class</Typography>
                            {filteredScores.length === 0 ? (
                                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    No test score data available.
                                </Typography>
                            ) : (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={filteredScores} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="className" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                                        <YAxis domain={[0, 100]} unit="%" />
                                        <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
                                        <Bar dataKey="avgScore" fill="#1976d2" name="Avg Score" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>

                    {/* Line chart — 30-day attendance trend */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>30-Day Attendance Trend</Typography>
                            {filteredTrend.length === 0 ? (
                                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                                    No attendance trend data available.
                                </Typography>
                            ) : (
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={filteredTrend} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" angle={-35} textAnchor="end" interval={Math.floor(filteredTrend.length / 6)} tick={{ fontSize: 11 }} />
                                        <YAxis domain={[0, 100]} unit="%" />
                                        <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                                        <Legend />
                                        <Line type="monotone" dataKey="attendanceRate" stroke="#2e7d32" dot={false} name="Attendance %" strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </Paper>
                    </Grid>

                    {/* Leaderboard */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Top 10 Students by Avg Score</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                            <TableCell>#</TableCell>
                                            <TableCell>Student</TableCell>
                                            <TableCell>Class</TableCell>
                                            <TableCell align="right">Avg Score</TableCell>
                                            <TableCell align="right">Attempts</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {leaderboard.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                    No leaderboard data available.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            leaderboard.map((s, i) => (
                                                <TableRow key={s.studentId} sx={{ backgroundColor: i === 0 ? '#fff8e1' : 'inherit' }}>
                                                    <TableCell>
                                                        <Typography fontWeight={i < 3 ? 700 : 400} color={i === 0 ? 'warning.main' : 'inherit'}>
                                                            {i + 1}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{s.studentName}</TableCell>
                                                    <TableCell>{s.className || '—'}</TableCell>
                                                    <TableCell align="right">{s.avgScore}%</TableCell>
                                                    <TableCell align="right">{s.attemptCount}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>

                    {/* Subject difficulty */}
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Subject Difficulty</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                            <TableCell>Subject</TableCell>
                                            <TableCell align="right">Avg Score</TableCell>
                                            <TableCell align="right">Attempts</TableCell>
                                            <TableCell align="center">Difficulty</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {subjectDifficulty.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                    No subject data available.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            subjectDifficulty.map((s) => {
                                                const { label, color } = difficultyLabel(s.avgScore);
                                                return (
                                                    <TableRow key={s.subjectId}>
                                                        <TableCell>{s.subjectName || '—'}</TableCell>
                                                        <TableCell align="right">{s.avgScore != null ? `${s.avgScore}%` : '—'}</TableCell>
                                                        <TableCell align="right">{s.attemptCount}</TableCell>
                                                        <TableCell align="center">
                                                            <Chip label={label} color={color} size="small" />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Container>
    );
};

export default AnalyticsDashboard;
