import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
    Box, Button, Link, TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const statusColor = {
    submitted: { bg: '#e3f2fd', text: '#1565c0' },
    graded:    { bg: '#e8f5e9', text: '#2e7d32' },
    late:      { bg: '#fff3e0', text: '#e65100' },
};

const AssignmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useSelector(s => s.user);
    const isTeacher = currentUser?.role === 'Teacher';

    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [gradeInputs, setGradeInputs] = useState({});

    useEffect(() => {
        axiosInstance.get(`${process.env.REACT_APP_BASE_URL}/AssignmentSubmissions/${id}`)
            .then(res => setSubmissions(res.data))
            .catch(err => setError(err.response?.data?.message || 'Failed to load submissions'))
            .finally(() => setLoading(false));
    }, [id]);

    const handleGradeChange = (submissionId, field, value) => {
        setGradeInputs(prev => ({
            ...prev,
            [submissionId]: {
                ...prev[submissionId],
                [field]: value,
            },
        }));
    };

    const handleSaveGrade = async (submissionId) => {
        const input = gradeInputs[submissionId] || {};
        setGradeInputs(prev => ({
            ...prev,
            [submissionId]: { ...prev[submissionId], saving: true, error: null },
        }));
        try {
            await axiosInstance.put(
                `${process.env.REACT_APP_BASE_URL}/GradeSubmission/${submissionId}`,
                { grade: input.grade, feedback: input.feedback }
            );
            setSubmissions(prev =>
                prev.map(s => s._id === submissionId ? { ...s, status: 'graded' } : s)
            );
            setGradeInputs(prev => ({
                ...prev,
                [submissionId]: { ...prev[submissionId], saving: false, error: null },
            }));
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to save grade';
            setGradeInputs(prev => ({
                ...prev,
                [submissionId]: { ...prev[submissionId], saving: false, error: msg },
            }));
        }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                    variant="outlined"
                    size="small"
                >
                    Back
                </Button>
                <Typography variant="h5">Assignment Submissions</Typography>
            </Box>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!loading && !error && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                <TableCell><strong>Student Name</strong></TableCell>
                                <TableCell><strong>Roll No.</strong></TableCell>
                                <TableCell><strong>Submitted At</strong></TableCell>
                                <TableCell><strong>File</strong></TableCell>
                                <TableCell align="center"><strong>Grade</strong></TableCell>
                                <TableCell align="center"><strong>Status</strong></TableCell>
                                {isTeacher && <TableCell><strong>Grade Input</strong></TableCell>}
                                {isTeacher && <TableCell><strong>Feedback Input</strong></TableCell>}
                                {isTeacher && <TableCell></TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {submissions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={isTeacher ? 9 : 6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No submissions yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                submissions.map(s => {
                                    const colors = statusColor[s.status] || { bg: '#f5f5f5', text: '#757575' };
                                    const fileHref = s.fileUrl?.startsWith('http')
                                        ? s.fileUrl
                                        : `${process.env.REACT_APP_BASE_URL}${s.fileUrl}`;
                                    const input = gradeInputs[s._id] || {};
                                    return (
                                        <TableRow key={s._id} hover>
                                            <TableCell>{s.studentId?.name || '—'}</TableCell>
                                            <TableCell>{s.studentId?.rollNum || '—'}</TableCell>
                                            <TableCell>
                                                {s.submittedAt
                                                    ? new Date(s.submittedAt).toLocaleString()
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {s.fileUrl ? (
                                                    <Link href={fileHref} target="_blank" rel="noopener noreferrer">
                                                        {s.fileName || 'View File'}
                                                    </Link>
                                                ) : '—'}
                                            </TableCell>
                                            <TableCell align="center">{s.grade || '—'}</TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={s.status}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: colors.bg,
                                                        color: colors.text,
                                                        fontWeight: 600,
                                                        textTransform: 'capitalize',
                                                    }}
                                                />
                                            </TableCell>
                                            {isTeacher && (
                                                <TableCell>
                                                    <TextField
                                                        size="small"
                                                        placeholder="Grade"
                                                        value={input.grade ?? ''}
                                                        onChange={e => handleGradeChange(s._id, 'grade', e.target.value)}
                                                        sx={{ width: 90 }}
                                                    />
                                                </TableCell>
                                            )}
                                            {isTeacher && (
                                                <TableCell>
                                                    <TextField
                                                        size="small"
                                                        placeholder="Feedback"
                                                        value={input.feedback ?? ''}
                                                        onChange={e => handleGradeChange(s._id, 'feedback', e.target.value)}
                                                        sx={{ width: 160 }}
                                                    />
                                                    {input.error && (
                                                        <Typography variant="caption" color="error" display="block">
                                                            {input.error}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            )}
                                            {isTeacher && (
                                                <TableCell>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        disabled={input.saving}
                                                        onClick={() => handleSaveGrade(s._id)}
                                                    >
                                                        {input.saving ? 'Saving…' : 'Save'}
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default AssignmentDetail;
