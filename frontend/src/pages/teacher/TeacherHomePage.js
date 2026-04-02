import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Grid, Paper, Typography, Box, Chip,
    CircularProgress, Divider, List, ListItem, ListItemText,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import AssignmentIcon from '@mui/icons-material/Assignment';
import QuizIcon from '@mui/icons-material/Quiz';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CountUp from 'react-countup';
import { getClassStudents } from '../../redux/sclassRelated/sclassHandle';

const BASE = process.env.REACT_APP_BASE_URL;

const StatCard = ({ icon, label, value, color, suffix = '' }) => (
    <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color }}>
            {icon}
            <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Box>
        <Typography variant="h4" fontWeight={700} color={color}>
            {value != null
                ? <CountUp start={0} end={value} duration={2} suffix={suffix} />
                : <CircularProgress size={28} />}
        </Typography>
    </Paper>
);

const TeacherHomePage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { currentUser } = useSelector(s => s.user);
    const { sclassStudents } = useSelector(s => s.sclass);

    const classId   = currentUser.teachSclass?._id  || currentUser.teachClasses?.[0]?._id  || currentUser.teachClasses?.[0];
    const schoolId  = currentUser.school?._id || currentUser.schoolId || currentUser.school;

    const [tests,       setTests]       = useState(null);
    const [assignments, setAssignments] = useState(null);
    const [notices,     setNotices]     = useState([]);
    const [attendance,  setAttendance]  = useState(null); // class avg %

    useEffect(() => {
        if (classId) dispatch(getClassStudents(classId));
    }, [dispatch, classId]);

    // Tests count
    useEffect(() => {
        if (!classId) return;
        axios.get(`${BASE}/TestsByClass/${classId}`)
            .then(({ data }) => setTests(Array.isArray(data) ? data.length : 0))
            .catch(() => setTests(0));
    }, [classId]);

    // Assignments count
    useEffect(() => {
        if (!classId) return;
        axios.get(`${BASE}/AssignmentsByClass/${classId}`)
            .then(({ data }) => {
                const list = Array.isArray(data) ? data : (data.assignments || []);
                setAssignments(list.length);
            })
            .catch(() => setAssignments(0));
    }, [classId]);

    // Notices
    useEffect(() => {
        if (!schoolId) return;
        axios.get(`${BASE}/NoticeList/${schoolId}`)
            .then(({ data }) => setNotices(Array.isArray(data) ? data.slice(0, 5) : []))
            .catch(() => setNotices([]));
    }, [schoolId]);

    // Class attendance average
    useEffect(() => {
        if (!sclassStudents?.length) return;
        const totals = sclassStudents.map(s => {
            const total   = s.attendance?.length || 0;
            const present = s.attendance?.filter(a => a.status === 'Present').length || 0;
            return total > 0 ? (present / total) * 100 : null;
        }).filter(v => v != null);
        if (totals.length) {
            setAttendance(Math.round(totals.reduce((a, b) => a + b, 0) / totals.length));
        } else {
            setAttendance(0);
        }
    }, [sclassStudents]);

    const studentCount = sclassStudents?.length ?? null;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Typography variant="h5" fontWeight={700} mb={3}>
                Welcome back, {currentUser.name}
            </Typography>

            {/* Stat cards */}
            <Grid container spacing={3} mb={4}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<PeopleIcon />}
                        label="Class Students"
                        value={studentCount}
                        color="#0ea5e9"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<QuizIcon />}
                        label="Tests Created"
                        value={tests}
                        color="#8b5cf6"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<AssignmentIcon />}
                        label="Assignments"
                        value={assignments}
                        color="#f59e0b"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        icon={<EventNoteIcon />}
                        label="Class Attendance"
                        value={attendance}
                        color={attendance >= 75 ? '#22c55e' : '#ef4444'}
                        suffix="%"
                    />
                </Grid>
            </Grid>

            {/* Quick actions + Notices */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, height: '100%' }}>
                        <Typography variant="subtitle1" fontWeight={700} mb={2}>Quick Actions</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {[
                            { label: 'Take Attendance', path: '/Teacher/attendance', color: '#0ea5e9' },
                            { label: 'Create Test',     path: '/Teacher/tests',      color: '#8b5cf6' },
                            { label: 'New Assignment',  path: '/Teacher/assignments', color: '#f59e0b' },
                            { label: 'View Class',      path: '/Teacher/class',       color: '#22c55e' },
                            { label: 'Weak Students',   path: '/Teacher/weak-students', color: '#ef4444' },
                        ].map(({ label, path, color }) => (
                            <Box
                                key={path}
                                onClick={() => navigate(path)}
                                sx={{
                                    p: 1.5, mb: 1, borderRadius: 2, cursor: 'pointer',
                                    borderLeft: `3px solid ${color}`,
                                    bgcolor: 'action.hover',
                                    '&:hover': { bgcolor: 'action.selected' },
                                    transition: 'background 0.15s',
                                }}
                            >
                                <Typography variant="body2" fontWeight={600} color={color}>{label}</Typography>
                            </Box>
                        ))}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="subtitle1" fontWeight={700} mb={2}>Recent Notices</Typography>
                        <Divider sx={{ mb: 2 }} />
                        {notices.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">No notices yet.</Typography>
                        ) : (
                            <List disablePadding>
                                {notices.map((n, i) => (
                                    <ListItem key={n._id || i} disablePadding sx={{ mb: 1 }}>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="body2" fontWeight={600}>{n.title}</Typography>
                                                    <Chip label="Notice" size="small" color="info" />
                                                </Box>
                                            }
                                            secondary={
                                                <Typography variant="caption" color="text.secondary">
                                                    {n.details?.slice(0, 100)}{n.details?.length > 100 ? '…' : ''}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default TeacherHomePage;
