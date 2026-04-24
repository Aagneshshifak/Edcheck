import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
    Box, Typography, Grid, Card, CardContent, CircularProgress,
    Button, Chip, LinearProgress, Table, TableBody, TableCell,
    TableHead, TableRow, Paper, Tabs, Tab, Avatar,
} from '@mui/material';
import {
    ArrowBack, SwitchAccount, School, Tag,
    EventAvailable, Assignment, Quiz, BarChart, Lock,
} from '@mui/icons-material';
import axiosInstance from '../../utils/axiosInstance';
import { fetchWeeklyTimetable } from '../../redux/timetableRelated/timetableSlice';
import ReportCard from '../../components/ReportCard';
import AcademicPerformanceDashboard from '../student/AcademicPerformanceDashboard';

// ── Theme tokens ──────────────────────────────────────────────────────────────
const BG     = '#111111';
const CARD   = 'rgba(255,255,255,0.06)';
const CARD2  = 'rgba(255,255,255,0.04)';
const ACCENT = '#ffffff';
const MUTED  = 'rgba(255,255,255,0.5)';
const TEXT   = '#ffffff';

const DAYS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const JS_DAY = { 0: null, 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

const AVATAR_COLORS = ['#0ea5e9','#a78bfa','#34d399','#f59e0b','#f472b6','#60a5fa'];
const avatarColor   = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct          = (a, t) => (t > 0 ? Math.round((a / t) * 100) : 0);
const attendColor  = (p) => p >= 75 ? '#34d399' : p >= 50 ? '#f59e0b' : '#ef4444';
const getDaysLeft  = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

// ── Reusable pieces ───────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color = '#ffffff', sub }) => (
    <Card sx={{
        background: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 3,
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
    }}>
        <CardContent sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ bgcolor: `${color}18`, borderRadius: 2, p: 1, display: 'flex', border: `1px solid ${color}30` }}>
                    {icon}
                </Box>
                <Typography sx={{ color: MUTED, fontSize: '0.75rem', fontWeight: 500 }}>{label}</Typography>
            </Box>
            <Typography sx={{ color, fontWeight: 800, fontSize: '1.8rem', lineHeight: 1, mb: sub ? 0.5 : 0 }}>
                {value}
            </Typography>
            {sub && <Typography sx={{ color: MUTED, fontSize: '0.7rem' }}>{sub}</Typography>}
        </CardContent>
    </Card>
);

const SectionHeader = ({ children }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, mt: 1 }}>
        <Box sx={{ width: 3, height: 18, bgcolor: ACCENT, borderRadius: 2 }} />
        <Typography sx={{ color: TEXT, fontWeight: 700, fontSize: '1rem' }}>{children}</Typography>
    </Box>
);

