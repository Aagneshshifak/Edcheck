import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Tabs, Tab, Table, TableBody, TableCell,
    TableHead, TableRow, CircularProgress, Alert,
} from '@mui/material';
import { fetchWeeklyTimetable } from '../../redux/timetableRelated/timetableSlice';

const BG    = '#ffffff';
const CARD  = '#000000';
const ACCENT = '#0ea5e9';
const BREAK_BG = 'rgba(14,165,233,0.05)';

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
            return { bgcolor: '#0c4a6e', borderLeft: `3px solid ${ACCENT}` };
        }
        return { bgcolor: CARD };
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
            <Typography variant="h5" fontWeight={700} color="#f1f5f9" mb={0.5}>
                My Timetable
            </Typography>
            <Typography variant="body2" color="#94a3b8" mb={3}>
                {isToday ? `Today is ${selectedDay} — Current time: ${now}` : `Viewing ${selectedDay}`}
            </Typography>

            {/* Day tabs */}
            <Paper sx={{ bgcolor: CARD, borderRadius: 2, mb: 3, overflow: 'hidden' }}>
                <Tabs
                    value={selectedDay}
                    onChange={(_, v) => setSelectedDay(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        borderBottom: '1px solid #1e293b',
                        '& .MuiTab-root': { color: '#64748b', fontWeight: 600, minWidth: 72 },
                        '& .Mui-selected': { color: ACCENT },
                        '& .MuiTabs-indicator': { bgcolor: ACCENT },
                    }}
                >
                    {DAYS.map(day => (
                        <Tab
                            key={day}
                            label={day}
                            value={day}
                            sx={day === todayAbbr ? { color: `${ACCENT} !important` } : {}}
                        />
                    ))}
                </Tabs>
            </Paper>

            {/* Timetable content */}
            <Paper sx={{ bgcolor: CARD, borderRadius: 2, overflow: 'hidden' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                        <CircularProgress sx={{ color: ACCENT }} />
                    </Box>
                ) : fetchError ? (
                    <Alert severity="error" sx={{ m: 2 }}>
                        {fetchError}
                    </Alert>
                ) : sortedPeriods.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="#64748b">No timetable available for {selectedDay}.</Typography>
                    </Box>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#000000' }}>
                                {['Period #', 'Time', 'Subject', 'Teacher'].map(h => (
                                    <TableCell key={h} sx={{ color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #334155' }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedPeriods.map((period, idx) => (
                                <TableRow
                                    key={idx}
                                    sx={{ ...getRowSx(period), '& td': { borderBottom: '1px solid #1e293b' } }}
                                >
                                    <TableCell sx={{ color: '#f1f5f9', fontWeight: 600 }}>
                                        {isBreak(period) ? '—' : period.periodNumber}
                                    </TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>
                                        {period.startTime} – {period.endTime}
                                    </TableCell>
                                    <TableCell sx={{ color: isBreak(period) ? '#64748b' : '#cbd5e1', fontStyle: isBreak(period) ? 'italic' : 'normal' }}>
                                        {getSubjectLabel(period)}
                                    </TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>
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
