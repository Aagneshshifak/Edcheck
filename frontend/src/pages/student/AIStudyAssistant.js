import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
    Box, Typography, Tabs, Tab, Paper, Button, TextField,
    CircularProgress, Alert, Chip, Card, CardContent,
    Divider, List, ListItem, ListItemText, Select, MenuItem,
    FormControl, InputLabel,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import QuizIcon from '@mui/icons-material/Quiz';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import axiosInstance from '../../utils/axiosInstance';
import { theme } from '../../theme/studentTheme';

const glass = {
    background: theme.card,
    border: theme.cardBorder,
    borderRadius: theme.radius,
    boxShadow: theme.cardShadow,
    p: 3,
};

// ── 1. Notes Panel ────────────────────────────────────────────────────────────
const NotesPanel = ({ studentId, classId, subjects }) => {
    const [subjectId, setSubjectId] = useState('');
    const [topic, setTopic]         = useState('');
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [notes, setNotes]         = useState(null);
    const [saved, setSaved]         = useState([]);

    useEffect(() => {
        if (!classId) return;
        axiosInstance.get('/api/ai/student/notes', { params: { classId } })
            .then(({ data }) => setSaved(data.notes || []))
            .catch(() => {});
    }, [classId]);

    const handleGenerate = async () => {
        if (!subjectId || !topic.trim()) return;
        setLoading(true); setError(''); setNotes(null);
        try {
            const { data } = await axiosInstance.post('/api/ai/student/generate-class-notes', { classId, subjectId, topic: topic.trim() });
            setNotes(data.notesContent);
        } catch (e) { setError(e.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    };

    const display = notes || saved[0]?.notesContent;

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theme.accent }}>Today's Class Notes</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select value={subjectId} label="Subject" onChange={e => setSubjectId(e.target.value)}>
                        {subjects.map(s => <MenuItem key={s._id} value={s._id}>{s.subName || s.subjectName}</MenuItem>)}
                    </Select>
                </FormControl>
                <TextField size="small" label="Topic" value={topic} onChange={e => setTopic(e.target.value)} sx={{ minWidth: 200 }} />
                <Button variant="contained" onClick={handleGenerate} disabled={loading || !subjectId || !topic.trim()}>
                    {loading ? <CircularProgress size={18} color="inherit" /> : 'Generate Notes'}
                </Button>
            </Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {display && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>📖 Explanation</Typography>
                        <Typography variant="body2">{display.explanation}</Typography>
                    </CardContent></Card>
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>🔑 Key Concepts</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {display.keyConcepts?.map((k, i) => <Chip key={i} label={k} size="small" color="primary" variant="outlined" />)}
                        </Box>
                    </CardContent></Card>
                    {display.formulas?.length > 0 && (
                        <Card variant="outlined"><CardContent>
                            <Typography fontWeight={700} gutterBottom>📐 Formulas</Typography>
                            {display.formulas.map((f, i) => <Typography key={i} variant="body2" sx={{ fontFamily: 'monospace', mb: 0.5 }}>• {f}</Typography>)}
                        </CardContent></Card>
                    )}
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>⚠️ Common Mistakes</Typography>
                        {display.commonMistakes?.map((m, i) => <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {m}</Typography>)}
                    </CardContent></Card>
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>📝 Summary</Typography>
                        <Typography variant="body2">{display.summary}</Typography>
                    </CardContent></Card>
                </Box>
            )}
        </Box>
    );
};