const EmptyState = ({ msg }) => (
    <Box sx={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 3, p: 4, textAlign: 'center', mb: 4,
    }}>
        <Typography sx={{ color: MUTED, fontSize: '0.85rem' }}>{msg}</Typography>
    </Box>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const ChildDashboard = () => {
    const { studentId } = useParams();
    const navigate      = useNavigate();
    const dispatch      = useDispatch();
    const { currentUser }    = useSelector(s => s.user);
    const { weeklyTimetable } = useSelector(s => s.timetable);

    const [student,     setStudent]     = useState(null);
    const [attendance,  setAttendance]  = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [attempts,    setAttempts]    = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [ttDay,       setTtDay]       = useState(JS_DAY[new Date().getDay()] || 'Mon');

    const children = currentUser?.children || [];

    useEffect(() => {
        if (!studentId) return;
        setLoading(true);
        setAccessDenied(false);

        axiosInstance.get(`/Student/${studentId}`)
            .then(res => {
                const s = res.data;

                // ── Security: verify this student belongs to the logged-in parent ──
                const parentId = currentUser?._id;
                const studentParentId = s?.parentId?._id || s?.parentId;
                const isOwned = children.some(c => (c._id || c) === studentId);

                if (!isOwned && String(studentParentId) !== String(parentId)) {
                    setAccessDenied(true);
                    setLoading(false);
                    return;
                }

                setStudent(s);
                const classId = s?.sclassName?._id || s?.sclassName || s?.classId?._id || s?.classId;

                return Promise.all([
                    axiosInstance.get(`/attendance-analytics/${studentId}`).catch(() => ({ data: [] })),
                    classId
                        ? axiosInstance.get(`/AssignmentsByClass/${classId}`).catch(() => ({ data: [] }))
                        : Promise.resolve({ data: [] }),
                    axiosInstance.get(`/StudentSubmissions/${studentId}`).catch(() => ({ data: [] })),
                    axiosInstance.get(`/AttemptsByStudent/${studentId}`).catch(() => ({ data: [] })),
                    classId ? dispatch(fetchWeeklyTimetable(classId)) : Promise.resolve(),
                ]);
            })
            .then(results => {
                if (!results) return; // access denied path
                const [attRes, asgRes, subRes, atmRes] = results;

                setAttendance(attRes?.data || []);

                const asgList = Array.isArray(asgRes?.data)
                    ? asgRes.data
                    : (asgRes?.data?.assignments || []);
                setAssignments(asgList);

                const subMap = {};
                (subRes?.data || []).forEach(s => {
                    subMap[s.assignmentId?._id || s.assignmentId] = s;
                });
                setSubmissions(subMap);

                setAttempts(atmRes?.data || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [studentId, dispatch, currentUser?._id]); // eslint-disable-line

    // ── Derived stats ─────────────────────────────────────────────────────────
    const totalAtt   = attendance.reduce((s, v) => s + v.attendedClasses, 0);
    const totalCls   = attendance.reduce((s, v) => s + v.totalClasses, 0);
    const overallAtt = pct(totalAtt, totalCls);
    const pendingAsg = assignments.filter(a => !submissions[a._id]).length;
    const avgMarks   = (() => {
        const r = student?.examResult || [];
        if (!r.length) return '—';
        return Math.round(r.reduce((s, x) => s + (x.marks || 0), 0) / r.length);
    })();

    // ── Timetable ─────────────────────────────────────────────────────────────
    const dayPeriods = (() => {
        const d = weeklyTimetable?.[ttDay];
        return [...(Array.isArray(d?.periods) ? d.periods : [])].sort((a, b) => a.startTime > b.startTime ? 1 : -1);
    })();
    const isBreak = (p) => p.type === 'interval' || p.type === 'lunch';

    // ── Guards ────────────────────────────────────────────────────────────────
    if (loading) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: BG }}>
            <CircularProgress sx={{ color: ACCENT }} />
        </Box>
    );

    if (accessDenied) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, bgcolor: BG }}>
            <Lock sx={{ color: '#ef4444', fontSize: '3rem' }} />
            <Typography sx={{ color: '#ef4444', fontWeight: 700, fontSize: '1.1rem' }}>Access Denied</Typography>
            <Typography sx={{ color: MUTED, fontSize: '0.88rem' }}>You are not authorised to view this student's data.</Typography>
            <Button onClick={() => navigate('/Parent/mychildren')} sx={{ color: ACCENT, textTransform: 'none' }}>
                Back to My Children
            </Button>
        </Box>
    );

    if (!student) return (
        <Box sx={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, bgcolor: BG }}>
            <Typography sx={{ color: '#ef4444' }}>Student not found.</Typography>
            <Button onClick={() => navigate('/Parent/mychildren')} sx={{ color: ACCENT, textTransform: 'none' }}>Back to My Children</Button>
        </Box>
    );

    const className = student.sclassName?.className || student.sclassName?.sclassName || '—';
    const color     = avatarColor(student.name);
    const initials  = (student.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: BG, minHeight: '100vh' }}>

            {/* ── Nav bar ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/Parent/mychildren')}
                    sx={{ color: MUTED, '&:hover': { color: TEXT }, textTransform: 'none', fontSize: '0.85rem' }}>
                    My Children
                </Button>

                {/* Switch Child button — always visible in top-right */}
                <Button
                    startIcon={<SwitchAccount />}
                    onClick={() => navigate('/Parent/mychildren')}
                    variant="outlined"
                    size="small"
                    sx={{
                        color: ACCENT,
                        borderColor: `${ACCENT}55`,
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        px: 2,
                        '&:hover': {
                            borderColor: ACCENT,
                            bgcolor: `${ACCENT}12`,
                        },
                    }}
                >
                    Switch Child
                </Button>
            </Box>

            {/* ── Student hero ── */}
            <Box sx={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 4, p: 3, mb: 4,
                display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                '&::before': {
                    content: '""', position: 'absolute',
                    top: 0, left: 0, right: 0, height: '3px',
                    background: `linear-gradient(90deg, ${color}, ${color}44)`,
                },
            }}>
                <Avatar sx={{
                    width: 72, height: 72, fontSize: '1.6rem', fontWeight: 700,
                    bgcolor: `${color}20`, color,
                    border: `2px solid ${color}55`,
                    boxShadow: `0 0 24px ${color}30`,
                }}>
                    {initials}
                </Avatar>
                <Box>
                    <Typography sx={{ color: TEXT, fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.2 }}>
                        {student.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        <Chip icon={<School sx={{ fontSize: '0.75rem !important', color: `${color} !important` }} />}
                            label={className} size="small"
                            sx={{ bgcolor: `${color}18`, color, border: `1px solid ${color}40`, fontSize: '0.75rem' }} />
                        {student.rollNum && (
                            <Chip icon={<Tag sx={{ fontSize: '0.75rem !important', color: `${MUTED} !important` }} />}
                                label={`Roll No: ${student.rollNum}`} size="small"
                                sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: MUTED, border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem' }} />
                        )}
                    </Box>
                </Box>
            </Box>

            {/* ── Stat cards ── */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard icon={<EventAvailable sx={{ color: '#34d399', fontSize: '1.2rem' }} />}
                        label="Attendance" value={`${overallAtt}%`} color="#34d399"
                        sub={`${totalAtt}/${totalCls} classes`} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard icon={<Assignment sx={{ color: '#f59e0b', fontSize: '1.2rem' }} />}
                        label="Pending Assignments" value={pendingAsg} color="#f59e0b"
                        sub={`of ${assignments.length} total`} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard icon={<Quiz sx={{ color: '#a78bfa', fontSize: '1.2rem' }} />}
                        label="Tests Attempted" value={attempts.length} color="#a78bfa" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard icon={<BarChart sx={{ color: ACCENT, fontSize: '1.2rem' }} />}
                        label="Avg Marks" value={avgMarks} color={ACCENT}
                        sub={student?.examResult?.length ? `${student.examResult.length} subjects` : undefined} />
                </Grid>
            </Grid>

            {/* ── Attendance ── */}
            <SectionHeader>Subject-wise Attendance</SectionHeader>
            {attendance.length === 0 ? <EmptyState msg="No attendance records found." /> : (
                <Grid container spacing={2} sx={{ mb: 4 }}>
                    {attendance.map(s => {
                        const c = attendColor(s.attendancePercentage);
                        return (
                            <Grid item xs={12} sm={6} md={4} key={s.subjectId}>
                                <Box sx={{
                                    background: 'rgba(255,255,255,0.06)',
                                    backdropFilter: 'blur(12px)',
                                    WebkitBackdropFilter: 'blur(12px)',
                                    border: `1px solid rgba(255,255,255,0.1)`,
                                    borderRadius: 3, p: 2.5,
                                    transition: 'transform 0.18s, box-shadow 0.18s',
                                    '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px rgba(0,0,0,0.4)` },
                                }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.2 }}>
                                        <Typography sx={{ color: TEXT, fontWeight: 600, fontSize: '0.88rem' }}>
                                            {s.subjectName}
                                        </Typography>
                                        <Typography sx={{ color: c, fontWeight: 800, fontSize: '1rem' }}>
                                            {s.attendancePercentage}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={s.attendancePercentage}
                                        sx={{ height: 8, borderRadius: 4,
                                            '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 4 } }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                        <Typography sx={{ color: MUTED, fontSize: '0.7rem' }}>
                                            {s.attendedClasses}/{s.totalClasses} classes
                                        </Typography>
                                        <Typography sx={{
                                            color: c, fontSize: '0.68rem', fontWeight: 700,
                                            bgcolor: `${c}18`, px: 0.8, py: 0.2, borderRadius: 1,
                                        }}>
                                            {s.attendancePercentage >= 75 ? 'Safe' : 'At Risk'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* ── Assignments ── */}
            <SectionHeader>Assignments</SectionHeader>
            {assignments.length === 0 ? <EmptyState msg="No assignments found." /> : (
                <Paper sx={{
                    background: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 3, overflow: 'hidden', mb: 4,
                }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                                {['Title', 'Subject', 'Due Date', 'Status'].map(h => (
                                    <TableCell key={h} sx={{ color: MUTED, fontWeight: 700, fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', py: 1.5 }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {assignments.map(a => {
                                const submitted = !!submissions[a._id];
                                const daysLeft  = getDaysLeft(a.dueDate);
                                const overdue   = daysLeft < 0;
                                const sc = submitted ? '#34d399' : overdue ? '#ef4444' : '#f59e0b';
                                return (
                                    <TableRow key={a._id} sx={{
                                        '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                                    }}>
                                        <TableCell sx={{ color: TEXT, fontSize: '0.83rem', py: 1.5 }}>{a.title}</TableCell>
                                        <TableCell sx={{ color: MUTED, fontSize: '0.8rem' }}>
                                            {a.subject?.subName || a.subject?.subjectName || '—'}
                                        </TableCell>
                                        <TableCell sx={{ color: MUTED, fontSize: '0.8rem' }}>
                                            {new Date(a.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={submitted ? 'Submitted' : overdue ? 'Overdue' : `${daysLeft}d left`}
                                                size="small"
                                                sx={{ fontSize: '0.68rem', bgcolor: `${sc}18`, color: sc, border: `1px solid ${sc}40` }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* ── Test results ── */}
            <SectionHeader>Test Results</SectionHeader>
            {attempts.length === 0 ? <EmptyState msg="No test attempts yet." /> : (
                <Paper sx={{
                    background: 'rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 3, overflow: 'hidden', mb: 4,
                }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                                {['Test', 'Score', 'Total', 'Percentage'].map(h => (
                                    <TableCell key={h} sx={{ color: MUTED, fontWeight: 700, fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', py: 1.5 }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {attempts.map(a => {
                                const p = pct(a.score, a.totalMarks);
                                const c = attendColor(p);
                                return (
                                    <TableRow key={a._id} sx={{
                                        '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                                    }}>
                                        <TableCell sx={{ color: TEXT, fontSize: '0.83rem', py: 1.5 }}>
                                            {a.testId?.title || 'Test'}
                                        </TableCell>
                                        <TableCell sx={{ color: c, fontWeight: 700, fontSize: '0.83rem' }}>{a.score}</TableCell>
                                        <TableCell sx={{ color: MUTED, fontSize: '0.8rem' }}>{a.totalMarks}</TableCell>
                                        <TableCell>
                                            <Chip label={`${p}%`} size="small"
                                                sx={{ fontSize: '0.68rem', bgcolor: `${c}18`, color: c, border: `1px solid ${c}40` }} />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {/* ── Report Card ── */}
            <SectionHeader>Report Card</SectionHeader>
            <Box sx={{ mb: 4 }}>
                <ReportCard studentId={studentId} compact />
            </Box>

            {/* ── Performance Charts ── */}
            <SectionHeader>Academic Performance</SectionHeader>
            <Box sx={{ mb: 4, mx: -3 }}>
                <AcademicPerformanceDashboard studentId={studentId} />
            </Box>

            {/* ── Timetable ── */}
            <SectionHeader>Weekly Timetable</SectionHeader>
            <Paper sx={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 3, overflow: 'hidden', mb: 2,
            }}>
                <Tabs value={ttDay} onChange={(_, v) => setTtDay(v)} variant="scrollable" scrollButtons="auto"
                    sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        '& .MuiTab-root': { color: MUTED, fontWeight: 600, minWidth: 64, fontSize: '0.8rem' },
                        '& .Mui-selected': { color: '#ffffff' },
                        '& .MuiTabs-indicator': { bgcolor: '#ffffff' },
                    }}>
                    {DAYS.map(d => <Tab key={d} label={d} value={d} />)}
                </Tabs>

                {dayPeriods.length === 0 ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography sx={{ color: MUTED, fontSize: '0.83rem' }}>No timetable for {ttDay}.</Typography>
                    </Box>
                ) : (
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}>
                                {['#', 'Time', 'Subject', 'Teacher'].map(h => (
                                    <TableCell key={h} sx={{ color: MUTED, fontWeight: 700, fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', py: 1.5 }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {dayPeriods.map((p, i) => (
                                <TableRow key={i} sx={{
                                    bgcolor: isBreak(p) ? 'rgba(14,165,233,0.03)' : 'transparent',
                                    '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                                }}>
                                    <TableCell sx={{ color: MUTED, fontSize: '0.78rem', py: 1.2 }}>
                                        {isBreak(p) ? '—' : p.periodNumber}
                                    </TableCell>
                                    <TableCell sx={{ color: TEXT, fontSize: '0.8rem' }}>
                                        {p.startTime} – {p.endTime}
                                    </TableCell>
                                    <TableCell sx={{ color: isBreak(p) ? MUTED : TEXT, fontStyle: isBreak(p) ? 'italic' : 'normal', fontSize: '0.8rem' }}>
                                        {isBreak(p)
                                            ? (p.type === 'lunch' ? 'Lunch Break' : 'Interval')
                                            : (p.subjectId?.subjectName || p.subjectId?.subName || '—')}
                                    </TableCell>
                                    <TableCell sx={{ color: MUTED, fontSize: '0.8rem' }}>
                                        {isBreak(p) ? '—' : (p.teacherId?.name || '—')}
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

export default ChildDashboard;
