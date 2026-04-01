import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, IconButton,
    Chip, MenuItem, Select, FormControl, InputLabel, CircularProgress,
    Alert, Tooltip, Tabs, Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ClassIcon from '@mui/icons-material/Class';

const BASE = process.env.REACT_APP_BASE_URL;
const EMPTY_FORM = { className: '', section: '', classTeacherId: '' };

const ClassManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);
    const navigate = useNavigate();

    const [classes, setClasses]   = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [success, setSuccess]   = useState('');

    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId]     = useState(null);
    const [form, setForm]         = useState(EMPTY_FORM);
    const [saving, setSaving]     = useState(false);

    const [detailOpen, setDetailOpen]       = useState(false);
    const [detail, setDetail]               = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTab, setDetailTab]         = useState(0);

    const fetchAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            axios.get(`${BASE}/SclassList/${schoolId}`),
            axios.get(`${BASE}/Teachers/${schoolId}`),
        ]).then(([c, t]) => {
            setClasses(Array.isArray(c.data) ? c.data : []);
            // Normalise teacher list: ensure _id is always a plain string
            const tList = Array.isArray(t.data) ? t.data : [];
            setTeachers(tList.map(t => ({ ...t, _id: String(t._id) })));
        }).catch(() => setError('Failed to load data'))
          .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true); };

    const openEdit = (c) => {
        setEditId(c._id);
        setForm({
            className:       c.sclassName || c.className || '',
            section:         c.section || '',
            // Normalise to string so MUI Select value matches
            classTeacherId:  c.classTeacher ? String(c.classTeacher._id || c.classTeacher) : '',
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.className) return setError('Class name is required');
        setSaving(true); setError('');
        try {
            if (editId) {
                const payload = {
                    className: form.className,
                    section: form.section,
                    // Send null to explicitly clear, send ID to set, omit if unchanged
                    classTeacherId: form.classTeacherId === '' ? null : form.classTeacherId,
                };
                await axios.put(`${BASE}/Admin/class/${editId}`, payload);
                setSuccess('Class updated');
            } else {
                await axios.post(`${BASE}/Admin/class/add`, { ...form, schoolId });
                setSuccess('Class created');
            }
            setFormOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete class "${name}"? This cannot be undone.`)) return;
        try {
            await axios.delete(`${BASE}/Admin/class/${id}`);
            setSuccess('Class deleted');
            fetchAll();
        } catch (e) { setError(e.response?.data?.message || 'Delete failed'); }
    };

    const openDetail = async (id) => {
        setDetailOpen(true); setDetailLoading(true); setDetail(null); setDetailTab(0);
        try {
            const { data } = await axios.get(`${BASE}/Admin/class/${id}/detail`);
            setDetail(data);
        } catch { setDetail(null); }
        finally { setDetailLoading(false); }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    <ClassIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Class Management
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Create Class</Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {loading ? <CircularProgress /> : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Class Name', 'Section', 'Class Teacher', 'Actions'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {classes.length === 0 ? (
                                <TableRow><TableCell colSpan={4} align="center">No classes found</TableCell></TableRow>
                            ) : classes.map(c => (
                        <TableRow key={c._id} hover>
                                    <TableCell>{c.sclassName}</TableCell>
                                    <TableCell>{c.section || '—'}</TableCell>
                                    <TableCell>
                                        {c.classTeacher?.name
                                            ? c.classTeacher.name
                                            : teachers.find(t => t._id === String(c.classTeacher?._id || c.classTeacher))?.name || '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title="View Detail">
                                            <IconButton size="small" onClick={() => openDetail(c._id)}><VisibilityIcon /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Add Subjects">
                                            <Button size="small" onClick={() => navigate(`/Admin/addsubject/${c._id}`)}>+ Subjects</Button>
                                        </Tooltip>
                                        <Tooltip title="Add Students">
                                            <Button size="small" onClick={() => navigate(`/Admin/class/addstudents/${c._id}`)}>+ Students</Button>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEdit(c)}><EditIcon /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(c._id, c.sclassName)}><DeleteIcon /></IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{editId ? 'Edit Class' : 'Create Class'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField
                        label="Class Name" value={form.className} required fullWidth
                        onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                    />
                    <TextField
                        label="Section (optional)" value={form.section} fullWidth
                        onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Class Teacher (optional)</InputLabel>
                        <Select
                            value={form.classTeacherId}
                            label="Class Teacher (optional)"
                            onChange={e => setForm(f => ({ ...f, classTeacherId: e.target.value }))}
                        >
                            <MenuItem value=""><em>None (clear teacher)</em></MenuItem>
                            {teachers.map(t => (
                                <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFormOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? <CircularProgress size={20} /> : editId ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Class Detail — {detail?.sclass?.sclassName}</DialogTitle>
                <DialogContent>
                    {detailLoading ? <CircularProgress /> : detail ? (
                        <>
                            <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                                <Tab label={`Subjects (${detail.subjects?.length ?? 0})`} />
                                <Tab label={`Students (${detail.students?.length ?? 0})`} />
                                <Tab label={`Teachers (${detail.teachers?.length ?? 0})`} />
                            </Tabs>
                            {detailTab === 0 && (
                                <Table size="small">
                                    <TableHead><TableRow><TableCell>Subject</TableCell><TableCell>Teacher</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {detail.subjects?.map(s => (
                                            <TableRow key={s._id}>
                                                <TableCell>{s.subName}</TableCell>
                                                <TableCell>{s.teacherId?.name || '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {detailTab === 1 && (
                                <Table size="small">
                                    <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Roll No</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {detail.students?.map(s => (
                                            <TableRow key={s._id}>
                                                <TableCell>{s.name}</TableCell>
                                                <TableCell>{s.rollNum}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={s.status || 'active'} size="small"
                                                        color={s.status === 'active' ? 'success' : s.status === 'suspended' ? 'error' : 'default'}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {detailTab === 2 && (
                                <Table size="small">
                                    <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Subjects</TableCell></TableRow></TableHead>
                                    <TableBody>
                                        {detail.teachers?.map(t => (
                                            <TableRow key={t._id}>
                                                <TableCell>{t.name}</TableCell>
                                                <TableCell>{t.email}</TableCell>
                                                <TableCell>{t.teachSubjects?.map(s => s.subName).join(', ') || '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </>
                    ) : <Typography>No data available</Typography>}
                </DialogContent>
                <DialogActions><Button onClick={() => setDetailOpen(false)}>Close</Button></DialogActions>
            </Dialog>
        </Container>
    );
};

export default ClassManagement;
