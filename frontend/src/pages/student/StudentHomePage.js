import { useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, LinearProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { getUserDetails } from '../../redux/userRelated/userHandle';
import { getSubjectList } from '../../redux/sclassRelated/sclassHandle';
import { calculateOverallAttendancePercentage } from '../../components/attendanceCalculator';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QuizIcon from '@mui/icons-material/Quiz';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CampaignIcon from '@mui/icons-material/Campaign';
import SeeNotice from '../../components/SeeNotice';
import UpcomingDeadlinesPanel from '../../components/UpcomingDeadlinesPanel';
import { theme } from '../../theme/studentTheme';
import { fetchDeadlines } from '../../redux/deadlinesRelated/deadlinesHandle';
import { fetchProgress } from '../../redux/progressRelated/progressHandle';
import axiosInstance from '../../utils/axiosInstance';
import ProgressLineChart from './ProgressLineChart';

// ── Shared card wrapper ───────────────────────────────────────────────────────
const Card = ({ children, sx = {} }) => (
    <Box sx={{
        background: theme.card,
        border: theme.cardBorder,
        borderRadius: theme.radius,
        p: 3,
        boxShadow: theme.cardShadow,
        height: '100%',
        ...sx,
    }}>
        {children}
    </Box>
);

const CardTitle = ({ children }) => (
    <Typography sx={{ color: theme.accent, fontWeight: 700, mb: 2, fontSize: '0.95rem', letterSpacing: 0.4 }}>
        {children}
    </Typography>
);

// ── Top: Summary card ─────────────────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, color, sub, to }) => {
    const inner = (
        <Box sx={{
            background: theme.card,
            border: theme.cardBorder,
            boxShadow: theme.cardShadow,
            borderRadius: theme.radius,
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            transition: theme.transition,
            height: '100%',
            '&:hover': { transform: 'translateY(-3px)', boxShadow: theme.cardHover },
        }}>
            <Box sx={{
                width: 48, height: 48, borderRadius: '10px', flexShrink: 0,
                background: `linear-gradient(135deg, ${color}28, ${color}0d)`,
                border: `1px solid ${color}38`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, fontSize: 24,
            }}>
                {icon}
            </Box>
            <Box>
                <Typography sx={{ color: theme.textMuted, fontSize: '0.68rem', letterSpacing: 1.1, textTransform: 'uppercase' }}>
                    {label}
                </Typography>
                <Typography sx={{ color: theme.text, fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2 }}>
                    {value}
                </Typography>
                {sub && <Typography sx={{ color: theme.textMuted, fontSize: '0.68rem', mt: 0.2 }}>{sub}</Typography>}
            </Box>
        </Box>
    );
    return to ? <Link to={to} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>{inner}</Link> : inner;
};

