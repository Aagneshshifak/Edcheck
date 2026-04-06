import React, { useState, useEffect } from 'react';
import {
    Box,
    TextField,
    Button,
    Snackbar,
    Alert,
    Typography,
    Card,
    CardContent,
    Radio,
    RadioGroup,
    FormControl,
    FormLabel,
    IconButton,
    Tooltip,
    Divider,
    CircularProgress,
    Paper,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import PublishIcon from '@mui/icons-material/Publish';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import * as XLSX from 'xlsx';

const emptyQuestion = () => ({
    questionText: '',
    options: ['', ''],
    correctAnswer: 0,
    marks: 1,
});

const AddQuestions = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useSelector((state) => state.user);

    const [test, setTest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState([emptyQuestion()]);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [submitting, setSubmitting] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // Load existing test data
    useEffect(() => {
        const fetchTest = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get(
                    `${process.env.REACT_APP_BASE_URL}/Test/${testId}`
                );
                setTest(res.data);
                // If test already has questions, load them
                if (res.data.questions && res.data.questions.length > 0) {
                    setQuestions(res.data.questions);
                }
            } catch (err) {
                setSnackbar({ 
                    open: true, 
                    message: err.response?.data?.message || 'Failed to load test', 
                    severity: 'error' 
                });
            } finally {
                setLoading(false);
            }
        };

        if (testId) {
            fetchTest();
        }
    }, [testId]);

    // ── Excel / XML import ────────────────────────────────────────────────────

    /**
     * Expected Excel columns (row 1 = header):
     * questionText | option1 | option2 | option3 | option4 | correctAnswer (1-based) | marks
     */
    const parseExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                const parsed = rows.map((row) => {
                    const opts = [row.option1, row.option2, row.option3, row.option4]
                        .map(String)
                        .filter(o => o.trim() !== '');
                    const correct = Math.max(0, Number(row.correctAnswer || 1) - 1);
                    return {
                        questionText: String(row.questionText || ''),
                        options: opts.length >= 2 ? opts : ['', ''],
                        correctAnswer: correct,
                        marks: Number(row.marks || 1),
                    };
                }).filter(q => q.questionText.trim());
                if (parsed.length === 0) {
                    setSnackbar({ open: true, message: 'No valid questions found in file', severity: 'warning' });
                    return;
                }
                setQuestions(parsed);
                setSnackbar({ open: true, message: `Imported ${parsed.length} questions from Excel`, severity: 'success' });
            } catch {
                setSnackbar({ open: true, message: 'Failed to parse Excel file', severity: 'error' });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    /**
     * Expected XML structure (supports two formats):
     * 
     * Format 1 (original):
     * <questions>
     *   <question marks="1">
     *     <text>Question text</text>
     *     <option correct="true">Option A</option>
     *     <option>Option B</option>
     *   </question>
     * </questions>
     * 
     * Format 2 (alternative):
     * <questions>
     *   <question>
     *     <questionText>Question text</questionText>
     *     <options>
     *       <option>Option A</option>
     *       <option>Option B</option>
     *     </options>
     *     <correctAnswer>1</correctAnswer>
     *     <marks>1</marks>
     *   </question>
     * </questions>
     */
    const parseXML = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(e.target.result, 'text/xml');
                const qNodes = doc.querySelectorAll('question');
                const parsed = Array.from(qNodes).map((q) => {
                    // Try Format 1 first (original format)
                    let text = q.querySelector('text')?.textContent?.trim();
                    let optNodes = q.querySelectorAll('option');
                    let options = [];
                    let correctAnswer = 0;
                    let marks = Number(q.getAttribute('marks') || 1);

                    if (text && optNodes.length > 0) {
                        // Format 1: <text> and direct <option> elements
                        optNodes.forEach((opt, i) => {
                            options.push(opt.textContent.trim());
                            if (opt.getAttribute('correct') === 'true') correctAnswer = i;
                        });
                    } else {
                        // Format 2: <questionText>, <options>, <correctAnswer>, <marks>
                        text = q.querySelector('questionText')?.textContent?.trim();
                        const optionsContainer = q.querySelector('options');
                        if (optionsContainer) {
                            optNodes = optionsContainer.querySelectorAll('option');
                            options = Array.from(optNodes).map(opt => opt.textContent.trim());
                        }
                        const correctAnswerNode = q.querySelector('correctAnswer');
                        if (correctAnswerNode) {
                            correctAnswer = Math.max(0, Number(correctAnswerNode.textContent.trim()) - 1);
                        }
                        const marksNode = q.querySelector('marks');
                        if (marksNode) {
                            marks = Number(marksNode.textContent.trim()) || 1;
                        }
                    }

                    return {
                        questionText: text || '',
                        options: options.length >= 2 ? options : ['', ''],
                        correctAnswer,
                        marks,
                    };
                }).filter(q => q.questionText);
                
                if (parsed.length === 0) {
                    setSnackbar({ open: true, message: 'No valid questions found in XML', severity: 'warning' });
                    return;
                }
                setQuestions(parsed);
                setSnackbar({ open: true, message: `Imported ${parsed.length} questions from XML`, severity: 'success' });
            } catch (err) {
                console.error('XML parse error:', err);
                setSnackbar({ open: true, message: 'Failed to parse XML file', severity: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const handleImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'xml') parseXML(file);
        else if (['xlsx', 'xls', 'csv'].includes(ext)) parseExcel(file);
        else setSnackbar({ open: true, message: 'Unsupported file type. Use .xlsx, .xls, .csv or .xml', severity: 'error' });
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['questionText', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'marks'],
            ['What is 2+2?', '3', '4', '5', '6', '2', '1'],
            ['Capital of France?', 'Berlin', 'Paris', 'Rome', 'Madrid', '2', '1'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        XLSX.writeFile(wb, 'questions_template.xlsx');
    };

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

    const handleSaveQuestions = async () => {
        setSubmitting(true);
        try {
            const payload = {
                questions: questions.map((q) => ({
                    questionText: q.questionText,
                    options: q.options,
                    correctAnswer: Number(q.correctAnswer),
                    marks: Number(q.marks),
                })),
            };
            await axiosInstance.put(
                `${process.env.REACT_APP_BASE_URL}/Test/${testId}/questions`,
                payload
            );
            setSnackbar({ open: true, message: 'Questions saved successfully!', severity: 'success' });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to save questions';
            setSnackbar({ open: true, message: msg, severity: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handlePublishTest = async () => {
        if (questions.length === 0) {
            setSnackbar({ 
                open: true, 
                message: 'Cannot publish test with no questions', 
                severity: 'error' 
            });
            return;
        }

        setPublishing(true);
        try {
            await axiosInstance.put(
                `${process.env.REACT_APP_BASE_URL}/Test/${testId}/publish`,
                { teacherId: currentUser._id }
            );
            setSnackbar({ 
                open: true, 
                message: 'Test published successfully! Admin has been notified.', 
                severity: 'success' 
            });
            // Navigate back to test list after a short delay
            setTimeout(() => {
                navigate('/Teacher/tests');
            }, 2000);
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to publish test';
            setSnackbar({ open: true, message: msg, severity: 'error' });
        } finally {
            setPublishing(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!test) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography color="error">Test not found</Typography>
                <Button 
                    startIcon={<ArrowBackIcon />} 
                    onClick={() => navigate('/Teacher/tests')}
                    sx={{ mt: 2 }}
                >
                    Back to Tests
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <IconButton onClick={() => navigate('/Teacher/tests')} aria-label="Back">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" fontWeight={700}>
                    {questions.length > 0 && test.questions?.length > 0 ? 'Edit Questions' : 'Add Questions'}
                </Typography>
            </Box>

            {/* Test Metadata - Read Only */}
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" fontWeight={600} mb={2}>
                    Test Information
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Title</Typography>
                        <Typography variant="body1" fontWeight={500}>{test.title}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Subject</Typography>
                        <Typography variant="body1" fontWeight={500}>
                            {test.subject?.subName || test.subject || '—'}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Class</Typography>
                        <Typography variant="body1" fontWeight={500}>
                            {test.classId?.sclassName || test.classId?.className || '—'}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Duration</Typography>
                        <Typography variant="body1" fontWeight={500}>
                            {test.durationMinutes} minutes
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Questions Section */}
            <Typography variant="h6" fontWeight={600} mb={2}>
                Questions
            </Typography>

            {/* Bulk import */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tooltip title="Download Excel template">
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
                        Template
                    </Button>
                </Tooltip>
                <Button size="small" variant="outlined" startIcon={<UploadFileIcon />} component="label">
                    Import Excel / XML
                    <input type="file" hidden accept=".xlsx,.xls,.csv,.xml" onChange={handleImport} />
                </Button>
                <Typography variant="caption" color="text.secondary">
                    Supports .xlsx, .xls, .csv, .xml — replaces current questions
                </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

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

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveQuestions}
                    disabled={submitting || questions.length === 0}
                    size="large"
                >
                    {submitting ? 'Saving...' : 'Save Questions'}
                </Button>
                <Button
                    variant="contained"
                    color="success"
                    startIcon={<PublishIcon />}
                    onClick={handlePublishTest}
                    disabled={publishing || questions.length === 0}
                    size="large"
                >
                    {publishing ? 'Publishing...' : 'Publish Test'}
                </Button>
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

export default AddQuestions;
