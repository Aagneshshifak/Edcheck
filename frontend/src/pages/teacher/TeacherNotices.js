import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, TextField, Button, CircularProgress, Alert,
} from '@mui/material';
import CampaignIcon      from '@mui/icons-material/Campaign';
import SendIcon          from '@mui/icons-material/Send';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

const TeacherNotices = () => {
    const { currentUser } = useSelector(s => s.user);

    const [title,   setTitle]   = useState('');
    const [details, setDetails] = useState('');
    const [date,    setDate]    = useState(new Date().toISOString().slice(0, 10));
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState('');

    const schoolId = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;

    useEffect(() => {
        if (!schoolId) return;
        setLoading(true);
        axiosInstance.get(`/NoticeList/${schoolId}`)
            .then(r => setNotices(Array.isArray(r.data) ? r.data : []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [schoolId]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!title.trim() || !details.trim()) { setError('Title and message are required.'); return; }
        setSending(true); setError(''); setSuccess('');
        try {
            const { data } = await axiosInstance.post('/NoticeCreate', {
                title, details, date, school: schoolId, schoolId, audience: 'all', targetType: 'all',
            });
            setNotices(prev => [data, ...prev]);
            setTitle(''); setDetails(''); setDate(new Date().toISOString().slice(0, 10));
            setSuccess('Notice sent successfully.');
        } catch {
            setError('Failed to send notice. Please try again.');
        } finally { setSending(false); }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <CampaignIcon />
                <Typography variant="h5" fontWeight={800}>Class Notices</Typography>
            </Box>

            {/* Create notice form */}
            <Paper component="form" onSubmit={handleSend}
                sx={{ borderRadius: 3, p: 3, mb: 4, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Typography fontWeight={700} fontSize="0.95rem">Send a Notice</Typography>

                {error   && <Alert severity="error"   onClose={() => setError('')}>{error}</Alert>}
                {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

                <TextField label="Title"   required fullWidth value={title}   onChange={e => setTitle(e.target.value)} />
                <TextField label="Message" required fullWidth multiline rows={3} value={details} onChange={e => setDetails(e.target.value)} />
                <TextField label="Date" type="date" required fullWidth value={date}
                    onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />

                <Button type="submit" variant="contained" disabled={sending}
                    startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                    sx={{ alignSelf: 'flex-end', borderRadius: 2.5, textTransform: 'none', fontWeight: 700, px: 4 }}>
                    {sending ? 'Sending…' : 'Send Notice'}
                </Button>
            </Paper>

            {/* Existing notices */}
            <Typography fontWeight={700} fontSize="1rem" sx={{ mb: 2 }}>Recent Notices</Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : notices.length === 0 ? (
                <Paper sx={{ borderRadius: 3, p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary" fontSize="0.88rem">No notices yet.</Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {notices.map(n => (
                        <Paper key={n._id} sx={{ borderRadius: 2, p: 2.5, borderLeft: '3px solid rgba(255,255,255,0.4)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.8 }}>
                                <Typography fontWeight={600} fontSize="0.9rem">{n.title}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <CalendarTodayIcon sx={{ fontSize: 11, opacity: 0.4 }} />
                                    <Typography variant="caption" color="text.secondary">
                                        {n.date ? new Date(n.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Typography color="text.secondary" fontSize="0.82rem" lineHeight={1.6}>{n.details}</Typography>
                        </Paper>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default TeacherNotices;
