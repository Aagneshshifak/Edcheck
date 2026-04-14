import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Button, CircularProgress, Alert, Paper } from '@mui/material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import QuizIcon from '@mui/icons-material/Quiz';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const StudentTestList = () => {
    const { currentUser } = useSelector(s => s.user);
    const navigate = useNavigate();

    const [tests, setTests]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
        axiosInstance.get(`/TestsForStudent/${currentUser._id}`)
            .then(res => setTests(res.data || []))
            .catch(() => setError('Failed to load tests.'))
            .finally(() => setLoading(false));
    }, [currentUser._id]);

    if (loading) return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh', background: '#111111', p: 3 }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>Available Tests</Typography>
                <Typography variant="body2" color="text.secondary">
                    {tests.length} test{tests.length !== 1 ? 's' : ''} available
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {tests.length === 0 && !error ? (
                <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
                    <QuizIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                    <Typography color="text.secondary">No tests available right now</Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
                    {tests.map(test => (
                        <Paper key={test._id} variant="outlined" sx={{
                            p: 3, display: 'flex', flexDirection: 'column', gap: 1.5,
                            transition: 'all .2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Typography fontWeight={700} fontSize="1rem" sx={{ flex: 1, mr: 1 }}>
                                    {test.title}
                                </Typography>
                                <QuizIcon color="action" fontSize="small" />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {test.subject && (
                                    <Chip label={test.subject.subName || test.subject} size="small" variant="outlined" />
                                )}
                                <Chip
                                    icon={<AccessTimeIcon sx={{ fontSize: '12px !important' }} />}
                                    label={`${test.durationMinutes} min`}
                                    size="small" color="warning" variant="outlined"
                                />
                                <Chip
                                    label={`${test.questions?.length || 0} questions`}
                                    size="small" variant="outlined"
                                />
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={<PlayArrowIcon />}
                                onClick={() => navigate(`/Student/test/${test._id}`)}
                                sx={{ mt: 'auto', textTransform: 'none', fontWeight: 600 }}
                            >
                                Start Test
                            </Button>
                        </Paper>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default StudentTestList;
