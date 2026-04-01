import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, IconButton,
    Chip, MenuItem, Select, FormControl, InputLabel, OutlinedInput,
    CircularProgress, Alert, Tooltip, Divider, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import BarChartIcon from '@mui/icons-material/BarChart';
import PersonIcon from '@mui/icons-material/Person';

const BASE = process.env.REACT_APP_BASE_URL;

const EMPTY_FORM = { name: '', email: '', password: '', phone: '', subjectIds: [], classIds: [] };

const TeacherManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [teachers, setTeachers]   = useState([]);
    const [classes, setClasses]     = useState([]);
    const [subjects, setSubjects]   = useState([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [success, setSuccess]     = useState('');

    // Dialog state
    const [formOpen, setFormOpen]   = useState(false);
    const [editId, setEditId]       = useState(null);
    const [form, setForm]           = useState(EMPTY_FORM);
    const [saving, setSaving]       = useState(false);

    // Performance dialog
    const [perfOpen, setPerfOpen]   = useState(false);
    const [perfData, setPerfData]   = useState(null);
    const [perfLoading, setPerfLoading] = useState(false);

    const fetchAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            axios.get(`${BASE}/Teachers/${schoolId}`),
            axios.get(`${BASE}/SclassList/${schoolId}`),
            axios.get(`${BASE}/AllSubjects/${schoolId}`),
        ]).then(([t, c, s]) => {
            setTeachers(Array.isArray(t.data) ? t.data : []);
            setClasses(Array.isArray(c.data) ? c.data : []);
            setSubjects(Array.isArray(s.data) ? s.data : []);
        }).catch(() => setError('Failed to load data'))
          .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true); };
    const openEdit = (t) => {
        setEditId(t._id);
        setForm({
            name: t.name, email: t.email, password: '', phone: t.phone || '',
            subjectIds: (t.teachSubjects || []).map(s => s._id || s),
            classIds:   (t.teachClasses  || []).map(c => c._id || c),
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.email) return setError('Name and email are required');
        setSaving(true); setError('');
        try {
            if (editId) {
                await axios.put(`${BASE}/Admin/teacher/${editId}`, form);
                setSuccess('Teacher updated');
            } else {
                if (!form.password) return setError('Password is required');
                await axios.post(`${BASE}/Admin/teacher/add`, { ...form, schoolId });
                setSuccess('Teacher added');
            }
            setFormOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove teacher "${name}"?`)) return;
        try {
            await axios.delete(`${BASE}/Admin/teacher/${id}`);
            setSuccess('Teacher removed');
            fetchAll();
        } catch (e) { setError(e.response?.data?.message || 'Delete failed'); }
    };

    const openPerf = async (id) => {
        setPerfOpen(true); setPerfLoading(true); setPerfData(null);
        try {
            const { data } = await axios.get(`${BASE}/Admin/teacher/${id}/performance`);
            setPerfData(data);
        } catch { setPerfData(null); }
        finally { setPerfLoading(false); }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4"><PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Teacher Management</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Teacher</Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {loading ? <CircularProgress /> : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Name','Email','Phone','Subjects','Classes','Actions'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {teachers.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center">No teachers found</TableCell></TableRow>
                            ) : teachers.map(t => (
                                <TableRow key={t._id} hover>
                                    <TableCell>{t.name}</TableCell>
                                    <TableCell>{t.email}</TableCell>
                                    <TableCell>{t.phone || '—'}</TableCell>
                                    <TableCell>
                                        {(t.teachSubjects?.length ? t.teachSubjects : t.teachSubject ? [t.teachSubject] : [])
                                            .map((s, i) => <Chip key={i} label={s.subName || s} size="small" sx={{ mr: 0.5 }} />)}
                                    </TableCell>
                                    <TableCell>
                                        {(t.teachClasses?.length ? t.teachClasses : t.teachSclass ? [t.teachSclass] : [])
                                            .map((c, i) => <Chip key={i} label={c.sclassName || c} size="small" variant="outlined" sx={{ mr: 0.5 }} />)}
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title="Performance"><IconButton size="small" onClick={() => openPerf(t._id)}><BarChartIcon /></IconButton></Tooltip>
                                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(t)}><EditIcon /></IconButton></Tooltip>
                                        <Tooltip title="Remove"><IconButton size="small" color="error" onClick={() => handleDelete(t._id, t.name)}><DeleteIcon /></IconButton></Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editId ? 'Edit Teacher' : 'Add Teacher'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required fullWidth />
                    <TextField label="Email" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required fullWidth />
                    {!editId && <TextField label="Password" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} required fullWidth />}
                    <TextField label="Phone" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} fullWidth />

                    <FormControl fullWidth>
                        <InputLabel>Assign Subjects</InputLabel>
                        <Select multiple value={form.subjectIds} input={<OutlinedInput label="Assign Subjects" />}
                            onChange={e => setForm(f => ({...f, subjectIds: e.target.value}))}
                            renderValue={sel => sel.map(id => subjects.find(s => s._id === id)?.subName || id).join(', ')}>
                            {subjects.map(s => <MenuItem key={s._id} value={s._id}>{s.subName} ({s.sclassName?.sclassName || ''})</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel>Assign Classes</InputLabel>
                        <Select multiple value={form.classIds} input={<OutlinedInput label="Assign Classes" />}
                            onChange={e => setForm(f => ({...f, classIds: e.target.value}))}
                            renderValue={sel => sel.map(id => classes.find(c => c._id === id)?.sclassName || id).join(', ')}>
                            {classes.map(c => <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>)}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFormOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? <CircularProgress size={20} /> : editId ? 'Update' : 'Add'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Performance Dialog */}
            <Dialog open={perfOpen} onClose={() => setPerfOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Teacher Performance</DialogTitle>
                <DialogContent>
                    {perfLoading ? <CircularProgress /> : perfData ? (
                        <Box>
                            <Typography variant="h6">{perfData.teacher?.name}</Typography>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>{perfData.teacher?.email}</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <Grid container spacing={2}>
                                {[
                                    { label: 'Assignments Created', value: perfData.stats?.assignmentsCreated ?? '—' },
                                    { label: 'Tests Created',       value: perfData.stats?.testsCreated ?? '—' },
                                    { label: 'Avg Student Score',   value: perfData.stats?.avgStudentScore ? `${perfData.stats.avgStudentScore}%` : '—' },
                                ].map(({ label, value }) => (
                                    <Grid item xs={4} key={label}>
                                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                                            <Typography variant="h5" color="primary">{value}</Typography>
                                            <Typography variant="caption">{label}</Typography>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    ) : <Typography>No data available</Typography>}
                </DialogContent>
                <DialogActions><Button onClick={() => setPerfOpen(false)}>Close</Button></DialogActions>
            </Dialog>
        </Container>
    );
};

export default TeacherManagement;
