import { useState } from 'react';
import {
    Box, Typography, TextField, Select, MenuItem, FormControl,
    InputLabel, Button, CircularProgress, Alert, Card, CardContent,
    Slider, Collapse, IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import axiosInstance from '../../utils/axiosInstance';

const QuestionCard = ({ question, index }) => {
    const [open, setOpen] = useState(false);

    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
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
            </CardContent>
        </Card>
    );
};

const QuestionGeneratorPanel = () => {
    const [topic, setTopic] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [difficulty, setDifficulty] = useState('medium');
    const [count, setCount] = useState(5);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleSubmit = async () => {
        if (!topic.trim() || !subjectName.trim()) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const { data } = await axiosInstance.post('/AI/generate-questions', {
                topic: topic.trim(),
                subjectName: subjectName.trim(),
                difficulty,
                count,
            });
            setResult(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate questions');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Question Generator</Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <TextField
                    size="small"
                    label="Topic"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    sx={{ minWidth: 200 }}
                />
                <TextField
                    size="small"
                    label="Subject Name"
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    sx={{ minWidth: 180 }}
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
                <Slider
                    value={count}
                    min={1}
                    max={10}
                    step={1}
                    marks
                    onChange={(_, v) => setCount(v)}
                    valueLabelDisplay="auto"
                />
            </Box>

            <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading || !topic.trim() || !subjectName.trim()}
                sx={{ mb: 2 }}
            >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Generate Questions'}
            </Button>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {result?.questions?.map((q, i) => (
                <QuestionCard key={i} question={q} index={i} />
            ))}
        </Box>
    );
};

export default QuestionGeneratorPanel;
