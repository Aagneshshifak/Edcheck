import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Paper, Typography, Table, TableBody, TableCell,
    TableHead, TableRow, Chip, Alert, CircularProgress,
} from '@mui/material';


const BG    = '#ffffff';
const CARD  = '#000000';
const ACCENT = '#0ea5e9';

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
    const today = DAYS[new Date().getDay()];
    const todayDate = new Date().toISOString().split('T')[0];

    const [now, setNow] = useState(getCurrentTime());
    const [periods, setPeriods] = useState([]);
    const [substituteAlerts, setSubstituteAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    // Refresh current time every minute
    useEffect(() => {
        const interval = setInterval(() => setNow(getCurrentTime()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Fetch teacher's own schedule directly from teacherSchedule collection
    useEffect(() => {
        if (!teacherId || !today || today === 'Sun') return;
        setLoading(true);
        setFetchError(null);
        axiosInstance.get(`/TeacherSchedule/${teacherId}/${today}`)
            .then(({ data }) => setPeriods(Array.isArray(data.periods) ? data.periods : []))
            .catch(() => setFetchError('Failed to load timetable.'))
            .finally(() => setLoading(false));
    }, [teacherId, today]);

    // Fetch substitute alerts — search across all classes
    useEffect(() => {
        if (!teacherId || !todayDate) return;
        // Fetch substitute assignments where this teacher is the substitute
        axiosInstance.get(`/Substitute/teacher/${teacherId}/${todayDate}`)
            .then(({ data }) => setSubstituteAlerts(Array.isArray(data) ? data : []))
            .catch(() => setSubstituteAlerts([]));
    }, [teacherId, todayDate]);

    const sorted = [...periods].sort((a, b) => a.startTime > b.startTime ? 1 : -1);
    const activePeriod = sorted.find(p => isActive(p.startTime, p.endTime, now));
    const nextPeriod   = sorted.find(p => p.startTime > now);

    const getRowStyle = (p) => {
        if (activePeriod?.periodNumber === p.periodNumber && activePeriod?.startTime === p.startTime)
            return { bgcolor: '#0c4a6e', borderLeft: `3px solid ${ACCENT}` };
        if (!activePeriod && nextPeriod?.periodNumber === p.periodNumber && nextPeriod?.startTime === p.startTime)
            return { bgcolor: '#1e3a5f', borderLeft: '3px solid #38bdf8' };
        return { bgcolor: CARD };
    };

    const getChip = (p) => {
        if (activePeriod?.periodNumber === p.periodNumber && activePeriod?.startTime === p.startTime)
            return <Chip label="Now" size="small" sx={{ bgcolor: ACCENT, color: '#fff', fontWeight: 700 }} />;
        if (!activePeriod && nextPeriod?.periodNumber === p.periodNumber && nextPeriod?.startTime === p.startTime)
            return <Chip label="Next" size="small" sx={{ bgcolor: '#38bdf8', color: '#ffffff', fontWeight: 700 }} />;
        return null;
    };

    const subjectName = (p) =>
        p.subjectId?.subjectName || p.subjectId?.subName || '—';

    const className = (p) =>
        p.classId?.className || p.classId?.sclassName || '—';

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: BG, p: 3 }}>
            <Typography variant="h5" fontWeight={700} color="#f1f5f9" mb={1}>
                My Timetable — {today}
            </Typography>
            <Typography variant="body2" color="#94a3b8" mb={3}>
                Current time: {now}
            </Typography>

            {/* Substitute alerts */}
            {substituteAlerts.length > 0 && (
                <Box mb={3}>
                    {substituteAlerts.map((alert, i) => (
                        <Alert key={i} severity="warning"
                            sx={{ mb: 1, bgcolor: '#451a03', color: '#fef3c7', '& .MuiAlert-icon': { color: '#f59e0b' } }}>
                            <strong>Substitute:</strong> You are covering Period {alert.periodNumber} for{' '}
                            <strong>{alert.subjectId?.subjectName || alert.subjectId?.subName || '—'}</strong> in{' '}
                            <strong>{alert.classId?.className || alert.classId?.sclassName || '—'}</strong> today.
                        </Alert>
                    ))}
                </Box>
            )}

            {/* Next Class Reminder */}
            {nextPeriod && (
                <Paper sx={{ bgcolor: '#0c4a6e', border: `1px solid ${ACCENT}`, borderRadius: 2, p: 2, mb: 3 }}>
                    <Typography variant="subtitle2" color={ACCENT} fontWeight={700} mb={0.5}>
                        Next Class Reminder
                    </Typography>
                    <Typography variant="body1" color="#f1f5f9" fontWeight={600}>
                        Period {nextPeriod.periodNumber} — {subjectName(nextPeriod)}
                    </Typography>
                    <Typography variant="body2" color="#94a3b8">
                        Class: {className(nextPeriod)} &nbsp;|&nbsp; {nextPeriod.startTime} – {nextPeriod.endTime}
                    </Typography>
                </Paper>
            )}

            {/* Timetable table */}
            <Paper sx={{ bgcolor: CARD, borderRadius: 2, overflow: 'hidden' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                        <CircularProgress sx={{ color: ACCENT }} />
                    </Box>
                ) : fetchError ? (
                    <Alert severity="error" sx={{ m: 2 }}>{fetchError}</Alert>
                ) : sorted.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="#64748b">No periods assigned for today.</Typography>
                    </Box>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#000000' }}>
                                {['Period', 'Class', 'Subject', 'Start', 'End', 'Status'].map(h => (
                                    <TableCell key={h} sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155' }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sorted.map((p, idx) => (
                                <TableRow key={idx} sx={{ ...getRowStyle(p), '& td': { borderBottom: '1px solid #1e293b' } }}>
                                    <TableCell sx={{ color: '#f1f5f9', fontWeight: 600 }}>{p.periodNumber}</TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>{className(p)}</TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>{subjectName(p)}</TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>{p.startTime}</TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>{p.endTime}</TableCell>
                                    <TableCell>{getChip(p)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Paper>
        </Box>
    );
};

export default TeacherTimetable;
