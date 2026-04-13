import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import {
    Container, Typography, Box, Button, Paper, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, MenuItem, Select, FormControl,
    InputLabel, IconButton, Chip, CircularProgress, Alert, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIcon from '@mui/icons-material/Assignment';
import VisibilityIcon from '@mui/icons-material/Visibility';

const EMPTY_FORM = { title: '', topic: '', description: '', dueDate: '', subjectId: '', classId: '' };

const TeacherAssignments = () => {
    const { currentUser } = useSelector(s => s.user);
    const schoolId = currentUser.school?._id || currentUser.schoolId || currentUser.school;
    const navigate = useNavigate();

    const [subjects, setSubjects]       = useState([]);
    const [classes, setClasses]         = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState('');
    const [success, setSuccess]         = useState('');
    const [open, setOpen]               = useState(false);
    const [form, setForm]               = useState(EMPTY_FORM);
    const [file, setFile]               = useState(null);
    const [saving, setSaving]           = useState(false);

    // Fetch populated teacher data to get subject/class names
    useEffect(() => {
        if (!currentUser._id) return;
        axiosInstance.get(`/Teacher/${currentUser._id}`)
            .then(({ data }) => {
                const subs = data.teachSubjects?.length
                    ? data.teachSubjects
                    : data.teachSubject ? [data.teachSubject] : [];
                const cls = data.teachClasses?.length
                    ? data.teachClasses
                    : data.teachSclass ? [data.teachSclass] : [];
                setSubjects(subs.filter(Boolean));
                setClasses(cls.filter(Boolean));
            })
            .catch(() => {
                const rawSubs = currentUser.teachSubjects || (currentUser.teachSubject ? [currentUser.teachSubject] : []);
                const rawCls  = currentUser.teachClasses  || (currentUser.teachSclass  ? [currentUser.teachSclass]  : []);
                setSubjects(rawSubs);
                setClasses(rawCls);
            });
    }, [currentUser._id]);

    const fetchAssignments = useCallback(async () => {
        if (!currentUser._id) return;
        setLoading(true);
        try {
            const { data } = await axiosInstance.get(`/AssignmentsByTeacher/${currentUser._id}`);
            setAssignments(Array.isArray(data) ? data : []);
        } catch {
            setError('Failed to load assignments');
        } finally { setLoading(false); }
    }, [currentUser._id]);

    useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

    const handleOpen = () => {
        setForm({ ...EMPTY_FORM, subjectId: subjects[0]?._id || '', classId: classes[0]?._id || '' });
        setFile(null);
        setOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.title || !form.topic || !form.dueDate || !form.subjectId || !form.classId)
            return setError('Title, topic, due date, subject and class are required');
        setSaving(true); setError('');
        try {
            const fd = new FormData();
            fd.append('title',      form.title);
            fd.append('topic',      form.topic);
            fd.append('description',form.description);
            fd.append('dueDate',    form.dueDate);
            fd.append('subject',    form.subjectId);
            fd.append('sclassName', form.classId);
            fd.append('school',     schoolId);
            fd.append('createdBy',  currentUser._id);
            if (file) fd.append('file', file);
            await axiosInstance.post(`/AssignmentCreate`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setSuccess('Assignment published');
            setOpen(false);
            fetchAssignments();
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to create assignment');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this assignment?')) return;
        try {
            await axiosInstance.delete(`/Assignment/${id}`);
            setSuccess('Assignment deleted');
            setAssignments(prev => prev.filter(a => a._id !== id));
        } catch { setError('Delete failed'); }
    };

    const subjectLabel = s => s?.subName || s?.subjectName || String(s);
    const classLabel   = c => c?.sclassName || c?.className || String(c);
    const subjectName  = a => a.subject?.subName || a.subject?.subjectName || '—';

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6, bgcolor: '#ffffff', minHeight: '100vh', pt: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon sx={{ color: '#0ea5e9' }} />
                    <Typography variant="h5" sx={{ color: '#f1f5f9' }}>Assignments</Typography>
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}
                    sx={{ bgcolor: '#0ea5e9', '&:hover': { bgcolor: '#0284c7' } }}>
                    Create Assignment
                </Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress sx={{ color: '#0ea5e9' }} /></Box>
            ) : (
                <TableContainer component={Paper} sx={{ bgcolor: '#000000' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#000000' }}>
                            <TableRow>
                                {['Title', 'Subject', 'Topic', 'Submissions', 'Due Date', 'Actions'].map(h => (
                                    <TableCell key={h} sx={{ color: '#94a3b8', fontWeight: 'bold' }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {assignments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#64748b', bgcolor: '#000000' }}>
                                        No assignments yet. Click "Create Assignment" to get started.
                                    </TableCell>
                                </TableRow>
                            ) : assignments.map(a => (
                                <TableRow key={a._id} hover sx={{ '&:hover': { bgcolor: '#000000' } }}>
                                    <TableCell sx={{ color: '#f1f5f9' }}>{a.title}</TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>{subjectName(a)}</TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>{a.topic}</TableCell>
                                    <TableCell sx={{ color: '#cbd5e1' }}>
                                        {a.submissionCount ?? 0} / {a.totalStudents ?? 0}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={new Date(a.dueDate).toLocaleDateString()}
                                            size="small"
                                            color={new Date(a.dueDate) < new Date() ? 'error' : 'default'}
                                            sx={new Date(a.dueDate) >= new Date() ? { bgcolor: '#0ea5e9', color: '#fff' } : {}}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title="View Submissions">
                                            <IconButton size="small" sx={{ color: '#0ea5e9' }}
                                                onClick={() => navigate(`/Teacher/assignments/${a._id}`)}>
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(a._id)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Assignment</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Title" value={form.title} required fullWidth
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    <TextField label="Topic" value={form.topic} required fullWidth
                        onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
                    <TextField label="Description" value={form.description} fullWidth multiline rows={2}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    <TextField label="Due Date" type="date" value={form.dueDate} required fullWidth
                        InputLabelProps={{ shrink: true }}
                        onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                    <FormControl fullWidth required>
                        <InputLabel>Subject</InputLabel>
                        <Select value={form.subjectId} label="Subject"
                            onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}>
                            {subjects.map(s => (
                                <MenuItem key={s._id || s} value={s._id || s}>
                                    {subjectLabel(s)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth required>
                        <InputLabel>Class</InputLabel>
                        <Select value={form.classId} label="Class"
                            onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}>
                            {classes.map(c => (
                                <MenuItem key={c._id || c} value={c._id || c}>
                                    {classLabel(c)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Button variant="outlined" component="label">
                        {file ? file.name : 'Attach File (optional)'}
                        <input type="file" hidden onChange={e => setFile(e.target.files[0])} />
                    </Button>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                        {saving ? <CircularProgress size={20} /> : 'Publish'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default TeacherAssignments;
