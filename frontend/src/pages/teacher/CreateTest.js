import React, { useState } from 'react';
import {
    Box,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Switch,
    FormControlLabel,
    Button,
    Snackbar,
    Alert,
    Typography,
    Card,
    CardContent,
    Radio,
    RadioGroup,
    FormLabel,
    IconButton,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSelector } from 'react-redux';
import axios from 'axios';

const emptyQuestion = () => ({
    questionText: '',
    options: ['', ''],
    correctAnswer: 0,
    marks: 1,
});

const CreateTest = () => {
    const { currentUser } = useSelector((state) => state.user);

    const subjects = currentUser?.teachSubject
        ? Array.isArray(currentUser.teachSubject)
            ? currentUser.teachSubject
            : [currentUser.teachSubject]
        : [];
    const classId = currentUser?.teachSclass?._id || '';
    const schoolId = currentUser?.school?._id || '';
    const createdBy = currentUser?._id || '';

    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(30);
    const [shuffleQuestions, setShuffleQuestions] = useState(false);
    const [questions, setQuestions] = useState([emptyQuestion()]);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [submitting, setSubmitting] = useState(false);

    const handleAddQuestion = () => {
        setQuestions((prev) => [...prev, emptyQuestion()]);
    };

    const handleRemoveQuestion = (index) => {
        setQuestions((prev) => prev.filter((_, i) => i !== index));
    };

    const handleQuestionChange = (index, field, value) => {
        setQuestions((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleOptionChange = (qIndex, optIndex, value) => {
        setQuestions((prev) => {
            const updated = [...prev];
            const opts = [...updated[qIndex].options];
            opts[optIndex] = value;
            updated[qIndex] = { ...updated[qIndex], options: opts };
            return updated;
        });
    };

    const handleAddOption = (qIndex) => {
        setQuestions((prev) => {
            const updated = [...prev];
            if (updated[qIndex].options.length < 6) {
                updated[qIndex] = {
                    ...updated[qIndex],
                    options: [...updated[qIndex].options, ''],
                };
            }
            return updated;
        });
    };

    const handleRemoveOption = (qIndex, optIndex) => {
        setQuestions((prev) => {
            const updated = [...prev];
            const opts = updated[qIndex].options.filter((_, i) => i !== optIndex);
            const correctAnswer =
                updated[qIndex].correctAnswer >= opts.length
                    ? opts.length - 1
                    : updated[qIndex].correctAnswer;
            updated[qIndex] = { ...updated[qIndex], options: opts, correctAnswer };
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                title,
                subject,
                classId,
                school: schoolId,
                createdBy,
                durationMinutes: Number(durationMinutes),
                shuffleQuestions,
                questions: questions.map((q) => ({
                    questionText: q.questionText,
                    options: q.options,
                    correctAnswer: Number(q.correctAnswer),
                    marks: Number(q.marks),
                })),
            };
            await axios.post(`${process.env.REACT_APP_BASE_URL}/TestCreate`, payload);
            setSnackbar({ open: true, message: 'Test created successfully!', severity: 'success' });
            setTitle('');
            setSubject('');
            setDurationMinutes(30);
            setShuffleQuestions(false);
            setQuestions([emptyQuestion()]);
        } catch (err) {
            const msg =
                err.response?.data?.message || err.message || 'Failed to create test';
            setSnackbar({ open: true, message: msg, severity: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h5" fontWeight={700} mb={3}>
                Create Test
            </Typography>

            <Box component="form" onSubmit={handleSubmit}>
                {/* Basic fields */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    <TextField
                        label="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        fullWidth
                    />

                    <FormControl fullWidth required>
                        <InputLabel>Subject</InputLabel>
                        <Select
                            value={subject}
                            label="Subject"
                            onChange={(e) => setSubject(e.target.value)}
                        >
                            {subjects.map((s) => (
                                <MenuItem key={s._id} value={s._id}>
                                    {s.subName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Duration (minutes)"
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        inputProps={{ min: 1 }}
                        required
                        fullWidth
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={shuffleQuestions}
                                onChange={(e) => setShuffleQuestions(e.target.checked)}
                            />
                        }
                        label="Shuffle Questions"
                    />
                </Box>

                {/* Questions */}
                <Typography variant="h6" fontWeight={600} mb={2}>
                    Questions
                </Typography>

                {questions.map((q, qIndex) => (
                    <Card key={qIndex} variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Question {qIndex + 1}
                                </Typography>
                                {questions.length > 1 && (
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleRemoveQuestion(qIndex)}
                                        aria-label="Remove question"
                                    >
                                        <DeleteOutlineIcon />
                                    </IconButton>
                                )}
                            </Box>

                            <TextField
                                label="Question Text"
                                value={q.questionText}
                                onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                                required
                                fullWidth
                                multiline
                                minRows={2}
                                sx={{ mb: 2 }}
                            />

                            <FormControl component="fieldset" sx={{ width: '100%', mb: 2 }}>
                                <FormLabel component="legend" sx={{ mb: 1 }}>
                                    Options (select correct answer)
                                </FormLabel>
                                <RadioGroup
                                    value={String(q.correctAnswer)}
                                    onChange={(e) =>
                                        handleQuestionChange(qIndex, 'correctAnswer', Number(e.target.value))
                                    }
                                >
                                    {q.options.map((opt, optIndex) => (
                                        <Box
                                            key={optIndex}
                                            sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                                        >
                                            <Radio value={String(optIndex)} size="small" />
                                            <TextField
                                                label={`Option ${optIndex + 1}`}
                                                value={opt}
                                                onChange={(e) =>
                                                    handleOptionChange(qIndex, optIndex, e.target.value)
                                                }
                                                required
                                                size="small"
                                                sx={{ flex: 1 }}
                                            />
                                            {q.options.length > 2 && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleRemoveOption(qIndex, optIndex)}
                                                    aria-label="Remove option"
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Box>
                                    ))}
                                </RadioGroup>

                                {q.options.length < 6 && (
                                    <Button
                                        size="small"
                                        startIcon={<AddCircleOutlineIcon />}
                                        onClick={() => handleAddOption(qIndex)}
                                        sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                                    >
                                        Add Option
                                    </Button>
                                )}
                            </FormControl>

                            <TextField
                                label="Marks"
                                type="number"
                                value={q.marks}
                                onChange={(e) =>
                                    handleQuestionChange(qIndex, 'marks', e.target.value)
                                }
                                inputProps={{ min: 1 }}
                                required
                                size="small"
                                sx={{ width: 120 }}
                            />
                        </CardContent>
                    </Card>
                ))}

                <Button
                    variant="outlined"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddQuestion}
                    sx={{ mb: 3 }}
                >
                    Add Question
                </Button>

                <Box>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={submitting}
                        size="large"
                    >
                        {submitting ? 'Creating...' : 'Create Test'}
                    </Button>
                </Box>
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default CreateTest;
