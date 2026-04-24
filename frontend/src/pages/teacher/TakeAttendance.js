import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, TableContainer, Button, Chip,
    Alert, CircularProgress, LinearProgress, Divider,
} from '@mui/material';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import CancelIcon       from '@mui/icons-material/Cancel';
import AccessTimeIcon   from '@mui/icons-material/AccessTime';
import EventNoteIcon    from '@mui/icons-material/EventNote';
import ClassIcon        from '@mui/icons-material/Class';
import MenuBookIcon     from '@mui/icons-material/MenuBook';
import ScheduleIcon     from '@mui/icons-material/Schedule';

const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const detectCurrent = (periods) => {
    const now = nowHHMM();
    return periods.find(p => now >= p.startTime && now < p.endTime) || null;
};

// status → style map
const STATUS_STYLE = {
    Present: { bg: 'rgba(52,211,153,0.15)', color: '#34d399', border: 'rgba(52,211,153,0.4)' },
    Absent:  { bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', border: 'rgba(239,68,68,0.4)'  },
    Late:    { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.4)' },
};

const TakeAttendance = () => {
    const { currentUser } = useSelector(s => s.user);

    const [schedule,      setSchedule]      = useState([]);
    const [activePeriod,  setActivePeriod]  = useState(null);
    const [students,      setStudents]      = useState([]);
    const [marks,         setMarks]         = useState({});   // { studentId: 'Present'|'Absent'|'Late' }

    const [loading,       setLoading]       = useState(true);
    const [submitting,    setSubmitting]     = useState(false);
    const [alreadyMarked, setAlreadyMarked] = useState(false);
    const [error,         setError]         = useState('');
    const [summary,       setSummary]       = useState(null); // post-submit summary

    const todayAbbr = DAYS[new Date().getDay()];
    const todayISO  = new Date().toISOString().slice(0, 10);

    // ── Load today's schedule ─────────────────────────────────────────────────
    useEffect(() => {
        if (!currentUser?._id) return;
        setLoading(true);
        axiosInstance.get(`/TeacherSchedule/${currentUser._id}/${todayAbbr}`)
            .then(({ data }) => {
                const periods = (data.periods || []).filter(p => p.type !== 'interval' && p.type !== 'lunch');
                setSchedule(periods);
                const current = detectCurrent(periods);
                setActivePeriod(current || periods[0] || null);
            })
            .catch(() => setError("Could not load today's schedule."))
            .finally(() => setLoading(false));
    }, [currentUser?._id, todayAbbr]);

    // ── Load students + duplicate check when period changes ───────────────────
    const loadStudentsAndCheck = useCallback(async () => {
        if (!activePeriod?.classId) return;
        setLoading(true);
        setError('');
        setSummary(null);
        setAlreadyMarked(false);

        const classId   = activePeriod.classId?._id   || activePeriod.classId;
        const subjectId = activePeriod.subjectId?._id || activePeriod.subjectId;

        try {
            const [studRes, checkRes] = await Promise.all([
                axiosInstance.get(`/Sclass/Students/${classId}`),
                axiosInstance.get(`/api/attendance/check`, {
                    params: { classId, date: todayISO, periodNumber: activePeriod.periodNumber, subjectId },
                }),
            ]);

            const list = Array.isArray(studRes.data) ? studRes.data : [];
            // Sort by roll number for consistent order
            list.sort((a, b) => (a.rollNum || 0) - (b.rollNum || 0));
            setStudents(list);

            // Default all to Present
            const init = {};
            list.forEach(s => { init[s._id] = 'Present'; });
            setMarks(init);

            setAlreadyMarked(checkRes.data?.marked === true);
        } catch {
            setError('Failed to load students.');
        } finally {
            setLoading(false);
        }
    }, [activePeriod, todayISO]);

    useEffect(() => { loadStudentsAndCheck(); }, [loadStudentsAndCheck]);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!activePeriod) return;
        setSubmitting(true);
        setError('');

        const classId   = activePeriod.classId?._id   || activePeriod.classId;
        const subjectId = activePeriod.subjectId?._id || activePeriod.subjectId;

        // Include student name in records so backend can return it in absentees list
        const records = students.map(s => ({
            studentId: s._id,
            name:      s.name,
            status:    marks[s._id] || 'Absent',
        }));

        try {
            const { data } = await axiosInstance.post(`/api/attendance/mark`, {
                classId, subjectId,
                teacherId:    currentUser._id,
                date:         todayISO,
                periodNumber: activePeriod.periodNumber,
                records,
            });
            setSummary(data);
            setAlreadyMarked(true);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to submit attendance';
            if (err.response?.status === 409) setAlreadyMarked(true);
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const setStatus = (id, status) => setMarks(p => ({ ...p, [id]: status }));
    const markAll   = (status) => {
        const next = {};
        students.forEach(s => { next[s._id] = status; });
        setMarks(next);
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const presentCount = Object.values(marks).filter(v => v === 'Present').length;
    const absentCount  = Object.values(marks).filter(v => v === 'Absent').length;
    const lateCount    = Object.values(marks).filter(v => v === 'Late').length;
    const total        = students.length;
    const pct          = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

    const className   = activePeriod?.classId?.className   || activePeriod?.classId?.sclassName   || '—';
    const subjectName = activePeriod?.subjectId?.subjectName || activePeriod?.subjectId?.subName   || '—';
    const isCurrent   = activePeriod ? detectCurrent([activePeriod]) !== null : false;

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>

            {/* ── Title ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <EventNoteIcon />
                <Typography variant="h5" fontWeight={800}>Take Attendance</Typography>
                <Chip label={todayAbbr} size="small" sx={{ ml: 1 }} />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            {/* ── Period chips ── */}
            {schedule.length > 0 && (
                <Paper sx={{ borderRadius: 3, p: 2, mb: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1.5, display: 'block' }}>
                        Today's Schedule
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {schedule.map(p => {
                            const pid      = `${p.periodNumber}-${p.classId?._id || p.classId}`;
                            const isActive = activePeriod?.periodNumber === p.periodNumber &&
                                String(activePeriod?.classId?._id || activePeriod?.classId) === String(p.classId?._id || p.classId);
                            const isNow    = detectCurrent([p]) !== null;
                            const pClass   = p.classId?.className || p.classId?.sclassName || '';
                            const pSub     = p.subjectId?.subjectName || p.subjectId?.subName || '';
                            return (
                                <Chip key={pid}
                                    label={`P${p.periodNumber} · ${pSub} · ${pClass} · ${p.startTime}–${p.endTime}`}
                                    onClick={() => { setActivePeriod(p); setSummary(null); }}
                                    color={isActive ? 'primary' : isNow ? 'default' : 'default'}
                                    variant={isActive ? 'filled' : 'outlined'}
                                    sx={{ fontWeight: isActive ? 700 : 400, cursor: 'pointer' }}
                                />
                            );
                        })}
                    </Box>
                </Paper>
            )}

            {/* ── Active period info ── */}
            {activePeriod && (
                <Paper sx={{
                    borderRadius: 3, p: 2.5, mb: 3,
                    display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon fontSize="small" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Period</Typography>
                            <Typography fontWeight={700} fontSize="0.95rem">
                                {activePeriod.periodNumber} &nbsp;·&nbsp; {activePeriod.startTime}–{activePeriod.endTime}
                            </Typography>
                        </Box>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ClassIcon fontSize="small" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Class</Typography>
                            <Typography fontWeight={700} fontSize="0.95rem">{className}</Typography>
                        </Box>
                    </Box>
                    <Divider orientation="vertical" flexItem />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MenuBookIcon fontSize="small" />
                        <Box>
                            <Typography variant="caption" color="text.secondary">Subject</Typography>
                            <Typography fontWeight={700} fontSize="0.95rem">{subjectName}</Typography>
                        </Box>
                    </Box>
                    <Box sx={{ ml: 'auto' }}>
                        <Chip size="small"
                            icon={isCurrent ? <ScheduleIcon sx={{ fontSize: '0.8rem !important' }} /> : undefined}
                            label={isCurrent ? 'Current Period' : 'Selected'}
                            color={isCurrent ? 'success' : 'default'}
                            variant="outlined"
                        />
                    </Box>
                </Paper>
            )}

            {/* ── Already marked warning ── */}
            {alreadyMarked && !summary && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Attendance already marked for this period.
                </Alert>
            )}

            {/* ── Post-submit summary ── */}
            {summary && (
                <Paper sx={{ borderRadius: 3, p: 3, mb: 3, borderLeft: '3px solid #16a34a' }}>
                    <Typography color="success.main" fontWeight={700} fontSize="1rem" mb={1.5}>
                        ✓ Attendance Saved — Period {activePeriod?.periodNumber}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, mb: summary.absentees?.length ? 2 : 0, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Total',   value: summary.summary?.total },
                            { label: 'Present', value: summary.summary?.present, color: 'success.main' },
                            { label: 'Absent',  value: summary.summary?.absent,  color: 'error.main' },
                            { label: 'Late',    value: summary.summary?.late,    color: 'warning.main' },
                        ].map(({ label, value, color }) => (
                            <Box key={label}>
                                <Typography variant="caption" color="text.secondary">{label}</Typography>
                                <Typography sx={{ color: color || 'text.primary', fontWeight: 800, fontSize: '1.3rem', lineHeight: 1 }}>{value ?? 0}</Typography>
                            </Box>
                        ))}
                    </Box>
                    {summary.absentees?.length > 0 && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, fontWeight: 600, display: 'block' }}>
                                Absent / Late Students:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {summary.absentees.map(a => (
                                    <Chip key={a.studentId} label={a.name || a.studentId} size="small"
                                        color={a.status === 'Late' ? 'warning' : 'error'} variant="outlined"
                                        sx={{ fontSize: '0.72rem' }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}
                </Paper>
            )}

            {/* ── Live summary bar ── */}
            {total > 0 && !summary && (
                <Paper sx={{ borderRadius: 3, p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Typography color="success.main" fontSize="0.82rem" fontWeight={700}>{presentCount} Present</Typography>
                            <Typography color="error.main"   fontSize="0.82rem" fontWeight={700}>{absentCount} Absent</Typography>
                            {lateCount > 0 && <Typography color="warning.main" fontSize="0.82rem" fontWeight={700}>{lateCount} Late</Typography>}
                        </Box>
                        <Typography fontWeight={700}>{pct}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={pct} sx={{ height: 7, borderRadius: 4 }} />
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <Button size="small" color="success" variant="outlined" onClick={() => markAll('Present')} disabled={alreadyMarked}
                            sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem' }}>
                            All Present
                        </Button>
                        <Button size="small" color="error" variant="outlined" onClick={() => markAll('Absent')} disabled={alreadyMarked}
                            sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem' }}>
                            All Absent
                        </Button>
                    </Box>
                </Paper>
            )}

            {/* ── Student list ── */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress />
                </Box>
            ) : !activePeriod ? (
                <Paper sx={{ borderRadius: 3, p: 5, textAlign: 'center' }}>
                    <Typography color="text.secondary">No periods scheduled for today.</Typography>
                </Paper>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden', maxHeight: 520 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {['Roll', 'Student Name', 'Status', 'Mark'].map(h => (
                                    <TableCell key={h}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                                        No students found in this class
                                    </TableCell>
                                </TableRow>
                            ) : students.map(s => {
                                const status = marks[s._id] || 'Present';
                                const st     = STATUS_STYLE[status];
                                return (
                                    <TableRow key={s._id}>
                                        <TableCell sx={{ width: 60 }}>{s.rollNum}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                                        <TableCell sx={{ width: 90 }}>
                                            <Chip label={status} size="small"
                                                color={status === 'Present' ? 'success' : status === 'Absent' ? 'error' : 'warning'}
                                                variant="outlined"
                                                sx={{ fontSize: '0.68rem', fontWeight: 700 }} />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.8 }}>
                                                {['Present','Absent','Late'].map(opt => {
                                                    const active = status === opt;
                                                    const color  = opt === 'Present' ? 'success' : opt === 'Absent' ? 'error' : 'warning';
                                                    return (
                                                        <Button key={opt} size="small"
                                                            disabled={alreadyMarked}
                                                            onClick={() => setStatus(s._id, opt)}
                                                            color={color}
                                                            variant={active ? 'contained' : 'outlined'}
                                                            startIcon={opt === 'Present' ? <CheckCircleIcon sx={{ fontSize: '0.8rem !important' }} />
                                                                : opt === 'Absent' ? <CancelIcon sx={{ fontSize: '0.8rem !important' }} />
                                                                : <ScheduleIcon sx={{ fontSize: '0.8rem !important' }} />}
                                                            sx={{ minWidth: 76, textTransform: 'none', fontSize: '0.72rem', borderRadius: 2, py: 0.4 }}>
                                                            {opt}
                                                        </Button>
                                                    );
                                                })}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* ── Submit ── */}
            {students.length > 0 && !alreadyMarked && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="contained" size="large"
                        onClick={handleSubmit} disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <EventNoteIcon />}
                        sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700, px: 4 }}>
                        {submitting ? 'Saving…' : `Submit Attendance — Period ${activePeriod?.periodNumber}`}
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default TakeAttendance;
