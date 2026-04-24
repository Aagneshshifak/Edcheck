import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Button, Paper, Divider } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const DetailRow = ({ label, value }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={500}>{value}</Typography>
    </Box>
);

const StudentTestResult = () => {
    const { testId }  = useParams();
    const navigate    = useNavigate();
    const { currentUser } = useSelector(s => s.user);

    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
        axiosInstance.get(`/AttemptsByStudent/${currentUser._id}`)
            .then(res => {
                const found = (res.data || []).find(a => {
                    const id = a.testId?._id ?? a.testId;
                    return id === testId;
                });
                found ? setAttempt(found) : setError('Result not found for this test.');
            })
            .catch(() => setError('Failed to load result.'))
            .finally(() => setLoading(false));
    }, [currentUser._id, testId]);

    if (loading) return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, gap: 2 }}>
            <Alert severity="error">{error}</Alert>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/Student/tests')} sx={{ textTransform: 'none' }}>
                Back to Tests
            </Button>
        </Box>
    );

    const score      = attempt.score ?? 0;
    const totalMarks = attempt.totalMarks ?? 0;
    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const testTitle  = attempt.testId?.title ?? 'Test';
    const submittedAt = attempt.submittedAt
        ? new Date(attempt.submittedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
    const submissionType = attempt.submissionType === 'auto' ? 'Auto-submitted (time expired)' : 'Manually submitted';
    const scoreColor = percentage >= 75 ? 'success' : percentage >= 50 ? 'warning' : 'error';

    return (
        <Box sx={{ minHeight: '100vh', background: '#111111', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: '100%', maxWidth: 520 }}>
                <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>Test Result</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{testTitle}</Typography>

                {/* Score card */}
                <Paper variant="outlined" sx={{ p: 4, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
                        <CircularProgress
                            variant="determinate"
                            value={percentage}
                            size={120}
                            thickness={5}
                            color={scoreColor}
                        />
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography fontWeight={700} fontSize="1.6rem">{percentage}%</Typography>
                        </Box>
                    </Box>
                    <Typography fontWeight={700} fontSize="2rem">{score} / {totalMarks}</Typography>
                    <Typography variant="body2" color="text.secondary">Score / Total Marks</Typography>
                </Paper>

                {/* Details */}
                <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                    <DetailRow label="Submission Type" value={submissionType} />
                    <Divider />
                    <DetailRow label="Submitted At" value={submittedAt} />
                </Paper>

                <Button
                    fullWidth
                    variant="contained"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/Student/tests')}
                    sx={{ py: 1.2, textTransform: 'none', fontWeight: 600 }}
                >
                    Back to Tests
                </Button>
            </Box>
        </Box>
    );
};

export default StudentTestResult;
