import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, TableContainer, IconButton, Chip, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    TextField, CircularProgress, Alert, Collapse, List, ListItem,
    ListItemText, ListItemSecondaryAction, MenuItem, Select,
    FormControl, InputLabel, Divider,
} from '@mui/material';
import AddIcon        from '@mui/icons-material/Add';
import EditIcon       from '@mui/icons-material/Edit';
import DeleteIcon     from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TopicIcon      from '@mui/icons-material/Topic';
import PersonIcon     from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ClassIcon      from '@mui/icons-material/Class';


const EMPTY_FORM = { subName: '', subCode: '', sessions: 30, classId: '', teacherId: '', topics: [] };

const SubjectManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classes,  setClasses]  = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');
    const [success,  setSuccess]  = useState('');
    const [expanded, setExpanded] = useState(null);

    // Add subject dialog
    const [addOpen,   setAddOpen]   = useState(false);
    const [addForm,   setAddForm]   = useState(EMPTY_FORM);
    const [topicDraft, setTopicDraft] = useState('');
    const [saving,    setSaving]    = useState(false);

    // Edit topics dialog
    const [topicsOpen,    setTopicsOpen]    = useState(false);
    const [topicsSubject, setTopicsSubject] = useState(null);
    const [editTopics,    setEditTopics]    = useState([]);
    const [topicInput,    setTopicInput]    = useState('');
    const [savingTopics,  setSavingTopics]  = useState(false);

    // Assign teacher dialog
    const [teacherOpen,    setTeacherOpen]    = useState(false);
    const [teacherSubject, setTeacherSubject] = useState(null);
    const [selTeacher,     setSelTeacher]     = useState('');
    const [savingTeacher,  setSavingTeacher]  = useState(false);

    // Assign class dialog
    const [classOpen,    setClassOpen]    = useState(false);
    const [classSubject, setClassSubject] = useState(null);
    const [selClass,     setSelClass]     = useState('');
    const [savingClass,  setSavingClass]  = useState(false);

    const fetchAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            axiosInstance.get(`/Admin/subjects/detail/${schoolId}`),
            axiosInstance.get(`/Teachers/${schoolId}`),
            axiosInstance.get(`/SclassList/${schoolId}`),
        ]).then(([s, t, c]) => {
            setSubjects(Array.isArray(s.data) ? s.data : []);
            setTeachers(Array.isArray(t.data) ? t.data : []);
            setClasses(Array.isArray(c.data) ? c.data : []);
        }).catch(() => setError('Failed to load data'))
          .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Add subject ──────────────────────────────────────────────────────────
    const openAdd = () => { setAddForm(EMPTY_FORM); setTopicDraft(''); setAddOpen(true); };

    const addTopicToForm = () => {
        const t = topicDraft.trim();
        if (t && !addForm.topics.includes(t)) setAddForm(f => ({ ...f, topics: [...f.topics, t] }));
        setTopicDraft('');
    };

    const handleAdd = async () => {
        if (!addForm.subName) return setError('Subject name is required');
        setSaving(true); setError('');
        try {
            await axiosInstance.post(`/Admin/subjects/add`, { ...addForm, schoolId });
            setSuccess('Subject added');
            setAddOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    // ── Delete subject ───────────────────────────────────────────────────────
    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete subject "${name}"?`)) return;
        try {
            await axiosInstance.delete(`/Admin/subjects/${id}`);
            setSuccess('Subject deleted');
            fetchAll();
        } catch (e) { setError(e.response?.data?.message || 'Delete failed'); }
    };

    // ── Edit topics ──────────────────────────────────────────────────────────
    const openTopics = (s) => {
        setTopicsSubject(s);
        setEditTopics([...(s.topics || [])]);
        setTopicInput('');
        setTopicsOpen(true);
    };

    const saveTopics = async () => {
        setSavingTopics(true);
        try {
            await axiosInstance.put(`/Admin/subjects/${topicsSubject._id}/topics`, { topics: editTopics });
            setSuccess('Topics saved');
            setTopicsOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSavingTopics(false); }
    };

    // ── Assign teacher ───────────────────────────────────────────────────────
    const openTeacher = (s) => {
        setTeacherSubject(s);
        setSelTeacher(String(s.teacherId?._id || s.teacherId || ''));
        setTeacherOpen(true);
    };

    const saveTeacher = async () => {
        setSavingTeacher(true);
        try {
            await axiosInstance.put(`/Admin/subjects/${teacherSubject._id}/teacher`, { teacherId: selTeacher || null });
            setSuccess('Teacher assigned');
            setTeacherOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSavingTeacher(false); }
    };

    // ── Assign class ─────────────────────────────────────────────────────────
    const openClass = (s) => {
        setClassSubject(s);
        setSelClass(String(s.classId?._id || s.classId || ''));
        setClassOpen(true);
    };

    const saveClass = async () => {
        setSavingClass(true);
        try {
            if (selClass) {
                await axiosInstance.post(`/Admin/subjects/${classSubject._id}/assign-class`, { classId: selClass });
            } else {
                await axiosInstance.delete(`/Admin/subjects/${classSubject._id}/assign-class`);
            }
            setSuccess('Class assignment updated');
            setClassOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSavingClass(false); }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h4">
                    <TopicIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Subject Management
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Subject</Button>
            </Box>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Add subjects with topics, assign a handling teacher per class.
            </Typography>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {loading ? <CircularProgress /> : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Subject', 'Class', 'Handling Teacher', 'Topics', 'Assignments', 'Actions'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {subjects.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center">No subjects found. Add one above.</TableCell></TableRow>
                            ) : subjects.map(s => (
                                <React.Fragment key={s._id}>
                                    <TableRow hover>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <strong>{s.subName || s.subjectName}</strong>
                                                {s.subCode && <Chip label={s.subCode} size="small" variant="outlined" />}
                                            </Box>
                                        </TableCell>
                                        <TableCell>{s.classId?.sclassName || '—'}</TableCell>
                                        <TableCell>
                                            {s.teacherId
                                                ? <Chip icon={<PersonIcon />} label={s.teacherId.name} size="small" color="primary" variant="outlined" />
                                                : <Chip label="Unassigned" size="small" color="warning" />
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Chip
                                                    label={`${(s.topics || []).length} topics`}
                                                    size="small"
                                                    color={(s.topics || []).length > 0 ? 'info' : 'default'}
                                                    variant="outlined"
                                                />
                                                {(s.topics || []).length > 0 && (
                                                    <IconButton size="small" onClick={() => setExpanded(expanded === s._id ? null : s._id)}>
                                                        {expanded === s._id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip icon={<AssignmentIcon />} label={s.assignmentCount || 0} size="small" />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Edit Topics">
                                                <IconButton size="small" onClick={() => openTopics(s)}><EditIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Assign Handling Teacher">
                                                <IconButton size="small" color="primary" onClick={() => openTeacher(s)}><PersonIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Assign to Class">
                                                <IconButton size="small" color="secondary" onClick={() => openClass(s)}><ClassIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete Subject">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(s._id, s.subName)}><DeleteIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                                            <Collapse in={expanded === s._id} timeout="auto" unmountOnExit>
                                                <Box sx={{
                                                    mx: 2, my: 1.5, p: 2,
                                                    borderRadius: 2,
                                                    background: 'linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(99,102,241,0.06) 100%)',
                                                    border: '1px solid rgba(14,165,233,0.15)',
                                                }}>
                                                    <Typography variant="caption" fontWeight={600} color="primary" sx={{ mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                        Topics — {s.subName}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                                        {(s.topics || []).map((t, i) => (
                                                            <Chip
                                                                key={i} label={t} size="small"
                                                                sx={{
                                                                    bgcolor: 'rgba(14,165,233,0.1)',
                                                                    color: '#0ea5e9',
                                                                    border: '1px solid rgba(14,165,233,0.3)',
                                                                    fontWeight: 500,
                                                                    '&:hover': { bgcolor: 'rgba(14,165,233,0.18)' },
                                                                }}
                                                            />
                                                        ))}
                                                    </Box>
                                                </Box>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* ── Add Subject Dialog ── */}
            <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Subject</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Subject Name" value={addForm.subName} required fullWidth
                        onChange={e => setAddForm(f => ({ ...f, subName: e.target.value }))} />
                    <TextField label="Subject Code (e.g. MATH)" value={addForm.subCode} fullWidth
                        onChange={e => setAddForm(f => ({ ...f, subCode: e.target.value }))} />
                    <TextField label="Sessions" type="number" value={addForm.sessions} fullWidth
                        onChange={e => setAddForm(f => ({ ...f, sessions: Number(e.target.value) }))} />
                    <FormControl fullWidth>
                        <InputLabel>Class (optional)</InputLabel>
                        <Select value={addForm.classId} label="Class (optional)"
                            onChange={e => setAddForm(f => ({ ...f, classId: e.target.value }))}>
                            <MenuItem value=""><em>No specific class</em></MenuItem>
                            {classes.map(c => <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Handling Teacher (optional)</InputLabel>
                        <Select value={addForm.teacherId} label="Handling Teacher (optional)"
                            onChange={e => setAddForm(f => ({ ...f, teacherId: e.target.value }))}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {teachers.map(t => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Divider>Topics</Divider>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField label="Add topic" size="small" fullWidth value={topicDraft}
                            onChange={e => setTopicDraft(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTopicToForm()} />
                        <Button variant="outlined" onClick={addTopicToForm} startIcon={<AddIcon />}>Add</Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {addForm.topics.map((t, i) => (
                            <Chip key={i} label={t} size="small" onDelete={() => setAddForm(f => ({ ...f, topics: f.topics.filter((_, j) => j !== i) }))} />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAdd} disabled={saving}>
                        {saving ? <CircularProgress size={20} /> : 'Add Subject'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Edit Topics Dialog ── */}
            <Dialog open={topicsOpen} onClose={() => setTopicsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Topics — {topicsSubject?.subName}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
                        <TextField label="Add topic" size="small" fullWidth value={topicInput}
                            onChange={e => setTopicInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (setEditTopics(p => topicInput.trim() && !p.includes(topicInput.trim()) ? [...p, topicInput.trim()] : p), setTopicInput(''))} />
                        <Button variant="contained" onClick={() => { const t = topicInput.trim(); if (t && !editTopics.includes(t)) setEditTopics(p => [...p, t]); setTopicInput(''); }} startIcon={<AddIcon />}>Add</Button>
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <List dense>
                        {editTopics.length === 0
                            ? <Typography color="text.secondary" sx={{ px: 1 }}>No topics yet.</Typography>
                            : editTopics.map((t, i) => (
                                <ListItem key={i}>
                                    <ListItemText primary={t} />
                                    <ListItemSecondaryAction>
                                        <IconButton edge="end" size="small" onClick={() => setEditTopics(p => p.filter((_, j) => j !== i))}>
                                            <DeleteIcon fontSize="small" color="error" />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))
                        }
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTopicsOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={saveTopics} disabled={savingTopics}>
                        {savingTopics ? <CircularProgress size={20} /> : 'Save Topics'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Assign Teacher Dialog ── */}
            <Dialog open={teacherOpen} onClose={() => setTeacherOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Assign Handling Teacher</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Subject: <strong>{teacherSubject?.subName}</strong>
                        {teacherSubject?.classId?.sclassName && <> &nbsp;·&nbsp; Class: <strong>{teacherSubject.classId.sclassName}</strong></>}
                    </Typography>
                    <FormControl fullWidth>
                        <InputLabel>Handling Teacher</InputLabel>
                        <Select value={selTeacher} label="Handling Teacher" onChange={e => setSelTeacher(e.target.value)}>
                            <MenuItem value=""><em>None (unassign)</em></MenuItem>
                            {teachers.map(t => <MenuItem key={t._id} value={t._id}>{t.name} — {t.email}</MenuItem>)}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTeacherOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={saveTeacher} disabled={savingTeacher}>
                        {savingTeacher ? <CircularProgress size={20} /> : 'Assign'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Assign Class Dialog ── */}
            <Dialog open={classOpen} onClose={() => setClassOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Assign Subject to Class</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Subject: <strong>{classSubject?.subName}</strong>
                        {classSubject?.classId?.sclassName && (
                            <> &nbsp;·&nbsp; Currently in: <strong>{classSubject.classId.sclassName}</strong></>
                        )}
                    </Typography>
                    <FormControl fullWidth>
                        <InputLabel>Assign to Class</InputLabel>
                        <Select value={selClass} label="Assign to Class" onChange={e => setSelClass(e.target.value)}>
                            <MenuItem value=""><em>None (unassign from class)</em></MenuItem>
                            {classes.map(c => (
                                <MenuItem key={c._id} value={c._id}>
                                    {c.sclassName || c.className}
                                    {c.section ? ` — ${c.section}` : ''}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClassOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={saveClass} disabled={savingClass}>
                        {savingClass ? <CircularProgress size={20} /> : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default SubjectManagement;
