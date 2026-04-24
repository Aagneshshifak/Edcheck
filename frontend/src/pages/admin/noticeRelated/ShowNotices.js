import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Typography, Paper, TextField, Button, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Alert, Table,
    TableHead, TableBody, TableRow, TableCell, TableContainer,
    IconButton, Chip, Divider, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import CampaignIcon from '@mui/icons-material/Campaign';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getAllNotices } from '../../../redux/noticeRelated/noticeHandle';
import { deleteUser } from '../../../redux/userRelated/userHandle';

const TARGET_TYPES = [
    { value: 'all',     label: 'Everyone' },
    { value: 'class',   label: 'Specific Class' },
    { value: 'teacher', label: 'Specific Teacher' },
    { value: 'student', label: 'Specific Student' },
    { value: 'parent',  label: 'Specific Parent' },
];

const AUDIENCE_MAP = {
    all: 'all', class: 'students', teacher: 'teachers', student: 'students', parent: 'parents',
};

const ShowNotices = () => {
    const dispatch = useDispatch();
    const { noticesList, loading } = useSelector(s => s.notice);
    const { currentUser } = useSelector(s => s.user);
    const adminID = currentUser._id;

    // ── Create form state ──────────────────────────────────────────────────────
    const [formOpen,    setFormOpen]    = useState(false);
    const [title,       setTitle]       = useState('');
    const [details,     setDetails]     = useState('');
    const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
    const [targetType,  setTargetType]  = useState('all');
    const [targetId,    setTargetId]    = useState('');
    const [targets,     setTargets]     = useState([]);
    const [attachFiles, setAttachFiles] = useState(null);
    const [sending,     setSending]     = useState(false);
    const [formError,   setFormError]   = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    useEffect(() => { dispatch(getAllNotices(adminID, 'Notice')); }, [adminID, dispatch]);

    // Load target options
    useEffect(() => {
        setTargetId(''); setTargets([]);
        if (targetType === 'all') return;
        const eps = { class: `/SclassList/${adminID}`, teacher: `/Teachers/${adminID}`, student: `/Students/${adminID}`, parent: `/Parents/${adminID}` };
        axiosInstance.get(eps[targetType]).then(({ data }) => setTargets(Array.isArray(data) ? data : [])).catch(() => setTargets([]));
    }, [targetType, adminID]);

    const getTargetLabel = (item) => {
        if (targetType === 'class')   return item.className || item.sclassName || item._id;
        if (targetType === 'teacher') return item.name || item._id;
        if (targetType === 'student') return `${item.name} (Roll: ${item.rollNum})`;
        if (targetType === 'parent')  return item.name || item.email || item._id;
        return item._id;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !details.trim()) { setFormError('Title and message are required.'); return; }
        if (targetType !== 'all' && !targetId) { setFormError('Please select a target.'); return; }
        setFormError(''); setSending(true);
        const fd = new FormData();
        fd.append('title', title); fd.append('details', details); fd.append('date', date);
        fd.append('adminID', adminID); fd.append('audience', AUDIENCE_MAP[targetType] || 'all');
        fd.append('targetType', targetType);
        if (targetType !== 'all' && targetId) fd.append('targetId', targetId);
        if (attachFiles) Array.from(attachFiles).forEach(f => fd.append('attachments', f));
        try {
            await axiosInstance.post('/NoticeCreate', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setFormSuccess('Notice sent!');
            setTitle(''); setDetails(''); setTargetType('all'); setTargetId(''); setAttachFiles(null);
            setFormOpen(false);
            dispatch(getAllNotices(adminID, 'Notice'));
        } catch { setFormError('Failed to send notice.'); }
        finally { setSending(false); }
    };

    const handleDelete = (id, address) => {
        dispatch(deleteUser(id, address)).then(() => dispatch(getAllNotices(adminID, 'Notice')));
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#111111' }}>
                    <CampaignIcon /> Notices
                </Typography>
                <Button
                    variant="contained"
                    startIcon={formOpen ? <ExpandLessIcon /> : <AddIcon />}
                    onClick={() => { setFormOpen(o => !o); setFormError(''); setFormSuccess(''); }}
                >
                    {formOpen ? 'Cancel' : 'Create Notice'}
                </Button>
            </Box>

            {formSuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setFormSuccess('')}>{formSuccess}</Alert>}

            {/* ── Inline Create Form ── */}
            <Collapse in={formOpen}>
                <Paper component="form" onSubmit={handleSubmit}
                    sx={{ mb: 3, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700 }}>New Notice</Typography>
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

                    {formError && <Alert severity="error" onClose={() => setFormError('')}>{formError}</Alert>}

                    <TextField label="Title" required fullWidth value={title}
                        onChange={e => setTitle(e.target.value)} size="small" />

                    <TextField label="Message" required fullWidth multiline rows={3} value={details}
                        onChange={e => setDetails(e.target.value)} />

                    <TextField label="Date" type="date" required fullWidth value={date}
                        onChange={e => setDate(e.target.value)}
                        InputLabelProps={{ shrink: true }} size="small" />

                    <FormControl fullWidth size="small">
                        <InputLabel>Send To</InputLabel>
                        <Select value={targetType} label="Send To" onChange={e => setTargetType(e.target.value)}>
                            {TARGET_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                        </Select>
                    </FormControl>

                    {targetType !== 'all' && (
                        <FormControl fullWidth size="small">
                            <InputLabel>Select {TARGET_TYPES.find(t => t.value === targetType)?.label}</InputLabel>
                            <Select value={targetId} label={`Select ${targetType}`} onChange={e => setTargetId(e.target.value)}>
                                {targets.length === 0
                                    ? <MenuItem disabled value="">Loading…</MenuItem>
                                    : targets.map(t => <MenuItem key={t._id} value={t._id}>{getTargetLabel(t)}</MenuItem>)
                                }
                            </Select>
                        </FormControl>
                    )}

                    <Box
                        onClick={() => document.getElementById('notice-attach').click()}
                        sx={{
                            border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 2, p: 1.5,
                            textAlign: 'center', cursor: 'pointer',
                            '&:hover': { borderColor: 'rgba(255,255,255,0.4)' },
                        }}
                    >
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                            {attachFiles ? `${attachFiles.length} file(s) selected` : 'Attach files (optional)'}
                        </Typography>
                        <input id="notice-attach" type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            hidden onChange={e => setAttachFiles(e.target.files.length ? e.target.files : null)} />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Button type="submit" variant="contained" size="large" disabled={sending}
                            startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                            sx={{ px: 5, borderRadius: 2 }}>
                            {sending ? 'Sending…' : 'Send Notice'}
                        </Button>
                    </Box>
                </Paper>
            </Collapse>

            {/* ── Notices List ── */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : !noticesList?.length ? (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography sx={{ color: '#666666', mb: 2 }}>No notices yet.</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
                        Create First Notice
                    </Button>
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {['Title', 'Details', 'Date', ''].map(h => (
                                    <TableCell key={h} sx={{ background: '#111111', color: '#ffffff', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase' }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {noticesList.map(n => {
                                const d = new Date(n.date);
                                const ds = d.toString() !== 'Invalid Date' ? d.toISOString().slice(0, 10) : '—';
                                return (
                                    <TableRow key={n._id} hover sx={{ '& .MuiTableCell-root': { color: '#111111', borderBottom: '1px solid rgba(0,0,0,0.06)' } }}>
                                        <TableCell sx={{ fontWeight: 600 }}>{n.title}</TableCell>
                                        <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.details}</TableCell>
                                        <TableCell><Chip label={ds} size="small" /></TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(n._id, 'Notice')}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default ShowNotices;
