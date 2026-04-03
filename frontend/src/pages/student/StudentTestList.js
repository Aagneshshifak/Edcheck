import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Button, CircularProgress, Alert } from '@mui/material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import QuizIcon from '@mui/icons-material/Quiz';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { theme } from '../../theme/studentTheme';

const StudentTestList = () => {
    const { currentUser } = useSelector(s => s.user);
    const navigate = useNavigate();
    
    const BASE = process.env.REACT_APP_BASE_URL;
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        axios.get(`${BASE}/TestsForStudent/${currentUser._id}`)
            .then(res => setTests(res.data || []))
            .catch(() => setError('Failed to load tests.'))
            .finally(() => setLoading(false));
    }, [BASE, currentUser._id]);

    if (loading) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: theme.accent }} />
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Typography sx={{ color: theme.text, fontSize: '1.4rem', fontWeight: 700 }}>Available Tests</Typography>
                <Typography sx={{ color: theme.textMuted, fontSize: '0.82rem' }}>
                    {tests.length} test{tests.length !== 1 ? 's' : ''} available
                </Typography>
            </Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {tests.length === 0 && !error ? (
                <Box sx={{ background: theme.card, border: theme.cardBorder, borderRadius: 3, p: 4, textAlign: 'center' }}>
                    <QuizIcon sx={{ color: theme.textMuted, fontSize: 48, mb: 1 }} />
                    <Typography sx={{ color: theme.textMuted }}>No tests available right now</Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
                    {tests.map(test => (
                        <Box key={test._id} sx={{
                            background: theme.card, border: theme.cardBorder, borderRadius: 3, p: 3,
                            display: 'flex', flexDirection: 'column', gap: 1.5, transition: 'all .2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '1rem', flex: 1, mr: 1 }}>
                                    {test.title}
                                </Typography>
                                <QuizIcon sx={{ color: theme.accent, fontSize: 20 }} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {test.subject && (
                                    <Chip label={test.subject.subName || test.subject} size="small"
                                        sx={{ bgcolor: `${theme.accent}22`, color: theme.accent, border: `1px solid ${theme.accent}44`, fontSize: '0.7rem' }} />
                                )}
                                <Chip icon={<AccessTimeIcon sx={{ fontSize: '12px !important' }} />}
                                    label={`${test.durationMinutes} min`} size="small"
                                    sx={{ bgcolor: 'rgba(255,171,64,0.15)', color: '#ffab40', border: '1px solid rgba(255,171,64,0.3)', fontSize: '0.7rem' }} />
                                <Chip label={`${test.questions?.length || 0} questions`} size="small"
                                    sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: theme.textMuted, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem' }} />
                            </Box>
                            <Button onClick={() => navigate(`/Student/test/${test._id}`)}
                                sx={{ mt: 'auto', background: 'linear-gradient(135deg,#0050c8,#1e90ff)', color: '#fff', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                                Start Test
                            </Button>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default StudentTestList;
