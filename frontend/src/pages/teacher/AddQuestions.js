import React, { useState, useEffect } from 'react';
import {
    Box, TextField, Button, Snackbar, Alert, Typography,
    Card, CardContent, Radio, RadioGroup, FormControl, FormLabel,
    IconButton, Tooltip, Divider, CircularProgress, Paper, Chip,
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

    useEffect(() => {
        const fetchTest = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get(`/Test/${testId}`);
                setTest(res.data);
                if (res.data.questions && res.data.questions.length > 0) {
                    setQuestions(res.data.questions);
                }
            } catch (err) {
                setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to load test', severity: 'error' });
            } finally {
                setLoading(false);
            }
        };
        if (testId) fetchTest();
    }, [testId]);

    // ── Excel import ──────────────────────────────────────────────────────────
    const parseExcel = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                const parsed = rows.map((row) => {
                    const opts = [row.option1, row.option2, row.option3, row.option4]
                        .map(String).filter(o => o.trim() !== '');

                    // Support correctAnswer as:
                    // - Letter: A/B/C/D (case-insensitive)
                    // - 1-based number: 1/2/3/4
                    // - 0-based number: 0/1/2/3 (if value is 0)
                    let correctAnswer = 0;
                    const ca = String(row.correctAnswer || '').trim().toUpperCase();
                    if (['A','B','C','D'].includes(ca)) {
                        correctAnswer = ['A','B','C','D'].indexOf(ca);
                    } else if (ca === '0') {
                        correctAnswer = 0; // explicit 0-based
                    } else {
                        const num = Number(ca);
                        correctAnswer = num > 0 ? num - 1 : 0; // 1-based → 0-based
                    }
                    correctAnswer = Math.max(0, Math.min(correctAnswer, opts.length - 1));

                    return {
                        questionText: String(row.questionText || ''),
                        options: opts.length >= 2 ? opts : ['', ''],
                        correctAnswer,
                        marks: Number(row.marks || 1),
                    };
                }).filter(q => q.questionText.trim());
                if (!parsed.length) { setSnackbar({ open: true, message: 'No valid questions found', severity: 'warning' }); return; }
                setQuestions(parsed);
                setSnackbar({ open: true, message: `Imported ${parsed.length} questions`, severity: 'success' });
            } catch { setSnackbar({ open: true, message: 'Failed to parse Excel file', severity: 'error' }); }
        };
        reader.readAsArrayBuffer(file);
    };

    // ── XML import ────────────────────────────────────────────────────────────
    const parseXML = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const doc = new DOMParser().parseFromString(e.target.result, 'text/xml');
                const parsed = Array.from(doc.querySelectorAll('question')).map((q) => {
                    const text = q.querySelector('text')?.textContent?.trim()
                        || q.querySelector('questionText')?.textContent?.trim() || '';
                    const optNodes = q.querySelectorAll('option');
                    const options = Array.from(optNodes).map(o => o.textContent.trim());

                    let correctAnswer = 0;

                    // Method 1: correct="true" attribute on an <option>
                    let foundByAttr = false;
                    optNodes.forEach((o, i) => {
                        if (o.getAttribute('correct') === 'true') {
                            correctAnswer = i;
                            foundByAttr = true;
                        }
                    });

                    // Method 2: <correctAnswer> element — supports A/B/C/D or 1/2/3/4
                    if (!foundByAttr) {
                        const caNode = q.querySelector('correctAnswer') || q.querySelector('answer');
                        if (caNode) {
                            const ca = caNode.textContent.trim().toUpperCase();
                            if (['A','B','C','D','E','F'].includes(ca)) {
                                correctAnswer = ['A','B','C','D','E','F'].indexOf(ca);
                            } else {
                                const num = Number(ca);
                                correctAnswer = num > 0 ? num - 1 : 0; // 1-based → 0-based
                            }
                        }
                    }

                    correctAnswer = Math.max(0, Math.min(correctAnswer, options.length - 1));

                    return {
                        questionText: text,
                        options: options.length >= 2 ? options : ['', ''],
                        correctAnswer,
                        marks: Number(q.getAttribute('marks') || q.querySelector('marks')?.textContent || 1),
                    };
                }).filter(q => q.questionText);

                if (!parsed.length) {
                    setSnackbar({ open: true, message: 'No valid questions found in XML', severity: 'warning' });
                    return;
                }
                setQuestions(parsed);
                setValidationResults(null);
                setSnackbar({ open: true, message: `Imported ${parsed.length} questions from XML`, severity: 'success' });
            } catch {
                setSnackbar({ open: true, message: 'Failed to parse XML file', severity: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const downloadXMLTemplate = () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<questions>

  <!-- FORMAT 1: Mark correct answer using correct="true" on the option -->
  <question marks="1">
    <text>What is the SI unit of force?</text>
    <option>Watt</option>
    <option correct="true">Newton</option>
    <option>Joule</option>
    <option>Pascal</option>
  </question>

  <!-- FORMAT 2: Use <correctAnswer> with letter A/B/C/D -->
  <question marks="1">
    <text>What does CPU stand for?</text>
    <option>Computer Personal Unit</option>
    <option>Central Processing Unit</option>
    <option>Central Program Utility</option>
    <option>Core Processing Unit</option>
    <correctAnswer>B</correctAnswer>
  </question>

  <!-- FORMAT 3: Use <correctAnswer> with number 1/2/3/4 (1-based) -->
  <question marks="2">
    <text>Which planet is closest to the Sun?</text>
    <option>Mercury</option>
    <option>Venus</option>
    <option>Earth</option>
    <option>Mars</option>
    <correctAnswer>1</correctAnswer>
  </question>

</questions>`;
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'questions_template.xml';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'xml') parseXML(file);
        else if (['xlsx', 'xls', 'csv'].includes(ext)) parseExcel(file);
        else setSnackbar({ open: true, message: 'Use .xlsx, .xls, .csv or .xml', severity: 'error' });
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['questionText', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'marks'],
            ['', '', '', '', '', '← Use A, B, C or D', ''],
            ['What is the SI unit of force?', 'Watt', 'Newton', 'Joule', 'Pascal', 'B', '1'],
            ['What does CPU stand for?', 'Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Unit', 'A', '1'],
            ['Speed of light in vacuum?', '3×10⁸ m/s', '3×10⁶ m/s', '3×10⁴ m/s', '3×10¹⁰ m/s', 'A', '1'],
        ]);
        // Set column widths
        ws['!cols'] = [{ wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 18 }, { wch: 8 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        XLSX.writeFile(wb, 'questions_template.xlsx');
    };

    const [validating, setValidating] = useState(false);
    const [validationResults, setValidationResults] = useState(null);

    // ── AI Validate ───────────────────────────────────────────────────────────
    const handleAIValidate = async () => {
        if (!questions.length) return;
        setValidating(true);
        setValidationResults(null);
        try {
            const { data } = await axiosInstance.post('/Test/ai-validate-answers', { questions });
            setValidationResults(data.results || []);

            // Auto-apply AI suggestions where confidence is high
            const updated = [...questions];
            let applied = 0;
            (data.results || []).forEach(r => {
                if (r.confidence === 'high' && r.questionIndex < updated.length) {
                    updated[r.questionIndex] = { ...updated[r.questionIndex], correctAnswer: r.correctAnswer };
                    applied++;
                }
            });
            if (applied > 0) {
                setQuestions(updated);
                setSnackbar({ open: true, message: `AI auto-corrected ${applied} answer(s) with high confidence`, severity: 'success' });
            } else {
                setSnackbar({ open: true, message: 'AI validation complete — review suggestions below', severity: 'info' });
            }
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.message || 'AI validation failed', severity: 'error' });
        } finally {
            setValidating(false);
        }
    };

    const applyAISuggestion = (questionIndex, correctAnswer) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[questionIndex] = { ...updated[questionIndex], correctAnswer };
            return updated;
        });
    };
    const handleAddQuestion = () => setQuestions(p => [...p, emptyQuestion()]);
    const handleRemoveQuestion = (i) => setQuestions(p => p.filter((_, idx) => idx !== i));
    const handleQuestionChange = (i, field, val) => setQuestions(p => { const u = [...p]; u[i] = { ...u[i], [field]: val }; return u; });
    const handleOptionChange = (qi, oi, val) => setQuestions(p => { const u = [...p]; const opts = [...u[qi].options]; opts[oi] = val; u[qi] = { ...u[qi], options: opts }; return u; });
    const handleAddOption = (qi) => setQuestions(p => { const u = [...p]; if (u[qi].options.length < 6) u[qi] = { ...u[qi], options: [...u[qi].options, ''] }; return u; });
    const handleRemoveOption = (qi, oi) => setQuestions(p => { const u = [...p]; const opts = u[qi].options.filter((_, i) => i !== oi); const ca = u[qi].correctAnswer >= opts.length ? opts.length - 1 : u[qi].correctAnswer; u[qi] = { ...u[qi], options: opts, correctAnswer: ca }; return u; });

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSubmitting(true);
        try {
            await axiosInstance.put(`/Test/${testId}/questions`, {
                questions: questions.map(q => ({ questionText: q.questionText, options: q.options, correctAnswer: Number(q.correctAnswer), marks: Number(q.marks) })),
                teacherId: currentUser._id,
            });
            setSnackbar({ open: true, message: 'Questions saved!', severity: 'success' });
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to save', severity: 'error' });
        } finally { setSubmitting(false); }
    };

    // ── Publish ───────────────────────────────────────────────────────────────
    const handlePublish = async () => {
        if (!questions.length) { setSnackbar({ open: true, message: 'Add at least one question before publishing', severity: 'error' }); return; }
        setPublishing(true);
        try {
            await axiosInstance.put(`/Test/${testId}/publish`, { teacherId: currentUser._id });
            setSnackbar({ open: true, message: 'Test published! Admin has been notified.', severity: 'success' });
            setTimeout(() => navigate('/Teacher/tests'), 1800);
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to publish', severity: 'error' });
        } finally { setPublishing(false); }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

    if (!test) return (
        <Box sx={{ p: 3 }}>
            <Typography color="error">Test not found</Typography>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/Teacher/tests')} sx={{ mt: 2 }}>Back</Button>
        </Box>
    );

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <IconButton onClick={() => navigate('/Teacher/tests')}><ArrowBackIcon /></IconButton>
                <Typography variant="h5" fontWeight={700}>
                    {test.questions?.length > 0 ? 'Edit Questions' : 'Add Questions'}
                </Typography>
            </Box>

            {/* Test metadata — read only */}
            <Paper sx={{ p: 2.5, mb: 3, border: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="subtitle2" color="text.secondary" mb={1.5} fontWeight={600} textTransform="uppercase" fontSize="0.72rem" letterSpacing={1}>
                    Test Info
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
                    {[
                        { label: 'Title', value: test.title },
                        { label: 'Subject', value: test.subject?.subName || '—' },
                        { label: 'Class', value: test.classId?.sclassName || test.classId?.className || '—' },
                        { label: 'Duration', value: `${test.durationMinutes} min` },
                    ].map(({ label, value }) => (
                        <Box key={label}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography fontWeight={600} fontSize="0.9rem">{value}</Typography>
                        </Box>
                    ))}
                </Box>
            </Paper>

            {/* Import toolbar */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Tooltip title="Download Excel template — use A/B/C/D in correctAnswer column">
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
                        Excel Template
                    </Button>
                </Tooltip>
                <Tooltip title="Download XML template with correct answer examples">
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadXMLTemplate}>
                        XML Template
                    </Button>
                </Tooltip>
                <Button size="small" variant="outlined" startIcon={<UploadFileIcon />} component="label">
                    Import Excel / XML
                    <input type="file" hidden accept=".xlsx,.xls,.csv,.xml" onChange={handleImport} />
                </Button>
                {questions.length > 0 && (
                    <Tooltip title="Use AI to detect and fix correct answers automatically">
                        <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            onClick={handleAIValidate}
                            disabled={validating}
                            startIcon={validating ? <CircularProgress size={14} color="inherit" /> : null}
                            sx={{ background: '#7c3aed', '&:hover': { background: '#6d28d9' } }}
                        >
                            {validating ? 'AI Validating…' : '✨ AI Validate Answers'}
                        </Button>
                    </Tooltip>
                )}
                <Typography variant="caption" color="text.secondary">
                    XML: use <strong>correct="true"</strong> on option or <strong>&lt;correctAnswer&gt;B&lt;/correctAnswer&gt;</strong>
                </Typography>
            </Box>

            {/* AI Validation Results */}
            {validationResults && validationResults.length > 0 && (
                <Box sx={{ mb: 2, p: 2, borderRadius: 2, border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.05)' }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#7c3aed' }}>
                        ✨ AI Validation Results
                    </Typography>
                    {validationResults.map((r, i) => {
                        const q = questions[r.questionIndex];
                        if (!q) return null;
                        const aiAnswer = q.options[r.correctAnswer];
                        const currentAnswer = q.options[q.correctAnswer];
                        const matches = r.correctAnswer === q.correctAnswer;
                        return (
                            <Box key={i} sx={{
                                display: 'flex', alignItems: 'center', gap: 1, mb: 0.75,
                                p: 1, borderRadius: 1,
                                background: matches ? 'rgba(34,197,94,0.08)' : r.confidence === 'low' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                            }}>
                                <Typography variant="caption" sx={{ minWidth: 24, fontWeight: 700 }}>Q{r.questionIndex + 1}</Typography>
                                <Typography variant="caption" sx={{ flex: 1 }}>
                                    AI says: <strong>{String.fromCharCode(65 + r.correctAnswer)}. {aiAnswer}</strong>
                                    {!matches && <span style={{ color: '#ef4444' }}> (current: {String.fromCharCode(65 + q.correctAnswer)}. {currentAnswer})</span>}
                                </Typography>
                                <Chip
                                    label={r.confidence}
                                    size="small"
                                    sx={{
                                        height: 18, fontSize: '0.65rem',
                                        bgcolor: r.confidence === 'high' ? 'rgba(34,197,94,0.15)' : r.confidence === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                        color: r.confidence === 'high' ? '#22c55e' : r.confidence === 'medium' ? '#f59e0b' : '#ef4444',
                                    }}
                                />
                                {!matches && r.confidence !== 'low' && (
                                    <Button size="small" variant="outlined" sx={{ fontSize: '0.65rem', py: 0, px: 1, minWidth: 0, height: 22 }}
                                        onClick={() => applyAISuggestion(r.questionIndex, r.correctAnswer)}>
                                        Apply
                                    </Button>
                                )}
                                {matches && <Typography variant="caption" sx={{ color: '#22c55e' }}>✓</Typography>}
                            </Box>
                        );
                    })}
                </Box>
            )}
            <Divider sx={{ mb: 2 }} />

            {/* Questions list */}
            {questions.map((q, qi) => (
                <Card key={qi} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Typography variant="subtitle1" fontWeight={600}>Question {qi + 1}</Typography>
                            {questions.length > 1 && (
                                <IconButton size="small" color="error" onClick={() => handleRemoveQuestion(qi)}>
                                    <DeleteOutlineIcon />
                                </IconButton>
                            )}
                        </Box>

                        <TextField label="Question Text" value={q.questionText}
                            onChange={e => handleQuestionChange(qi, 'questionText', e.target.value)}
                            required fullWidth multiline minRows={2} sx={{ mb: 2 }} />

                        <FormControl component="fieldset" sx={{ width: '100%', mb: 2 }}>
                            <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>Options — select correct answer</FormLabel>
                            <RadioGroup value={String(q.correctAnswer)} onChange={e => handleQuestionChange(qi, 'correctAnswer', Number(e.target.value))}>
                                {q.options.map((opt, oi) => (
                                    <Box key={oi} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Radio value={String(oi)} size="small" />
                                        <TextField label={`Option ${oi + 1}`} value={opt}
                                            onChange={e => handleOptionChange(qi, oi, e.target.value)}
                                            required size="small" sx={{ flex: 1 }} />
                                        {q.options.length > 2 && (
                                            <IconButton size="small" onClick={() => handleRemoveOption(qi, oi)}>
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Box>
                                ))}
                            </RadioGroup>
                            {q.options.length < 6 && (
                                <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={() => handleAddOption(qi)} sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
                                    Add Option
                                </Button>
                            )}
                        </FormControl>

                        <TextField label="Marks" type="number" value={q.marks}
                            onChange={e => handleQuestionChange(qi, 'marks', e.target.value)}
                            inputProps={{ min: 1 }} required size="small" sx={{ width: 120 }} />
                    </CardContent>
                </Card>
            ))}

            <Button variant="outlined" startIcon={<AddCircleOutlineIcon />} onClick={handleAddQuestion} sx={{ mb: 3 }}>
                Add Question
            </Button>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
                    disabled={submitting || !questions.length} size="large">
                    {submitting ? 'Saving…' : 'Save Questions'}
                </Button>
                <Button variant="contained" color="success" startIcon={<PublishIcon />} onClick={handlePublish}
                    disabled={publishing || !questions.length} size="large"
                    sx={{ background: '#111111', '&:hover': { background: '#333333' } }}>
                    {publishing ? 'Publishing…' : 'Publish Test'}
                </Button>
            </Box>

            <Snackbar open={snackbar.open} autoHideDuration={4000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default AddQuestions;
