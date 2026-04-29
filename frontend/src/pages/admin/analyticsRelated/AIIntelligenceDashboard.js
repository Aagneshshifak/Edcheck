import { useState, useEffect, useRef } from 'react';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Paper, Typography, Button, Chip, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Grid, Skeleton, Modal, IconButton, CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';

// ── Shared helpers ────────────────────────────────────────────────────────────

const priorityColor = (priority) => {
    if (priority === 'High')   return 'error';
    if (priority === 'Medium') return 'warning';
    return 'success';
};

const scoreColor = (score) => {
    if (score == null) return '#9e9e9e';
    if (score >= 75)   return '#4caf50';
    if (score >= 50)   return '#ff9800';
    return '#f44336';
};

const CachedAt = ({ cachedAt }) => {
    if (!cachedAt) return null;
    return (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            (cached at {new Date(cachedAt).toLocaleTimeString()})
        </Typography>
    );
};

const EmptyState = ({ message }) => (
    <Box sx={{ py: 6, textAlign: 'center' }}>
        <SmartToyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">{message}</Typography>
    </Box>
);

const PanelSkeleton = () => (
    <Box>
        <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={40} sx={{ mb: 1, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
    </Box>
);

// ── High Risk Students Panel ──────────────────────────────────────────────────

const HighRiskStudentsPanel = ({ schoolId, panelRef }) => {
    const [profiles, setProfiles]   = useState([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [cachedAt, setCachedAt]   = useState(null);
    const [latestTestId, setLatestTestId] = useState(null);

    // Fetch the most recent test for this school on mount
    useEffect(() => {
        axiosInstance.get(`/Admin/tests/${schoolId}`)
            .then(res => {
                const tests = Array.isArray(res.data) ? res.data : (res.data?.tests || []);
                if (tests.length > 0) {
                    // Sort by createdAt descending and pick the first
                    const sorted = [...tests].sort((a, b) =>
                        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                    );
                    setLatestTestId(sorted[0]._id);
                }
            })
            .catch(() => {});
    }, [schoolId]);

    const runAnalysis = async () => {
        if (!latestTestId) {
            setError('No tests found for this school. Create a test first.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.post('/api/ai/admin/predict-student-risk', { testId: latestTestId });
            setProfiles(res.data.profiles || []);
            setCachedAt(res.data.cachedAt || null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to run analysis');
        } finally {
            setLoading(false);
        }
    };

    const highRisk = profiles.filter(p => p.riskLevel === 'High');

    return (
        <Paper sx={{ p: 3 }} ref={panelRef}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">⚠️ High-Risk Students</Typography>
                    <CachedAt cachedAt={cachedAt} />
                </Box>
                <Button variant="contained" color="error" size="small" onClick={runAnalysis} disabled={loading}>
                    {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                    Run Analysis
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <PanelSkeleton />
            ) : highRisk.length === 0 ? (
                <EmptyState message="No high-risk students found. Run analysis to generate predictions." />
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell><strong>Student ID</strong></TableCell>
                                <TableCell><strong>Risk Level</strong></TableCell>
                                <TableCell><strong>Weak Subjects</strong></TableCell>
                                <TableCell><strong>Suggested Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {highRisk.map((p, i) => (
                                <TableRow key={String(p.studentId) + i} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>
                                            {String(p.studentId).slice(-8)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={p.riskLevel} color="error" size="small" />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {(p.weakSubjects || []).map(s => (
                                                <Chip key={s} label={s} size="small" variant="outlined" color="warning" />
                                            ))}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            {(p.suggestedActions || []).slice(0, 2).map((action, idx) => (
                                                <Typography key={idx} variant="caption">• {action}</Typography>
                                            ))}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
};

// ── Weak Classes Panel ────────────────────────────────────────────────────────

const WeakClassesPanel = ({ schoolId, panelRef }) => {
    const [reports, setReports]   = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [cachedAt, setCachedAt] = useState(null);

    const runAnalysis = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch all classes for this school
            const classRes = await axiosInstance.get(`/SclassList/${schoolId}`);
            const classes = Array.isArray(classRes.data) ? classRes.data : [];

            if (classes.length === 0) {
                setError('No classes found for this school.');
                setLoading(false);
                return;
            }

            // Run analysis for each class
            const results = [];
            let lastCachedAt = null;
            for (const cls of classes) {
                try {
                    const res = await axiosInstance.post('/api/ai/admin/class-performance-analysis', {
                        classId: String(cls._id),
                    });
                    results.push({ ...res.data.report, className: cls.className || cls.sclassName });
                    if (res.data.cachedAt) lastCachedAt = res.data.cachedAt;
                } catch {
                    // Skip classes that fail
                }
            }

            // Sort by averageScore ascending (weakest first)
            results.sort((a, b) => (a.averageScore ?? 100) - (b.averageScore ?? 100));
            setReports(results);
            setCachedAt(lastCachedAt);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to run analysis');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{ p: 3 }} ref={panelRef}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">📉 Weak Classes</Typography>
                    <CachedAt cachedAt={cachedAt} />
                </Box>
                <Button variant="contained" color="warning" size="small" onClick={runAnalysis} disabled={loading}>
                    {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                    Run Analysis
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <PanelSkeleton />
            ) : reports.length === 0 ? (
                <EmptyState message="No class performance data yet. Run analysis to generate reports." />
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell><strong>Class Name</strong></TableCell>
                                <TableCell align="right"><strong>Avg Score</strong></TableCell>
                                <TableCell><strong>Weak Subjects</strong></TableCell>
                                <TableCell><strong>Recommendations</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reports.map((r, i) => (
                                <TableRow key={String(r.classId) + i} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{r.className}</Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography
                                            variant="body2"
                                            fontWeight={700}
                                            sx={{ color: scoreColor(r.averageScore) }}
                                        >
                                            {r.averageScore != null ? `${r.averageScore}%` : 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {(r.weakSubjects || []).map(s => (
                                                <Chip key={s} label={s} size="small" variant="outlined" color="warning" />
                                            ))}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption">
                                            {(r.recommendations || []).slice(0, 1).join('')}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
};

// ── Teacher Performance AI Panel ──────────────────────────────────────────────

const TeacherPerformanceAIPanel = ({ schoolId }) => {
    const [reports, setReports]   = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [cachedAt, setCachedAt] = useState(null);

    const runAnalysis = async () => {
        setLoading(true);
        setError('');
        try {
            // Fetch all teachers for this school
            const teacherRes = await axiosInstance.get(`/Teachers/${schoolId}`);
            const teachers = Array.isArray(teacherRes.data) ? teacherRes.data : [];

            if (teachers.length === 0) {
                setError('No teachers found for this school.');
                setLoading(false);
                return;
            }

            // Run analysis for each teacher
            const results = [];
            let lastCachedAt = null;
            for (const teacher of teachers) {
                try {
                    const res = await axiosInstance.post('/api/ai/admin/teacher-performance-analysis', {
                        teacherId: String(teacher._id),
                    });
                    results.push({ ...res.data.report, teacherName: teacher.name });
                    if (res.data.cachedAt) lastCachedAt = res.data.cachedAt;
                } catch {
                    // Skip teachers that fail
                }
            }

            // Sort by performanceScore ascending (lowest first)
            results.sort((a, b) => (a.performanceScore ?? 100) - (b.performanceScore ?? 100));
            setReports(results);
            setCachedAt(lastCachedAt);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to run analysis');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">👩‍🏫 Teacher Performance (AI)</Typography>
                    <CachedAt cachedAt={cachedAt} />
                </Box>
                <Button variant="contained" color="primary" size="small" onClick={runAnalysis} disabled={loading}>
                    {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                    Run Analysis
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <PanelSkeleton />
            ) : reports.length === 0 ? (
                <EmptyState message="No teacher performance data yet. Run analysis to generate reports." />
            ) : (
                <TableContainer>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell><strong>Teacher Name</strong></TableCell>
                                <TableCell align="right"><strong>Performance Score</strong></TableCell>
                                <TableCell><strong>Top Recommendation</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {reports.map((r, i) => (
                                <TableRow key={String(r.teacherId) + i} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{r.teacherName}</Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Chip
                                            label={r.performanceScore != null ? `${r.performanceScore}%` : 'N/A'}
                                            size="small"
                                            sx={{
                                                bgcolor: scoreColor(r.performanceScore),
                                                color: '#fff',
                                                fontWeight: 700,
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption">
                                            {(r.recommendations || [])[0] || '—'}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Paper>
    );
};

// ── School Summary Panel ──────────────────────────────────────────────────────

const SchoolSummaryPanel = ({ schoolId }) => {
    const [report, setReport]     = useState(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [cachedAt, setCachedAt] = useState(null);

    const runAnalysis = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.post('/api/ai/admin/school-performance-summary', { schoolId });
            setReport(res.data.report);
            setCachedAt(res.data.cachedAt || null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to run analysis');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">🏫 School Performance Summary</Typography>
                    <CachedAt cachedAt={cachedAt} />
                </Box>
                <Button variant="contained" color="success" size="small" onClick={runAnalysis} disabled={loading}>
                    {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                    Run Analysis
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <PanelSkeleton />
            ) : !report ? (
                <EmptyState message="No school summary yet. Run analysis to generate a report." />
            ) : (
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography
                                variant="h4"
                                fontWeight={700}
                                sx={{ color: scoreColor(report.overallAverageScore) }}
                            >
                                {report.overallAverageScore != null ? `${report.overallAverageScore}%` : 'N/A'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">Overall Average Score</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Top Classes</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {(report.topClasses || []).length === 0
                                    ? <Typography variant="caption" color="text.secondary">None</Typography>
                                    : (report.topClasses || []).map(c => (
                                        <Chip key={c} label={c} size="small" color="success" />
                                    ))
                                }
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Weak Subjects</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {(report.weakSubjects || []).length === 0
                                    ? <Typography variant="caption" color="text.secondary">None</Typography>
                                    : (report.weakSubjects || []).map(s => (
                                        <Chip key={s} label={s} size="small" color="warning" />
                                    ))
                                }
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Academic Trend</Typography>
                            <Typography variant="body2">{report.academicTrend || 'N/A'}</Typography>
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Paper>
    );
};

// ── AI Recommendations Panel ──────────────────────────────────────────────────

const AIRecommendationsPanel = ({ schoolId }) => {
    const [recommendation, setRecommendation] = useState(null);
    const [loading, setLoading]               = useState(false);
    const [error, setError]                   = useState('');
    const [cachedAt, setCachedAt]             = useState(null);
    const [modalOpen, setModalOpen]           = useState(false);
    const [copied, setCopied]                 = useState({});

    const runAnalysis = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.post('/api/ai/admin/generate-recommendations', { schoolId });
            setRecommendation(res.data.recommendation);
            setCachedAt(res.data.cachedAt || null);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate recommendations');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(prev => ({ ...prev, [idx]: true }));
            setTimeout(() => setCopied(prev => ({ ...prev, [idx]: false })), 2000);
        });
    };

    const allRecs = recommendation?.recommendations || [];
    const highPriority = allRecs.filter(r => r.priority === 'High');
    const mediumPriority = allRecs.filter(r => r.priority === 'Medium');
    const lowPriority = allRecs.filter(r => r.priority === 'Low');

    const RecGroup = ({ title, items, color }) => {
        if (items.length === 0) return null;
        return (
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: `${color}.main` }}>{title}</Typography>
                {items.map((rec, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Chip label={rec.priority} color={priorityColor(rec.priority)} size="small" sx={{ mt: 0.3, flexShrink: 0 }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>{rec.title}</Typography>
                                <Typography variant="caption" color="text.secondary">{rec.description}</Typography>
                            </Box>
                        </Box>
                    </Paper>
                ))}
            </Box>
        );
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6">💡 AI Recommendations</Typography>
                    <CachedAt cachedAt={cachedAt} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {recommendation && (
                        <Button variant="outlined" size="small" onClick={() => setModalOpen(true)}>
                            Apply Recommendations
                        </Button>
                    )}
                    <Button variant="contained" size="small" onClick={runAnalysis} disabled={loading}>
                        {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                        Run Analysis
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loading ? (
                <PanelSkeleton />
            ) : !recommendation ? (
                <EmptyState message="No recommendations yet. Run individual analyses first, then generate recommendations." />
            ) : (
                <Box>
                    <RecGroup title="🔴 High Priority" items={highPriority} color="error" />
                    <RecGroup title="🟡 Medium Priority" items={mediumPriority} color="warning" />
                    <RecGroup title="🟢 Low Priority" items={lowPriority} color="success" />
                </Box>
            )}

            {/* Apply Recommendations Modal */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
                <Box sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: { xs: '90%', sm: 560 },
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    boxShadow: 24,
                    p: 3,
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">🔴 High Priority Recommendations</Typography>
                        <IconButton size="small" onClick={() => setModalOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {highPriority.length === 0 ? (
                        <Typography color="text.secondary">No high-priority recommendations.</Typography>
                    ) : (
                        highPriority.map((rec, idx) => (
                            <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" fontWeight={700}>{rec.title}</Typography>
                                        <Typography variant="caption" color="text.secondary">{rec.description}</Typography>
                                    </Box>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleCopy(`${rec.title}: ${rec.description}`, idx)}
                                        title="Copy to clipboard"
                                    >
                                        <ContentCopyIcon fontSize="small" color={copied[idx] ? 'success' : 'action'} />
                                    </IconButton>
                                </Box>
                            </Paper>
                        ))
                    )}
                </Box>
            </Modal>
        </Paper>
    );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────

const AIIntelligenceDashboard = ({ schoolId }) => {
    const highRiskRef  = useRef(null);
    const weakClassRef = useRef(null);

    const scrollTo = (ref) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <Box>
            {/* Action buttons */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <SmartToyIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={600} sx={{ mr: 1 }}>AI School Intelligence</Typography>
                <Button size="small" variant="outlined" onClick={() => scrollTo(highRiskRef)}>
                    View Risk Students
                </Button>
                <Button size="small" variant="outlined" onClick={() => scrollTo(weakClassRef)}>
                    View Weak Classes
                </Button>
            </Paper>

            <Grid container spacing={3}>
                {/* High Risk Students */}
                <Grid item xs={12}>
                    <HighRiskStudentsPanel schoolId={schoolId} panelRef={highRiskRef} />
                </Grid>

                {/* Weak Classes */}
                <Grid item xs={12}>
                    <WeakClassesPanel schoolId={schoolId} panelRef={weakClassRef} />
                </Grid>

                {/* Teacher Performance */}
                <Grid item xs={12}>
                    <TeacherPerformanceAIPanel schoolId={schoolId} />
                </Grid>

                {/* School Summary */}
                <Grid item xs={12}>
                    <SchoolSummaryPanel schoolId={schoolId} />
                </Grid>

                {/* AI Recommendations */}
                <Grid item xs={12}>
                    <AIRecommendationsPanel schoolId={schoolId} />
                </Grid>
            </Grid>
        </Box>
    );
};

export default AIIntelligenceDashboard;
