import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    Button, TextField, MenuItem, Select, FormControl, InputLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Grid, Tabs, Tab, LinearProgress, Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
    CartesianGrid, LineChart, Line, Legend,
} from 'recharts';
import SkeletonChart from '../../../components/SkeletonChart';

const BASE = process.env.REACT_APP_BASE_URL;
const STALE_MS = 24 * 60 * 60 * 1000;
const COLORS = ['#1976d2', '#7b1fa2', '#2e7d32', '#e65100', '#c62828', '#00838f', '#558b2f', '#6a1b9a'];

const difficultyLabel = (avg) => {
    if (avg == null) return { label: 'N/A', color: 'default' };
    if (avg >= 75)   return { label: 'Easy',   color: 'success' };
    if (avg >= 50)   return { label: 'Medium',  color: 'warning' };
    return                  { label: 'Hard',    color: 'error'   };
};

const riskColor = (score) => {
    if (score == null) return 'default';
    if (score >= 70)   return 'error';
    if (score >= 50)   return 'warning';
    return 'success';
};

const perfColor = (score) => {
    if (score == null) return '#9e9e9e';
    if (score >= 75)   return '#4caf50';
    if (score >= 50)   return '#ff9800';
    return '#f44336';
};

// ── School Overview ──────────────────────────────────────────────────────────

