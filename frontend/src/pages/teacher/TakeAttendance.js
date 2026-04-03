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
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0b1120', minHeight: '100vh' }}>

            {/* ── Title ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <EventNoteIcon sx={{ color: '#0ea5e9' }} />
                <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.4rem' }}>
                    Take Attendance
                </Typography>
                <Chip label={todayAbbr} size="small"
                    sx={{ bgcolor: 'rgba(14,165,233,0.15)', color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.3)', ml: 1 }} />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

            {/* ── Period chips ── */}
            {schedule.length > 0 && (
                <Paper sx={{ bgcolor: '#1e293b', border: '1px solid rgba(14,165,233,0.12)', borderRadius: 3, p: 2, mb: 3 }}>
                    <Typography sx={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
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
                                    sx={{
                                        bgcolor: isActive ? '#0ea5e9' : isNow ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.05)',
                                        color:   isActive ? '#fff'    : isNow ? '#0ea5e9'               : 'rgba(148,163,184,0.7)',
                                        border:  `1px solid ${isActive ? '#0ea5e9' : isNow ? 'rgba(14,165,233,0.35)' : 'rgba(255,255,255,0.07)'}`,
                                        fontWeight: isActive ? 700 : 400,
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: isActive ? '#0284c7' : 'rgba(14,165,233,0.2)' },
                                    }}
                                />
                            );
                        })}
                    </Box>
                </Paper>
            )}

            {/* ── Active period info ── */}
            {activePeriod && (
                <Paper sx={{
                    bgcolor: '#1e293b', border: `1px solid ${isCurrent ? 'rgba(52,211,153,0.3)' : 'rgba(14,165,233,0.15)'}`,
                    borderRadius: 3, p: 2.5, mb: 3,
                    display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center',
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon sx={{ color: '#0ea5e9', fontSize: '1.1rem' }} />
                        <Box>
                            <Typography sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.68rem' }}>Period</Typography>
                            <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>
                                {activePeriod.periodNumber} &nbsp;·&nbsp; {activePeriod.startTime}–{activePeriod.endTime}
                            </Typography>
                        </Box>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ClassIcon sx={{ color: '#a78bfa', fontSize: '1.1rem' }} />
                        <Box>
                            <Typography sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.68rem' }}>Class</Typography>
                            <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>{className}</Typography>
                        </Box>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MenuBookIcon sx={{ color: '#34d399', fontSize: '1.1rem' }} />
                        <Box>
                            <Typography sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.68rem' }}>Subject</Typography>
                            <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>{subjectName}</Typography>
                        </Box>
                    </Box>
                    <Box sx={{ ml: 'auto' }}>
                        <Chip size="small"
                            icon={isCurrent ? <ScheduleIcon sx={{ fontSize: '0.8rem !important', color: '#34d399 !important' }} /> : undefined}
                            label={isCurrent ? 'Current Period' : 'Selected'}
                            sx={{
                                bgcolor: isCurrent ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                                color:   isCurrent ? '#34d399' : 'rgba(148,163,184,0.5)',
                                border:  `1px solid ${isCurrent ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.07)'}`,
                            }}
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
                <Paper sx={{ bgcolor: '#1e293b', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 3, p: 3, mb: 3 }}>
                    <Typography sx={{ color: '#34d399', fontWeight: 700, fontSize: '1rem', mb: 1.5 }}>
                        ✓ Attendance Saved — Period {activePeriod?.periodNumber}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3, mb: summary.absentees?.length ? 2 : 0, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Total',   value: summary.summary?.total,   color: '#f1f5f9' },
                            { label: 'Present', value: summary.summary?.present, color: '#34d399' },
                            { label: 'Absent',  value: summary.summary?.absent,  color: '#ef4444' },
                            { label: 'Late',    value: summary.summary?.late,    color: '#fbbf24' },
                        ].map(({ label, value, color }) => (
                            <Box key={label}>
                                <Typography sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.68rem' }}>{label}</Typography>
                                <Typography sx={{ color, fontWeight: 800, fontSize: '1.3rem', lineHeight: 1 }}>{value ?? 0}</Typography>
                            </Box>
                        ))}
                    </Box>
                    {summary.absentees?.length > 0 && (
                        <Box>
                            <Typography sx={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.75rem', mb: 1, fontWeight: 600 }}>
                                Absent / Late Students:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {summary.absentees.map(a => (
                                    <Chip key={a.studentId} label={a.name || a.studentId} size="small"
                                        sx={{
                                            bgcolor: a.status === 'Late' ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.12)',
                                            color:   a.status === 'Late' ? '#fbbf24' : '#ef4444',
                                            border:  `1px solid ${a.status === 'Late' ? 'rgba(251,191,36,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                            fontSize: '0.72rem',
                                        }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}
                </Paper>
            )}

            {/* ── Live summary bar ── */}
            {total > 0 && !summary && (
                <Paper sx={{ bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Typography sx={{ color: '#34d399', fontSize: '0.82rem', fontWeight: 700 }}>{presentCount} Present</Typography>
                            <Typography sx={{ color: '#ef4444', fontSize: '0.82rem', fontWeight: 700 }}>{absentCount} Absent</Typography>
                            {lateCount > 0 && <Typography sx={{ color: '#fbbf24', fontSize: '0.82rem', fontWeight: 700 }}>{lateCount} Late</Typography>}
                        </Box>
                        <Typography sx={{ color: pct >= 75 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{pct}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={pct} sx={{
                        height: 7, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.06)',
                        '& .MuiLinearProgress-bar': { bgcolor: pct >= 75 ? '#34d399' : pct >= 50 ? '#f59e0b' : '#ef4444', borderRadius: 4 },
                    }} />
                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <Button size="small" onClick={() => markAll('Present')} disabled={alreadyMarked}
                            sx={{ color: '#34d399', borderColor: 'rgba(52,211,153,0.35)', border: '1px solid', borderRadius: 2, textTransform: 'none', fontSize: '0.75rem',
                                '&:hover': { bgcolor: 'rgba(52,211,153,0.1)' } }}>
                            All Present
                        </Button>
                        <Button size="small" onClick={() => markAll('Absent')} disabled={alreadyMarked}
                            sx={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.35)', border: '1px solid', borderRadius: 2, textTransform: 'none', fontSize: '0.75rem',
                                '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
                            All Absent
                        </Button>
                    </Box>
                </Paper>
            )}

            {/* ── Student list ── */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress sx={{ color: '#0ea5e9' }} />
                </Box>
            ) : !activePeriod ? (
                <Paper sx={{ bgcolor: '#1e293b', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, p: 5, textAlign: 'center' }}>
                    <Typography sx={{ color: 'rgba(148,163,184,0.4)' }}>No periods scheduled for today.</Typography>
                </Paper>
            ) : (
                /* Fixed-height scrollable container for 45+ students */
                <TableContainer component={Paper} sx={{
                    bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 3, overflow: 'hidden',
                    maxHeight: 520,
                    '& .MuiTableBody-root': { overflowY: 'auto' },
                }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                {['Roll', 'Student Name', 'Status', 'Mark'].map(h => (
                                    <TableCell key={h} sx={{
                                        bgcolor: '#1e293b', color: 'rgba(148,163,184,0.7)',
                                        fontWeight: 700, fontSize: '0.73rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.07)', py: 1.5,
                                    }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'rgba(148,163,184,0.35)', borderBottom: 'none' }}>
                                        No students found in this class
                                    </TableCell>
                                </TableRow>
                            ) : students.map(s => {
                                const status    = marks[s._id] || 'Present';
                                const st        = STATUS_STYLE[status];
                                return (
                                    <TableRow key={s._id} sx={{
                                        bgcolor: `${st.bg.replace('0.15','0.04')}`,
                                        '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                                        '&:hover': { bgcolor: `${st.bg.replace('0.15','0.08')}` },
                                    }}>
                                        <TableCell sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.8rem', width: 60 }}>{s.rollNum}</TableCell>
                                        <TableCell sx={{ color: '#f1f5f9', fontWeight: 500, fontSize: '0.85rem' }}>{s.name}</TableCell>
                                        <TableCell sx={{ width: 90 }}>
                                            <Chip label={status} size="small" sx={{
                                                bgcolor: st.bg, color: st.color,
                                                border: `1px solid ${st.border}`,
                                                fontSize: '0.68rem', fontWeight: 700,
                                            }} />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.8 }}>
                                                {['Present','Absent','Late'].map(opt => {
                                                    const os = STATUS_STYLE[opt];
                                                    const active = status === opt;
                                                    return (
                                                        <Button key={opt} size="small"
                                                            disabled={alreadyMarked}
                                                            onClick={() => setStatus(s._id, opt)}
                                                            startIcon={opt === 'Present' ? <CheckCircleIcon sx={{ fontSize: '0.8rem !important' }} />
                                                                : opt === 'Absent' ? <CancelIcon sx={{ fontSize: '0.8rem !important' }} />
                                                                : <ScheduleIcon sx={{ fontSize: '0.8rem !important' }} />}
                                                            sx={{
                                                                minWidth: 76, textTransform: 'none', fontSize: '0.72rem', borderRadius: 2, py: 0.4,
                                                                ...(active
                                                                    ? { bgcolor: os.color, color: opt === 'Present' ? '#0f172a' : '#fff', '&:hover': { bgcolor: os.color } }
                                                                    : { color: os.color, border: `1px solid ${os.border}`, '&:hover': { bgcolor: os.bg } }),
                                                            }}>
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
                        sx={{
                            bgcolor: '#0ea5e9', color: '#fff', borderRadius: 2.5,
                            textTransform: 'none', fontWeight: 700, px: 4,
                            boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
                            '&:hover': { bgcolor: '#0284c7' },
                        }}>
                        {submitting ? 'Saving…' : `Submit Attendance — Period ${activePeriod?.periodNumber}`}
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default TakeAttendance;
