import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, Alert,
    CircularProgress, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, IconButton, Tooltip, Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';

const RECIPIENT_TYPES = ['All', 'Students', 'Teachers', 'Parents', 'Class'];

const NotificationCenter = () => {
    const currentUser = useSelector(state => state.user.currentUser);
    const schoolId = currentUser?.school || currentUser?._id;

    // Compose form state
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [recipientType, setRecipientType] = useState('All');
    const [classId, setClassId] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [formError, setFormError] = useState('');
    const [sending, setSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState('');

    // Classes list for "Class" recipient type
    const [classes, setClasses] = useState([]);

    // Sent notifications list
    const [notifications, setNotifications] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');

    const fetchClasses = () => {
        axios.get(`${process.env.REACT_APP_BASE_URL}/SclassList/${schoolId}`)
            .then(res => setClasses(Array.isArray(res.data) ? res.data : []))
            .catch(() => setClasses([]));
    };

    const fetchNotifications = () => {
        setListLoading(true);
        setListError('');
        axios.get(`${process.env.REACT_APP_BASE_URL}/Admin/notifications/sent/${schoolId}`)
            .then(res => setNotifications(Array.isArray(res.data) ? res.data : []))
            .catch(err => setListError(err.response?.data?.message || 'Failed to load notifications'))
            .finally(() => setListLoading(false));
    };

    useEffect(() => {
        if (schoolId) {
            fetchClasses();
            fetchNotifications();
        }
    }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSend = async (e) => {
        e.preventDefault();
        setFormError('');
        setSendSuccess('');

        if (!title.trim()) {
            setFormError('Title is required.');
            return;
        }
        if (!message.trim()) {
            setFormError('Message body is required.');
            return;
        }
        if (recipientType === 'Class' && !classId) {
            setFormError('Please select a class.');
            return;
        }

        setSending(true);
        try {
            const payload = {
                title: title.trim(),
                message: message.trim(),
                recipientType,
                schoolId,
                ...(recipientType === 'Class' && classId ? { classId } : {}),
                ...(scheduledAt ? { scheduledAt } : {}),
            };
            const res = await axios.post(`${process.env.REACT_APP_BASE_URL}/Admin/notifications/send`, payload);
            setSendSuccess(`Notification sent to ${res.data.count} recipient(s).`);
            setTitle('');
            setMessage('');
            setRecipientType('All');
            setClassId('');
            setScheduledAt('');
            fetchNotifications();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to send notification.');
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this notification?')) return;
        try {
            await axios.delete(`${process.env.REACT_APP_BASE_URL}/Admin/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.notificationId !== id && n._id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed.');
        }
    };

    // Parse title and recipient type from the stored message string "title: body"
    const parseNotification = (n) => {
        const raw = n.message || '';
        const colonIdx = raw.indexOf(': ');
        const parsedTitle = colonIdx !== -1 ? raw.substring(0, colonIdx) : raw;
        return { parsedTitle };
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Notification Center</Typography>

            {/* Compose Form */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" gutterBottom>Compose Notification</Typography>
                <Box component="form" onSubmit={handleSend} noValidate>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Title"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                            fullWidth
                            size="small"
                            inputProps={{ maxLength: 200 }}
                        />
                        <TextField
                            label="Message"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            required
                            fullWidth
                            multiline
                            minRows={3}
                            size="small"
                        />
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel>Recipient Type</InputLabel>
                                <Select
                                    value={recipientType}
                                    label="Recipient Type"
                                    onChange={e => { setRecipientType(e.target.value); setClassId(''); }}
                                >
                                    {RECIPIENT_TYPES.map(t => (
                                        <MenuItem key={t} value={t}>{t}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {recipientType === 'Class' && (
                                <FormControl size="small" sx={{ minWidth: 180 }}>
                                    <InputLabel>Class</InputLabel>
                                    <Select
                                        value={classId}
                                        label="Class"
                                        onChange={e => setClassId(e.target.value)}
                                    >
                                        <MenuItem value="">Select class</MenuItem>
                                        {classes.map(c => (
                                            <MenuItem key={c._id} value={c._id}>
                                                {c.sclassName || c.className}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            )}

                            <TextField
                                label="Scheduled Time (optional)"
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => setScheduledAt(e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                                sx={{ minWidth: 220 }}
                            />
                        </Box>

                        {formError && <Alert severity="error">{formError}</Alert>}
                        {sendSuccess && <Alert severity="success">{sendSuccess}</Alert>}

                        <Box>
                            <Button
                                type="submit"
                                variant="contained"
                                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                                disabled={sending}
                            >
                                {sending ? 'Sending…' : 'Send Notification'}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Paper>

            <Divider sx={{ mb: 3 }} />

            {/* Sent Notifications List */}
            <Typography variant="h6" gutterBottom>Sent Notifications</Typography>

            {listLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {listError && <Alert severity="error" sx={{ mb: 2 }}>{listError}</Alert>}

            {!listLoading && !listError && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                <TableCell><strong>Title</strong></TableCell>
                                <TableCell><strong>Message</strong></TableCell>
                                <TableCell><strong>Send Time</strong></TableCell>
                                <TableCell align="center"><strong>Recipients</strong></TableCell>
                                <TableCell align="center"><strong>Read</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {notifications.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No notifications sent yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                notifications.map(n => {
                                    const { parsedTitle } = parseNotification(n);
                                    const notifId = n.notificationId || n._id;
                                    return (
                                        <TableRow key={notifId} hover>
                                            <TableCell sx={{ fontWeight: 500 }}>{parsedTitle}</TableCell>
                                            <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {n.message}
                                            </TableCell>
                                            <TableCell>
                                                {n.createdAt ? new Date(n.createdAt).toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell align="center">{n.totalRecipients ?? '—'}</TableCell>
                                            <TableCell align="center">{n.readCount ?? 0}</TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Delete notification">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleDelete(notifId)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default NotificationCenter;
