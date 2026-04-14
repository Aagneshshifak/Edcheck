import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import { Box, Typography, Grid, CircularProgress, Paper } from '@mui/material';
import {
    RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
    PieChart, Pie,
} from 'recharts';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

// ── Colour helpers ────────────────────────────────────────────────────────────
const SUBJECT_PALETTE = ['#0ea5e9','#a78bfa','#34d399','#f59e0b','#f472b6','#60a5fa','#fb923c','#4ade80'];
const pctColor = (v) => v >= 75 ? '#16a34a' : v >= 50 ? '#d97706' : '#dc2626';

// ── Shared card ───────────────────────────────────────────────────────────────
const ChartCard = ({ title, subtitle, children }) => (
    <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, height: '100%' }}>
        <Typography fontWeight={700} fontSize="1rem" mb={0.3}>{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary" display="block" mb={2}>{subtitle}</Typography>}
        {children}
    </Paper>
);

const Empty = ({ msg }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
        <Typography variant="body2" color="text.disabled">{msg}</Typography>
    </Box>
);

// ── Custom tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            {label && <Typography fontWeight={700} fontSize="0.78rem" mb={0.5}>{label}</Typography>}
            {payload.map((p, i) => (
                <Typography key={i} fontSize="0.75rem" sx={{ color: p.color || '#111111' }}>
                    {p.name}: {typeof p.value === 'number' ? `${p.value}%` : p.value}
                </Typography>
            ))}
        </Paper>
    );
};

// ── 1. Attendance Radial Chart ────────────────────────────────────────────────
const AttendanceChart = ({ studentId }) => {
    const [data, setData]       = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get(`/attendance-analytics/${studentId}`)
            .then(r => setData(r.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [studentId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>;
    if (!data.length) return <Empty msg="No attendance records yet" />;

    const radialData = data.map((s, i) => ({
        name: s.subjectName,
        value: s.attendancePercentage,
        fill: SUBJECT_PALETTE[i % SUBJECT_PALETTE.length],
    }));

    return (
        <ResponsiveContainer width="100%" height={260}>
            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%"
                data={radialData} startAngle={180} endAngle={-180}>
                <RadialBar minAngle={5} background={{ fill: 'rgba(0,0,0,0.04)' }}
                    clockWise dataKey="value"
                    label={{ position: 'insideStart', fill: '#ffffff', fontSize: 10 }} />
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right"
                    formatter={(v) => <span style={{ color: '#555555', fontSize: '0.72rem' }}>{v}</span>} />
                <Tooltip content={<ChartTooltip />} />
            </RadialBarChart>
        </ResponsiveContainer>
    );
};

// ── 2. Subject Marks Bar Chart ────────────────────────────────────────────────
const MarksChart = ({ studentId }) => {
    const [data, setData]       = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get(`/api/report/student/${studentId}`)
            .then(r => {
                const subjects = (r.data?.subjects || [])
                    .filter(s => s.totalMarks !== null)
                    .map(s => ({ name: s.subjectName.slice(0, 10), marks: s.totalMarks, grade: s.grade }));
                setData(subjects);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [studentId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>;
    if (!data.length) return <Empty msg="No marks data yet" />;

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="name" tick={{ fill: '#666666', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#666666', fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="marks" name="Total %" radius={[4, 4, 0, 0]}>
                    {data.map((entry, i) => (
                        <Cell key={i} fill={pctColor(entry.marks)} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

// ── 3. Assignment Completion Pie Chart ────────────────────────────────────────
const AssignmentChart = ({ studentId }) => {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axiosInstance.get(`/Student/${studentId}`)
            .then(async r => {
                const classId = r.data?.sclassName?._id || r.data?.sclassName || r.data?.classId;
                if (!classId) { setData({ submitted: 0, pending: 0, overdue: 0 }); return; }

                const [asgRes, subRes] = await Promise.all([
                    axiosInstance.get(`/AssignmentsByClass/${classId}`).catch(() => ({ data: [] })),
                    axiosInstance.get(`/StudentSubmissions/${studentId}`).catch(() => ({ data: [] })),
                ]);

                const assignments  = Array.isArray(asgRes.data) ? asgRes.data : (asgRes.data?.assignments || []);
                const submittedIds = new Set((subRes.data || []).map(s => s.assignmentId?._id || s.assignmentId));
                const now = new Date();

                let submitted = 0, pending = 0, overdue = 0;
                assignments.forEach(a => {
                    if (submittedIds.has(a._id)) submitted++;
                    else if (new Date(a.dueDate) < now) overdue++;
                    else pending++;
                });
                setData({ submitted, pending, overdue });
            })
            .catch(() => setData({ submitted: 0, pending: 0, overdue: 0 }))
            .finally(() => setLoading(false));
    }, [studentId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>;
    if (!data || (data.submitted + data.pending + data.overdue) === 0) return <Empty msg="No assignments yet" />;

    const pieData = [
        { name: 'Submitted', value: data.submitted, fill: '#16a34a' },
        { name: 'Pending',   value: data.pending,   fill: '#d97706' },
        { name: 'Overdue',   value: data.overdue,   fill: '#dc2626' },
    ].filter(d => d.value > 0);

    const total = data.submitted + data.pending + data.overdue;
    const completionPct = total > 0 ? Math.round((data.submitted / total) * 100) : 0;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                <Typography sx={{ color: pctColor(completionPct), fontWeight: 800, fontSize: '1.6rem' }}>
                    {completionPct}%
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'flex-end', ml: 0.5, mb: 0.5 }}>
                    completion
                </Typography>
            </Box>
            <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                        paddingAngle={3} dataKey="value">
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                                <Typography sx={{ color: d.fill, fontWeight: 700, fontSize: '0.78rem' }}>
                                    {d.name}: {d.value}
                                </Typography>
                            </Paper>
                        );
                    }} />
                    <Legend formatter={(v, e) => <span style={{ color: e.payload.fill, fontSize: '0.75rem' }}>{v}</span>} />
                </PieChart>
            </ResponsiveContainer>
        </Box>
    );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const AcademicPerformanceDashboard = ({ studentId: propStudentId }) => {
    const { currentUser } = useSelector(s => s.user);
    const studentId = propStudentId || currentUser?._id;

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#111111', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <TrendingUpIcon sx={{ fontSize: '1.6rem' }} />
                <Box>
                    <Typography fontWeight={800} fontSize="1.4rem" lineHeight={1.2}>
                        Academic Performance
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Visual overview of your academic progress
                    </Typography>
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                    <ChartCard title="Attendance by Subject" subtitle="% of classes attended">
                        <AttendanceChart studentId={studentId} />
                    </ChartCard>
                </Grid>
                <Grid item xs={12} md={4}>
                    <ChartCard title="Subject Marks" subtitle="Overall % per subject">
                        <MarksChart studentId={studentId} />
                    </ChartCard>
                </Grid>
                <Grid item xs={12} md={4}>
                    <ChartCard title="Assignment Completion" subtitle="Submitted vs pending vs overdue">
                        <AssignmentChart studentId={studentId} />
                    </ChartCard>
                </Grid>
            </Grid>
        </Box>
    );
};

export default AcademicPerformanceDashboard;
