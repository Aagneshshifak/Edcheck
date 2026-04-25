import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, CircularProgress, Alert, Chip,
    FormControl, InputLabel, Select, MenuItem, Box, IconButton, Tooltip,
    Tabs, Tab, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Switch, FormControlLabel,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import QuizIcon from '@mui/icons-material/Quiz';


const EMPTY_FORM = { title: '', subjectId: '', classId: '', durationMinutes: 30, shuffleQuestions: false };

const TestOversight = () => {
    const navigate  = useNavigate();
    const schoolId  = useSelector(s => s.user.currentUser._id);

    const [tests, setTests]         = useState([]);
    const [classes, setClasses]     = useState([]);
    const [subjects, setSubjects]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [tab, setTab]             = useState(0); // 0=All, 1=Active, 2=Completed

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [saving, setSaving]         = useState(false);
    const [classSubjects, setClassSubjects] = useState([]);

    // When class changes in the form, fetch subjects for that class only
    useEffect(() => {
        if (!form.classId) { setClassSubjects([]); return; }
        axiosInstance.get(`/ClassSubjects/${form.classId}`)
            .then(({ data }) => {
                // Deduplicate by _id
                const seen = new Set();
                const unique = (Array.isArray(data) ? data : []).filter(s => {
                    if (seen.has(s._id)) return false;
                    seen.add(s._id);
                    return true;
                });
                setClassSubjects(unique);
            })
            .catch(() => setClassSubjects([]));
    }, [form.classId]);

    const fetchAll = useCallback(() => {
        setLoading(true); setError('');
        Promise.all([
            axiosInstance.get(`/Admin/tests/${schoolId}`),
            axiosInstance.get(`/SclassList/${schoolId}`),
            axiosInstance.get(`/AllSubjects/${schoolId}`),
        ]).then(([t, c, s]) => {
            setTests(Array.isArray(t.data) ? t.data : []);
            setClasses(Array.isArray(c.data) ? c.data : []);
            setSubjects(Array.isArray(s.data) ? s.data : []);
        }).catch(err => setError(err.response?.data?.message || 'Failed to load tests'))
          .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this test and all its attempts?')) return;
        try {
            await axiosInstance.delete(`/Test/${id}`);
            setTests(prev => prev.filter(t => t._id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed'); }
    };

    const handleToggle = async (e, id) => {
        e.stopPropagation();
        try {
            const { data } = await axiosInstance.put(`/Admin/tests/${id}/toggle`);
            setTests(prev => prev.map(t => t._id === id ? { ...t, isActive: data.isActive } : t));
        } catch (err) { alert('Toggle failed'); }
    };

    const handleCreate = async () => {
        if (!form.title || !form.classId) return setError('Title and class are required');
        setSaving(true); setError('');
        try {
            await axiosInstance.post(`/Admin/tests/create`, { ...form, schoolId });
            setSuccess('Test created');
            setCreateOpen(false);
            setForm(EMPTY_FORM);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Create failed');
        } finally { setSaving(false); }
    };

    const classOptions = [...new Map(tests.map(t => [t.classId?._id, t.classId])).values()].filter(Boolean);

    const filtered = tests.filter(t => {
        if (classFilter && t.classId?._id !== classFilter) return false;
        if (tab === 1 && !t.isActive)  return false;
        if (tab === 2 && t.isActive)   return false;
        return true;
    });

    const activeCount    = tests.filter(t => t.isActive).length;
    const completedCount = tests.filter(t => !t.isActive).length;
    const alertCount     = tests.filter(t => t.cheatingAlert).length;
    const avgScore       = tests.filter(t => t.classAvgScore != null).length > 0
        ? (tests.reduce((s, t) => s + (t.classAvgScore || 0), 0) / tests.filter(t => t.classAvgScore != null).length).toFixed(1)
        : null;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4"><QuizIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Test Control Panel</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Create Test</Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Summary */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`${activeCount} active`}    color="success" />
                <Chip label={`${completedCount} completed`} />
                {avgScore && <Chip label={`Avg score: ${avgScore}%`} color="primary" />}
                {alertCount > 0 && <Chip icon={<WarningAmberIcon />} label={`${alertCount} cheating alert${alertCount > 1 ? 's' : ''}`} color="error" />}
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label={`All (${tests.length})`} />
                <Tab label={`Active (${activeCount})`} />
                <Tab label={`Completed (${completedCount})`} />
            </Tabs>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Class</InputLabel>
                    <Select value={classFilter} label="Class" onChange={e => setClassFilter(e.target.value)}>
                        <MenuItem value="">All Classes</MenuItem>
                        {classOptions.map(c => <MenuItem key={c._id} value={c._id}>{c.sclassName || c.className}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>

            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>}

            {!loading && !error && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Title','Class','Subject','Teacher','Attempts','Avg Score','Status','Alerts','Actions'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No tests found.</TableCell></TableRow>
                            ) : filtered.map(t => (
                                <TableRow key={t._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/Admin/tests/${t._id}`)}>
                                    <TableCell><strong>{t.title}</strong></TableCell>
                                    <TableCell>{t.classId?.sclassName || t.classId?.className || '—'}</TableCell>
                                    <TableCell>{t.subject?.subName || t.subject?.subjectName || '—'}</TableCell>
                                    <TableCell>{t.createdBy?.name || '—'}</TableCell>
                                    <TableCell align="center">{t.attemptCount ?? 0}</TableCell>
                                    <TableCell align="center">
                                        {t.classAvgScore != null ? `${t.classAvgScore}%` : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={t.isActive ? 'Active' : 'Completed'}
                                            size="small"
                                            color={t.isActive ? 'success' : 'default'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {t.cheatingAlert
                                            ? <Tooltip title={`${t.fastSubmits} suspiciously fast submission(s)`}>
                                                <Chip icon={<WarningAmberIcon />} label="Alert" size="small" color="error" />
                                              </Tooltip>
                                            : <Typography variant="caption" color="text.secondary">—</Typography>
                                        }
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title={t.isActive ? 'Deactivate' : 'Activate'}>
                                            <IconButton size="small" color={t.isActive ? 'warning' : 'success'} onClick={e => handleToggle(e, t._id)}>
                                                {t.isActive ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={e => handleDelete(e, t._id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Create Test Dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Test</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Title" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required fullWidth />
                    <FormControl fullWidth required>
                        <InputLabel>Class</InputLabel>
                        <Select value={form.classId} label="Class" onChange={e => setForm(f => ({...f, classId: e.target.value, subjectId: ''}))}>
                            {classes.map(c => <MenuItem key={c._id} value={c._id}>{c.sclassName || c.className}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Subject (optional)</InputLabel>
                        <Select value={form.subjectId} label="Subject (optional)" onChange={e => setForm(f => ({...f, subjectId: e.target.value}))}
                            disabled={!form.classId}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {classSubjects.map(s => (
                                <MenuItem key={s._id} value={s._id}>
                                    {s.subjectName || s.subName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField label="Duration (minutes)" type="number" value={form.durationMinutes}
                        onChange={e => setForm(f => ({...f, durationMinutes: Number(e.target.value)}))} fullWidth />
                    <FormControlLabel
                        control={<Switch checked={form.shuffleQuestions} onChange={e => setForm(f => ({...f, shuffleQuestions: e.target.checked}))} />}
                        label="Shuffle questions"
                    />
                    <Alert severity="info" sx={{ mt: 1 }}>
                        After creating, open the test to add questions via the teacher interface.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreate} disabled={saving}>
                        {saving ? <CircularProgress size={20} /> : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default TestOversight;
