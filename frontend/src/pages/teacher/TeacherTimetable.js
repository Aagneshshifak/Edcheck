import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Table, TableBody, TableCell,
    TableHead, TableRow, Chip, Alert, CircularProgress,
} from '@mui/material';

// ── Glass card helper ─────────────────────────────────────────────────────────
const GlassCard = ({ children, sx = {} }) => (
    <Box sx={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 3,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
        overflow: 'hidden',
        ...sx,
    }}>
        {children}
    </Box>
);

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isActive(startTime, endTime, now) {
    return now >= startTime && now < endTime;
}

const TeacherTimetable = () => {
    const { currentUser } = useSelector(s => s.user);
    const teacherId = currentUser?._id;
    const today     = DAYS[new Date().getDay()];
    const todayDate = new Date().toISOString().split('T')[0];

    const [now,               setNow]               = useState(getCurrentTime());
    const [periods,           setPeriods]           = useState([]);
    const [substituteAlerts,  setSubstituteAlerts]  = useState([]);
    const [loading,           setLoading]           = useState(false);
    const [fetchError,        setFetchError]        = useState(null);

    useEffect(() => {
        const interval = setInterval(() => setNow(getCurrentTime()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!teacherId || !today || today === 'Sun') return;
        setLoading(true);
        setFetchError(null);
        axiosInstance.get(`/TeacherSchedule/${teacherId}/${today}`)
            .then(({ data }) => setPeriods(Array.isArray(data.periods) ? data.periods : []))
            .catch(() => setFetchError('Failed to load timetable.'))
            .finally(() => setLoading(false));
    }, [teacherId, today]);

    useEffect(() => {
        if (!teacherId || !todayDate) return;
        axiosInstance.get(`/Substitute/teacher/${teacherId}/${todayDate}`)
            .then(({ data }) => setSubstituteAlerts(Array.isArray(data) ? data : []))
            .catch(() => setSubstituteAlerts([]));
    }, [teacherId, todayDate]);

    const sorted       = [...periods].sort((a, b) => a.startTime > b.startTime ? 1 : -1);
    const activePeriod = sorted.find(p => isActive(p.startTime, p.endTime, now));
    const nextPeriod   = sorted.find(p => p.startTime > now);

    const isCurrentRow = (p) =>
        activePeriod?.periodNumber === p.periodNumber && activePeriod?.startTime === p.startTime;
    const isNextRow = (p) =>
        !activePeriod && nextPeriod?.periodNumber === p.periodNumber && nextPeriod?.startTime === p.startTime;

    const subjectName = (p) => p.subjectId?.subjectName || p.subjectId?.subName || '—';
    const className   = (p) => p.classId?.className || p.classId?.sclassName || '—';

    return (
        <Box sx={{ minHeight: '100vh', p: 3 }}>
            {/* Header */}
            <Typography variant="h5" fontWeight={700} mb={0.5}>
                My Timetable — {today}
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
                Current time: {now}
            </Typography>

            {/* Substitute alerts */}
            {substituteAlerts.length > 0 && (
                <Box mb={3}>
                    {substituteAlerts.map((alert, i) => (
                        <Alert key={i} severity="warning" sx={{ mb: 1 }}>
                            <strong>Substitute:</strong> You are covering Period {alert.periodNumber} for{' '}
                            <strong>{alert.subjectId?.subjectName || alert.subjectId?.subName || '—'}</strong> in{' '}
                            <strong>{alert.classId?.className || alert.classId?.sclassName || '—'}</strong> today.
                        </Alert>
                    ))}
                </Box>
            )}

            {/* Next class reminder — glass card */}
            {nextPeriod && (
                <GlassCard sx={{ p: 2.5, mb: 3, borderLeft: '3px solid rgba(255,255,255,0.4)' }}>
                    <Typography variant="subtitle2" fontWeight={700} mb={0.5} color="text.secondary">
                        Next Class Reminder
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                        Period {nextPeriod.periodNumber} — {subjectName(nextPeriod)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Class: {className(nextPeriod)} &nbsp;|&nbsp; {nextPeriod.startTime} – {nextPeriod.endTime}
                    </Typography>
                </GlassCard>
            )}

            {/* Timetable table — glass card */}
            <GlassCard>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                        <CircularProgress />
                    </Box>
                ) : fetchError ? (
                    <Alert severity="error" sx={{ m: 2 }}>{fetchError}</Alert>
                ) : sorted.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">No periods assigned for today.</Typography>
                    </Box>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                                {['Period', 'Class', 'Subject', 'Start', 'End', 'Status'].map(h => (
                                    <TableCell key={h} sx={{
                                        fontWeight: 700, fontSize: '0.75rem',
                                        textTransform: 'uppercase', letterSpacing: 0.8,
                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sorted.map((p, idx) => (
                                <TableRow key={idx} sx={{
                                    bgcolor: isCurrentRow(p)
                                        ? 'rgba(255,255,255,0.1)'
                                        : isNextRow(p)
                                        ? 'rgba(255,255,255,0.05)'
                                        : 'transparent',
                                    borderLeft: isCurrentRow(p)
                                        ? '3px solid rgba(255,255,255,0.6)'
                                        : isNextRow(p)
                                        ? '3px solid rgba(255,255,255,0.25)'
                                        : '3px solid transparent',
                                    '& td': { borderBottom: '1px solid rgba(255,255,255,0.05)' },
                                }}>
                                    <TableCell fontWeight={600}>{p.periodNumber}</TableCell>
                                    <TableCell>{className(p)}</TableCell>
                                    <TableCell>{subjectName(p)}</TableCell>
                                    <TableCell>{p.startTime}</TableCell>
                                    <TableCell>{p.endTime}</TableCell>
                                    <TableCell>
                                        {isCurrentRow(p) && (
                                            <Chip label="Now" size="small" variant="outlined"
                                                sx={{ borderColor: 'rgba(255,255,255,0.5)', color: '#ffffff', fontWeight: 700 }} />
                                        )}
                                        {isNextRow(p) && (
                                            <Chip label="Next" size="small" variant="outlined"
                                                sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }} />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </GlassCard>
        </Box>
    );
};

export default TeacherTimetable;
