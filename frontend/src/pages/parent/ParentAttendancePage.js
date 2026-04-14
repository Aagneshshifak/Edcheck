import { useEffect, useState } from 'react';
import { Box, Typography, Grid, CircularProgress, Button } from '@mui/material';
import axiosInstance from '../../utils/axiosInstance';
import { useSelector } from 'react-redux';
import { sortSummariesAscending } from '../../components/attendanceUtils';
import { SubjectCard } from '../student/StudentAttendancePage';

const ParentAttendancePage = () => {
    const { currentUser } = useSelector(s => s.user);
    const [summaries,  setSummaries]  = useState([]);
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    const childId = currentUser?.children?.[0]?._id || currentUser?.children?.[0];

    useEffect(() => {
        if (!childId) return;
        setLoading(true);
        setError(null);
        axiosInstance.get(`/attendance-analytics/${childId}`)
            .then(res => setSummaries(sortSummariesAscending(res.data)))
            .catch(() => setError('Failed to load attendance data. Please try again.'))
            .finally(() => setLoading(false));
    }, [childId, retryCount]);

    if (!currentUser?.children?.length) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No student linked to this account</Typography>
        </Box>
    );

    if (loading) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );

    if (error) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Typography color="error">{error}</Typography>
            <Button variant="contained" onClick={() => setRetryCount(c => c + 1)}>Retry</Button>
        </Box>
    );

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
                Child's Attendance Analytics
            </Typography>

            {summaries.length === 0 ? (
                <Box sx={{
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 3, p: 4, textAlign: 'center',
                }}>
                    <Typography color="text.secondary">No attendance records found</Typography>
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
