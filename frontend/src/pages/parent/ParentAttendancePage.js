import { useEffect, useState } from 'react';
import { Box, Typography, Grid, CircularProgress, Button } from '@mui/material';
import axiosInstance from '../../utils/axiosInstance';
import { useSelector } from 'react-redux';
import { theme } from '../../theme/studentTheme';
import { sortSummariesAscending } from '../../components/attendanceUtils';
import { SubjectCard } from '../student/StudentAttendancePage';

const ParentAttendancePage = () => {
    const { currentUser } = useSelector(s => s.user);
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const childId = currentUser?.children?.[0]?._id || currentUser?.children?.[0];

    useEffect(() => {
        if (!childId) return;
        setLoading(true);
        setError(null);
        axiosInstance.get(`${process.env.REACT_APP_BASE_URL}/attendance-analytics/${childId}`)
            .then(res => {
                setSummaries(sortSummariesAscending(res.data));
            })
            .catch(() => {
                setError('Failed to load attendance data. Please try again.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [childId, retryCount]);

    if (!currentUser?.children?.length) {
        return (
            <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: theme.textMuted, fontSize: '1rem' }}>
                    No student linked to this account
                </Typography>
            </Box>
        );
    }

    if (loading) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: theme.accent }} />
        </Box>
    );

    if (error) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Typography sx={{ color: theme.danger }}>{error}</Typography>
            <Button variant="contained" onClick={() => setRetryCount(c => c + 1)}
                sx={{ bgcolor: theme.accent, '&:hover': { bgcolor: theme.accentHover } }}>
                Retry
            </Button>
        </Box>
    );

    return (
        <Box sx={{ p: 3 }}>
            <Typography sx={{ color: theme.text, fontSize: '1.5rem', fontWeight: 700, mb: 3 }}>
                Child's Attendance Analytics
            </Typography>

            {summaries.length === 0 ? (
                <Box sx={{ background: theme.card, border: theme.cardBorder, borderRadius: 3, p: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: theme.textMuted }}>No attendance records found</Typography>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {summaries.map(s => (
                        <Grid item xs={12} sm={6} md={4} key={s.subjectId || s.subjectName}>
                            <SubjectCard
                                subjectName={s.subjectName}
                                totalClasses={s.totalClasses}
                                attendedClasses={s.attendedClasses}
                                attendancePercentage={s.attendancePercentage}
                                mode="bar"
                            />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

export default ParentAttendancePage;
