import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, TableContainer, IconButton, Chip, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    TextField, CircularProgress, Alert, Collapse, List, ListItem,
    ListItemText, ListItemSecondaryAction, MenuItem, Select,
    FormControl, InputLabel, Divider,
} from '@mui/material'


import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TopicIcon from '@mui/icons-material/Topic';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';

const BASE = process.env.REACT_APP_BASE_URL;

const SubjectManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [subjects, setSubjects]   = useState([]);
    const [teachers, setTeachers]   = useState([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');
    const [expanded, setExpanded]   = useState(null); // subject id with expanded topics

    // Topics dialog
    const [topicsOpen, setTopicsOpen]   = useState(false);
    const [topicsSubject, setTopicsSubject] = useState(null);
    const [topicInput, setTopicInput]   = useState('');
    const [editTopics, setEditTopics]   = useState([]);
    const [savingTopics, setSavingTopics] = useState(false);

    // Teacher assign dialog
    const [teacherOpen, setTeacherOpen]     = useState(false);
    const [teacherSubject, setTeacherSubject] = useState(null);
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [savingTeacher, setSavingTeacher] = useState(false);

    const fetchAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            axios.get(`${BASE}/Admin/subjects/detail/${schoolId}`),
            axios.get(`${BASE}/Teachers/${schoolId}`),
        ]).then(([s, t]) => {
            setSubjects(Array.isArray(s.data) ? s.data : []);
            setTeachers(Array.isArray(t.data) ? t.data : []);
        }).catch(() => setError('Failed to load subjects'))
          .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Topics ──────────────────────────────────────────────────────────────
    const openTopics = (subject) => {
        setTopicsSubject(subject);
        setEditTopics([...(subject.topics || [])]);
        setTopicInput('');
        setTopicsOpen(true);
    };

    const addTopic = () => {
        const t = topicInput.trim();
        if (t && !editTopics.includes(t)) setEditTopics(prev => [...prev, t]);
        setTopicInput('');
    };

    const removeTopic = (t) => setEditTopics(prev => prev.filter(x => x !== t));

    const saveTopics = async () => {
        setSavingTopics(true);
        try {
            await axios.put(`${BASE}/Admin/subjects/${topicsSubject._id}/topics`, { topics: editTopics });
            setSuccess('Topics saved');
            setTopicsOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSavingTopics(false); }
    };

    // ── Teacher assign ───────────────────────────────────────────────────────
    const openTeacher = (subject) => {
        setTeacherSubject(subject);
        setSelectedTeacher(subject.teacherId?._id || '');
        setTeacherOpen(true);
    };

    const saveTeacher = async () => {
        setSavingTeacher(true);
        try {
            await axios.put(`${BASE}/Admin/subjects/${teacherSubject._id}/teacher`, { teacherId: selectedTeacher });
            setSuccess('Teacher assigned');
            setTeacherOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSavingTeacher(false); }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Typography variant="h4" gutterBottom>
                <TopicIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Subject Management
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Manage topics, teacher assignments, and view assignment counts per subject.
            </Typography>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {loading ? <CircularProgress /> : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Subject','Class','Teacher','Topics','Assignments','Actions'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {subjects.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center">No subjects found</TableCell></TableRow>
                            ) : subjects.map(s => (
                                <>
                                    <TableRow key={s._id} hover>
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
                                                <Chip label={`${(s.topics || []).length} topics`} size="small" />
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
                                            <Tooltip title="Assign Teacher">
                                                <IconButton size="small" color="primary" onClick={() => openTeacher(s)}><PersonIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                    {/* Expandable topics row */}
                                    {expanded === s._id && (
                                        <TableRow key={`${s._id}-topics`}>
                                            <TableCell colSpan={6} sx={{ py: 0, bgcolor: 'grey.50' }}>
                                                <Collapse in timeout="auto">
                                                    <Box sx={{ px: 3, py: 1 }}>
                                                        <Typography variant="caption" color="text.secondary">Topics in {s.subName}:</Typography>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                            {(s.topics || []).map((t, i) => (
                                                                <Chip key={i} label={t} size="small" sx={{ bgcolor: '#e3f2fd' }} />
                                                            ))}
                                                        </Box>
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Topics Dialog */}
            <Dialog open={topicsOpen} onClose={() => setTopicsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Topics — {topicsSubject?.subName}</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
                        <TextField
                            label="Add topic" size="small" fullWidth
                            value={topicInput}
                            onChange={e => setTopicInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTopic()}
                        />
                        <Button variant="contained" onClick={addTopic} startIcon={<AddIcon />}>Add</Button>
                    </Box>
                    <Divider sx={{ mb: 1 }} />
                    <List dense>
                        {editTopics.length === 0
                            ? <Typography color="text.secondary" sx={{ px: 1 }}>No topics yet. Add some above.</Typography>
                            : editTopics.map((t, i) => (
                                <ListItem key={i}>
                                    <ListItemText primary={t} />
                                    <ListItemSecondaryAction>
                                        <IconButton edge="end" size="small" onClick={() => removeTopic(t)}>
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

            {/* Teacher Assign Dialog */}
            <Dialog open={teacherOpen} onClose={() => setTeacherOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Assign Teacher — {teacherSubject?.subName}</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <FormControl fullWidth>
                        <InputLabel>Teacher</InputLabel>
                        <Select value={selectedTeacher} label="Teacher" onChange={e => setSelectedTeacher(e.target.value)}>
                            <MenuItem value=""><em>None</em></MenuItem>
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
        </Container>
    );
};

export default SubjectManagement;
