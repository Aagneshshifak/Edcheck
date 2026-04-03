import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, Grid, CircularProgress,
    Alert, Button, Chip, LinearProgress, Divider, Tab, Tabs,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BarChartIcon from '@mui/icons-material/BarChart';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, LineChart, Line, Legend,
} from 'recharts';


const ACCENT = '#0ea5e9';

// ── Helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (v) => {
    if (v == null) return '#9e9e9e';
    if (v >= 75)   return '#22c55e';
    if (v >= 50)   return '#f59e0b';
    return '#ef4444';
};

const riskChip = (score) => {
    if (score == null) return <Chip label="N/A" size="small" />;
    if (score >= 70)   return <Chip label="High Risk"   size="small" color="error"   />;
    if (score >= 50)   return <Chip label="Medium Risk" size="small" color="warning" />;
    return                    <Chip label="Low Risk"    size="small" color="success" />;
};

// ── Sub-panels ───────────────────────────────────────────────────────────────

const ClassOverview = ({ students }) => {
    if (!students.length) return (
        <Typography color="text.secondary" sx={{ mt: 2 }}>No student data available.</Typography>
    );

    const avgAttendance = Math.round(
        students.filter(s => s.attendancePercent != null)
            .reduce((a, s) => a + s.attendancePercent, 0) /
        (students.filter(s => s.attendancePercent != null).length || 1)
    );
    const avgScore = Math.round(
        students.filter(s => s.overallAvg != null)
            .reduce((a, s) => a + s.overallAvg, 0) /
        (students.filter(s => s.overallAvg != null).length || 1)
    );
    const highRisk = students.filter(s => s.riskScore >= 70).length;

    return (
        <Box>
            {/* Summary row */}
            <Grid container spacing={2} mb={3}>
                {[
                    { label: 'Students',        value: students.length,  color: ACCENT },
                    { label: 'Avg Attendance',  value: `${avgAttendance}%`, color: avgAttendance >= 75 ? '#22c55e' : '#ef4444' },
                    { label: 'Avg Score',       value: `${avgScore}%`,   color: scoreColor(avgScore) },
                    { label: 'High Risk',       value: highRisk,         color: '#ef4444' },
                ].map(({ label, value, color }) => (
                    <Grid item xs={6} sm={3} key={label}>
                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="h5" fontWeight={700} color={color}>{value}</Typography>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Score distribution bar chart */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>Score Distribution</Typography>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={students.map(s => ({ name: s.name.split(' ')[0], score: s.overallAvg ?? 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
                        <Bar dataKey="score" fill={ACCENT} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Paper>

            {/* Attendance bar chart */}
            <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>Attendance by Student</Typography>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={students.map(s => ({ name: s.name.split(' ')[0], att: s.attendancePercent ?? 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} />
                        <Bar dataKey="att" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Paper>
        </Box>
    );
};

const SubjectBreakdown = ({ students }) => {
    // Aggregate subject averages across all students
    const subjectMap = {};
    for (const s of students) {
        for (const sub of (s.subjectAvgs || [])) {
            if (!subjectMap[sub.name]) subjectMap[sub.name] = [];
            subjectMap[sub.name].push(sub.avg);
        }
    }
    const chartData = Object.entries(subjectMap).map(([name, scores]) => ({
        name,
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    })).sort((a, b) => b.avg - a.avg);

    if (!chartData.length) return (
        <Typography color="text.secondary" sx={{ mt: 2 }}>No test data available yet.</Typography>
    );

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={2}>Class Average by Subject</Typography>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => [`${v}%`, 'Class Avg']} />
                        <Bar dataKey="avg" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Paper>

            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.100' }}>
                        <TableRow>
                            <TableCell><strong>Subject</strong></TableCell>
                            <TableCell><strong>Class Avg</strong></TableCell>
                            <TableCell><strong>Students Below 50%</strong></TableCell>
                            <TableCell><strong>Difficulty</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {chartData.map(row => {
                            const below = (subjectMap[row.name] || []).filter(v => v < 50).length;
                            const diff  = row.avg >= 75 ? { label: 'Easy', color: 'success' }
                                        : row.avg >= 50 ? { label: 'Medium', color: 'warning' }
                                        : { label: 'Hard', color: 'error' };
                            return (
                                <TableRow key={row.name} hover>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LinearProgress
                                                variant="determinate" value={row.avg}
                                                sx={{ width: 60, height: 6, borderRadius: 3,
                                                    '& .MuiLinearProgress-bar': { bgcolor: scoreColor(row.avg) } }}
                                            />
                                            <Typography variant="body2">{row.avg}%</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{below}</TableCell>
                                    <TableCell><Chip label={diff.label} color={diff.color} size="small" /></TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

const RiskTable = ({ students }) => {
    const sorted = [...students].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    return (
        <TableContainer component={Paper}>
            <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.100' }}>
                    <TableRow>
                        <TableCell><strong>Student</strong></TableCell>
                        <TableCell><strong>Risk Score</strong></TableCell>
                        <TableCell><strong>Level</strong></TableCell>
                        <TableCell><strong>Attendance</strong></TableCell>
                        <TableCell><strong>Avg Score</strong></TableCell>
                        <TableCell><strong>Weak Subjects</strong></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {sorted.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                No data available
                            </TableCell>
                        </TableRow>
                    ) : sorted.map(s => (
                        <TableRow key={s.studentId} hover>
                            <TableCell>
                                <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                                <Typography variant="caption" color="text.secondary">Roll: {s.rollNum}</Typography>
                            </TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <LinearProgress
                                        variant="determinate" value={s.riskScore ?? 0}
                                        sx={{ width: 60, height: 6, borderRadius: 3,
                                            '& .MuiLinearProgress-bar': {
                                                bgcolor: s.riskScore >= 70 ? '#ef4444' : s.riskScore >= 50 ? '#f59e0b' : '#22c55e',
                                            } }}
                                    />
                                    <Typography variant="body2">{s.riskScore ?? '—'}%</Typography>
                                </Box>
                            </TableCell>
                            <TableCell>{riskChip(s.riskScore)}</TableCell>
                            <TableCell>{s.attendancePercent != null ? `${s.attendancePercent}%` : '—'}</TableCell>
                            <TableCell>{s.overallAvg != null ? `${s.overallAvg}%` : '—'}</TableCell>
                            <TableCell>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {s.weakSubjects.length === 0
                                        ? <Typography variant="caption" color="text.secondary">None</Typography>
                                        : s.weakSubjects.map(sub => (
                                            <Chip key={sub} label={sub} size="small" color="error" variant="outlined" />
                                        ))}
                                </Box>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const TeacherAnalytics = () => {
    const { currentUser } = useSelector(s => s.user);
    const classId = currentUser.teachSclass?._id
        || currentUser.teachClasses?.[0]?._id
        || currentUser.teachClasses?.[0]
        || '';

    const [students, setStudents] = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');
    const [tab,      setTab]      = useState(0);

    const fetchInsights = useCallback(async () => {
        if (!classId) return;
        setLoading(true); setError('');
        try {
            const { data } = await axiosInstance.get(`/Teacher/class/${classId}/insights`);
            setStudents(Array.isArray(data) ? data : []);
        } catch {
            setError('Failed to load analytics data');
        } finally { setLoading(false); }
    }, [classId]);

    useEffect(() => { fetchInsights(); }, [fetchInsights]);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BarChartIcon color="primary" />
                    <Typography variant="h5" fontWeight={700}>Class Analytics</Typography>
                </Box>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchInsights} disabled={loading}>
                    Refresh
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper sx={{ mb: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label="Overview" />
                    <Tab label="Subject Breakdown" />
                    <Tab label="Risk Analysis" />
                </Tabs>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
            ) : (
                <>
                    {tab === 0 && <ClassOverview students={students} />}
                    {tab === 1 && <SubjectBreakdown students={students} />}
                    {tab === 2 && <RiskTable students={students} />}
                </>
            )}
        </Container>
    );
};

export default TeacherAnalytics;
