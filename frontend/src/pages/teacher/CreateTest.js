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
    Tooltip,
    Divider,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import * as XLSX from 'xlsx';

const emptyQuestion = () => ({
    questionText: '',
    options: ['', ''],
    correctAnswer: 0,
    marks: 1,
});

const CreateTest = () => {
    const { currentUser } = useSelector((state) => state.user);

    const rawSubjects = currentUser?.teachSubjects?.length
        ? currentUser.teachSubjects
        : currentUser?.teachSubject
            ? Array.isArray(currentUser.teachSubject) ? currentUser.teachSubject : [currentUser.teachSubject]
            : [];

    // Deduplicate by subject name
    const seenNames = new Set();
    const subjects = rawSubjects.filter(s => {
        const name = (s.subName || s.subjectName || '').toLowerCase();
        if (!name || seenNames.has(name)) return false;
        seenNames.add(name);
        return true;
    });

    const classId = currentUser?.teachSclass?._id
        || currentUser?.teachClasses?.[0]?._id
        || currentUser?.teachClasses?.[0]
        || '';
    const schoolId = currentUser?.school?._id || currentUser?.schoolId || '';
    const createdBy = currentUser?._id || '';

    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(30);
    const [shuffleQuestions, setShuffleQuestions] = useState(false);
    const [questions, setQuestions] = useState([emptyQuestion()]);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [submitting, setSubmitting] = useState(false);

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
     * Expected XML structure:
     * <questions>
     *   <question marks="1">
     *     <text>Question text</text>
     *     <option correct="true">Option A</option>
     *     <option>Option B</option>
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
                    const text = q.querySelector('text')?.textContent?.trim()
                        || q.querySelector('questionText')?.textContent?.trim() || '';
                    const optNodes = q.querySelectorAll('option');
                    const options = Array.from(optNodes).map(o => o.textContent.trim());

                    let correctAnswer = 0;

                    // Method 1: correct="true" attribute on an <option>
                    let foundByAttr = false;
                    optNodes.forEach((opt, i) => {
                        if (opt.getAttribute('correct') === 'true') {
                            correctAnswer = i;
                            foundByAttr = true;
                        }
                    });

                    // Method 2: <correctAnswer> element — A/B/C/D or 1-based number
                    if (!foundByAttr) {
                        const caNode = q.querySelector('correctAnswer') || q.querySelector('answer');
                        if (caNode) {
                            const ca = caNode.textContent.trim().toUpperCase();
                            if (['A','B','C','D','E','F'].includes(ca)) {
                                correctAnswer = ['A','B','C','D','E','F'].indexOf(ca);
                            } else {
                                const num = Number(ca);
                                correctAnswer = num > 0 ? num - 1 : 0;
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

                if (parsed.length === 0) {
                    setSnackbar({ open: true, message: 'No valid questions found in XML', severity: 'warning' });
                    return;
                }
                setQuestions(parsed);
                setSnackbar({ open: true, message: `Imported ${parsed.length} questions from XML`, severity: 'success' });
            } catch {
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
            ['', '', '', '', '', '← Use A, B, C or D', ''],
            ['What is the SI unit of force?', 'Watt', 'Newton', 'Joule', 'Pascal', 'B', '1'],
            ['Capital of France?', 'Berlin', 'Paris', 'Rome', 'Madrid', 'B', '1'],
            ['What does CPU stand for?', 'Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Core Processing Unit', 'A', '1'],
        ]);
        ws['!cols'] = [{ wch: 50 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 18 }, { wch: 8 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        XLSX.writeFile(wb, 'questions_template.xlsx');
    };

    const downloadXMLTemplate = () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<questions>

  <!-- METHOD 1: Mark correct answer with correct="true" on the option -->
  <question marks="1">
    <text>What is the SI unit of force?</text>
    <option>Watt</option>
    <option correct="true">Newton</option>
    <option>Joule</option>
    <option>Pascal</option>
  </question>

  <!-- METHOD 2: Use correctAnswer with letter A/B/C/D -->
  <question marks="1">
    <text>Capital of France?</text>
    <option>Berlin</option>
    <option>Paris</option>
    <option>Rome</option>
    <option>Madrid</option>
    <correctAnswer>B</correctAnswer>
  </question>

  <!-- METHOD 3: Use correctAnswer with number 1/2/3/4 (1-based) -->
  <question marks="2">
    <text>What does CPU stand for?</text>
    <option>Central Processing Unit</option>
    <option>Computer Personal Unit</option>
    <option>Central Program Utility</option>
    <option>Core Processing Unit</option>
    <correctAnswer>1</correctAnswer>
  </question>

</questions>`;
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'questions_template.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
            await axiosInstance.post(`${process.env.REACT_APP_BASE_URL}/TestCreate`, payload);
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
                            {subjects.map((s, i) => (
                                <MenuItem key={s._id || s._id || i} value={s._id || s}>
                                    {s.subName || s.subjectName || String(s)}
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

                {/* Bulk import */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Tooltip title="Download Excel template (.xlsx)">
                        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
                            Excel Template
                        </Button>
                    </Tooltip>
                    <Tooltip title="Download XML template (.xml)">
                        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadXMLTemplate}>
                            XML Template
                        </Button>
                    </Tooltip>
                    <Button size="small" variant="outlined" startIcon={<UploadFileIcon />} component="label">
                        Import Excel / XML
                        <input type="file" hidden accept=".xlsx,.xls,.csv,.xml" onChange={handleImport} />
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                        Excel: use A/B/C/D in correctAnswer column · XML: use correct="true" or &lt;correctAnswer&gt;B&lt;/correctAnswer&gt;
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
