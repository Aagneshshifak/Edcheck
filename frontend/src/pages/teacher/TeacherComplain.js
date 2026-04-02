import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Grid, Tabs, Tab,
    List, ListItem, ListItemText, Divider, TextField, Button,
    Chip, CircularProgress, Alert, Avatar,
} from '@mui/material';
import AnnouncementOutlinedIcon from '@mui/icons-material/AnnouncementOutlined';
import MessageIcon from '@mui/icons-material/Message';
import SendIcon from '@mui/icons-material/Send';

const BASE = process.env.REACT_APP_BASE_URL;

// ── Notices tab ───────────────────────────────────────────────────────────────

const NoticesTab = ({ schoolId }) => {
    const [notices,  setNotices]  = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');

    useEffect(() => {
        if (!schoolId) return;
        setLoading(true);
        axios.get(`${BASE}/NoticeList/${schoolId}`)
            .then(({ data }) => setNotices(Array.isArray(data) ? data : []))
            .catch(() => setError('Failed to load notices'))
            .finally(() => setLoading(false));
    }, [schoolId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    if (error)   return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;

    return (
        <Box>
            {notices.length === 0 ? (
                <Typography color="text.secondary" sx={{ mt: 3 }}>No notices posted yet.</Typography>
            ) : (
                <List disablePadding>
                    {notices.map((n, i) => (
                        <Paper key={n._id || i} sx={{ mb: 2, p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Typography variant="subtitle1" fontWeight={700}>{n.title}</Typography>
                                <Chip label="Notice" size="small" color="info" />
                            </Box>
                            <Typography variant="body2" color="text.secondary">{n.details}</Typography>
                            {n.date && (
                                <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                                    {new Date(n.date).toLocaleDateString()}
                                </Typography>
                            )}
                        </Paper>
                    ))}
                </List>
            )}
        </Box>
    );
};

// ── Messages tab ──────────────────────────────────────────────────────────────

const MessagesTab = ({ currentUser, schoolId }) => {
    const [complains, setComplains] = useState([]);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState('');
    const [success,   setSuccess]   = useState('');
    const [message,   setMessage]   = useState('');
    const [sending,   setSending]   = useState(false);

    const fetchComplains = useCallback(() => {
        if (!schoolId) return;
        setLoading(true);
        axios.get(`${BASE}/ComplainList/${schoolId}`)
            .then(({ data }) => setComplains(Array.isArray(data) ? data : []))
            .catch(() => setError('Failed to load messages'))
            .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchComplains(); }, [fetchComplains]);

    const handleSend = async () => {
        if (!message.trim()) return;
        setSending(true); setError(''); setSuccess('');
        try {
            await axios.post(`${BASE}/ComplainCreate`, {
                user:    currentUser._id,
                school:  schoolId,
                complaint: message.trim(),
                date:    new Date(),
            });
            setSuccess('Message sent');
            setMessage('');
            fetchComplains();
        } catch {
            setError('Failed to send message');
        } finally { setSending(false); }
    };

    return (
        <Box>
            {/* Compose */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Send a Message to Admin</Typography>
                <TextField
                    fullWidth multiline rows={3}
                    placeholder="Write your message or complaint here…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    sx={{ mb: 1.5 }}
                />
                {error   && <Alert severity="error"   sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSuccess('')}>{success}</Alert>}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained" endIcon={<SendIcon />}
                        onClick={handleSend} disabled={sending || !message.trim()}
                    >
                        {sending ? <CircularProgress size={18} color="inherit" /> : 'Send'}
                    </Button>
                </Box>
            </Paper>

            {/* History */}
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Message History</Typography>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
            ) : complains.length === 0 ? (
                <Typography color="text.secondary">No messages yet.</Typography>
            ) : (
                <List disablePadding>
                    {complains.map((c, i) => (
                        <Paper key={c._id || i} sx={{ mb: 1.5, p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: '#0ea5e9' }}>
                                    {(c.user?.name || currentUser.name || '?')[0].toUpperCase()}
                                </Avatar>
                                <Typography variant="body2" fontWeight={600}>
                                    {c.user?.name || currentUser.name}
                                </Typography>
                                {c.date && (
                                    <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
                                        {new Date(c.date).toLocaleDateString()}
                                    </Typography>
                                )}
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ pl: 4.5 }}>
                                {c.complaint}
                            </Typography>
                        </Paper>
                    ))}
                </List>
            )}
        </Box>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const TeacherComplain = () => {
    const { currentUser } = useSelector(s => s.user);
    const schoolId = currentUser.school?._id || currentUser.schoolId || currentUser.school;
    const [tab, setTab] = useState(0);

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <AnnouncementOutlinedIcon color="primary" />
                <Typography variant="h5" fontWeight={700}>Notices & Messages</Typography>
            </Box>

            <Paper sx={{ mb: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab icon={<AnnouncementOutlinedIcon fontSize="small" />} iconPosition="start" label="Notices" />
                    <Tab icon={<MessageIcon fontSize="small" />} iconPosition="start" label="Messages" />
                </Tabs>
            </Paper>

            {tab === 0 && <NoticesTab schoolId={schoolId} />}
            {tab === 1 && <MessagesTab currentUser={currentUser} schoolId={schoolId} />}
        </Container>
    );
};

export default TeacherComplain;