// ── Middle-left: Subject Assignment Panel ─────────────────────────────────────
const SubjectAssignmentPanel = ({ subjectsList, assignments }) => (
    <Card>
        <CardTitle>Subject Assignments</CardTitle>
        {!subjectsList || subjectsList.length === 0 ? (
            <Typography sx={{ color: theme.textMuted, fontSize: '0.82rem', textAlign: 'center', py: 3 }}>
                No subjects enrolled
            </Typography>
        ) : (
            subjectsList.map((s) => {
                const count = assignments.filter(a =>
                    (a.subject?._id || a.subject) === s._id
                ).length;
                return (
                    <Box key={s._id} sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        py: 1.2, borderBottom: `1px solid ${theme.divider}`,
                        '&:last-child': { borderBottom: 'none' },
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{
                                width: 32, height: 32, borderRadius: '8px',
                                background: `linear-gradient(135deg, ${theme.accent}28, ${theme.accent}0d)`,
                                border: `1px solid ${theme.accent}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <MenuBookIcon sx={{ color: theme.accent, fontSize: 16 }} />
                            </Box>
                            <Box>
                                <Typography sx={{ color: theme.text, fontSize: '0.85rem', fontWeight: 600 }}>
                                    {s.subName || s.subjectName}
                                </Typography>
                                <Typography sx={{ color: theme.textMuted, fontSize: '0.7rem' }}>
                                    {s.subCode}
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{
                            px: 1.5, py: 0.4, borderRadius: '20px',
                            background: count > 0 ? `${theme.warning}18` : `${theme.accent}12`,
                            border: `1px solid ${count > 0 ? theme.warning : theme.accent}30`,
                        }}>
                            <Typography sx={{ color: count > 0 ? theme.warning : theme.textMuted, fontSize: '0.72rem', fontWeight: 600 }}>
                                {count} assignment{count !== 1 ? 's' : ''}
                            </Typography>
                        </Box>
                    </Box>
                );
            })
        )}
    </Card>
);

// ── Bottom-right: Attendance Analytics Chart ──────────────────────────────────
const AttendanceAnalyticsChart = ({ summaries }) => (
    <Card>
        <CardTitle>Attendance Analytics</CardTitle>
        {summaries.length === 0 ? (
            <Typography sx={{ color: theme.textMuted, fontSize: '0.82rem', textAlign: 'center', py: 3 }}>
                No attendance records yet
            </Typography>
        ) : (
            summaries.map(({ subjectName, attendedClasses, totalClasses, attendancePercentage }) => {
                const color = attendancePercentage >= 75 ? theme.success : attendancePercentage >= 50 ? theme.warning : theme.danger;
                return (
                    <Box key={subjectName} sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography sx={{ color: theme.text, fontSize: '0.82rem' }}>{subjectName}</Typography>
                            <Typography sx={{ color, fontSize: '0.82rem', fontWeight: 700 }}>{attendancePercentage}%</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={attendancePercentage} sx={{
                            height: 6, borderRadius: 3,
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                        }} />
                        <Typography sx={{ color: theme.textMuted, fontSize: '0.68rem', mt: 0.3 }}>
                            {attendedClasses} / {totalClasses} classes attended
                        </Typography>
                    </Box>
                );
            })
        )}
    </Card>
);

// ── Page ──────────────────────────────────────────────────────────────────────
const StudentHomePage = () => {
    const dispatch = useDispatch();
    const { userDetails, currentUser, loading } = useSelector(s => s.user);
    const { subjectsList } = useSelector(s => s.sclass);
    const { deadlines } = useSelector(s => s.deadlines);
    const progress = useSelector(s => s.progress);

    const [subjectAttendance, setSubjectAttendance] = useState([]);
    const [attendanceSummaries, setAttendanceSummaries] = useState([]);
    const [assignments, setAssignments] = useState([]);

    const classID = currentUser?.sclassName?._id || currentUser?.classId?._id;

    useEffect(() => {
        if (currentUser?._id) {
            dispatch(getUserDetails(currentUser._id, 'Student'));
            dispatch(fetchDeadlines(currentUser._id));
            dispatch(fetchProgress(currentUser._id));
        }
        if (classID) dispatch(getSubjectList(classID, 'ClassSubjects'));
    }, [dispatch, currentUser?._id, classID]);

    useEffect(() => {
        if (userDetails?.attendance) setSubjectAttendance(userDetails.attendance);
    }, [userDetails]);

    // Fetch real attendance analytics from the dedicated endpoint
    useEffect(() => {
        if (!currentUser?._id) return;
        axiosInstance.get(`/attendance-analytics/${currentUser._id}`)
            .then(r => setAttendanceSummaries(Array.isArray(r.data) ? r.data : []))
            .catch(() => {});
    }, [currentUser?._id]);

    // Fetch assignments for the subject panel
    useEffect(() => {
        if (!classID) return;
        axiosInstance.get(`/AssignmentsByClass/${classID}`)
            .then(r => setAssignments(Array.isArray(r.data) ? r.data : (r.data?.assignments || [])))
            .catch(() => {});
    }, [classID]);

    const pendingAssignments = deadlines.filter(d => d.type === 'assignment').length;
    const upcomingTests = deadlines.filter(d => d.type === 'test').length;
    const overallPct = Math.round(calculateOverallAttendancePercentage(subjectAttendance));
    const overallAvg = progress.data?.length > 0
        ? Math.round(progress.data.reduce((s, i) => s + i.percentageScore, 0) / progress.data.length * 10) / 10
        : null;

    return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, p: { xs: 2, md: 3 } }}>

            {/* ── TOP: Summary Cards ── */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { icon: <MenuBookIcon />, label: 'Total Subjects', value: subjectsList?.length || 0, color: theme.accent },
                    { icon: <AssignmentIcon />, label: 'Pending Assignments', value: pendingAssignments, color: theme.warning, sub: 'Due soon' },
                    { icon: <CheckCircleIcon />, label: 'Attendance', value: `${overallPct}%`, color: overallPct >= 75 ? theme.success : theme.danger, sub: overallPct >= 75 ? 'Good standing' : 'Needs improvement' },
                    { icon: <QuizIcon />, label: 'Upcoming Tests', value: upcomingTests, color: '#a855f7', sub: 'This week' },
                    { icon: <TrendingUpIcon />, label: 'Learning Progress', value: overallAvg !== null ? `${overallAvg}%` : 'No data', color: theme.accent, to: '/Student/progress' },
                ].map((card, i) => (
                    <Grid item xs={12} sm={6} md={loading ? 3 : 'auto'} key={i}
                        sx={{ flex: { md: 1 } }}>
                        <SummaryCard {...card} />
                    </Grid>
                ))}
            </Grid>

            {/* ── MIDDLE: Subject Assignments | Upcoming Deadlines ── */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={5}>
                    <SubjectAssignmentPanel subjectsList={subjectsList} assignments={assignments} />
                </Grid>
                <Grid item xs={12} md={7}>
                    <UpcomingDeadlinesPanel />
                </Grid>
            </Grid>

            {/* ── BOTTOM: Learning Progress Chart | Attendance Analytics ── */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={7}>
                    <Card>
                        <CardTitle>Learning Progress</CardTitle>
                        {progress.loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress sx={{ color: theme.accent }} />
                            </Box>
                        ) : (
                            <ProgressLineChart data={progress.data || []} selectedSubjects={[]} />
                        )}
                    </Card>
                </Grid>
                <Grid item xs={12} md={5}>
                    <AttendanceAnalyticsChart summaries={attendanceSummaries} />
                </Grid>
            </Grid>

            {/* ── FOOTER: Notices ── */}
            <Box sx={{
                background: theme.card,
                border: theme.cardBorder,
                borderRadius: theme.radius,
                p: 3,
                boxShadow: theme.cardShadow,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CampaignIcon sx={{ color: theme.accent, fontSize: 20 }} />
                    <Typography sx={{ color: theme.accent, fontWeight: 700, fontSize: '0.95rem', letterSpacing: 0.4 }}>
                        School Notices
                    </Typography>
                </Box>
                <SeeNotice />
            </Box>

        </Box>
    );
};

export default StudentHomePage;
