import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Typography, Paper, TextField, Button, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Alert,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import SendIcon      from '@mui/icons-material/Send';
import { addStuff } from '../../../redux/userRelated/userHandle';
import { underControl } from '../../../redux/userRelated/userSlice';


const TARGET_TYPES = [
    { value: 'all',     label: 'Everyone' },
    { value: 'class',   label: 'Specific Class' },
    { value: 'teacher', label: 'Specific Teacher' },
    { value: 'student', label: 'Specific Student' },
    { value: 'parent',  label: 'Specific Parent' },
];

const AUDIENCE_MAP = {
    all:     'all',
    class:   'students',
    teacher: 'teachers',
    student: 'students',
    parent:  'parents',
};

const AddNotice = () => {
    const dispatch  = useDispatch();
    const navigate  = useNavigate();
    const { status, response, error } = useSelector(s => s.user);
    const { currentUser } = useSelector(s => s.user);

    const [title,      setTitle]      = useState('');
    const [details,    setDetails]    = useState('');
    const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
    const [targetType, setTargetType] = useState('all');
    const [targetId,   setTargetId]   = useState('');
    const [targets,    setTargets]    = useState([]); // list for dropdown
    const [attachFiles, setAttachFiles] = useState(null); // FileList
    const [loader,     setLoader]     = useState(false);
    const [formError,  setFormError]  = useState('');

    const adminID = currentUser._id;

    // Load target options when targetType changes
    useEffect(() => {
        setTargetId('');
        setTargets([]);
        if (targetType === 'all') return;

        const endpoints = {
            class:   `/SclassList/${adminID}`,
            teacher: `/Teachers/${adminID}`,
            student: `/Students/${adminID}`,
            parent:  `/Parents/${adminID}`,
        };

        const ep = endpoints[targetType];
        if (!ep) return;

        axiosInstance.get(`${BASE}${ep}`)
            .then(({ data }) => {
                const list = Array.isArray(data) ? data : [];
                setTargets(list);
            })
            .catch(() => setTargets([]));
    }, [targetType, adminID, BASE]);

    const getTargetLabel = (item) => {
        if (targetType === 'class')   return item.className || item.sclassName || item._id;
        if (targetType === 'teacher') return item.name || item._id;
        if (targetType === 'student') return `${item.name} (Roll: ${item.rollNum})`;
        if (targetType === 'parent')  return item.name || item.email || item._id;
        return item._id;
    };

    const submitHandler = (e) => {
        e.preventDefault();
        if (!title.trim() || !details.trim()) {
            setFormError('Title and message are required.');
            return;
        }
        if (targetType !== 'all' && !targetId) {
            setFormError('Please select a target.');
            return;
        }
        setFormError('');
        setLoader(true);

        // Use FormData so we can attach files
        const formData = new FormData();
        formData.append('title',      title);
        formData.append('details',    details);
        formData.append('date',       date);
        formData.append('adminID',    adminID);
        formData.append('audience',   AUDIENCE_MAP[targetType] || 'all');
        formData.append('targetType', targetType);
        if (targetType !== 'all' && targetId) formData.append('targetId', targetId);
        if (attachFiles) {
            Array.from(attachFiles).forEach(f => formData.append('attachments', f));
        }

        axiosInstance.post(`${process.env.REACT_APP_BASE_URL}/NoticeCreate`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
            .then(() => { navigate('/Admin/notices'); })
            .catch(() => { setFormError('Failed to create notice.'); setLoader(false); });
    };

    useEffect(() => {
        if (status === 'added') {
            navigate('/Admin/notices');
            dispatch(underControl());
        } else if (status === 'error') {
            setFormError('Network error. Please try again.');
            setLoader(false);
        } else if (status === 'failed') {
            setFormError(response || 'Failed to create notice.');
            setLoader(false);
        }
    }, [status, navigate, error, response, dispatch]);

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 640, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <CampaignIcon sx={{ color: '#0ea5e9', fontSize: '1.6rem' }} />
                <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.4rem' }}>
                    Create Notice
                </Typography>
            </Box>

            {formError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>{formError}</Alert>}

            <Paper component="form" onSubmit={submitHandler}
                sx={{ bgcolor: '#1e293b', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 3, p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                <TextField label="Title" required fullWidth value={title} onChange={e => setTitle(e.target.value)}
                    sx={fieldSx} InputLabelProps={{ sx: { color: 'rgba(148,163,184,0.6)' } }} />

                <TextField label="Message" required fullWidth multiline rows={4} value={details} onChange={e => setDetails(e.target.value)}
                    sx={fieldSx} InputLabelProps={{ sx: { color: 'rgba(148,163,184,0.6)' } }} />

                <TextField label="Date" type="date" required fullWidth value={date} onChange={e => setDate(e.target.value)}
                    InputLabelProps={{ shrink: true, sx: { color: 'rgba(148,163,184,0.6)' } }} sx={fieldSx} />

                {/* Target type */}
                <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: 'rgba(148,163,184,0.6)' }}>Send To</InputLabel>
                    <Select value={targetType} label="Send To" onChange={e => setTargetType(e.target.value)}
                        sx={{ color: '#f1f5f9', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(14,165,233,0.25)' } }}>
                        {TARGET_TYPES.map(t => (
                            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Target selection — shown when not "all" */}
                {targetType !== 'all' && (
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ color: 'rgba(148,163,184,0.6)' }}>
                            Select {TARGET_TYPES.find(t => t.value === targetType)?.label}
                        </InputLabel>
                        <Select value={targetId} label={`Select ${targetType}`} onChange={e => setTargetId(e.target.value)}
                            sx={{ color: '#f1f5f9', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(14,165,233,0.25)' } }}>
                            {targets.length === 0
                                ? <MenuItem disabled value="">Loading…</MenuItem>
                                : targets.map(t => (
                                    <MenuItem key={t._id} value={t._id}>{getTargetLabel(t)}</MenuItem>
                                ))
                            }
                        </Select>
                    </FormControl>
                )}

                {/* Attachments */}
                <Box
                    onClick={() => document.getElementById('notice-attach-input').click()}
                    sx={{
                        border: `2px dashed ${attachFiles ? 'rgba(14,165,233,0.6)' : 'rgba(14,165,233,0.2)'}`,
                        borderRadius: 2, p: 2, textAlign: 'center', cursor: 'pointer',
                        '&:hover': { borderColor: 'rgba(14,165,233,0.5)', bgcolor: 'rgba(14,165,233,0.04)' },
                    }}
                >
                    <Typography sx={{ color: attachFiles ? '#0ea5e9' : 'rgba(148,163,184,0.5)', fontSize: '0.82rem' }}>
                        {attachFiles
                            ? `${attachFiles.length} file${attachFiles.length > 1 ? 's' : ''} selected`
                            : 'Attach files (optional) — PDF, DOC, DOCX, JPG, PNG'}
                    </Typography>
                    <input id="notice-attach-input" type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        hidden onChange={e => setAttachFiles(e.target.files.length ? e.target.files : null)} />
                </Box>

                <Button type="submit" variant="contained" size="large" disabled={loader}
                    startIcon={loader ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                    sx={{
                        bgcolor: '#0ea5e9', color: '#fff', borderRadius: 2.5,
                        textTransform: 'none', fontWeight: 700,
                        boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
                        '&:hover': { bgcolor: '#0284c7' },
                        alignSelf: 'flex-end', px: 4,
                    }}>
                    {loader ? 'Sending…' : 'Send Notice'}
                </Button>
            </Paper>
        </Box>
    );
};

const fieldSx = {
    '& .MuiOutlinedInput-root': {
        color: '#f1f5f9',
        '& fieldset': { borderColor: 'rgba(14,165,233,0.25)' },
        '&:hover fieldset': { borderColor: 'rgba(14,165,233,0.5)' },
        '&.Mui-focused fieldset': { borderColor: '#0ea5e9' },
    },
};

export default AddNotice;
