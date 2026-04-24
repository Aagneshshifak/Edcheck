import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Divider, Button, CircularProgress,
    Chip, TextField, Snackbar, Alert, Collapse, IconButton,
    Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import axiosInstance from '../../utils/axiosInstance';

const glass = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 3,
    boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
};

const severityColor = { high: '#f44336', medium: '#ff9800', low: '#4caf50' };

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ title, badge, children, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <Box sx={{ mb: 2 }}>
            <Box
                onClick={() => setOpen(o => !o)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', mb: open ? 1 : 0 }}
            >
                <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>
                    {title}
                </Typography>
                {badge && <Chip label={badge} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />}
                <Box sx={{ flex: 1 }} />
                <IconButton size="small" sx={{ p: 0 }}>
                    {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
            </Box>
            <Collapse in={open}>{children}</Collapse>
            <Divider sx={{ mt: 1.5, borderColor: 'rgba(255,255,255,0.06)' }} />
        </Box>
    );
};

// ── Main widget ───────────────────────────────────────────────────────────────
const AIAssistantWidget = ({ teachSubjects = [], classId = '' }) => {
    const navigate = useNavigate();

    // ── 1. Today's Topic ─────────────────────────────────────────────────────
    const [subjectId, setSubjectId] = useState('');
    const [topic, setTopic]         = useState('');

    const subjectName = teachSubjects.find(s => s._id === subjectId)?.subjectName
        || teachSubjects.find(s => s._id === subjectId)?.subName || '';

    // ── 2. Suggested Notes ───────────────────────────────────────────────────
    const [notesLoading, setNotesLoading] = useState(false);
    const [notes, setNotes]               = useState(null);
    const [notesError, setNotesError]     = useState('');

    const fetchNotes = async () => {
        if (!subjectId || !topic.trim()) return;
        setNotesLoading(true); setNotesError(''); setNotes(null);
        try {
            const { data } = await axiosInstance.post('/AI/note-suggestions', { subjectId, topic: topic.trim() });
            setNotes(data);
        } catch (e) {
            setNotesError(e.response?.data?.message || 'Failed to get suggestions');
        } finally { setNotesLoading(false); }
    };

    // ── 3. Weak Topics ───────────────────────────────────────────────────────
    const [weakTopics, setWeakTopics]   = useState([]);
    const [weakLoading, setWeakLoading] = useState(false);

    useEffect(() => {
        if (!subjectId || !classId) return;
        setWeakLoading(true);
        axiosInstance.get('/AI/topic-performance', { params: { subjectId, classId } })
            .then(({ data }) => setWeakTopics((data.topicPerformance || []).slice(0, 4)))
            .catch(() => setWeakTopics([]))
            .finally(() => setWeakLoading(false));
    }, [subjectId, classId]);

    // ── 4. Suggested Questions ───────────────────────────────────────────────
    const [qLoading, setQLoading]   = useState(false);
    const [questions, setQuestions] = useState([]);
    const [bankId, setBankId]       = useState(null);
    const [qError, setQError]       = useState('');
    const [testId, setTestId]       = useState('');
    const [addingToTest, setAddingToTest] = useState(false);
    const [snack, setSnack]         = useState({ open: false, msg: '', severity: 'success' });

    const fetchQuestions = async () => {
        if (!subjectId || !topic.trim()) return;
        setQLoading(true); setQError(''); setQuestions([]); setBankId(null);
        try {
            const { data } = await axiosInstance.post('/AI/generate-questions', {
                topic: topic.trim(), subjectName, difficulty: 'medium', count: 3, subjectId,
            });
            setQuestions(data.questions || []);
            const { data: bd } = await axiosInstance.get('/AI/question-bank', {
                params: { subjectId, topic: topic.trim(), difficulty: 'medium' },
            });
            if (bd.banks?.[0]) setBankId(bd.banks[0]._id);
        } catch (e) {
            setQError(e.response?.data?.message || 'Failed to generate questions');
        } finally { setQLoading(false); }
    };

    const handleAddToTest = async () => {
        if (!testId.trim() || !bankId || !questions.length) return;
        setAddingToTest(true);
        try {
            const ids = questions.map((q, i) => q._id || String(i));
            const { data } = await axiosInstance.post(`/AI/question-bank/${bankId}/add-to-test`, {
                testId: testId.trim(), questionIds: ids,
            });
            setSnack({ open: true, msg: data.message, severity: 'success' });
            setTestId('');
        } catch (e) {
            setSnack({ open: true, msg: e.response?.data?.message || 'Failed', severity: 'error' });
        } finally { setAddingToTest(false); }
    };

    const canFetch = subjectId && topic.trim();

    return (
        <Box sx={{ ...glass, p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AutoAwesomeIcon sx={{ color: '#a78bfa', fontSize: 20 }} />
                    <Typography variant="subtitle1" fontWeight={700}>AI Assistant</Typography>
                </Box>
                <Button
                    size="small"
                    endIcon={<ArrowForwardIcon fontSize="small" />}
                    onClick={() => navigate('/Teacher/ai-dashboard')}
                    sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}
                >
                    Full Dashboard
                </Button>
            </Box>

            {/* ── Section 1: Today's Topic ── */}
            <Section title="Today's Topic">
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel sx={{ fontSize: '0.8rem' }}>Subject</InputLabel>
                        <Select value={subjectId} label="Subject" onChange={e => setSubjectId(e.target.value)}
                            sx={{ fontSize: '0.8rem' }}>
                            {teachSubjects.map(s => (
                                <MenuItem key={s._id} value={s._id} sx={{ fontSize: '0.8rem' }}>
                                    {s.subjectName || s.subName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        label="Topic"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && canFetch && fetchNotes()}
                        sx={{ minWidth: 180, fontSize: '0.8rem' }}
                        inputProps={{ style: { fontSize: '0.8rem' } }}
                        InputLabelProps={{ style: { fontSize: '0.8rem' } }}
                    />
                    <Button
                        size="small"
                        variant="contained"
                        onClick={() => { fetchNotes(); fetchQuestions(); }}
                        disabled={!canFetch || notesLoading || qLoading}
                        sx={{ fontSize: '0.75rem', px: 2 }}
                    >
                        {(notesLoading || qLoading) ? <CircularProgress size={14} color="inherit" /> : 'Get AI Insights'}
                    </Button>
                </Box>
                {topic && subjectName && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label={subjectName} size="small" color="primary" variant="outlined" />
                        <Chip label={topic} size="small" color="secondary" variant="outlined" />
                    </Box>
                )}
            </Section>

            {/* ── Section 2: Suggested Notes ── */}
            <Section title="Suggested Notes" defaultOpen={!!notes}>
                {notesError && <Typography variant="caption" color="error">{notesError}</Typography>}
                {notesLoading && <CircularProgress size={18} />}
                {notes && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {notes.suggestions?.slice(0, 3).map((s, i) => (
                            <Typography key={i} variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                                • {s}
                            </Typography>
                        ))}
                        {notes.keyPoints?.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                {notes.keyPoints.slice(0, 5).map((kp, i) => (
                                    <Chip key={i} label={kp} size="small" variant="outlined"
                                        sx={{ fontSize: '0.7rem', height: 20 }} />
                                ))}
                            </Box>
                        )}
                    </Box>
                )}
                {!notes && !notesLoading && !notesError && (
                    <Typography variant="caption" color="text.secondary">
                        Enter a topic above to get teaching suggestions.
                    </Typography>
                )}
            </Section>

            {/* ── Section 3: Weak Topics ── */}
            <Section title="Weak Topics" badge={weakTopics.length > 0 ? `${weakTopics.length} found` : undefined}>
                {weakLoading && <CircularProgress size={18} />}
                {!weakLoading && weakTopics.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                        {subjectId ? 'No weak topics on record. Run analysis from AI Dashboard.' : 'Select a subject to see weak topics.'}
                    </Typography>
                )}
                {weakTopics.map((wt, i) => {
                    const color = severityColor[wt.severity] || '#9e9e9e';
                    return (
                        <Box key={i} sx={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            px: 1.5, py: 0.75, mb: 0.75, borderRadius: 1.5,
                            borderLeft: `3px solid ${color}`,
                            background: 'rgba(255,255,255,0.04)',
                        }}>
                            <Box>
                                <Typography variant="body2" fontWeight={600}>{wt.topic}</Typography>
                                {wt.suggestion && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        💡 {wt.suggestion.slice(0, 80)}{wt.suggestion.length > 80 ? '…' : ''}
                                    </Typography>
                                )}
                            </Box>
                            <Chip
                                label={`${Math.round(wt.averageScore)}%`}
                                size="small"
                                sx={{ bgcolor: color, color: '#fff', fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                            />
                        </Box>
                    );
                })}
                {weakTopics.length > 0 && (
                    <Button size="small" onClick={() => navigate('/Teacher/ai-dashboard')}
                        sx={{ mt: 0.5, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                        View all →
                    </Button>
                )}
            </Section>

            {/* ── Section 4: Suggested Questions ── */}
            <Section title="Suggested Questions" badge={questions.length > 0 ? `${questions.length} ready` : undefined} defaultOpen={questions.length > 0}>
                {qError && <Typography variant="caption" color="error">{qError}</Typography>}
                {qLoading && <CircularProgress size={18} />}
                {!qLoading && questions.length === 0 && !qError && (
                    <Typography variant="caption" color="text.secondary">
                        Enter a topic above to generate practice questions.
                    </Typography>
                )}
                {questions.map((q, i) => (
                    <Box key={i} sx={{
                        px: 1.5, py: 1, mb: 0.75, borderRadius: 1.5,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                            Q{i + 1}. {q.questionText}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {q.options?.map((opt, oi) => (
                                <Chip
                                    key={oi}
                                    label={`${String.fromCharCode(65 + oi)}. ${opt}`}
                                    size="small"
                                    sx={{
                                        fontSize: '0.7rem', height: 20,
                                        bgcolor: oi === q.correctAnswer ? 'success.dark' : 'transparent',
                                        border: oi === q.correctAnswer ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                        color: oi === q.correctAnswer ? '#fff' : 'rgba(255,255,255,0.7)',
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                ))}

                {/* Add to Test */}
                {questions.length > 0 && bankId && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TextField
                            size="small"
                            label="Test ID"
                            placeholder="Paste test _id"
                            value={testId}
                            onChange={e => setTestId(e.target.value)}
                            sx={{ minWidth: 200, fontSize: '0.8rem' }}
                            inputProps={{ style: { fontSize: '0.8rem' } }}
                            InputLabelProps={{ style: { fontSize: '0.8rem' } }}
                        />
                        <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={addingToTest ? <CircularProgress size={14} color="inherit" /> : <AddCircleOutlineIcon fontSize="small" />}
                            onClick={handleAddToTest}
                            disabled={addingToTest || !testId.trim()}
                            sx={{ fontSize: '0.75rem' }}
                        >
                            Add to Test
                        </Button>
                    </Box>
                )}
            </Section>

            <Snackbar open={snack.open} autoHideDuration={4000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AIAssistantWidget;
