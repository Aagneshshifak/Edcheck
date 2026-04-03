import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import {
    Container, Grid, Box, Paper, Typography, CircularProgress,
    Chip, LinearProgress, Divider,
} from '@mui/material';
import GroupsIcon        from '@mui/icons-material/Groups';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SchoolIcon        from '@mui/icons-material/School';
import QuizIcon          from '@mui/icons-material/Quiz';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';
import AnnouncementIcon  from '@mui/icons-material/Announcement';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';


const STAT_CARDS = [
    { key: 'totalStudents', label: 'Total Students', icon: <GroupsIcon />,         color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#0284c7)' },
    { key: 'totalTeachers', label: 'Total Teachers', icon: <ManageAccountsIcon />, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)' },
    { key: 'totalClasses',  label: 'Total Classes',  icon: <SchoolIcon />,         color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#059669)' },
    { key: 'activeTests',   label: 'Active Tests',   icon: <QuizIcon />,           color: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
];

const StatCard = ({ label, value, icon, color, gradient, loading, onClick }) => (
    <Paper
        onClick={onClick}
        sx={{
            p: 3, cursor: onClick ? 'pointer' : 'default',
            background: 'rgba(17,24,39,0.8)',
            border: `1px solid ${color}30`,
            borderRadius: 3,
            transition: 'all 0.25s ease',
            '&:hover': onClick ? { borderColor: color, boxShadow: `0 8px 32px ${color}25`, transform: 'translateY(-3px)' } : {},
        }}
    >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
                <Typography variant='caption' sx={{ color: 'rgba(148,163,184,0.8)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.7rem', fontWeight: 600 }}>
                    {label}
                </Typography>
                <Typography variant='h3' sx={{ fontWeight: 700, mt: 0.5, background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    {loading ? <CircularProgress size={28} sx={{ color }} /> : (value ?? 0)}
                </Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, background: `${color}18`, color, display: 'flex' }}>
                {icon}
            </Box>
        </Box>
    </Paper>
);

const SectionCard = ({ title, icon, children, minHeight = 280 }) => (
    <Paper sx={{ p: 2.5, borderRadius: 3, minHeight, background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(14,165,233,0.12)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ color: '#0ea5e9' }}>{icon}</Box>
            <Typography variant='h6' sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</Typography>
        </Box>
        <Divider sx={{ mb: 2, borderColor: 'rgba(14,165,233,0.1)' }} />
        {children}
    </Paper>
);

const AdminHomePage = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);
    const navigate = useNavigate();
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboard = useCallback(() => {
        setLoading(true);
        axiosInstance.get(`/Admin/dashboard/${schoolId}`)
            .then(res => setData(res.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    const stats = data?.stats || {};

    return (
        <Container maxWidth='xl' sx={{ mt: 3, mb: 6 }}>

            {/* ── Row 1: Stat cards ── */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                {STAT_CARDS.map(card => (
                    <Grid item xs={12} sm={6} md={3} key={card.key}>
                        <StatCard
                            label={card.label}
                            value={stats[card.key]}
                            icon={card.icon}
                            color={card.color}
                            gradient={card.gradient}
                            loading={loading}
                            onClick={() => {
                                const routes = { totalStudents: '/Admin/manage/students', totalTeachers: '/Admin/manage/teachers', totalClasses: '/Admin/manage/classes', activeTests: '/Admin/tests' };
                                navigate(routes[card.key]);
                            }}
                        />
                    </Grid>
                ))}
            </Grid>

            {/* ── Row 2: Charts ── */}
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                    <SectionCard title='Class Performance' icon={<SchoolIcon fontSize='small' />}>
                        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                        : !data?.classPerformance?.length
                            ? <Typography color='text.secondary' sx={{ textAlign: 'center', py: 4 }}>No test data yet.</Typography>
                            : <ResponsiveContainer width='100%' height={220}>
                                <BarChart data={data.classPerformance} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray='3 3' stroke='rgba(14,165,233,0.08)' />
                                    <XAxis dataKey='className' angle={-30} textAnchor='end' tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <YAxis domain={[0, 100]} unit='%' tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <Tooltip
                                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 8 }}
                                        formatter={v => [`${v}%`, 'Avg Score']}
                                    />
                                    <Bar dataKey='avgScore' fill='#0ea5e9' radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        }
                    </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                    <SectionCard title='Teacher Performance' icon={<ManageAccountsIcon fontSize='small' />}>
                        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                        : !data?.teacherPerformance?.length
                            ? <Typography color='text.secondary' sx={{ textAlign: 'center', py: 4 }}>No performance data yet.</Typography>
                            : data.teacherPerformance.map((t, i) => (
                                <Box key={i} sx={{ mb: 1.5 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant='body2' sx={{ fontWeight: 500 }}>{t.name}</Typography>
                                        <Typography variant='body2' sx={{ color: t.score >= 75 ? '#10b981' : t.score >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>
                                            {t.score}%
                                        </Typography>
                                    </Box>
                                    <LinearProgress variant='determinate' value={t.score}
                                        sx={{ height: 6, borderRadius: 3,
                                            '& .MuiLinearProgress-bar': { bgcolor: t.score >= 75 ? '#10b981' : t.score >= 50 ? '#f59e0b' : '#ef4444' }
                                        }}
                                    />
                                </Box>
                            ))
                        }
                    </SectionCard>
                </Grid>
            </Grid>

            {/* ── Row 3: Risk + Notices ── */}
            <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                    <SectionCard title='Student Risk Alerts' icon={<WarningAmberIcon fontSize='small' sx={{ color: '#ef4444' }} />}>
                        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                        : !data?.studentRisk?.length
                            ? <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography sx={{ color: '#10b981', fontWeight: 600 }}>No at-risk students</Typography>
                                <Typography variant='caption' color='text.secondary'>All students have good attendance</Typography>
                              </Box>
                            : data.studentRisk.map((s, i) => (
                                <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px solid rgba(14,165,233,0.08)' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <WarningAmberIcon fontSize='small' sx={{ color: s.riskScore >= 70 ? '#ef4444' : '#f59e0b' }} />
                                        <Box>
                                            <Typography variant='body2' sx={{ fontWeight: 600 }}>{s.name}</Typography>
                                            <Typography variant='caption' color='text.secondary'>
                                                Attendance: {s.attendanceRate != null ? `${s.attendanceRate}%` : 'N/A'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Chip
                                        label={`Risk ${s.riskScore}%`}
                                        size='small'
                                        sx={{ bgcolor: s.riskScore >= 70 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: s.riskScore >= 70 ? '#ef4444' : '#f59e0b', fontWeight: 600, border: `1px solid ${s.riskScore >= 70 ? '#ef444440' : '#f59e0b40'}` }}
                                    />
                                </Box>
                            ))
                        }
                    </SectionCard>
                </Grid>
                <Grid item xs={12} md={6}>
                    <SectionCard title='Recent Notices' icon={<AnnouncementIcon fontSize='small' />}>
                        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                        : !data?.recentNotices?.length
                            ? <Typography color='text.secondary' sx={{ textAlign: 'center', py: 4 }}>No notices yet.</Typography>
                            : data.recentNotices.map((n, i) => (
                                <Box key={i} sx={{ py: 1.25, borderBottom: '1px solid rgba(14,165,233,0.08)' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.25 }}>
                                        <Typography variant='body2' sx={{ fontWeight: 600, flex: 1, mr: 1 }}>{n.title}</Typography>
                                        <Typography variant='caption' sx={{ color: 'rgba(148,163,184,0.7)', whiteSpace: 'nowrap' }}>
                                            {new Date(n.date).toLocaleDateString()}
                                        </Typography>
                                    </Box>
                                    <Typography variant='caption' color='text.secondary' sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {n.details}
                                    </Typography>
                                </Box>
                            ))
                        }
                    </SectionCard>
                </Grid>
            </Grid>
        </Container>
    );
};

export default AdminHomePage;