import { useState } from 'react';
import {
    Box, Typography, TextField, Select, MenuItem, FormControl,
    InputLabel, Button, CircularProgress, Alert, Card, CardContent,
    Slider, Collapse, IconButton, Checkbox, Chip, Divider, Snackbar,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SaveIcon from '@mui/icons-material/Save';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import axiosInstance from '../../utils/axiosInstance';

// ── Single question card ──────────────────────────────────────────────────────
const QuestionCard = ({ question, index, selected, onToggle }) => {
    const [open, setOpen] = useState(false);

    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderColor: selected ? 'primary.main' : 'divider',
                borderWidth: selected ? 2 : 1,
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {onToggle && (
                        <Checkbox
                            checked={selected}
                            onChange={() => onToggle(question._id || index)}
                            size="small"
                            sx={{ mt: 0.25, p: 0 }}
                        />
                    )}
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                            Q{index + 1}. {question.questionText}
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                            {question.options?.map((opt, i) => (
                                <Typography
                                    key={i}
                                    variant="body2"
                                    sx={{
                                        px: 1, py: 0.5, borderRadius: 1,
                                        bgcolor: i === question.correctAnswer ? 'success.light' : 'transparent',
                                        color: i === question.correctAnswer ? 'success.contrastText' : 'text.primary',
                                        fontWeight: i === question.correctAnswer ? 700 : 400,
                                    }}
                                >
                                    {String.fromCharCode(65 + i)}. {opt}
                                </Typography>
                            ))}
                        </Box>

                        {question.explanation && (
                            <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">Explanation</Typography>
                                    <IconButton size="small" onClick={() => setOpen(o => !o)}>
                                        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                    </IconButton>
                                </Box>
                                <Collapse in={open}>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        {question.explanation}
                                    </Typography>
                                </Collapse>
                            </>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
};

// ── Main panel ────────────────────────────────────────────────────────────────
const QuestionGeneratorPanel = ({ teachSubjects = [] }) => {
    const [subjectId, setSubjectId]     = useState('');
    const [topic, setTopic]             = useState('');
    const [difficulty, setDifficulty]   = useState('medium');
    const [count, setCount]             = useState(5);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState('');
    const [questions, setQuestions]     = useState([]);
    const [bankId, setBankId]           = useState(null);   // id of saved bank entry
    const [selected, setSelected]       = useState(new Set());
    const [testId, setTestId]           = useState('');
    const [addingToTest, setAddingToTest] = useState(false);
    const [snack, setSnack]             = useState({ open: false, msg: '', severity: 'success' });

    const subjectName = teachSubjects.find(s => s._id === subjectId)?.subjectName
        || teachSubjects.find(s => s._id === subjectId)?.subName
        || '';

    const handleGenerate = async () => {
        if (!topic.trim() || !subjectName) return;
        setLoading(true);
        setError('');
        setQuestions([]);
        setBankId(null);
        setSelected(new Set());
        try {
            const { data } = await axiosInstance.post('/AI/generate-questions', {
                topic: topic.trim(),
                subjectName,
                difficulty,
                count,
                subjectId: subjectId || undefined,
            });
            setQuestions(data.questions || []);
            // Fetch the saved bank id
            if (subjectId) {
                const { data: bankData } = await axiosInstance.get('/AI/question-bank', {
                    params: { subjectId, topic: topic.trim(), difficulty },
                });
                if (bankData.banks?.[0]) setBankId(bankData.banks[0]._id);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate questions');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelected(new Set(questions.map((q, i) => q._id || i)));
    };

    const handleAddToTest = async () => {
        if (!testId.trim() || !bankId || selected.size === 0) return;
        setAddingToTest(true);
        try {
            const { data } = await axiosInstance.post(`/AI/question-bank/${bankId}/add-to-test`, {
                testId: testId.trim(),
                questionIds: [...selected].map(String),
            });
            setSnack({ open: true, msg: data.message, severity: 'success' });
            setSelected(new Set());
            setTestId('');
        } catch (err) {
            setSnack({ open: true, msg: err.response?.data?.message || 'Failed to add questions', severity: 'error' });
        } finally {
            setAddingToTest(false);
        }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Question Generator</Typography>

            {/* Inputs */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select value={subjectId} label="Subject" onChange={e => setSubjectId(e.target.value)}>
                        {teachSubjects.map(s => (
                            <MenuItem key={s._id} value={s._id}>
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
                    sx={{ minWidth: 200 }}
                />

                <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel>Difficulty</InputLabel>
                    <Select value={difficulty} label="Difficulty" onChange={e => setDifficulty(e.target.value)}>
                        <MenuItem value="easy">Easy</MenuItem>
                        <MenuItem value="medium">Medium</MenuItem>
                        <MenuItem value="hard">Hard</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ mb: 2, maxWidth: 300 }}>
                <Typography variant="body2" gutterBottom>
                    Number of Questions: <strong>{count}</strong>
                </Typography>
                <Slider value={count} min={1} max={10} step={1} marks
                    onChange={(_, v) => setCount(v)} valueLabelDisplay="auto" />
            </Box>

            <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={loading || !topic.trim() || !subjectName}
                sx={{ mb: 2 }}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
            >
                {loading ? 'Generating…' : 'Generate Questions'}
            </Button>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Results */}
            {questions.length > 0 && (
                <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" color="text.secondary">
                            {questions.length} questions generated
                        </Typography>
                        {bankId && (
                            <Chip icon={<SaveIcon fontSize="small" />} label="Saved to Question Bank"
                                size="small" color="success" variant="outlined" />
                        )}
                        <Button size="small" onClick={selectAll} disabled={selected.size === questions.length}>
                            Select All
                        </Button>
                        <Button size="small" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                            Deselect All
                        </Button>
                    </Box>

                    {questions.map((q, i) => (
                        <QuestionCard
                            key={q._id || i}
                            question={q}
                            index={i}
                            selected={selected.has(q._id || i)}
                            onToggle={toggleSelect}
                        />
                    ))}

                    {/* Add to test */}
                    {bankId && selected.size > 0 && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>
                                Add {selected.size} selected question{selected.size > 1 ? 's' : ''} to a test
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                <TextField
                                    size="small"
                                    label="Test ID"
                                    placeholder="Paste test _id here"
                                    value={testId}
                                    onChange={e => setTestId(e.target.value)}
                                    sx={{ minWidth: 260 }}
                                />
                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={addingToTest ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineIcon />}
                                    onClick={handleAddToTest}
                                    disabled={addingToTest || !testId.trim()}
                                >
                                    {addingToTest ? 'Adding…' : 'Add to Test'}
                                </Button>
                            </Box>
                        </>
                    )}
                </>
            )}

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default QuestionGeneratorPanel;