const SchoolOverview = ({ overview, selectedClass, setSelectedClass, fromDate, setFromDate, toDate, setToDate }) => {
    const classOptions = overview
        ? [...new Map(overview.avgScoresByClass.map(c => [String(c.classId), c.className])).entries()]
        : [];

    const filteredScores = (overview?.avgScoresByClass || []).filter(c =>
        !selectedClass || String(c.classId) === selectedClass
    );

    const filteredTrend = (overview?.attendanceTrend30d || []).filter(d => {
        if (fromDate && d.date < fromDate) return false;
        if (toDate   && d.date > toDate)   return false;
        return true;
    });

    const subjectMap = {};
    for (const row of (overview?.subjectPerformance || [])) {
        if (!subjectMap[row.subjectName]) subjectMap[row.subjectName] = { scores: [], name: row.subjectName };
        subjectMap[row.subjectName].scores.push(row.avgScore);
    }
    const subjectChartData = Object.values(subjectMap).map(s => ({
        name: s.name,
        avgScore: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length * 10) / 10,
    })).sort((a, b) => b.avgScore - a.avgScore);

    return (
        <Box>
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Class</InputLabel>
                        <Select value={selectedClass} label="Class" onChange={e => setSelectedClass(e.target.value)}>
                            <MenuItem value="">All Classes</MenuItem>
                            {classOptions.map(([id, name]) => <MenuItem key={id} value={id}>{name || id}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField label="From" type="date" size="small" InputLabelProps={{ shrink: true }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
                    <TextField label="To"   type="date" size="small" InputLabelProps={{ shrink: true }} value={toDate}   onChange={e => setToDate(e.target.value)} />
                    <Button size="small" onClick={() => { setSelectedClass(''); setFromDate(''); setToDate(''); }}>Clear</Button>
                </Box>
            </Paper>
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Class-wise Avg Test Score</Typography>
                        {filteredScores.length === 0
                            ? <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data yet.</Typography>
                            : <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={filteredScores} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="className" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                                    <YAxis domain={[0, 100]} unit="%" />
                                    <RTooltip formatter={v => [`${v}%`, 'Avg Score']} />
                                    <Bar dataKey="avgScore" fill="#1976d2" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        }
                    </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Subject-wise Performance</Typography>
                        {subjectChartData.length === 0
                            ? <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data yet.</Typography>
                            : <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={subjectChartData} layout="vertical" margin={{ top: 5, right: 40, left: 80, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} unit="%" />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                                    <RTooltip formatter={v => [`${v}%`, 'Avg Score']} />
                                    <Bar dataKey="avgScore" fill="#7b1fa2" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        }
                    </Paper>
                </Grid>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>30-Day Attendance Trend</Typography>
                        {filteredTrend.length === 0
                            ? <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No attendance data.</Typography>
                            : <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={filteredTrend} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" angle={-35} textAnchor="end" interval={Math.floor(filteredTrend.length / 6)} tick={{ fontSize: 11 }} />
                                    <YAxis domain={[0, 100]} unit="%" />
                                    <RTooltip formatter={v => [`${v}%`, 'Attendance']} />
                                    <Legend />
                                    <Line type="monotone" dataKey="attendanceRate" stroke="#2e7d32" dot={false} name="Attendance %" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        }
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Assignment Completion</Typography>
                        {(overview?.completionRatesByClass || []).filter(c => c.completionRate != null).length === 0
                            ? <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No data.</Typography>
                            : (overview?.completionRatesByClass || []).filter(c => c.completionRate != null).map(c => (
                                <Box key={String(c.classId)} sx={{ mb: 1.5 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="body2">{c.className}</Typography>
                                        <Typography variant="body2" fontWeight={600}>{c.completionRate}%</Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={c.completionRate}
                                        sx={{ height: 8, borderRadius: 4,
                                            '& .MuiLinearProgress-bar': { bgcolor: c.completionRate >= 75 ? '#4caf50' : c.completionRate >= 50 ? '#ff9800' : '#f44336' }
                                        }} />
                                </Box>
                            ))
                        }
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

// ── Teacher Performance ──────────────────────────────────────────────────────

const TeacherPerformance = ({ teachers }) => (
    <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Performance score = 60% avg student test score + 40% assignment completion rate.
        </Typography>
        {teachers.length === 0
            ? <Alert severity="info">No teacher performance data available yet.</Alert>
            : <Grid container spacing={2}>
                {teachers.map((t, i) => (
                    <Grid item xs={12} sm={6} md={4} key={String(t.teacherId)}>
                        <Paper sx={{ p: 2, border: i === 0 ? '2px solid #1976d2' : '1px solid #e0e0e0' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box>
                                    <Typography fontWeight={700}>{t.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">{t.email}</Typography>
                                </Box>
                                {i === 0 && <Chip label="Top" color="primary" size="small" />}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                                {(t.subjects || []).map(s => <Chip key={s} label={s} size="small" variant="outlined" />)}
                            </Box>
                            <Divider sx={{ mb: 1.5 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">Performance Score</Typography>
                                <Typography variant="body2" fontWeight={700} sx={{ color: perfColor(t.performanceScore) }}>
                                    {t.performanceScore != null ? `${t.performanceScore}%` : 'N/A'}
                                </Typography>
                            </Box>
                            <LinearProgress variant="determinate" value={t.performanceScore || 0}
                                sx={{ height: 8, borderRadius: 4, mb: 1.5,
                                    '& .MuiLinearProgress-bar': { bgcolor: perfColor(t.performanceScore) }
                                }} />
                            <Grid container spacing={1}>
                                {[
                                    { label: 'Avg Student Score', value: t.avgStudentScore != null ? `${t.avgStudentScore}%` : 'N/A' },
                                    { label: 'Assignment Completion', value: t.assignmentCompletionRate != null ? `${t.assignmentCompletionRate}%` : 'N/A' },
                                    { label: 'Tests Created', value: t.testsCreated },
                                    { label: 'Assignments Created', value: t.assignmentsCreated },
                                ].map(({ label, value }) => (
                                    <Grid item xs={6} key={label}>
                                        <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                                            <Typography variant="h6" fontSize={16}>{value}</Typography>
                                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        }
    </Box>
);

// ── Student Risk Monitor ─────────────────────────────────────────────────────

const StudentRisk = ({ students }) => {
    const [classFilter, setClassFilter] = useState('');
    const classOptions = [...new Set(students.map(s => s.className))].filter(Boolean);
    const visible = classFilter ? students.filter(s => s.className === classFilter) : students;

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                    Students with attendance below 75% or avg score below 50% are flagged.
                </Typography>
                <FormControl size="small" sx={{ minWidth: 160, ml: 'auto' }}>
                    <InputLabel>Filter by Class</InputLabel>
                    <Select value={classFilter} label="Filter by Class" onChange={e => setClassFilter(e.target.value)}>
                        <MenuItem value="">All Classes</MenuItem>
                        {classOptions.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>
            {visible.length === 0
                ? <Alert severity="success">No at-risk students detected.</Alert>
                : <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Student', 'Class', 'Attendance', 'Avg Score', 'Risk Score', 'Flags'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visible.map(s => (
                                <TableRow key={String(s.studentId)} hover
                                    sx={{ bgcolor: s.riskScore >= 70 ? '#fff3e0' : 'inherit' }}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {s.riskScore >= 70 && <WarningAmberIcon fontSize="small" color="error" />}
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">Roll: {s.rollNum}</Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{s.className}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LinearProgress variant="determinate" value={s.attendanceRate || 0}
                                                sx={{ width: 60, height: 6, borderRadius: 3,
                                                    '& .MuiLinearProgress-bar': { bgcolor: (s.attendanceRate || 0) >= 75 ? '#4caf50' : '#f44336' }
                                                }} />
                                            <Typography variant="body2">{s.attendanceRate != null ? `${s.attendanceRate}%` : 'N/A'}</Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{s.avgScore != null ? `${s.avgScore}%` : 'N/A'}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={s.riskScore != null ? `${s.riskScore}%` : 'N/A'}
                                            color={riskColor(s.riskScore)} size="small" />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {(s.flags || []).map(f => <Chip key={f} label={f} size="small" color="warning" />)}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            }
        </Box>
    );
};

// ── Leaderboard + Subject Difficulty ────────────────────────────────────────

const LeaderboardSection = ({ leaderboard, subjectDifficulty }) => (
    <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Top 10 Students by Avg Score</Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell>#</TableCell>
                                <TableCell>Student</TableCell>
                                <TableCell>Class</TableCell>
                                <TableCell align="right">Avg Score</TableCell>
                                <TableCell align="right">Attempts</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {leaderboard.length === 0
                                ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No data.</TableCell></TableRow>
                                : leaderboard.map((s, i) => (
                                    <TableRow key={String(s.studentId)} sx={{ bgcolor: i === 0 ? '#fff8e1' : 'inherit' }}>
                                        <TableCell><Typography fontWeight={i < 3 ? 700 : 400} color={i === 0 ? 'warning.main' : 'inherit'}>{i + 1}</Typography></TableCell>
                                        <TableCell>{s.studentName}</TableCell>
                                        <TableCell>{s.className || 'N/A'}</TableCell>
                                        <TableCell align="right">{s.avgScore}%</TableCell>
                                        <TableCell align="right">{s.attemptCount}</TableCell>
                                    </TableRow>
                                ))
                            }
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Subject Difficulty</Typography>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell>Subject</TableCell>
                                <TableCell align="right">Avg Score</TableCell>
                                <TableCell align="right">Attempts</TableCell>
                                <TableCell align="center">Difficulty</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {subjectDifficulty.length === 0
                                ? <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No data.</TableCell></TableRow>
                                : subjectDifficulty.map(s => {
                                    const { label, color } = difficultyLabel(s.avgScore);
                                    return (
                                        <TableRow key={String(s.subjectId)}>
                                            <TableCell>{s.subjectName || 'N/A'}</TableCell>
                                            <TableCell align="right">{s.avgScore != null ? `${s.avgScore}%` : 'N/A'}</TableCell>
                                            <TableCell align="right">{s.attemptCount}</TableCell>
                                            <TableCell align="center"><Chip label={label} color={color} size="small" /></TableCell>
                                        </TableRow>
                                    );
                                })
                            }
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Grid>
    </Grid>
);

// ── Grade Distribution ───────────────────────────────────────────────────────

const GradeDistribution = ({ gradeDistribution, loadingGrade, classes, subjects }) => {
    return (
        <Box>
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Class</InputLabel>
                        <Select defaultValue="" label="Class">
                            <MenuItem value="">All Classes</MenuItem>
                            {(classes || []).map(c => <MenuItem key={String(c.classId)} value={String(c.classId)}>{c.className}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Subject</InputLabel>
                        <Select defaultValue="" label="Subject">
                            <MenuItem value="">All Subjects</MenuItem>
                            {(subjects || []).map(s => <MenuItem key={String(s.subjectId)} value={String(s.subjectId)}>{s.subjectName}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>
            </Paper>

            {loadingGrade ? (
                <SkeletonChart height={300} />
            ) : !gradeDistribution ? (
                <Alert severity="info">No grade distribution data available yet.</Alert>
            ) : (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Score Distribution</Typography>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={gradeDistribution.buckets || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                                    <YAxis allowDecimals={false} />
                                    <RTooltip formatter={v => [v, 'Students']} />
                                    <Bar dataKey="count" fill="#1976d2" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Grid container spacing={2} direction="column">
                            {[
                                { label: 'Mean', value: gradeDistribution.stats?.mean != null ? `${gradeDistribution.stats.mean}%` : 'N/A' },
                                { label: 'Median', value: gradeDistribution.stats?.median != null ? `${gradeDistribution.stats.median}%` : 'N/A' },
                                { label: 'Std Dev', value: gradeDistribution.stats?.stddev != null ? `${gradeDistribution.stats.stddev}` : 'N/A' },
                            ].map(({ label, value }) => (
                                <Grid item key={label}>
                                    <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                                        <Typography variant="h5" fontWeight={700}>{value}</Typography>
                                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                                    </Paper>
                                </Grid>
                            ))}
                            <Grid item>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>Pass / Fail Ratio</Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        <Chip label={`Pass: ${gradeDistribution.passFailRatio?.pass ?? 0}%`} color="success" size="small" />
                                        <Chip label={`Fail: ${gradeDistribution.passFailRatio?.fail ?? 0}%`} color="error" size="small" />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">
                                        Threshold: {gradeDistribution.passFailRatio?.threshold ?? 50}%
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
};

// ── Cohort Progression ───────────────────────────────────────────────────────

const CohortProgression = ({ cohortProgression, loadingCohort }) => {
    const data = cohortProgression;
    const hasData = data && data.series && data.series.some(s => s.data && s.data.some(v => v != null));

    const chartData = !data ? [] : (data.months || []).map((month, i) => {
        const point = { month };
        (data.series || []).forEach(s => { point[s.className] = s.data[i]; });
        return point;
    });

    return (
        <Box>
            {loadingCohort ? (
                <SkeletonChart height={320} />
            ) : !data ? (
                <Alert severity="info">No cohort progression data available yet.</Alert>
            ) : !hasData ? (
                <Alert severity="info">No data available for the selected period.</Alert>
            ) : (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Monthly Average Score by Class</Typography>
                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis domain={[0, 100]} unit="%" />
                            <RTooltip formatter={v => v != null ? [`${v}%`, ''] : ['N/A', '']} />
                            <Legend />
                            {(data.series || []).map((s, i) => (
                                <Line
                                    key={s.classId}
                                    type="monotone"
                                    dataKey={s.className}
                                    stroke={COLORS[i % COLORS.length]}
                                    strokeWidth={s.classId === 'school' ? 3 : 2}
                                    strokeDasharray={s.classId === 'school' ? '5 5' : undefined}
                                    dot={false}
                                    connectNulls
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </Paper>
            )}
        </Box>
    );
};

// ── Risk Trends ──────────────────────────────────────────────────────────────

const RiskTrends = ({ riskTrends, loadingRisk }) => {
    const data = riskTrends;
    const highRiskSet = new Set((data?.highRisk || []).map(String));

    const StudentRow = ({ student }) => {
        const isHigh = highRiskSet.has(String(student.studentId));
        const delta = student.delta ?? 0;
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid #f0f0f0' }}>
                <TrendingDownIcon fontSize="small" color="error" />
                <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{student.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{student.className}</Typography>
                </Box>
                <Typography variant="body2" color="error.main" fontWeight={600}>
                    {Math.abs(delta)}pp
                </Typography>
                {isHigh && <Chip label="High Risk" color="error" size="small" sx={{ fontWeight: 700 }} />}
            </Box>
        );
    };

    return (
        <Box>
            {loadingRisk ? (
                <SkeletonChart height={300} />
            ) : !data ? (
                <Alert severity="info">No risk trend data available yet.</Alert>
            ) : (
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Attendance Decline</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Students whose attendance dropped &gt;10pp (last 30d vs prior 30d)
                            </Typography>
                            {(data.attendanceDecline || []).length === 0 ? (
                                <Alert severity="success" sx={{ mt: 2 }}>No students at risk.</Alert>
                            ) : (
                                <Box sx={{ mt: 1 }}>
                                    {data.attendanceDecline.map(s => (
                                        <StudentRow key={String(s.studentId)} student={s} />
                                    ))}
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Score Decline</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Students whose avg score dropped &gt;15pp (last 3 tests vs prior 3)
                            </Typography>
                            {(data.scoreDecline || []).length === 0 ? (
                                <Alert severity="success" sx={{ mt: 2 }}>No students at risk.</Alert>
                            ) : (
                                <Box sx={{ mt: 1 }}>
                                    {data.scoreDecline.map(s => (
                                        <StudentRow key={String(s.studentId)} student={s} />
                                    ))}
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
};

// ── Parent Engagement ────────────────────────────────────────────────────────

const ParentEngagement = ({ parentEngagement, loadingParent }) => {
    const data = parentEngagement;

    return (
        <Box>
            {loadingParent ? (
                <SkeletonChart height={200} />
            ) : !data ? (
                <Alert severity="info">No parent engagement data available yet.</Alert>
            ) : data.totalParents === 0 ? (
                <Alert severity="info">No parent accounts registered yet.</Alert>
            ) : (
                <Grid container spacing={3}>
                    {[
                        { label: 'Total Parents', value: data.totalParents, sub: 'registered accounts' },
                        { label: 'Active (30d)', value: `${data.activePercent ?? 0}%`, sub: `${data.activeParents ?? 0} of ${data.totalParents} logged in` },
                        { label: 'Notification Read Rate', value: `${data.notificationReadRate ?? 0}%`, sub: `${data.read ?? 0} of ${data.delivered ?? 0} delivered` },
                    ].map(({ label, value, sub }) => (
                        <Grid item xs={12} sm={4} key={label}>
                            <Paper sx={{ p: 3, textAlign: 'center' }}>
                                <Typography variant="h4" fontWeight={700}>{value}</Typography>
                                <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 0.5 }}>{label}</Typography>
                                <Typography variant="caption" color="text.secondary">{sub}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

// ── Main Dashboard ───────────────────────────────────────────────────────────

const AnalyticsDashboard = ({ initialTab = 0 }) => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [overview, setOverview]                   = useState(null);
    const [leaderboard, setLeaderboard]             = useState([]);
    const [subjectDifficulty, setSubjectDifficulty] = useState([]);
    const [teachers, setTeachers]                   = useState([]);
    const [riskStudents, setRiskStudents]           = useState([]);
    const [gradeDistribution, setGradeDistribution] = useState(null);
    const [cohortProgression, setCohortProgression] = useState(null);
    const [riskTrends, setRiskTrends]               = useState(null);
    const [parentEngagement, setParentEngagement]   = useState(null);
    const [loading, setLoading]                     = useState(false);
    const [loadingGrade, setLoadingGrade]           = useState(false);
    const [loadingCohort, setLoadingCohort]         = useState(false);
    const [loadingRisk, setLoadingRisk]             = useState(false);
    const [loadingParent, setLoadingParent]         = useState(false);
    const [error, setError]                         = useState('');
    const [lastFetched, setLastFetched]             = useState(null);
    const [tab, setTab]                             = useState(initialTab);
    const [selectedClass, setSelectedClass]         = useState('');
    const [fromDate, setFromDate]                   = useState('');
    const [toDate, setToDate]                       = useState('');

    const isStale = lastFetched && Date.now() - lastFetched > STALE_MS;

    const fetchAll = useCallback(async () => {
        setLoading(true); setError('');
        setLoadingGrade(true); setLoadingCohort(true); setLoadingRisk(true); setLoadingParent(true);
        try {
            const [ovRes, lbRes, sdRes, tRes, rRes, gdRes, cpRes, rtRes, peRes] = await Promise.all([
                axios.get(`${BASE}/Admin/analytics/overview/${schoolId}`),
                axios.get(`${BASE}/Admin/analytics/leaderboard/${schoolId}`),
                axios.get(`${BASE}/Admin/analytics/subjectDifficulty/${schoolId}`),
                axios.get(`${BASE}/Admin/analytics/teachers/${schoolId}`),
                axios.get(`${BASE}/Admin/analytics/risk/${schoolId}`),
                axios.get(`${BASE}/Admin/analytics/gradeDistribution/${schoolId}`).catch(() => ({ data: null })),
                axios.get(`${BASE}/Admin/analytics/cohortProgression/${schoolId}`).catch(() => ({ data: null })),
                axios.get(`${BASE}/Admin/analytics/riskTrends/${schoolId}`).catch(() => ({ data: null })),
                axios.get(`${BASE}/Admin/analytics/parentEngagement/${schoolId}`).catch(() => ({ data: null })),
            ]);
            setOverview(ovRes.data);
            setLeaderboard(Array.isArray(lbRes.data) ? lbRes.data : []);
            setSubjectDifficulty(Array.isArray(sdRes.data) ? sdRes.data : []);
            setTeachers(Array.isArray(tRes.data) ? tRes.data : []);
            setRiskStudents(Array.isArray(rRes.data) ? rRes.data : []);
            setGradeDistribution(gdRes.data);
            setCohortProgression(cpRes.data);
            setRiskTrends(rtRes.data);
            setParentEngagement(peRes.data);
            setLastFetched(Date.now());
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
            setLoadingGrade(false); setLoadingCohort(false); setLoadingRisk(false); setLoadingParent(false);
        }
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const classOptions = (overview?.avgScoresByClass || []).map(c => ({ classId: c.classId, className: c.className }));
    const subjectOptions = (overview?.subjectPerformance || [])
        .map(s => ({ subjectId: s.subjectId, subjectName: s.subjectName }))
        .filter((s, i, arr) => arr.findIndex(x => String(x.subjectId) === String(s.subjectId)) === i);

    const TABS = [
        { label: 'School Overview' },
        { label: 'Teacher Performance' },
        { label: `Student Risk (${riskStudents.length})` },
        { label: 'Leaderboard' },
        { label: 'Grade Distribution' },
        { label: 'Cohort Progression' },
        { label: 'Risk Trends' },
        { label: 'Parent Engagement' },
    ];

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h4">Analytics Dashboard</Typography>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAll} disabled={loading}>Refresh</Button>
            </Box>

            {isStale && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}
                    action={<Button color="inherit" size="small" onClick={fetchAll}>Refresh Now</Button>}>
                    Data last refreshed over 24 hours ago.
                </Alert>
            )}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }} variant="scrollable" scrollButtons="auto">
                {TABS.map((t, i) => <Tab key={i} label={t.label} />)}
            </Tabs>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : (
                <>
                    {tab === 0 && overview && (
                        <SchoolOverview overview={overview}
                            selectedClass={selectedClass} setSelectedClass={setSelectedClass}
                            fromDate={fromDate} setFromDate={setFromDate}
                            toDate={toDate} setToDate={setToDate} />
                    )}
                    {tab === 0 && !overview && !loading && (
                        <Alert severity="info">No analytics data yet. Data appears once students take tests and attendance is recorded.</Alert>
                    )}
                    {tab === 1 && <TeacherPerformance teachers={teachers} />}
                    {tab === 2 && <StudentRisk students={riskStudents} />}
                    {tab === 3 && <LeaderboardSection leaderboard={leaderboard} subjectDifficulty={subjectDifficulty} />}
                    {tab === 4 && (
                        <GradeDistribution
                            gradeDistribution={gradeDistribution}
                            loadingGrade={loadingGrade}
                            classes={classOptions}
                            subjects={subjectOptions}
                        />
                    )}
                    {tab === 5 && <CohortProgression cohortProgression={cohortProgression} loadingCohort={loadingCohort} />}
                    {tab === 6 && <RiskTrends riskTrends={riskTrends} loadingRisk={loadingRisk} />}
                    {tab === 7 && <ParentEngagement parentEngagement={parentEngagement} loadingParent={loadingParent} />}
                </>
            )}
        </Container>
    );
};

export default AnalyticsDashboard;
