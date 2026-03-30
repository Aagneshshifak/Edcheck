import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, LinearProgress } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { getUserDetails } from '../../redux/userRelated/userHandle';
import { getSubjectList } from '../../redux/sclassRelated/sclassHandle';
import { calculateOverallAttendancePercentage } from '../../components/attendanceCalculator';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QuizIcon from '@mui/icons-material/Quiz';
import SeeNotice from '../../components/SeeNotice';
import { theme } from '../../theme/studentTheme';
import axios from 'axios';

const SummaryCard = ({ icon, label, value, color, sub }) => (
    <Box sx={{
        background: theme.card,
        border: theme.cardBorder,
        boxShadow: theme.cardShadow,
        borderRadius: 3,
        p: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        transition: 'transform 0.2s',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 8px 32px ${theme.accentGlow}` }
    }}>
        <Box sx={{
            width: 56, height: 56, borderRadius: 2,
            background: `linear-gradient(135deg, ${color}33, ${color}11)`,
            border: `1px solid ${color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: color, fontSize: 28
        }}>
            {icon}
        </Box>
        <Box>
            <Typography sx={{ color: theme.textMuted, fontSize: '0.78rem', letterSpacing: 1, textTransform: 'uppercase' }}>
                {label}
            </Typography>
            <Typography sx={{ color: theme.text, fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.2 }}>
                {value}
            </Typography>
            {sub && <Typography sx={{ color: theme.textMuted, fontSize: '0.75rem' }}>{sub}</Typography>}
        </Box>
    </Box>
);

const SubjectAttendanceBar = ({ subject, present, total }) => {
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    const color = pct >= 75 ? theme.success : pct >= 50 ? theme.warning : theme.danger;
    return (
        <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ color: theme.text, fontSize: '0.85rem' }}>{subject}</Typography>
                <Typography sx={{ color, fontSize: '0.85rem', fontWeight: 700 }}>{pct}%</Typography>
            </Box>
            <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                    height: 6, borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 }
                }}
            />
        </Box>
    );
};

const StudentHomePage = () => {
    const dispatch = useDispatch();
    const { userDetails, currentUser, loading } = useSelector(s => s.user);
    const { subjectsList } = useSelector(s => s.sclass);

    const [subjectAttendance, setSubjectAttendance] = useState([]);
    const [pendingAssignments, setPendingAssignments] = useState(0);
    const [upcomingTests, setUpcomingTests] = useState(0);

    const classID = currentUser?.sclassName?._id || currentUser?.classId?._id;

    useEffect(() => {
        if (currentUser?._id) dispatch(getUserDetails(currentUser._id, "Student"));
        if (classID) dispatch(getSubjectList(classID, "ClassSubjects"));
    }, [dispatch, currentUser?._id, classID]);

    useEffect(() => {
        if (userDetails?.attendance) setSubjectAttendance(userDetails.attendance);
    }, [userDetails]);

    // Fetch pending assignments count
    useEffect(() => {
        if (!classID) return;
        axios.get(`${process.env.REACT_APP_BASE_URL}/AssignmentsByClass/${classID}`)
            .then(res => {
                const now = new Date();
                const pending = res.data.filter(a => new Date(a.dueDate) >= now).length;
                setPendingAssignments(pending);
            }).catch(() => {});
    }, [classID]);

    const overallPct = Math.round(calculateOverallAttendancePercentage(subjectAttendance));

    // Per-subject attendance
    const subjectAttendanceMap = {};
    subjectAttendance.forEach(a => {
        const key = a.subName?.subName || a.subjectId?.subName || 'Unknown';
        if (!subjectAttendanceMap[key]) subjectAttendanceMap[key] = { present: 0, total: 0 };
        subjectAttendanceMap[key].total++;
        if (a.status === 'Present') subjectAttendanceMap[key].present++;
    });

    return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, p: 3 }}>
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard icon={<MenuBookIcon />} label="Total Subjects"
                        value={subjectsList?.length || 0} color={theme.accent} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard icon={<AssignmentIcon />} label="Pending Assignments"
                        value={pendingAssignments} color={theme.warning}
                        sub="Due soon" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard icon={<CheckCircleIcon />} label="Attendance"
                        value={`${overallPct}%`}
                        color={overallPct >= 75 ? theme.success : theme.danger}
                        sub={overallPct >= 75 ? "Good standing" : "Needs improvement"} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <SummaryCard icon={<QuizIcon />} label="Upcoming Tests"
                        value={upcomingTests} color="#a855f7" sub="This week" />
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                {/* Per-subject attendance */}
                <Grid item xs={12} md={5}>
                    <Box sx={{
                        background: theme.card, border: theme.cardBorder,
                        borderRadius: 3, p: 3, boxShadow: theme.cardShadow
                    }}>
                        <Typography sx={{ color: theme.accent, fontWeight: 700, mb: 2, fontSize: '1rem', letterSpacing: 0.5 }}>
                            Attendance by Subject
                        </Typography>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                <CircularProgress sx={{ color: theme.accent }} />
                            </Box>
                        ) : Object.keys(subjectAttendanceMap).length > 0 ? (
                            Object.entries(subjectAttendanceMap).map(([sub, data]) => (
                                <SubjectAttendanceBar key={sub} subject={sub}
                                    present={data.present} total={data.total} />
                            ))
                        ) : (
                            <Typography sx={{ color: theme.textMuted, textAlign: 'center', py: 3 }}>
                                No attendance records yet
                            </Typography>
                        )}
                    </Box>
                </Grid>

                {/* Notices */}
                <Grid item xs={12} md={7}>
                    <Box sx={{
                        background: theme.card, border: theme.cardBorder,
                        borderRadius: 3, p: 3, boxShadow: theme.cardShadow
                    }}>
                        <Typography sx={{ color: theme.accent, fontWeight: 700, mb: 2, fontSize: '1rem', letterSpacing: 0.5 }}>
                            Notices
                        </Typography>
                        <SeeNotice />
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
};

export default StudentHomePage;
