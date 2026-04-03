import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Alert, Button, CircularProgress,
    Card, CardContent, Chip, LinearProgress, Grid,
} from '@mui/material';
import RefreshIcon      from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon        from '@mui/icons-material/Error';
import GroupsIcon       from '@mui/icons-material/Groups';
import PersonIcon       from '@mui/icons-material/Person';


const AlertsCenter = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [alerts,  setAlerts]  = useState([]);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');
    const [filter,  setFilter]  = useState('all'); // all | attendance | student_risk

    const fetchAlerts = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data } = await axiosInstance.get(`/Admin/alerts/${schoolId}`);
            setAlerts(data.alerts || []);
        } catch { setError('Failed to load alerts'); }
        finally { setLoading(false); }
    }, [schoolId]);

    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

    const visible = filter === 'all' ? alerts : alerts.filter(a => a.type === filter);
    const errorCount   = alerts.filter(a => a.severity === 'error').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon sx={{ fontSize: 32, color: 'warning.main' }} />
                    <Typography variant="h4">Real-Time Alerts</Typography>
                </Box>
                <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAlerts} disabled={loading}>Refresh</Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Summary chips */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
                <Chip icon={<ErrorIcon />} label={`${errorCount} Critical`} color="error" onClick={() => setFilter('all')} variant={filter === 'all' ? 'filled' : 'outlined'} />
                <Chip icon={<WarningAmberIcon />} label={`${warningCount} Warnings`} color="warning" onClick={() => setFilter('all')} variant={filter === 'all' ? 'filled' : 'outlined'} />
                <Chip icon={<GroupsIcon />} label="Class Attendance" onClick={() => setFilter(f => f === 'attendance' ? 'all' : 'attendance')} variant={filter === 'attendance' ? 'filled' : 'outlined'} color="info" />
                <Chip icon={<PersonIcon />} label="Student Risk" onClick={() => setFilter(f => f === 'student_risk' ? 'all' : 'student_risk')} variant={filter === 'student_risk' ? 'filled' : 'outlined'} color="secondary" />
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : visible.length === 0 ? (
                <Alert severity="success" icon={false}>
                    <Typography fontWeight={600}>All clear!</Typography>
                    No alerts detected. Attendance is healthy across all classes.
                </Alert>
            ) : (
                <Grid container spacing={2}>
                    {visible.map((alert, i) => (
                        <Grid item xs={12} sm={6} md={4} key={i}>
                            <Card
                                variant="outlined"
                                sx={{
                                    borderColor: alert.severity === 'error' ? 'error.main' : 'warning.main',
                                    borderWidth: 1.5,
                                    bgcolor: alert.severity === 'error'
                                        ? 'rgba(211,47,47,0.06)'
                                        : 'rgba(237,108,2,0.06)',
                                }}
                            >
                                <CardContent sx={{ pb: '12px !important' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                                        {alert.severity === 'error'
                                            ? <ErrorIcon color="error" fontSize="small" sx={{ mt: 0.3 }} />
                                            : <WarningAmberIcon color="warning" fontSize="small" sx={{ mt: 0.3 }} />
                                        }
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                                                {alert.title}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {alert.message}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    {alert.value != null && (
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="caption" color="text.secondary">Attendance</Typography>
                                                <Typography variant="caption" fontWeight={700}
                                                    color={alert.severity === 'error' ? 'error.main' : 'warning.main'}>
                                                    {alert.value}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress
                                                variant="determinate" value={alert.value}
                                                color={alert.severity === 'error' ? 'error' : 'warning'}
                                                sx={{ height: 6, borderRadius: 3 }}
                                            />
                                        </Box>
                                    )}
                                    <Box sx={{ mt: 1 }}>
                                        <Chip
                                            label={alert.type === 'attendance' ? 'Class' : 'Student'}
                                            size="small" variant="outlined"
                                            color={alert.type === 'attendance' ? 'info' : 'secondary'}
                                        />
                                        {alert.rollNum && (
                                            <Chip label={`Roll ${alert.rollNum}`} size="small" sx={{ ml: 0.5 }} />
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
        </Container>
    );
};

export default AlertsCenter;
