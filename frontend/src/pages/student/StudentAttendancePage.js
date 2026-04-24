import React, { useEffect, useState } from 'react';
import {
    Box, Typography, Grid, LinearProgress, CircularProgress,
    ToggleButtonGroup, ToggleButton, Button
} from '@mui/material';
import axiosInstance from '../../utils/axiosInstance';
import { useSelector } from 'react-redux';
import { theme } from '../../theme/studentTheme';
import { getColorForPercentage, sortSummariesAscending } from '../../components/attendanceUtils';

/**
 * SubjectCard — renders a single subject's attendance summary.
 * Supports two visualisation modes: "bar" (LinearProgress) and "circle" (CircularProgress).
 *
 * Props:
 *   subjectName         {string}
 *   totalClasses        {number}
 *   attendedClasses     {number}
 *   attendancePercentage {number}
 *   mode                {"bar" | "circle"}
 */
export const SubjectCard = ({ subjectName, totalClasses, attendedClasses, attendancePercentage, mode }) => {
    const color = getColorForPercentage(attendancePercentage, theme);
    const isAtRisk = attendancePercentage < 75;

    return (
        <Box sx={{
            background: theme.card,
            border: `1px solid ${color}33`,
            borderRadius: 3,
            p: 3,
            boxShadow: `0 4px 20px ${color}11`,
            transition: 'all 0.2s',
            '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 8px 32px ${color}22` }
        }}>
            <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '1rem', mb: 0.5 }}>
                {subjectName}
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ color: theme.textMuted, fontSize: '0.78rem' }}>
                    {attendedClasses}/{totalClasses} classes
                </Typography>
                <Typography sx={{ color, fontWeight: 700, fontSize: '1.1rem' }}>
                    {attendancePercentage}%
                </Typography>
            </Box>

            {mode === 'bar' ? (
                <LinearProgress
                    variant="determinate"
                    value={attendancePercentage}
                    sx={{
                        height: 8,
                        borderRadius: 4,
                        '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 }
                    }}
                />
            ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <CircularProgress
                            variant="determinate"
                            value={attendancePercentage}
                            size={72}
                            sx={{
                                color,
                                '& .MuiCircularProgress-circle': { strokeLinecap: 'round' }
                            }}
                        />
                        <Box sx={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '0.85rem' }}>
                                {attendancePercentage}%
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                <Typography sx={{
                    color: isAtRisk ? theme.danger : theme.success,
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: isAtRisk ? `${theme.danger}18` : `${theme.success}18`
                }}>
                    {isAtRisk ? 'At Risk' : 'Safe'}
                </Typography>
            </Box>
        </Box>
    );
};

const StudentAttendancePage = () => {
    const { currentUser } = useSelector(s => s.user);
    const [summaries, setSummaries] = useState([]);
    const [visualisationMode, setVisualisationMode] = useState('bar');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (!currentUser?._id) return;
        setLoading(true);
        setError(null);
        axiosInstance.get(`/attendance-analytics/${currentUser._id}`)
            .then(res => {
                setSummaries(sortSummariesAscending(res.data));
            })
            .catch(() => {
                setError('Failed to load attendance data. Please try again.');
            })
            .finally(() => {
                setLoading(false);
            });
    }, [currentUser?._id, retryCount]);

    const totalAttended = summaries.reduce((s, v) => s + v.attendedClasses, 0);
    const totalClasses = summaries.reduce((s, v) => s + v.totalClasses, 0);
    const overall = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

    if (loading) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: theme.accent }} />
        </Box>
    );

    if (error) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Typography sx={{ color: theme.danger }}>{error}</Typography>
            <Button variant="contained" onClick={() => setRetryCount(c => c + 1)}
                sx={{ bgcolor: theme.accent, '&:hover': { bgcolor: theme.accentHover } }}>
                Retry
            </Button>
        </Box>
    );

    return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, p: 3 }}>
            <Typography sx={{ color: theme.text, fontSize: '1.5rem', fontWeight: 700, mb: 0.5 }}>
                Attendance Analytics
            </Typography>
            <Typography sx={{ color: theme.textMuted, fontSize: '0.85rem', mb: 3 }}>
                Overall: {overall}% • {totalAttended}/{totalClasses} classes attended
            </Typography>

            {/* Overall ring */}
            <Box sx={{
                background: theme.card, border: theme.cardBorder, borderRadius: 3,
                p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 3, boxShadow: theme.cardShadow
            }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress variant="determinate" value={overall} size={80}
                        sx={{ color: overall >= 75 ? theme.success : theme.danger,
                            '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }} />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '1rem' }}>{overall}%</Typography>
                    </Box>
                </Box>
                <Box>
                    <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '1.1rem' }}>
                        Overall Attendance
                    </Typography>
                    <Typography sx={{ color: overall >= 75 ? theme.success : theme.danger, fontSize: '0.85rem' }}>
                        {overall >= 75 ? '✓ You are in good standing' : '⚠ Below 75% — attendance at risk'}
                    </Typography>
                    <Typography sx={{ color: theme.textMuted, fontSize: '0.78rem', mt: 0.5 }}>
                        Minimum required: 75%
                    </Typography>
                </Box>
            </Box>

            {/* Visualisation mode toggle */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <ToggleButtonGroup
                    value={visualisationMode}
                    exclusive
                    onChange={(_, val) => { if (val) setVisualisationMode(val); }}
                    size="small"
                >
                    <ToggleButton value="bar">Progress Bar</ToggleButton>
                    <ToggleButton value="circle">Circular Chart</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {/* Per-subject cards */}
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
                                mode={visualisationMode}
                            />
                        </Grid>
                    ))}
                </Grid>
            )}
        </Box>
    );
};

export default StudentAttendancePage;
