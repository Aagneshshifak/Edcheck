import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, TextField, Button, CircularProgress,
    Alert, Chip, Divider,
} from '@mui/material';
import CampaignIcon  from '@mui/icons-material/Campaign';
import SendIcon      from '@mui/icons-material/Send';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';


const fieldSx = {
    '& .MuiOutlinedInput-root': {
        color: '#f1f5f9',
        '& fieldset': { borderColor: 'rgba(14,165,233,0.25)' },
        '&:hover fieldset': { borderColor: 'rgba(14,165,233,0.5)' },
        '&.Mui-focused fieldset': { borderColor: '#0ea5e9' },
    },
    '& .MuiInputLabel-root': { color: 'rgba(148,163,184,0.6)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#0ea5e9' },
};

const TeacherNotices = () => {
    const { currentUser } = useSelector(s => s.user);

    const [title,    setTitle]    = useState('');
    const [details,  setDetails]  = useState('');
    const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));
    const [notices,  setNotices]  = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [sending,  setSending]  = useState(false);
    const [error,    setError]    = useState('');
    const [success,  setSuccess]  = useState('');

    const schoolId = currentUser?.school?._id || currentUser?.school || currentUser?.schoolId;

    // Load existing notices for this school
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
        if (!title.trim() || !details.trim()) {
            setError('Title and message are required.');
            return;
        }
        setSending(true);
        setError('');
        setSuccess('');

        try {
            const { data } = await axiosInstance.post(`/NoticeCreate`, {
                title,
                details,
                date,
                school:    schoolId,
                schoolId,
                audience:  'all',
                targetType: 'all',
            });
            setNotices(prev => [data, ...prev]);
            setTitle('');
            setDetails('');
            setDate(new Date().toISOString().slice(0, 10));
            setSuccess('Notice sent successfully.');
        } catch {
            setError('Failed to send notice. Please try again.');
        } finally {
            setSending(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0b1120', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <CampaignIcon sx={{ color: '#0ea5e9', fontSize: '1.6rem' }} />
                <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.4rem' }}>
                    Class Notices
                </Typography>
            </Box>

            {/* ── Create notice form ── */}
            <Paper component="form" onSubmit={handleSend}
                sx={{ bgcolor: '#000000', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 3, p: 3, mb: 4, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.95rem' }}>
                    Send a Notice
                </Typography>

                {error   && <Alert severity="error"   onClose={() => setError('')}>{error}</Alert>}
                {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

                <TextField label="Title" required fullWidth value={title} onChange={e => setTitle(e.target.value)} sx={fieldSx} />
                <TextField label="Message" required fullWidth multiline rows={3} value={details} onChange={e => setDetails(e.target.value)} sx={fieldSx} />
                <TextField label="Date" type="date" required fullWidth value={date} onChange={e => setDate(e.target.value)}
                    InputLabelProps={{ shrink: true }} sx={fieldSx} />

                <Button type="submit" variant="contained" disabled={sending}
                    startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                    sx={{
                        alignSelf: 'flex-end', bgcolor: '#0ea5e9', color: '#fff',
                        borderRadius: 2.5, textTransform: 'none', fontWeight: 700, px: 4,
                        boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
                        '&:hover': { bgcolor: '#0284c7' },
                    }}>
                    {sending ? 'Sending…' : 'Send Notice'}
                </Button>
            </Paper>

            {/* ── Existing notices ── */}
            <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem', mb: 2 }}>
                Recent Notices
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress sx={{ color: '#0ea5e9' }} />
                </Box>
            ) : notices.length === 0 ? (
                <Paper sx={{ bgcolor: '#000000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, p: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.88rem' }}>No notices yet.</Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {notices.map(n => (
                        <Paper key={n._id} sx={{
                            bgcolor: '#000000', border: '1px solid rgba(14,165,233,0.12)',
                            borderLeft: '3px solid #0ea5e9', borderRadius: 2, p: 2.5,
                        }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.8 }}>
                                <Typography sx={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem' }}>
                                    {n.title}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <CalendarTodayIcon sx={{ fontSize: 11, color: 'rgba(148,163,184,0.4)' }} />
                                    <Typography sx={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.7rem' }}>
                                        {n.date ? new Date(n.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Typography sx={{ color: 'rgba(148,163,184,0.65)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                                {n.details}
                            </Typography>
                        </Paper>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default TeacherNotices;
