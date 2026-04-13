import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, Alert,
    CircularProgress, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Tooltip, Divider, Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import PersonIcon from '@mui/icons-material/Person';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import GroupsIcon from '@mui/icons-material/Groups';

const RECIPIENT_OPTIONS = [
    { value: 'All',      label: 'Whole School',   icon: <SchoolIcon fontSize="small" /> },
    { value: 'Students', label: 'Students',        icon: <GroupsIcon fontSize="small" /> },
    { value: 'Teachers', label: 'Teachers',        icon: <PersonIcon fontSize="small" /> },
    { value: 'Parents',  label: 'Parents',         icon: <FamilyRestroomIcon fontSize="small" /> },
    { value: 'Class',    label: 'Specific Class',  icon: <PeopleIcon fontSize="small" /> },
];

const NotificationCenter = () => {
    const currentUser = useSelector(s => s.user.currentUser);
    const schoolId = currentUser?.school || currentUser?._id;

    const [title,         setTitle]         = useState('');
    const [message,       setMessage]       = useState('');
    const [recipientType, setRecipientType] = useState('All');
    const [classId,       setClassId]       = useState('');
    const [formError,     setFormError]     = useState('');
    const [sending,       setSending]       = useState(false);
    const [sendSuccess,   setSendSuccess]   = useState('');
    const [previewCount,  setPreviewCount]  = useState(null);
    const [previewing,    setPreviewing]    = useState(false);
    const [classes,       setClasses]       = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [listLoading,   setListLoading]   = useState(true);
    const [listError,     setListError]     = useState('');

    const fetchClasses = useCallback(() => {
        axiosInstance.get(`/SclassList/${schoolId}`)
            .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
            .catch(() => setClasses([]));
    }, [schoolId]);

    const fetchNotifications = useCallback(() => {
        setListLoading(true); setListError('');
        axiosInstance.get(`/Admin/notifications/sent/${schoolId}`)
            .then(r => setNotifications(Array.isArray(r.data) ? r.data : []))
            .catch(e => setListError(e.response?.data?.message || 'Failed to load'))
            .finally(() => setListLoading(false));
    }, [schoolId]);

    useEffect(() => { if (schoolId) { fetchClasses(); fetchNotifications(); } }, [fetchClasses, fetchNotifications, schoolId]);

    useEffect(() => {
        if (!schoolId) return;
        if (recipientType === 'Class' && !classId) { setPreviewCount(null); return; }
        setPreviewing(true);
        axiosInstance.get('/Admin/notifications/preview', { params: { recipientType, schoolId, ...(classId && { classId }) } })
            .then(r => setPreviewCount(r.data.count))
            .catch(() => setPreviewCount(null))
            .finally(() => setPreviewing(false));
    }, [recipientType, classId, schoolId]);

    const handleSend = async (e) => {
        e.preventDefault();
        setFormError(''); setSendSuccess('');
        if (!title.trim())   return setFormError('Title is required.');
        if (!message.trim()) return setFormError('Message is required.');
        if (recipientType === 'Class' && !classId) return setFormError('Please select a class.');
        setSending(true);
        try {
            const payload = { title: title.trim(), message: message.trim(), recipientType, schoolId, ...(classId && { classId }) };
            const res = await axiosInstance.post('/Admin/notifications/send', payload);
            setSendSuccess(`Sent to ${res.data.count} recipient(s).`);
            setTitle(''); setMessage(''); setRecipientType('All'); setClassId('');
            fetchNotifications();
        } catch (e) { setFormError(e.response?.data?.message || 'Failed to send.'); }
        finally { setSending(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this notification?')) return;
        try {
            await axiosInstance.delete(`/Admin/notifications/${id}`);
            setNotifications(p => p.filter(n => (n.notificationId || n._id) !== id));
        } catch (e) { alert(e.response?.data?.message || 'Delete failed.'); }
    };

    const selectedOpt = RECIPIENT_OPTIONS.find(r => r.value === recipientType);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <NotificationsIcon sx={{ color: '#111111' }} />
                <Typography variant="h4" sx={{ color: '#111111', fontWeight: 700 }}>Notification Control Panel</Typography>
            </Box>

            {/* ── Compose Card ── */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, mb: 0.5 }}>Compose & Send</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>Send to:</Typography>

                <Box component="form" onSubmit={handleSend} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                    {/* ── Glass category buttons ── */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {RECIPIENT_OPTIONS.map(opt => {
                            const active = recipientType === opt.value;
                            return (
                                <Box
                                    key={opt.value}
                                    onClick={() => { setRecipientType(opt.value); setClassId(''); }}
                                    sx={{
                                        display: 'flex', alignItems: 'center', gap: 0.8,
                                        px: 2, py: 1, borderRadius: 2, cursor: 'pointer',
                                        fontWeight: active ? 700 : 500,
                                        fontSize: '0.85rem',
                                        color: active ? '#000000' : '#ffffff',
                                        background: active
                                            ? 'rgba(255,255,255,0.95)'
                                            : 'rgba(255,255,255,0.08)',
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        border: active
                                            ? '1.5px solid rgba(255,255,255,0.9)'
                                            : '1.5px solid rgba(255,255,255,0.15)',
                                        boxShadow: active
                                            ? '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6)'
                                            : '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                                        transition: 'all 0.18s ease',
                                        userSelect: 'none',
                                        '&:hover': {
                                            background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)',
                                            borderColor: 'rgba(255,255,255,0.4)',
                                        },
                                    }}
                                >
                                    <Box sx={{ color: active ? '#000000' : '#ffffff', display: 'flex' }}>{opt.icon}</Box>
                                    {opt.label.toUpperCase()}
                                </Box>
                            );
                        })}
                    </Box>

                    {/* Class selector */}
                    {recipientType === 'Class' && (
                        <FormControl size="small" sx={{ maxWidth: 280 }}>
                            <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Select Class</InputLabel>
                            <Select value={classId} label="Select Class" onChange={e => setClassId(e.target.value)}
                                sx={{ color: '#ffffff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '& .MuiSvgIcon-root': { color: '#ffffff' } }}>
                                <MenuItem value="">Choose a class</MenuItem>
                                {classes.map(c => <MenuItem key={c._id} value={c._id}>{c.sclassName || c.className}</MenuItem>)}
                            </Select>
                        </FormControl>
                    )}

                    {/* Preview count */}
                    {(previewCount !== null || previewing) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {previewing
                                ? <CircularProgress size={16} sx={{ color: '#ffffff' }} />
                                : <Chip icon={<PeopleIcon />} label={`${previewCount} recipient${previewCount !== 1 ? 's' : ''} will receive this`}
                                    size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }} />
                            }
                        </Box>
                    )}

                    {/* Fields */}
                    <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)}
                        required fullWidth size="small" placeholder='e.g. "Math test on Friday"'
                        sx={{ '& .MuiOutlinedInput-root': { color: '#111111', bgcolor: '#ffffff' }, '& .MuiInputLabel-root': { color: '#666666' } }} />

                    <TextField label="Message" value={message} onChange={e => setMessage(e.target.value)}
                        required fullWidth multiline minRows={3} size="small" placeholder="Write your message here..."
                        sx={{ '& .MuiOutlinedInput-root': { color: '#111111', bgcolor: '#ffffff' }, '& .MuiInputLabel-root': { color: '#666666' } }} />

                    {formError   && <Alert severity="error"   onClose={() => setFormError('')}>{formError}</Alert>}
                    {sendSuccess && <Alert severity="success" onClose={() => setSendSuccess('')}>{sendSuccess}</Alert>}

                    <Box>
                        <Button type="submit" variant="contained" size="large" disabled={sending || (recipientType === 'Class' && !classId)}
                            startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                            sx={{ background: '#ffffff', color: '#000000', fontWeight: 700, '&:hover': { background: '#e0e0e0' } }}>
                            {sending ? 'Sending…' : `Send to ${selectedOpt?.label}`}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            <Divider sx={{ mb: 3, borderColor: 'rgba(0,0,0,0.1)' }} />

            {/* ── Sent list ── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: '#111111', fontWeight: 700 }}>Sent Notifications</Typography>
                <Chip label={`${notifications.length} total`} size="small" sx={{ bgcolor: '#111111', color: '#ffffff' }} />
            </Box>

            {listLoading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}
            {listError   && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

            {!listLoading && !listError && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {['Title', 'Message', 'Sent To', 'Time', 'Recipients', 'Read', ''].map(h => (
                                    <TableCell key={h} sx={{ background: '#111111', color: '#ffffff', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {notifications.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#111111' }}>No notifications sent yet.</TableCell>
                                </TableRow>
                            ) : notifications.map(n => {
                                const nid = n.notificationId || n._id;
                                const rt  = n.recipientType || 'All';
                                return (
                                    <TableRow key={String(nid)} hover sx={{ '& .MuiTableCell-root': { color: '#111111', borderBottom: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#ffffff' } }}>
                                        <TableCell sx={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || '—'}</TableCell>
                                        <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</TableCell>
                                        <TableCell><Chip label={rt} size="small" sx={{ bgcolor: '#111111', color: '#ffffff', fontSize: 11 }} /></TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}</TableCell>
                                        <TableCell align="center">{n.totalRecipients ?? '—'}</TableCell>
                                        <TableCell align="center" sx={{ color: n.readCount > 0 ? '#16a34a !important' : '#111111 !important' }}>{n.readCount ?? 0}</TableCell>
                                        <TableCell>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(String(nid))}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default NotificationCenter;
