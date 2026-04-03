import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import { theme } from '../../theme/studentTheme';

const StudentTestResult = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useSelector(s => s.user);
    const BASE = process.env.REACT_APP_BASE_URL;

    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        axiosInstance.get(`/AttemptsByStudent/${currentUser._id}`)
            .then(res => {
                const attempts = res.data || [];
                const found = attempts.find(a => {
                    const id = a.testId && a.testId._id ? a.testId._id : a.testId;
                    return id === testId;
                });
                if (!found) {
                    setError('Result not found for this test.');
                } else {
                    setAttempt(found);
                }
            })
            .catch(() => setError('Failed to load result.'))
            .finally(() => setLoading(false));
    }, [BASE, currentUser._id, testId]);

    if (loading) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: theme.accent }} />
        </Box>
    );

    if (error) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, gap: 2 }}>
            <Alert severity="error">{error}</Alert>
            <Button onClick={() => navigate('/Student/tests')} sx={{ color: theme.accent, textTransform: 'none' }}>
                Back to Tests
            </Button>
        </Box>
    );

    const score = attempt.score ?? 0;
    const totalMarks = attempt.totalMarks ?? 0;
    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const testTitle = attempt.testId && attempt.testId.title ? attempt.testId.title : 'Test';
    const submittedAt = attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const submissionType = attempt.submissionType === 'auto' ? 'Auto-submitted (time expired)' : 'Manually submitted';

    const scoreColor = percentage >= 75 ? '#00e676' : percentage >= 50 ? '#ffab40' : '#ff5252';

    return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ width: '100%', maxWidth: 520 }}>
                <Typography sx={{ color: theme.text, fontSize: '1.4rem', fontWeight: 700, mb: 0.5 }}>Test Result</Typography>
                <Typography sx={{ color: theme.textMuted, fontSize: '0.85rem', mb: 3 }}>{testTitle}</Typography>

                {/* Percentage circle */}
                <Box sx={{ background: theme.card, border: theme.cardBorder, borderRadius: 3, p: 4, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
                        <CircularProgress
                            variant="determinate"
                            value={percentage}
                            size={120}
                            thickness={5}
                            sx={{ color: scoreColor }}
                        />
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ color: scoreColor, fontWeight: 700, fontSize: '1.6rem' }}>{percentage}%</Typography>
                        </Box>
                    </Box>
                    <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '2rem' }}>
                        {score} / {totalMarks}
                    </Typography>
                    <Typography sx={{ color: theme.textMuted, fontSize: '0.82rem' }}>Score / Total Marks</Typography>
                </Box>

                {/* Details */}
                <Box sx={{ background: theme.card, border: theme.cardBorder, borderRadius: 3, p: 3, mb: 3 }}>
                    <DetailRow label="Submission Type" value={submissionType} />
                    <DetailRow label="Submitted At" value={submittedAt} />
                </Box>

                <Button
                    onClick={() => navigate('/Student/tests')}
                    sx={{ background: 'linear-gradient(135deg,#0050c8,#1e90ff)', color: '#fff', borderRadius: 2, px: 4, py: 1.2, textTransform: 'none', fontWeight: 600, width: '100%' }}
                >
                    Back to Tests
                </Button>
            </Box>
        </Box>
    );
};

const DetailRow = ({ label, value }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(30,144,255,0.1)', '&:last-child': { borderBottom: 'none' } }}>
        <Typography sx={{ color: '#8899aa', fontSize: '0.82rem' }}>{label}</Typography>
        <Typography sx={{ color: '#e0e8f0', fontSize: '0.85rem', fontWeight: 500 }}>{value}</Typography>
    </Box>
);

export default StudentTestResult;
