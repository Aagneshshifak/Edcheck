import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, Alert,
    CircularProgress, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Tooltip, Divider, Chip,
    ToggleButtonGroup, ToggleButton, Badge,
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
    { value: 'All',      label: 'Whole School', icon: <SchoolIcon />,          color: '#1976d2' },
    { value: 'Students', label: 'Students',      icon: <GroupsIcon />,          color: '#2e7d32' },
    { value: 'Teachers', label: 'Teachers',      icon: <PersonIcon />,          color: '#7b1fa2' },
    { value: 'Parents',  label: 'Parents',       icon: <FamilyRestroomIcon />,  color: '#e65100' },
    { value: 'Class',    label: 'Specific Class', icon: <PeopleIcon />,         color: '#0288d1' },
];

const RECIPIENT_COLORS = Object.fromEntries(RECIPIENT_OPTIONS.map(r => [r.value, r.color]));

const NotificationCenter = () => {
    const currentUser = useSelector(s => s.user.currentUser);
    const schoolId = currentUser?.school || currentUser?._id;

    // Compose state
    const [title, setTitle]               = useState('');
    const [message, setMessage]           = useState('');
    const [recipientType, setRecipientType] = useState('All');
    const [classId, setClassId]           = useState('');
    const [formError, setFormError]       = useState('');
    const [sending, setSending]           = useState(false);
    const [sendSuccess, setSendSuccess]   = useState('');

    // Recipient preview
    const [previewCount, setPreviewCount] = useState(null);
    const [previewing, setPreviewing]     = useState(false);

    // Data
    const [classes, setClasses]           = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [listLoading, setListLoading]   = useState(true);
    const [listError, setListError]       = useState('');

    const fetchClasses = useCallback(() => {
        axiosInstance.get(`/SclassList/${schoolId}`)
            .then(res => setClasses(Array.isArray(res.data) ? res.data : []))
            .catch(() => setClasses([]));
    }, [schoolId]);

    const fetchNotifications = useCallback(() => {
        setListLoading(true); setListError('');
        axiosInstance.get(`/Admin/notifications/sent/${schoolId}`)
            .then(res => setNotifications(Array.isArray(res.data) ? res.data : []))
            .catch(err => setListError(err.response?.data?.message || 'Failed to load notifications'))
            .finally(() => setListLoading(false));
    }, [schoolId]);

    useEffect(() => {
        if (schoolId) { fetchClasses(); fetchNotifications(); }
    }, [fetchClasses, fetchNotifications, schoolId]);

    // Auto-preview recipient count when type/class changes
    useEffect(() => {
        if (!schoolId) return;
        if (recipientType === 'Class' && !classId) { setPreviewCount(null); return; }
        setPreviewing(true);
        const params = { recipientType, schoolId };
        if (classId) params.classId = classId;
        axiosInstance.get(`/Admin/notifications/preview`, { params })
            .then(res => setPreviewCount(res.data.count))
            .catch(() => setPreviewCount(null))
            .finally(() => setPreviewing(false));
    }, [recipientType, classId, schoolId]);

    const handleSend = async (e) => {
        e.preventDefault();
        setFormError(''); setSendSuccess('');
        if (!title.trim())   return setFormError('Title is required.');
        if (!message.trim()) return setFormError('Message body is required.');
        if (recipientType === 'Class' && !classId) return setFormError('Please select a class.');

        setSending(true);
        try {
            const payload = { title: title.trim(), message: message.trim(), recipientType, schoolId };
            if (classId) payload.classId = classId;
            const res = await axiosInstance.post(`/Admin/notifications/send`, payload);
            setSendSuccess(`Sent to ${res.data.count} recipient(s).`);
            setTitle(''); setMessage(''); setRecipientType('All'); setClassId('');
            fetchNotifications();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to send notification.');
        } finally { setSending(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this notification for all recipients?')) return;
        try {
            await axiosInstance.delete(`/Admin/notifications/${id}`);
            setNotifications(prev => prev.filter(n => (n.notificationId || n._id) !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    const selectedOption = RECIPIENT_OPTIONS.find(r => r.value === recipientType);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <NotificationsIcon color="primary" />
                <Typography variant="h4">Notification Control Panel</Typography>
            </Box>

            {/* ── Compose ── */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom>Compose & Send</Typography>
                <Box component="form" onSubmit={handleSend} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                    {/* Recipient type selector */}
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Send to:</Typography>
                        <ToggleButtonGroup
                            value={recipientType}
                            exclusive
                            onChange={(_, v) => { if (v) { setRecipientType(v); setClassId(''); } }}
                            sx={{ flexWrap: 'wrap', gap: 1 }}
                        >
                            {RECIPIENT_OPTIONS.map(opt => (
                                <ToggleButton
                                    key={opt.value}
                                    value={opt.value}
                                    sx={{
                                        display: 'flex', gap: 0.5, px: 2,
                                        '&.Mui-selected': { bgcolor: opt.color, color: '#fff', '&:hover': { bgcolor: opt.color } }
                                    }}
                                >
                                    {opt.icon}
                                    {opt.label}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>

                    {/* Class selector (only for Class type) */}
                    {recipientType === 'Class' && (
                        <FormControl size="small" sx={{ maxWidth: 280 }}>
                            <InputLabel>Select Class</InputLabel>
                            <Select value={classId} label="Select Class" onChange={e => setClassId(e.target.value)}>
                                <MenuItem value="">Choose a class</MenuItem>
                                {classes.map(c => (
                                    <MenuItem key={c._id} value={c._id}>{c.sclassName || c.className}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {/* Recipient count preview */}
                    {(previewCount !== null || previewing) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {previewing
                                ? <CircularProgress size={16} />
                                : <Chip
                                    icon={<PeopleIcon />}
                                    label={`${previewCount} recipient${previewCount !== 1 ? 's' : ''} will receive this`}
                                    size="small"
                                    sx={{ bgcolor: selectedOption?.color, color: '#fff' }}
                                  />
                            }
                        </Box>
                    )}

                    <TextField
                        label="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required fullWidth size="small"
                        inputProps={{ maxLength: 200 }}
                        placeholder='e.g. "Math test scheduled on Friday"'
                    />
                    <TextField
                        label="Message"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        required fullWidth multiline minRows={3} size="small"
                        placeholder="Write your message here..."
                    />

                    {formError  && <Alert severity="error"   onClose={() => setFormError('')}>{formError}</Alert>}
                    {sendSuccess && <Alert severity="success" onClose={() => setSendSuccess('')}>{sendSuccess}</Alert>}

                    <Box>
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                            disabled={sending || (recipientType === 'Class' && !classId)}
                            sx={{ bgcolor: selectedOption?.color, '&:hover': { bgcolor: selectedOption?.color, filter: 'brightness(0.9)' } }}
                        >
                            {sending ? 'Sending...' : `Send to ${selectedOption?.label}`}
                        </Button>
                    </Box>
                </Box>
            </Paper>

            <Divider sx={{ mb: 3 }} />

            {/* ── Sent list ── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Sent Notifications</Typography>
                <Chip label={`${notifications.length} total`} size="small" />
            </Box>

            {listLoading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}
            {listError   && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

            {!listLoading && !listError && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Title', 'Message', 'Sent To', 'Time', 'Recipients', 'Read', ''].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {notifications.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No notifications sent yet.
                                    </TableCell>
                                </TableRow>
                            ) : notifications.map(n => {
                                const notifId = n.notificationId || n._id;
                                const rt = n.recipientType || 'All';
                                return (
                                    <TableRow key={String(notifId)} hover>
                                        <TableCell sx={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {n.title || n.message?.split(':')[0] || '—'}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                            {n.message}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={rt}
                                                size="small"
                                                sx={{ bgcolor: RECIPIENT_COLORS[rt] || '#9e9e9e', color: '#fff', fontSize: 11 }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                                            {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                                        </TableCell>
                                        <TableCell align="center">{n.totalRecipients ?? '—'}</TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" color={n.readCount > 0 ? 'success.main' : 'text.secondary'}>
                                                {n.readCount ?? 0}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Delete for all recipients">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(String(notifId))}>
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
