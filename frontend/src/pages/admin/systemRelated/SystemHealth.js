import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Grid, Paper, Chip, LinearProgress,
    Button, Alert, Box,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SkeletonTable from '../../../components/SkeletonTable';


// Custom hook: calls `callback` immediately and then every `delay` ms
function useInterval(callback, delay) {
    const savedCallback = useRef(callback);
    useEffect(() => { savedCallback.current = callback; }, [callback]);
    useEffect(() => {
        if (delay == null) return;
        savedCallback.current();
        const id = setInterval(() => savedCallback.current(), delay);
        return () => clearInterval(id);
    }, [delay]);
}

const dbChipColor = (status) => {
    if (status === 'Connected')    return 'success';
    if (status === 'Degraded')     return 'warning';
    return 'error';
};

const StatCard = ({ title, children }) => (
    <Paper sx={{ p: 2.5, height: '100%' }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {title}
        </Typography>
        {children}
    </Paper>
);

const SystemHealth = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');

    const fetchHealth = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get(`/Admin/health/${schoolId}`);
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load health metrics');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [schoolId]);

    useInterval(fetchHealth, 60000);

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
                <Typography variant="h4" sx={{ mb: 3 }}>System Health</Typography>
                <SkeletonTable rows={6} cols={3} />
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
                <Typography variant="h4" sx={{ mb: 3 }}>System Health</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, gap: 2 }}>
                    <Alert severity="error" sx={{ width: '100%', maxWidth: 480 }}>{error}</Alert>
                    <Button variant="contained" startIcon={<RefreshIcon />} onClick={fetchHealth}>
                        Retry
                    </Button>
                </Box>
            </Container>
        );
    }

    const memWarn  = data?.memory?.percent > 80;
    const cpuWarn  = data?.cpu?.loadPercent > 85;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h4">System Health</Typography>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchHealth}>
                    Refresh
                </Button>
            </Box>

            <Grid container spacing={3}>
                {/* DB Status */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard title="Database Status">
                        <Chip
                            label={data?.db?.status || 'Unknown'}
                            color={dbChipColor(data?.db?.status)}
                            size="medium"
                            sx={{ mt: 0.5 }}
                        />
                    </StatCard>
                </Grid>

                {/* Uptime */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard title="Server Uptime">
                        <Typography variant="h6" sx={{ mt: 0.5 }}>
                            {data?.uptime?.formatted || '—'}
                        </Typography>
                    </StatCard>
                </Grid>

                {/* Memory */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard title="Memory Usage">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, mb: 1 }}>
                            <Typography variant="h6">
                                {data?.memory?.usedMB ?? '—'} / {data?.memory?.totalMB ?? '—'} MB
                            </Typography>
                            {memWarn && (
                                <Chip label="High" color="warning" size="small" />
                            )}
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={data?.memory?.percent ?? 0}
                            sx={{
                                height: 8,
                                borderRadius: 4,
                                '& .MuiLinearProgress-bar': {
                                    bgcolor: memWarn ? '#ff9800' : '#4caf50',
                                },
                            }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {data?.memory?.percent ?? 0}% used
                        </Typography>
                    </StatCard>
                </Grid>

                {/* CPU Load */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard title="CPU Load">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Typography variant="h6">
                                {data?.cpu?.loadPercent ?? '—'}%
                            </Typography>
                            {cpuWarn && (
                                <Chip label="High" color="warning" size="small" />
                            )}
                        </Box>
                    </StatCard>
                </Grid>

                {/* Active Connections */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard title="Active Connections">
                        <Typography variant="h6" sx={{ mt: 0.5 }}>
                            {data?.connections?.active ?? '—'}
                        </Typography>
                    </StatCard>
                </Grid>

                {/* Avg Response Time */}
                <Grid item xs={12} sm={6} md={4}>
                    <StatCard title="Avg Response Time (5 min)">
                        <Typography variant="h6" sx={{ mt: 0.5 }}>
                            {data?.responseTime?.avgMs ?? '—'} ms
                        </Typography>
                    </StatCard>
                </Grid>

                {/* Collection Counts */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2.5 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Collection Counts
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            {[
                                { label: 'Students',  value: data?.collections?.students },
                                { label: 'Teachers',  value: data?.collections?.teachers },
                                { label: 'Tests',     value: data?.collections?.tests },
                            ].map(({ label, value }) => (
                                <Grid item xs={4} key={label}>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <Typography variant="h5" fontWeight={700}>
                                            {value ?? '—'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {label}
                                        </Typography>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>
        </Container>
    );
};

export default SystemHealth;
