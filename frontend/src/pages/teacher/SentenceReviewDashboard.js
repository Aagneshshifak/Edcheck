import React, { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
    TableBody, TableContainer, Chip, Button, TextField, Slider,
    Alert, CircularProgress, Divider, Collapse, Badge, Tooltip,
    IconButton
} from '@mui/material';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import EditIcon           from '@mui/icons-material/Edit';
import CancelIcon         from '@mui/icons-material/Cancel';
import ExpandMoreIcon     from '@mui/icons-material/ExpandMore';
import ExpandLessIcon     from '@mui/icons-material/ExpandLess';
import PsychologyIcon     from '@mui/icons-material/Psychology';
import axiosInstance      from '../../utils/axiosInstance';

const confidenceColor = { LOW: 'error', MEDIUM: 'warning', HIGH: 'success' };

const SentenceReviewDashboard = () => {
    const [evals, setEvals]         = useState([]);
    const [summary, setSummary]     = useState({ pending: 0, accepted: 0, modified: 0, rejected: 0 });
    const [loading, setLoading]     = useState(true);
    const [expanded, setExpanded]   = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [editScores, setEditScores]       = useState({});  // evalId → { score, feedback }
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [evRes, sumRes] = await Promise.all([
                axiosInstance.get('/api/teacher/sentence-evals/pending?limit=100'),
                axiosInstance.get('/api/teacher/sentence-evals/summary'),
            ]);
            setEvals(evRes.data.evals || []);
            setSummary(sumRes.data || {});
        } catch (err) {
            setError('Failed to load pending evaluations.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExpand = (id) => setExpanded(prev => prev === id ? null : id);

    const handleAction = async (evalId, action) => {
        const ed = editScores[evalId] || {};
        if (action !== 'accept' && ed.score === undefined) {
            setError('Please set a score before submitting.');
            return;
        }
        if (action === 'reject' && !ed.feedback?.trim()) {
            setError('Feedback is required when rejecting an AI evaluation.');
            return;
        }

        setActionLoading(evalId + action);
        setError('');
        try {
            await axiosInstance.put(`/api/teacher/sentence-evals/${evalId}/${action}`, {
                teacherScore:    ed.score,
                teacherFeedback: ed.feedback || '',
            });
            setSuccess(`Evaluation ${action === 'accept' ? 'accepted' : action === 'modify' ? 'updated' : 'rejected'} successfully.`);
            setEvals(prev => prev.filter(e => e._id !== evalId));
            setSummary(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
            setExpanded(null);
        } catch (err) {
            setError(err.response?.data?.message || 'Action failed.');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <PsychologyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                <Box>
                    <Typography variant="h5" fontWeight="bold">Descriptive Answer Review</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Review AI-evaluated student descriptive answers and set final scores
                    </Typography>
                </Box>
            </Box>

            {/* Summary Chips */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                {[
                    { label: 'Pending Review', count: summary.pending,  color: 'warning' },
                    { label: 'AI Accepted',    count: summary.accepted, color: 'success' },
                    { label: 'Modified',       count: summary.modified, color: 'info'    },
                    { label: 'Rejected',       count: summary.rejected, color: 'error'   },
                ].map(s => (
                    <Paper key={s.label} sx={{ px: 3, py: 1.5, borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="h5" fontWeight="bold" color={`${s.color}.main`}>{s.count}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Paper>
                ))}
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {evals.length === 0 ? (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                    No pending descriptive evaluations. All answers have been reviewed!
                </Alert>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell><strong>Student</strong></TableCell>
                                <TableCell><strong>Subject</strong></TableCell>
                                <TableCell><strong>Topic</strong></TableCell>
                                <TableCell><strong>AI Score</strong></TableCell>
                                <TableCell><strong>AI Confidence</strong></TableCell>
                                <TableCell><strong>Max Marks</strong></TableCell>
                                <TableCell><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {evals.map(ev => {
                                const isExpanded = expanded === ev._id;
                                const ed = editScores[ev._id] || {};

                                return (
                                    <React.Fragment key={ev._id}>
                                        <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => handleExpand(ev._id)}>
                                            <TableCell>{ev.studentId?.name || '—'} <Typography variant="caption" color="text.secondary">({ev.studentId?.rollNum})</Typography></TableCell>
                                            <TableCell>{ev.subjectId?.subjectName || ev.subjectId?.subName || '—'}</TableCell>
                                            <TableCell>{ev.topic || '—'}{ev.subtopic ? <Typography variant="caption" display="block" color="text.secondary">{ev.subtopic}</Typography> : null}</TableCell>
                                            <TableCell><strong>{ev.aiScore ?? '—'} / {ev.maxMarks}</strong></TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={ev.aiConfidence || 'LOW'}
                                                    color={confidenceColor[ev.aiConfidence] || 'error'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>{ev.maxMarks}</TableCell>
                                            <TableCell>
                                                <IconButton size="small">
                                                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Review Panel */}
                                        <TableRow>
                                            <TableCell colSpan={7} sx={{ p: 0 }}>
                                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                    <Box sx={{ p: 3, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                                                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
                                                            {/* Left: Student answer & Expected */}
                                                            <Box>
                                                                <Typography variant="subtitle2" fontWeight="bold" mb={1}>Question</Typography>
                                                                <Typography variant="body2" sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mb: 2 }}>
                                                                    {ev.questionText}
                                                                </Typography>

                                                                <Typography variant="subtitle2" fontWeight="bold" mb={1}>Student's Answer</Typography>
                                                                <Typography variant="body2" sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mb: 2, whiteSpace: 'pre-wrap' }}>
                                                                    {ev.studentAnswer || '[No answer provided]'}
                                                                </Typography>

                                                                <Typography variant="subtitle2" fontWeight="bold" mb={1}>Expected Answer (Reference)</Typography>
                                                                <Typography variant="body2" sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, fontStyle: 'italic' }}>
                                                                    {ev.expectedAnswer || 'N/A'}
                                                                </Typography>
                                                            </Box>

                                                            {/* Right: AI evaluation */}
                                                            <Box>
                                                                <Typography variant="subtitle2" fontWeight="bold" mb={1}>AI Evaluation</Typography>
                                                                <Alert severity={ev.aiConfidence === 'HIGH' ? 'success' : ev.aiConfidence === 'MEDIUM' ? 'warning' : 'error'} sx={{ mb: 2 }}>
                                                                    AI Score: <strong>{ev.aiScore} / {ev.maxMarks}</strong> — Confidence: <strong>{ev.aiConfidence}</strong>
                                                                </Alert>

                                                                {ev.aiFeedback && (
                                                                    <Typography variant="body2" sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                                                                        {ev.aiFeedback}
                                                                    </Typography>
                                                                )}

                                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                                                    {(ev.coveredConcepts || []).map(c => <Chip key={c} label={c} color="success" size="small" variant="outlined" />)}
                                                                </Box>
                                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                                                    {(ev.missingConcepts || []).map(c => <Chip key={c} label={`Missing: ${c}`} color="error" size="small" variant="outlined" />)}
                                                                </Box>
                                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                                    {(ev.incorrectConcepts || []).map(c => <Chip key={c} label={`Incorrect: ${c}`} color="warning" size="small" variant="outlined" />)}
                                                                </Box>

                                                                {/* Rubric scores */}
                                                                {ev.aiConceptCoverage !== null && (
                                                                    <Box sx={{ mt: 2 }}>
                                                                        {[
                                                                            ['Concept Coverage',    ev.aiConceptCoverage],
                                                                            ['Correctness',         ev.aiCorrectness],
                                                                            ['Relevance',           ev.aiRelevance],
                                                                            ['Explanation Quality', ev.aiExplanationQuality],
                                                                        ].map(([label, val]) => (
                                                                            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                                                <Typography variant="caption" sx={{ width: 140 }}>{label}</Typography>
                                                                                <Box sx={{ flex: 1, height: 6, bgcolor: 'action.hover', borderRadius: 3, overflow: 'hidden' }}>
                                                                                    <Box sx={{ height: '100%', width: `${(val || 0) * 100}%`, bgcolor: 'primary.main', borderRadius: 3 }} />
                                                                                </Box>
                                                                                <Typography variant="caption">{((val || 0) * 100).toFixed(0)}%</Typography>
                                                                            </Box>
                                                                        ))}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        </Box>

                                                        <Divider sx={{ mb: 2 }} />

                                                        {/* Key Concepts */}
                                                        {ev.keyConcepts?.length > 0 && (
                                                            <Box mb={2}>
                                                                <Typography variant="caption" color="text.secondary">Key Concepts: </Typography>
                                                                {ev.keyConcepts.map(c => <Chip key={c} label={c} size="small" sx={{ mr: 0.5, mb: 0.5 }} />)}
                                                            </Box>
                                                        )}

                                                        {/* Teacher Score Input */}
                                                        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                                            <Typography variant="subtitle2" fontWeight="bold" mb={2}>Your Decision</Typography>
                                                            <Box sx={{ mb: 2 }}>
                                                                <Typography variant="body2" gutterBottom>
                                                                    Score: <strong>{ed.score ?? ev.aiScore ?? 0} / {ev.maxMarks}</strong>
                                                                </Typography>
                                                                <Slider
                                                                    value={ed.score ?? ev.aiScore ?? 0}
                                                                    min={0}
                                                                    max={ev.maxMarks}
                                                                    step={0.5}
                                                                    marks
                                                                    onChange={(_, v) => setEditScores(prev => ({ ...prev, [ev._id]: { ...prev[ev._id], score: v } }))}
                                                                    sx={{ maxWidth: 400 }}
                                                                />
                                                            </Box>
                                                            <TextField
                                                                multiline
                                                                rows={2}
                                                                fullWidth
                                                                placeholder="Teacher feedback (required for rejection, optional otherwise)"
                                                                value={ed.feedback || ''}
                                                                onChange={e => setEditScores(prev => ({ ...prev, [ev._id]: { ...prev[ev._id], feedback: e.target.value } }))}
                                                                sx={{ mb: 2 }}
                                                            />
                                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                                <Button
                                                                    variant="contained"
                                                                    color="success"
                                                                    startIcon={<CheckCircleIcon />}
                                                                    onClick={() => handleAction(ev._id, 'accept')}
                                                                    disabled={!!actionLoading}
                                                                >
                                                                    {actionLoading === ev._id + 'accept' ? <CircularProgress size={18} /> : 'Accept AI Score'}
                                                                </Button>
                                                                <Button
                                                                    variant="contained"
                                                                    color="primary"
                                                                    startIcon={<EditIcon />}
                                                                    onClick={() => handleAction(ev._id, 'modify')}
                                                                    disabled={!!actionLoading}
                                                                >
                                                                    {actionLoading === ev._id + 'modify' ? <CircularProgress size={18} /> : 'Save My Score'}
                                                                </Button>
                                                                <Button
                                                                    variant="outlined"
                                                                    color="error"
                                                                    startIcon={<CancelIcon />}
                                                                    onClick={() => handleAction(ev._id, 'reject')}
                                                                    disabled={!!actionLoading}
                                                                >
                                                                    {actionLoading === ev._id + 'reject' ? <CircularProgress size={18} /> : 'Reject AI'}
                                                                </Button>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default SentenceReviewDashboard;
