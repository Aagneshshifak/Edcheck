import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, IconButton,
    Chip, MenuItem, Select, FormControl, InputLabel, CircularProgress,
    Alert, Tooltip, Tabs, Tab, Divider, Checkbox, ListItemText,
    OutlinedInput, Autocomplete,
} from '@mui/material';
import AddIcon        from '@mui/icons-material/Add';
import DeleteIcon     from '@mui/icons-material/Delete';
import EditIcon       from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ClassIcon      from '@mui/icons-material/Class';
import PersonAddIcon  from '@mui/icons-material/PersonAdd';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

const BASE = process.env.REACT_APP_BASE_URL;
const EMPTY_FORM = { className: '', section: '', classTeacherId: '', subjectIds: [] };

// ── helpers ───────────────────────────────────────────────────────────────────

const subLabel = s => s?.subName || s?.subjectName || String(s);

const ClassManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [classes,  setClasses]  = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]); // all school subjects
    const [students, setStudents] = useState([]); // all school students (for enrollment)
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');
    const [success,  setSuccess]  = useState('');

    // ── Create / Edit dialog ──────────────────────────────────────────────────
    const [formOpen, setFormOpen] = useState(false);
    const [editId,   setEditId]   = useState(null);
    const [form,     setForm]     = useState(EMPTY_FORM);
    const [saving,   setSaving]   = useState(false);

    // ── Detail dialog ─────────────────────────────────────────────────────────
    const [detailOpen,    setDetailOpen]    = useState(false);
    const [detailClassId, setDetailClassId] = useState(null);
    const [detail,        setDetail]        = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTab,     setDetailTab]     = useState(0);

    // ── Inline subject add (inside detail) ────────────────────────────────────
    const [addSubOpen,   setAddSubOpen]   = useState(false);
    const [newSubForm,   setNewSubForm]   = useState({ subName: '', subCode: '', teacherId: '' });
    const [savingSub,    setSavingSub]    = useState(false);

    // ── Student enrollment (inside detail) ───────────────────────────────────
    const [enrollStudent, setEnrollStudent] = useState(null); // selected student to enroll

    const fetchAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            axios.get(`${BASE}/SclassList/${schoolId}`),
            axios.get(`${BASE}/Teachers/${schoolId}`),
            axios.get(`${BASE}/Admin/subjects/detail/${schoolId}`),
            axios.get(`${BASE}/Students/${schoolId}`),
        ]).then(([c, t, s, st]) => {
            setClasses(Array.isArray(c.data) ? c.data : []);
            setTeachers((Array.isArray(t.data) ? t.data : []).map(t => ({ ...t, _id: String(t._id) })));
            setSubjects(Array.isArray(s.data) ? s.data : []);
            setStudents(Array.isArray(st.data) ? st.data : []);
        }).catch(() => setError('Failed to load data'))
          .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Refresh detail ────────────────────────────────────────────────────────
    const refreshDetail = useCallback(async (id) => {
        setDetailLoading(true);
        try {
            const { data } = await axios.get(`${BASE}/Admin/class/${id}/detail`);
            setDetail(data);
        } catch { setDetail(null); }
        finally { setDetailLoading(false); }
    }, []);

    // ── Create / Edit ─────────────────────────────────────────────────────────
    const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true); };

    const openEdit = (c) => {
        setEditId(c._id);
        // Pre-select subjects already assigned to this class
        const classSubIds = subjects
            .filter(s => String(s.classId?._id || s.classId) === String(c._id))
            .map(s => String(s._id));
        setForm({
            className:      c.sclassName || c.className || '',
            section:        c.section || '',
            classTeacherId: c.classTeacher ? String(c.classTeacher._id || c.classTeacher) : '',
            subjectIds:     classSubIds,
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.className) return setError('Class name is required');
        setSaving(true); setError('');
        try {
            let classId = editId;
            if (editId) {
                await axios.put(`${BASE}/Admin/class/${editId}`, {
                    className:      form.className,
                    section:        form.section,
                    classTeacherId: form.classTeacherId === '' ? null : form.classTeacherId,
                    subjectIds:     form.subjectIds,
                });
                setSuccess('Class updated');
            } else {
                const { data } = await axios.post(`${BASE}/Admin/class/add`, {
                    className:      form.className,
                    section:        form.section,
                    schoolId,
                    classTeacherId: form.classTeacherId || undefined,
                    subjectIds:     form.subjectIds,
                });
                classId = data._id;
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

    // ── Detail ────────────────────────────────────────────────────────────────
    const openDetail = async (id) => {
        setDetailClassId(id);
        setDetailOpen(true);
        setDetailTab(0);
        setDetail(null);
        await refreshDetail(id);
    };

    // ── Inline: add subject to class ─────────────────────────────────────────
    const handleAddSubject = async () => {
        if (!newSubForm.subName) return;
        setSavingSub(true);
        try {
            await axios.post(`${BASE}/Admin/subjects/add`, {
                subName:   newSubForm.subName,
                subCode:   newSubForm.subCode,
                classId:   detailClassId,
                teacherId: newSubForm.teacherId || undefined,
                schoolId,
            });
            setSuccess('Subject added');
            setAddSubOpen(false);
            setNewSubForm({ subName: '', subCode: '', teacherId: '' });
            await refreshDetail(detailClassId);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to add subject');
        } finally { setSavingSub(false); }
    };

    const handleRemoveSubject = async (subId, subName) => {
        if (!window.confirm(`Remove subject "${subName}" from this class?`)) return;
        try {
            await axios.delete(`${BASE}/Admin/subjects/${subId}`);
            setSuccess('Subject removed');
            await refreshDetail(detailClassId);
        } catch { setError('Failed to remove subject'); }
    };

    // ── Inline: enroll student ────────────────────────────────────────────────
    const handleEnrollStudent = async () => {
        if (!enrollStudent) return;
        try {
            await axios.put(`${BASE}/Admin/student/${enrollStudent._id}`, {
                classId:    detailClassId,
                sclassName: detailClassId,
            });
            setSuccess(`${enrollStudent.name} enrolled`);
            setEnrollStudent(null);
            await refreshDetail(detailClassId);
            fetchAll();
        } catch { setError('Failed to enroll student'); }
    };

    const handleUnenrollStudent = async (studentId, studentName) => {
        if (!window.confirm(`Remove ${studentName} from this class?`)) return;
        try {
            await axios.put(`${BASE}/Admin/student/${studentId}`, {
                classId:    null,
                sclassName: null,
            });
            setSuccess(`${studentName} removed from class`);
            await refreshDetail(detailClassId);
            fetchAll();
        } catch { setError('Failed to remove student'); }
    };

    // Students not yet in this class
    const unenrolledStudents = students.filter(s =>
        String(s.classId || s.sclassName || '') !== String(detailClassId || '')
    );

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
                                {['Class Name', 'Section', 'Class Teacher', 'Subjects', 'Students', 'Actions'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {classes.length === 0 ? (
                                <TableRow><TableCell colSpan={6} align="center">No classes found</TableCell></TableRow>
                            ) : classes.map(c => {
                                const classSubCount = subjects.filter(s =>
                                    String(s.classId?._id || s.classId) === String(c._id)
                                ).length;
                                const classStudentCount = students.filter(s =>
                                    String(s.classId || s.sclassName) === String(c._id)
                                ).length;
                                return (
                                    <TableRow key={c._id} hover>
                                        <TableCell><strong>{c.sclassName}</strong></TableCell>
                                        <TableCell>{c.section || '—'}</TableCell>
                                        <TableCell>
                                            {c.classTeacher?.name
                                                ? c.classTeacher.name
                                                : teachers.find(t => t._id === String(c.classTeacher?._id || c.classTeacher))?.name || '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={classSubCount} size="small" color={classSubCount > 0 ? 'info' : 'default'} />
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={classStudentCount} size="small" color={classStudentCount > 0 ? 'success' : 'default'} />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="View / Manage">
                                                <IconButton size="small" onClick={() => openDetail(c._id)}><VisibilityIcon /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(c)}><EditIcon /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(c._id, c.sclassName)}><DeleteIcon /></IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* ── Create / Edit Dialog ── */}
            <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
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
                            <MenuItem value=""><em>None</em></MenuItem>
                            {teachers.map(t => (
                                <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Gap 1: inline subject assignment */}
                    <FormControl fullWidth>
                        <InputLabel>Assign Subjects (optional)</InputLabel>
                        <Select
                            multiple
                            value={form.subjectIds}
                            label="Assign Subjects (optional)"
                            input={<OutlinedInput label="Assign Subjects (optional)" />}
                            onChange={e => setForm(f => ({ ...f, subjectIds: e.target.value }))}
                            renderValue={selected =>
                                selected.map(id => {
                                    const s = subjects.find(s => String(s._id) === String(id));
                                    return s ? subLabel(s) : id;
                                }).join(', ')
                            }
                        >
                            {subjects.map(s => (
                                <MenuItem key={s._id} value={String(s._id)}>
                                    <Checkbox checked={form.subjectIds.includes(String(s._id))} />
                                    <ListItemText primary={subLabel(s)} secondary={s.classId?.sclassName ? `Currently in ${s.classId.sclassName}` : 'Unassigned'} />
                                </MenuItem>
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

            {/* ── Detail / Manage Dialog ── */}
            <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {detail?.sclass?.sclassName
                        ? `Manage Class — ${detail.sclass.sclassName}${detail.sclass.section ? ` (${detail.sclass.section})` : ''}`
                        : 'Class Detail'}
                </DialogTitle>
                <DialogContent>
                    {detailLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
                    ) : detail ? (
                        <>
                            <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                                <Tab label={`Subjects (${detail.subjects?.length ?? 0})`} />
                                <Tab label={`Students (${detail.students?.length ?? 0})`} />
                                <Tab label={`Teachers (${detail.teachers?.length ?? 0})`} />
                            </Tabs>

                            {/* Gap 2: editable subjects tab */}
                            {detailTab === 0 && (
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                                        <Button size="small" variant="outlined" startIcon={<AddIcon />}
                                            onClick={() => { setNewSubForm({ subName: '', subCode: '', teacherId: '' }); setAddSubOpen(true); }}>
                                            Add Subject
                                        </Button>
                                    </Box>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                                            <TableRow>
                                                <TableCell>Subject</TableCell>
                                                <TableCell>Code</TableCell>
                                                <TableCell>Handling Teacher</TableCell>
                                                <TableCell align="right">Remove</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {detail.subjects?.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>No subjects assigned. Click "Add Subject" above.</TableCell></TableRow>
                                            ) : detail.subjects?.map(s => (
                                                <TableRow key={s._id} hover>
                                                    <TableCell><strong>{s.subName}</strong></TableCell>
                                                    <TableCell>{s.subCode || '—'}</TableCell>
                                                    <TableCell>{s.teacherId?.name || '—'}</TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Remove from class">
                                                            <IconButton size="small" color="error"
                                                                onClick={() => handleRemoveSubject(s._id, s.subName)}>
                                                                <RemoveCircleOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            )}

                            {/* Gap 3: student enrollment tab */}
                            {detailTab === 1 && (
                                <Box>
                                    {/* Enroll student */}
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                                        <Autocomplete
                                            options={unenrolledStudents}
                                            getOptionLabel={s => `${s.name} (Roll: ${s.rollNum})`}
                                            value={enrollStudent}
                                            onChange={(_, v) => setEnrollStudent(v)}
                                            renderInput={params => <TextField {...params} label="Enroll a student" size="small" />}
                                            sx={{ flex: 1 }}
                                            isOptionEqualToValue={(o, v) => o._id === v._id}
                                        />
                                        <Button
                                            variant="contained" size="small"
                                            startIcon={<PersonAddIcon />}
                                            disabled={!enrollStudent}
                                            onClick={handleEnrollStudent}
                                        >
                                            Enroll
                                        </Button>
                                    </Box>
                                    <Divider sx={{ mb: 1.5 }} />
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Roll No</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="right">Remove</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {detail.students?.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 3 }}>No students enrolled. Use the search above to enroll students.</TableCell></TableRow>
                                            ) : detail.students?.map(s => (
                                                <TableRow key={s._id} hover>
                                                    <TableCell>{s.name}</TableCell>
                                                    <TableCell>{s.rollNum}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={s.status || 'active'} size="small"
                                                            color={s.status === 'active' ? 'success' : s.status === 'suspended' ? 'error' : 'default'}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Remove from class">
                                                            <IconButton size="small" color="error"
                                                                onClick={() => handleUnenrollStudent(s._id, s.name)}>
                                                                <RemoveCircleOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            )}

                            {detailTab === 2 && (
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Subjects</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {detail.teachers?.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} align="center" sx={{ color: 'text.secondary', py: 3 }}>No teachers assigned to this class yet.</TableCell></TableRow>
                                        ) : detail.teachers?.map(t => (
                                            <TableRow key={t._id} hover>
                                                <TableCell>{t.name}</TableCell>
                                                <TableCell>{t.email}</TableCell>
                                                <TableCell>{t.teachSubjects?.map(s => s.subName).join(', ') || '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </>
                    ) : (
                        <Typography color="text.secondary">No data available</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* ── Add Subject to Class Dialog ── */}
            <Dialog open={addSubOpen} onClose={() => setAddSubOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Subject to Class</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField
                        label="Subject Name" required fullWidth value={newSubForm.subName}
                        onChange={e => setNewSubForm(f => ({ ...f, subName: e.target.value }))}
                    />
                    <TextField
                        label="Subject Code (e.g. MATH)" fullWidth value={newSubForm.subCode}
                        onChange={e => setNewSubForm(f => ({ ...f, subCode: e.target.value }))}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Handling Teacher (optional)</InputLabel>
                        <Select
                            value={newSubForm.teacherId}
                            label="Handling Teacher (optional)"
                            onChange={e => setNewSubForm(f => ({ ...f, teacherId: e.target.value }))}
                        >
                            <MenuItem value=""><em>None</em></MenuItem>
                            {teachers.map(t => (
                                <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddSubOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddSubject} disabled={savingSub || !newSubForm.subName}>
                        {savingSub ? <CircularProgress size={20} /> : 'Add Subject'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default ClassManagement;
