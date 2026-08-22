import React, { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableHead, TableRow, TableCell,
    TableBody, TableContainer, Chip, Button, TextField,
    CircularProgress, Alert, IconButton, Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import axiosInstance from '../../utils/axiosInstance';
import { useParams, useNavigate } from 'react-router-dom';

const TeacherTestValidation = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const [test, setTest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Track edits per question: { [questionId]: { questionText, options, correctAnswer, isApproved, isRejected } }
    const [edits, setEdits] = useState({});

    const fetchTest = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosInstance.get(`/Test/${testId}`);
            setTest(data);
            
            // Initialize edits state
            const initialEdits = {};
            data.questions?.forEach(q => {
                initialEdits[q._id || q._tempId] = {
                    questionText: q.questionText,
                    options: [...(q.options || [])],
                    correctAnswer: q.correctAnswer,
                    isApproved: q.validationStatus === 'VALID',
                    isRejected: false
                };
            });
            setEdits(initialEdits);
        } catch (err) {
            setError('Failed to load test details.');
        } finally {
            setLoading(false);
        }
    }, [testId]);

    useEffect(() => { fetchTest(); }, [fetchTest]);

    const handlePublish = async () => {
        // Collect all questions that aren't rejected
        const finalQuestions = test.questions.map(q => {
            const id = q._id || q._tempId;
            const ed = edits[id];
            if (ed.isRejected) return null; // We filter these out below
            
            return {
                ...q,
                questionText: ed.questionText,
                options: ed.options,
                correctAnswer: ed.correctAnswer,
                validationStatus: 'VALID'
            };
        }).filter(Boolean); // Remove rejected questions

        if (finalQuestions.length === 0) {
            setError('Cannot publish a test with 0 questions.');
            return;
        }

        try {
            setLoading(true);
            await axiosInstance.put(`/Test/${testId}`, {
                questions: finalQuestions,
                status: 'PUBLISHED'
            });
            setSuccess('Test published successfully!');
            setTimeout(() => navigate('/Teacher/tests'), 2000);
        } catch (err) {
            setError('Failed to publish test.');
            setLoading(false);
        }
    };

    const handleFieldChange = (qId, field, value) => {
        setEdits(prev => ({
            ...prev,
            [qId]: { ...prev[qId], [field]: value }
        }));
    };

    const handleOptionChange = (qId, optionIndex, value) => {
        setEdits(prev => {
            const newOptions = [...prev[qId].options];
            newOptions[optionIndex] = value;
            return {
                ...prev,
                [qId]: { ...prev[qId], options: newOptions }
            };
        });
    };

    const toggleApprove = (qId) => {
        setEdits(prev => ({
            ...prev,
            [qId]: { ...prev[qId], isApproved: true, isRejected: false }
        }));
    };

    const toggleReject = (qId) => {
        setEdits(prev => ({
            ...prev,
            [qId]: { ...prev[qId], isApproved: false, isRejected: true }
        }));
    };

    if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
    if (!test) return <Box sx={{ p: 4 }}><Alert severity="error">{error || 'Test not found'}</Alert></Box>;

    const pendingCount = Object.values(edits).filter(e => !e.isApproved && !e.isRejected).length;

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h5" fontWeight="bold">Review Generated Assessment</Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        {test.title} • {test.subject?.subName || 'No Subject'}
                    </Typography>
                </Box>
                <Button 
                    variant="contained" 
                    color="success" 
                    onClick={handlePublish}
                    disabled={pendingCount > 0}
                >
                    Publish Test ({test.questions.length - Object.values(edits).filter(e => e.isRejected).length} Qs)
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
            {pendingCount > 0 && <Alert severity="warning" sx={{ mb: 2 }}>Please review all {pendingCount} pending questions before publishing.</Alert>}

            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'background.default' }}>
                            <TableCell><strong>Curriculum Meta</strong></TableCell>
                            <TableCell><strong>Question & Options</strong></TableCell>
                            <TableCell><strong>Validation Issues</strong></TableCell>
                            <TableCell align="center"><strong>Actions</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {test.questions.map((q, idx) => {
                            const qId = q._id || q._tempId;
                            const ed = edits[qId];
                            if (!ed) return null;
                            
                            const isPending = !ed.isApproved && !ed.isRejected;
                            const rowColor = ed.isRejected ? 'rgba(211,47,47,0.05)' : ed.isApproved ? 'rgba(46,125,50,0.05)' : 'inherit';

                            return (
                                <TableRow key={qId} sx={{ bgcolor: rowColor }}>
                                    <TableCell sx={{ width: '20%', verticalAlign: 'top' }}>
                                        <Typography variant="body2" fontWeight="bold">Q{idx + 1}. {q.topic}</Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Domain: {q.curriculumMeta?.domain || 'N/A'}<br/>
                                            Chapter: {q.curriculumMeta?.chapter || 'N/A'}<br/>
                                            Subtopic: {q.curriculumMeta?.subtopic || 'N/A'}
                                        </Typography>
                                        <Chip 
                                            size="small" 
                                            label={q.difficulty} 
                                            color={q.difficulty === 'hard' ? 'error' : q.difficulty === 'medium' ? 'warning' : 'success'} 
                                            sx={{ mt: 1 }}
                                        />
                                    </TableCell>

                                    <TableCell sx={{ width: '45%', verticalAlign: 'top' }}>
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            variant="outlined"
                                            size="small"
                                            value={ed.questionText}
                                            onChange={(e) => handleFieldChange(qId, 'questionText', e.target.value)}
                                            sx={{ mb: 1.5 }}
                                        />
                                        {ed.options.map((opt, oIdx) => (
                                            <Box key={oIdx} sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                                                <input 
                                                    type="radio" 
                                                    checked={ed.correctAnswer === oIdx}
                                                    onChange={() => handleFieldChange(qId, 'correctAnswer', oIdx)}
                                                />
                                                <TextField
                                                    fullWidth
                                                    variant="standard"
                                                    size="small"
                                                    value={opt}
                                                    onChange={(e) => handleOptionChange(qId, oIdx, e.target.value)}
                                                />
                                            </Box>
                                        ))}
                                    </TableCell>

                                    <TableCell sx={{ width: '20%', verticalAlign: 'top' }}>
                                        {q.validationNotes ? (
                                            <Alert severity="warning" icon={<WarningAmberIcon fontSize="small"/>} sx={{ py: 0, px: 1, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
                                                {q.validationNotes}
                                            </Alert>
                                        ) : (
                                            <Typography variant="caption" color="success.main">Passed automatic checks</Typography>
                                        )}
                                    </TableCell>

                                    <TableCell sx={{ width: '15%', verticalAlign: 'middle', textAlign: 'center' }}>
                                        {ed.isRejected ? (
                                            <Chip label="Rejected" color="error" variant="outlined" onDelete={() => toggleApprove(qId)} deleteIcon={<EditIcon />} />
                                        ) : ed.isApproved ? (
                                            <Chip label="Approved" color="success" variant="outlined" onDelete={() => toggleReject(qId)} deleteIcon={<EditIcon />} />
                                        ) : (
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                <Button size="small" variant="contained" color="success" onClick={() => toggleApprove(qId)}>Approve</Button>
                                                <Button size="small" variant="outlined" color="error" onClick={() => toggleReject(qId)}>Reject</Button>
                                            </Box>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default TeacherTestValidation;