// ── 2. Study Plan Panel ───────────────────────────────────────────────────────
const StudyPlanPanel = ({ studentId }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [plan, setPlan]       = useState(null);

    useEffect(() => {
        axiosInstance.get(`/api/ai/student/study-plan/${studentId}`)
            .then(({ data }) => data.studyPlan && setPlan(data.studyPlan))
            .catch(() => {});
    }, [studentId]);

    const handleGenerate = async (regenerate = false) => {
        setLoading(true); setError('');
        try {
            const { data } = await axiosInstance.post('/api/ai/student/generate-study-plan', { studentId, regenerate });
            setPlan(data.studyPlan);
        } catch (e) { setError(e.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theme.accent }}>My Study Plan</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {plan && (
                        <Button variant="outlined" size="small" onClick={() => handleGenerate(true)} disabled={loading}>
                            Regenerate
                        </Button>
                    )}
                    {!plan && (
                        <Button variant="contained" onClick={() => handleGenerate(false)} disabled={loading}>
                            {loading ? <CircularProgress size={18} color="inherit" /> : 'Generate Plan'}
                        </Button>
                    )}
                </Box>
            </Box>
            {loading && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><CircularProgress size={18} /><Typography variant="body2">Analysing your performance...</Typography></Box>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {plan && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>📚 Weak Subject Focus</Typography>
                        {plan.weakSubjectFocus?.map((s, i) => (
                            <Box key={i} sx={{ mb: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" fontWeight={600}>{s.subject}</Typography>
                                    <Chip label={`${s.hoursPerDay}h/day · ${s.priority}`} size="small"
                                        color={s.priority === 'high' ? 'error' : s.priority === 'medium' ? 'warning' : 'success'} />
                                </Box>
                                {s.reason && <Typography variant="caption" color="text.secondary">{s.reason}</Typography>}
                            </Box>
                        ))}
                    </CardContent></Card>

                    {plan.subjectImprovementPlan?.length > 0 && (
                        <Card variant="outlined"><CardContent>
                            <Typography fontWeight={700} gutterBottom>🎯 Improvement Plan</Typography>
                            {plan.subjectImprovementPlan.map((s, i) => (
                                <Box key={i} sx={{ mb: 1.5 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="body2" fontWeight={600}>{s.subject}</Typography>
                                        {s.currentScore != null && s.targetScore != null && (
                                            <Typography variant="caption" color="text.secondary">
                                                {s.currentScore}% → {s.targetScore}%
                                            </Typography>
                                        )}
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">{s.strategy}</Typography>
                                </Box>
                            ))}
                        </CardContent></Card>
                    )}

                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>📅 Weekly Schedule</Typography>
                        {plan.weeklySchedule && Object.entries(plan.weeklySchedule).map(([day, task]) => (
                            <Box key={day} sx={{ display: 'flex', gap: 2, mb: 0.5 }}>
                                <Typography variant="body2" fontWeight={600} sx={{ minWidth: 90, textTransform: 'capitalize' }}>{day}</Typography>
                                <Typography variant="body2" color="text.secondary">{task}</Typography>
                            </Box>
                        ))}
                    </CardContent></Card>
                </Box>
            )}
            {!plan && !loading && (
                <Alert severity="info">Click "Generate Plan" to create your personalized study plan based on your test scores and learning progress.</Alert>
            )}
        </Box>
    );
};

// ── 3. Daily Routine Panel ────────────────────────────────────────────────────
const RoutinePanel = ({ studentId }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [routine, setRoutine] = useState(null);

    useEffect(() => {
        axiosInstance.get(`/api/ai/student/routine/${studentId}`)
            .then(({ data }) => data.routine && setRoutine(data.routine))
            .catch(() => {});
    }, [studentId]);

    const handleGenerate = async (regenerate = false) => {
        setLoading(true); setError('');
        try {
            const { data } = await axiosInstance.post('/api/ai/student/generate-daily-routine', { studentId, regenerate });
            setRoutine(data.routine);
        } catch (e) { setError(e.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    };

    const catColor = { school: '#0ea5e9', study: '#8b5cf6', break: '#22c55e', exercise: '#f59e0b', meal: '#f97316', sleep: '#6366f1' };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: theme.accent }}>Today's Routine</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {routine && (
                        <Button variant="outlined" size="small" onClick={() => handleGenerate(true)} disabled={loading}>
                            Regenerate
                        </Button>
                    )}
                    {!routine && (
                        <Button variant="contained" onClick={() => handleGenerate(false)} disabled={loading}>
                            {loading ? <CircularProgress size={18} color="inherit" /> : 'Generate Routine'}
                        </Button>
                    )}
                </Box>
            </Box>
            {loading && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><CircularProgress size={18} /><Typography variant="body2">Building your personalised routine...</Typography></Box>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {routine && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                        <Chip icon={<AccessTimeIcon />} label={`Wake up: ${routine.wakeUpTime}`} color="primary" />
                        <Chip icon={<AccessTimeIcon />} label={`Sleep: ${routine.sleepTime}`} color="secondary" />
                        <Chip label={`Study: ${routine.totalStudyHours}h`} color="success" />
                    </Box>
                    {routine.schedule?.map((item, i) => (
                        <Box key={i} sx={{
                            display: 'flex', gap: 2, alignItems: 'flex-start',
                            px: 2, py: 1.5, borderRadius: 2,
                            borderLeft: `4px solid ${catColor[item.category] || '#888'}`,
                            background: 'rgba(255,255,255,0.03)',
                        }}>
                            <Box sx={{ minWidth: 170 }}>
                                <Typography variant="body2" fontWeight={700} sx={{ color: catColor[item.category] || '#888' }}>
                                    {item.time}{item.endTime ? ` – ${item.endTime}` : ''}
                                </Typography>
                                <Chip label={item.duration} size="small" variant="outlined" sx={{ mt: 0.5, fontSize: '0.68rem', height: 18 }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>{item.activity}</Typography>
                                {item.details && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                        {item.details}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    ))}
                    {routine.healthTips?.length > 0 && (
                        <Card variant="outlined" sx={{ mt: 1 }}><CardContent>
                            <Typography fontWeight={700} gutterBottom>💡 Health Tips</Typography>
                            {routine.healthTips.map((t, i) => <Typography key={i} variant="body2">• {t}</Typography>)}
                        </CardContent></Card>
                    )}
                    {routine.subjectRevisionBreakdown?.length > 0 && (
                        <Card variant="outlined" sx={{ mt: 1 }}><CardContent>
                            <Typography fontWeight={700} gutterBottom>📊 Subject Revision Breakdown</Typography>
                            {routine.subjectRevisionBreakdown.map((s, i) => (
                                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="body2">{s.subject}</Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Chip label={`${s.minutes} min`} size="small" color="primary" variant="outlined" />
                                        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>{s.timeSlot}</Typography>
                                    </Box>
                                </Box>
                            ))}
                        </CardContent></Card>
                    )}
                    {routine.motivationalNote && (
                        <Box sx={{ px: 2, py: 1.5, borderRadius: 2, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', mt: 1 }}>
                            <Typography variant="body2" sx={{ color: '#a78bfa', fontStyle: 'italic' }}>✨ {routine.motivationalNote}</Typography>
                        </Box>
                    )}
                </Box>
            )}
            {!routine && !loading && (
                <Alert severity="info">Generate your personalized daily routine including study, breaks, exercise, and sleep schedule.</Alert>
            )}
        </Box>
    );
};

// ── 4. Test Prep Panel ────────────────────────────────────────────────────────
const TestPrepPanel = ({ studentId }) => {
    const [testId, setTestId]   = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [prep, setPrep]       = useState(null);

    const handleGenerate = async () => {
        if (!testId.trim()) return;
        setLoading(true); setError(''); setPrep(null);
        try {
            const { data } = await axiosInstance.post('/api/ai/student/prepare-next-test', { studentId, testId: testId.trim() });
            setPrep(data.revisionPlan);
        } catch (e) { setError(e.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    };

    const diffColor = { easy: 'success', medium: 'warning', hard: 'error' };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theme.accent }}>Next Test Preparation</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <TextField size="small" label="Test ID" value={testId} onChange={e => setTestId(e.target.value)} sx={{ minWidth: 260 }} placeholder="Paste test _id" />
                <Button variant="contained" onClick={handleGenerate} disabled={loading || !testId.trim()}>
                    {loading ? <CircularProgress size={18} color="inherit" /> : 'Prepare for Test'}
                </Button>
            </Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {prep && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>📌 Important Topics</Typography>
                        {prep.importantTopics?.map((t, i) => (
                            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">{t.topic} <Typography component="span" variant="caption" color="text.secondary">({t.weightage})</Typography></Typography>
                                <Chip label={t.estimatedDifficulty} size="small" color={diffColor[t.estimatedDifficulty] || 'default'} />
                            </Box>
                        ))}
                    </CardContent></Card>
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>📋 Revision Sequence</Typography>
                        {prep.revisionSequence?.map((s, i) => <Typography key={i} variant="body2">Step {i + 1}: {s}</Typography>)}
                    </CardContent></Card>
                    <Card variant="outlined"><CardContent>
                        <Typography fontWeight={700} gutterBottom>⚡ Quick Tips</Typography>
                        {prep.quickTips?.map((t, i) => <Typography key={i} variant="body2">• {t}</Typography>)}
                    </CardContent></Card>
                </Box>
            )}
        </Box>
    );
};

// ── 5. Assignment Help Panel ──────────────────────────────────────────────────
const AssignmentHelpPanel = ({ studentId }) => {
    const [question, setQuestion] = useState('');
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [solution, setSolution] = useState(null);
    const [history, setHistory]   = useState([]);

    useEffect(() => {
        axiosInstance.get(`/api/ai/student/assignment-help/${studentId}`)
            .then(({ data }) => setHistory(data.logs || []))
            .catch(() => {});
    }, [studentId]);

    const handleAsk = async () => {
        if (!question.trim()) return;
        setLoading(true); setError(''); setSolution(null);
        try {
            const { data } = await axiosInstance.post('/api/ai/student/assignment-help', { studentId, question: question.trim() });
            setSolution(data.solution);
            setHistory(prev => [data, ...prev.slice(0, 9)]);
            setQuestion('');
        } catch (e) { setError(e.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom sx={{ color: theme.accent }}>Assignment Help</Typography>
            <TextField
                fullWidth multiline minRows={3}
                label="Ask your question"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="e.g. How do I solve quadratic equations?"
                sx={{ mb: 2 }}
            />
            <Button variant="contained" onClick={handleAsk} disabled={loading || !question.trim()} sx={{ mb: 2 }}>
                {loading ? <CircularProgress size={18} color="inherit" /> : 'Get Help'}
            </Button>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {solution && (
                <Card variant="outlined" sx={{ mb: 3 }}><CardContent>
                    <Typography fontWeight={700} gutterBottom>✅ Solution</Typography>
                    <Typography fontWeight={600} gutterBottom>Steps:</Typography>
                    {solution.steps?.map((s, i) => <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>Step {i + 1}: {s}</Typography>)}
                    <Divider sx={{ my: 1.5 }} />
                    <Typography fontWeight={600} gutterBottom>Logic:</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>{solution.logic}</Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography fontWeight={600}>Final Answer: <Typography component="span" color="success.main">{solution.finalAnswer}</Typography></Typography>
                </CardContent></Card>
            )}
            {history.length > 0 && (
                <Box>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">Recent Questions</Typography>
                    {history.slice(0, 5).map((h, i) => (
                        <Box key={i} sx={{ px: 2, py: 1, mb: 1, borderRadius: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Typography variant="body2" fontWeight={600}>{h.question}</Typography>
                            <Typography variant="caption" color="text.secondary">{new Date(h.createdAt).toLocaleString()}</Typography>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const AIStudyAssistant = () => {
    const [tab, setTab] = useState(0);
    const { currentUser } = useSelector(s => s.user);
    const { subjectsList } = useSelector(s => s.sclass);

    const studentId = currentUser?._id;
    const classId   = currentUser?.sclassName?._id || currentUser?.classId?._id || currentUser?.classId;
    const subjects  = subjectsList || [];

    const tabs = [
        { label: 'Notes',       icon: <MenuBookIcon fontSize="small" /> },
        { label: 'Study Plan',  icon: <CalendarTodayIcon fontSize="small" /> },
        { label: 'Routine',     icon: <AccessTimeIcon fontSize="small" /> },
        { label: 'Test Prep',   icon: <QuizIcon fontSize="small" /> },
        { label: 'Ask Help',    icon: <HelpOutlineIcon fontSize="small" /> },
    ];

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', background: theme.bg }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <AutoAwesomeIcon sx={{ color: theme.accent }} />
                <Typography variant="h5" fontWeight={700} sx={{ color: theme.text }}>My AI Study Assistant</Typography>
            </Box>

            <Paper sx={{ mb: 3, background: theme.card, border: theme.cardBorder }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                    sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    {tabs.map((t, i) => (
                        <Tab key={i} label={t.label} icon={t.icon} iconPosition="start"
                            sx={{ fontSize: '0.82rem', minHeight: 48 }} />
                    ))}
                </Tabs>
            </Paper>

            <Box sx={glass}>
                {tab === 0 && <NotesPanel studentId={studentId} classId={classId} subjects={subjects} />}
                {tab === 1 && <StudyPlanPanel studentId={studentId} />}
                {tab === 2 && <RoutinePanel studentId={studentId} />}
                {tab === 3 && <TestPrepPanel studentId={studentId} />}
                {tab === 4 && <AssignmentHelpPanel studentId={studentId} />}
            </Box>
        </Box>
    );
};

export default AIStudyAssistant;
