import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Tabs, Tab, Table, TableBody, TableCell,
    TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import { fetchWeeklyTimetable } from '../../redux/timetableRelated/timetableSlice';

const BG     = '#111111';
const CARD   = '#1a1a1a';
const BREAK_BG = 'rgba(255,255,255,0.04)';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Map JS getDay() (0=Sun) to our day abbreviations
const JS_DAY_TO_TAB = { 0: null, 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isCurrentPeriod(startTime, endTime, now) {
    return now >= startTime && now < endTime;
}

const StudentTimetable = () => {
    const dispatch = useDispatch();
    const { currentUser } = useSelector(s => s.user);
    const { weeklyTimetable } = useSelector(s => s.timetable);

    const classId = currentUser?.sclassName?._id || currentUser?.sclassName;

    const todayAbbr = JS_DAY_TO_TAB[new Date().getDay()];
    const defaultTab = DAYS.includes(todayAbbr) ? todayAbbr : 'Mon';

    const [selectedDay, setSelectedDay] = useState(defaultTab);
    const [now, setNow] = useState(getCurrentTime());
    const [fetchError, setFetchError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Refresh current time every minute
    useEffect(() => {
        const interval = setInterval(() => setNow(getCurrentTime()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (classId) {
            setFetchError(null);
            setLoading(true);
            dispatch(fetchWeeklyTimetable(classId))
                .unwrap()
                .catch(() => setFetchError('Failed to load timetable. Please try again.'))
                .finally(() => setLoading(false));
        }
    }, [dispatch, classId]);

    const dayData = weeklyTimetable?.[selectedDay];
    const periods = Array.isArray(dayData?.periods) ? dayData.periods : [];
    const sortedPeriods = [...periods].sort((a, b) => (a.startTime > b.startTime ? 1 : -1));

    const isBreak = (p) => p.type === 'interval' || p.type === 'lunch';
    const isToday = selectedDay === todayAbbr;

    const getRowSx = (p) => {
        if (isBreak(p)) return { bgcolor: BREAK_BG };
        if (isToday && isCurrentPeriod(p.startTime, p.endTime, now)) {
            return { bgcolor: 'rgba(255,255,255,0.12)', borderLeft: '3px solid #ffffff' };
        }
        return {};
    };

    const getSubjectLabel = (p) => {
        if (p.type === 'interval') return 'Interval';
        if (p.type === 'lunch')    return 'Lunch Break';
        return p.subjectId?.subjectName || p.subjectId?.subName || p.subjectId?.name || '—';
    };

    const getTeacherLabel = (p) => {
        if (isBreak(p)) return '—';
        const t = p.teacherId;
        if (!t) return '—';
        return t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim() || '—';
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: BG, p: 3 }}>
            <Typography variant="h5" fontWeight={700} color="#ffffff" mb={0.5}>
                My Timetable
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
                {isToday ? `Today is ${selectedDay} — Current time: ${now}` : `Viewing ${selectedDay}`}
            </Typography>

            {/* Day tabs — glass effect */}
            <Box
                sx={{
                    background: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 2,
                    mb: 3,
                    overflow: 'hidden',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)',
                }}
            >
                <Tabs
                    value={selectedDay}
                    onChange={(_, v) => setSelectedDay(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', fontWeight: 600, minWidth: 72 },
                        '& .Mui-selected': { color: '#ffffff !important', fontWeight: 700 },
                        '& .MuiTabs-indicator': { bgcolor: '#ffffff', height: 3, borderRadius: 2 },
                        '& .MuiTabScrollButton-root': { color: 'rgba(255,255,255,0.5)' },
                    }}
                >
                    {DAYS.map(day => (
                        <Tab
                            key={day}
                            label={day}
                            value={day}
                            sx={day === todayAbbr ? { color: 'rgba(255,255,255,0.9) !important' } : {}}
                        />
                    ))}
                </Tabs>
            </Box>

            <Paper sx={{ bgcolor: CARD, borderRadius: 2, overflow: 'hidden' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                        <CircularProgress sx={{ color: '#ffffff' }} />
                    </Box>
                ) : fetchError ? (
                    <Alert severity="error" sx={{ m: 2 }}>
                        {fetchError}
                    </Alert>
                ) : sortedPeriods.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>No timetable available for {selectedDay}.</Typography>
                    </Box>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#000000' }}>
                                {['Period #', 'Time', 'Subject', 'Teacher'].map(h => (
                                    <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedPeriods.map((period, idx) => (
                                <TableRow
                                    key={idx}
                                    sx={{ ...getRowSx(period), '& td': { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
                                >
                                    <TableCell sx={{ color: '#ffffff', fontWeight: 600 }}>
                                        {isBreak(period) ? '—' : period.periodNumber}
                                    </TableCell>
                                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                        {period.startTime} – {period.endTime}
                                    </TableCell>
                                    <TableCell sx={{ color: isBreak(period) ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)', fontStyle: isBreak(period) ? 'italic' : 'normal' }}>
                                        {getSubjectLabel(period)}
                                    </TableCell>
                                    <TableCell sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                        {getTeacherLabel(period)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Paper>
        </Box>
    );
};

export default StudentTimetable;
