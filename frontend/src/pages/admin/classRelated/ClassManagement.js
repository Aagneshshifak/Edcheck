import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, TablePagination,
    IconButton, Chip, MenuItem, Select, FormControl, InputLabel,
    CircularProgress, Alert, Tooltip, Tabs, Tab, Divider, Checkbox,
    ListItemText, OutlinedInput, Autocomplete, InputAdornment,
} from '@mui/material';
import AddIcon                  from '@mui/icons-material/Add';
import DeleteIcon                from '@mui/icons-material/Delete';
import EditIcon                  from '@mui/icons-material/Edit';
import VisibilityIcon            from '@mui/icons-material/Visibility';
import ClassIcon                 from '@mui/icons-material/Class';
import PersonAddIcon             from '@mui/icons-material/PersonAdd';
import RemoveCircleOutlineIcon   from '@mui/icons-material/RemoveCircleOutline';
import SearchIcon                from '@mui/icons-material/Search';
import ClearIcon                 from '@mui/icons-material/Clear';

const BASE = process.env.REACT_APP_BASE_URL;
const ROWS_OPTIONS = [5, 10, 25, 50];

const subLabel = (s) => s?.subName || s?.subjectName || String(s);

const ClassManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);
    const navigate = useNavigate();

    // ── Data ──────────────────────────────────────────────────────────────────
    const [classes,  setClasses]  = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState('');
    const [success,  setSuccess]  = useState('');

    // ── Search & pagination ───────────────────────────────────────────────────
    const [search,   setSearch]   = useState('');
    const [page,     setPage]     = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // ── Edit dialog ───────────────────────────────────────────────────────────
    const [editOpen, setEditOpen] = useState(false);
    const [editId,   setEditId]   = useState(null);
    const [editForm, setEditForm] = useState({ className: '', section: '', classTeacherId: '', subjectIds: [] });
    const [saving,   setSaving]   = useState(false);

    // ── Detail / manage dialog ────────────────────────────────────────────────
    const [detailOpen,    setDetailOpen]    = useState(false);
    const [detailClassId, setDetailClassId] = useState(null);
    const [detail,        setDetail]        = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailTab,     setDetailTab]     = useState(0);

    // ── Inline subject add ────────────────────────────────────────────────────
    const [addSubOpen, setAddSubOpen] = useState(false);
    const [newSubForm, setNewSubForm] = useState({ subName: '', subCode: '', teacherId: '' });
    const [savingSub,  setSavingSub]  = useState(false);

    // ── Student enrollment ────────────────────────────────────────────────────
    const [enrollStudent, setEnrollStudent] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────────────────────
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

    const refreshDetail = useCallback(async (id) => {
        setDetailLoading(true);
        try {
            const { data } = await axios.get(`${BASE}/Admin/class/${id}/detail`);
            setDetail(data);
        } catch { setDetail(null); }
        finally { setDetailLoading(false); }
    }, []);

    // ── Derived: search + pagination ──────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return classes;
        return classes.filter(c =>
            (c.sclassName || c.className || '').toLowerCase().includes(q) ||
            (c.section || '').toLowerCase().includes(q)
        );
    }, [classes, search]);

    const paginated = useMemo(() =>
        filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filtered, page, rowsPerPage]);

    const handleSearchChange = (e) => { setSearch(e.target.value); setPage(0); };
    const handleClearSearch  = ()    => { setSearch(''); setPage(0); };

    // ── Edit ──────────────────────────────────────────────────────────────────
    const openEdit = (c) => {
        setEditId(c._id);
        const classSubIds = subjects
            .filter(s => String(s.classId?._id || s.classId) === String(c._id))
            .map(s => String(s._id));
        setEditForm({
            className:      c.sclassName || c.className || '',
            section:        c.section || '',
            classTeacherId: c.classTeacher ? String(c.classTeacher._id || c.classTeacher) : '',
            subjectIds:     classSubIds,
        });
        setEditOpen(true);
    };

    const handleEditSave = async () => {
        if (!editForm.className) return setError('Class name is required');
        setSaving(true); setError('');
        try {
            await axios.put(`${BASE}/Admin/class/${editId}`, {
                className:      editForm.className,
                section:        editForm.section,
                classTeacherId: editForm.classTeacherId === '' ? null : editForm.classTeacherId,
                subjectIds:     editForm.subjectIds,
            });
            setSuccess('Class updated');
            setEditOpen(false);
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete class "${name}"? This cannot be undone.`)) return;
        try {
            await axios.delete(`${BASE}/Admin/class/${id}`);
            setSuccess('Class deleted');
            fetchAll();
        } catch (e) {
            setError(e.response?.data?.message || 'Delete failed');
        }
    };

    // ── Status toggle ─────────────────────────────────────────────────────────
    const handleToggleStatus = async (id, current) => {
        try {
            await axios.put(`${BASE}/Admin/class/${id}/status`);
            setSuccess(`Class ${current === 'active' ? 'deactivated' : 'activated'}`);
            fetchAll();
        } catch { setError('Failed to update status'); }
    };

    // ── Detail ────────────────────────────────────────────────────────────────
    const openDetail = async (id) => {
        setDetailClassId(id); setDetailOpen(true); setDetailTab(0); setDetail(null);
        await refreshDetail(id);
    };

    // ── Inline subject add ────────────────────────────────────────────────────
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

    // ── Student enrollment ────────────────────────────────────────────────────
    const handleEnrollStudent = async () => {
        if (!enrollStudent) return;
        try {
            await axios.post(`${BASE}/Admin/student/${enrollStudent._id}/enroll`, { classId: detailClassId });
            setSuccess(`${enrollStudent.name} enrolled`);
            setEnrollStudent(null);
            await refreshDetail(detailClassId);
            fetchAll();
        } catch { setError('Failed to enroll student'); }
    };

    const handleUnenrollStudent = async (studentId, studentName) => {
        if (!window.confirm(`Remove ${studentName} from this class?`)) return;
        try {
            await axios.delete(`${BASE}/Admin/student/${studentId}/enroll`);
            setSuccess(`${studentName} removed`);
            await refreshDetail(detailClassId);
            fetchAll();
        } catch { setError('Failed to remove student'); }
    };

    const unenrolledStudents = students.filter(s =>
        String(s.classId || s.sclassName || '') !== String(detailClassId || '')
    );

    // ── Helpers ───────────────────────────────────────────────────────────────
    const classSubjectCount = (c) =>
        subjects.filter(s => String(s.classId?._id || s.classId) === String(c._id)).length;

    const classStudentCount = (c) =>
        students.filter(s => String(s.classId || s.sclassName) === String(c._id)).length;

    const teacherName = (c) =>
        c.classTeacher?.name ||
        teachers.find(t => t._id === String(c.classTeacher?._id || c.classTeacher))?.name ||
        '—';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                        p: 1, borderRadius: 2,
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                        display: 'flex', alignItems: 'center',
                    }}>
                        <ClassIcon sx={{ color: '#fff', fontSize: 22 }} />
                    </Box>
                    <Typography variant="h5" fontWeight={700}>Class Management</Typography>
                    {!loading && (
                        <Chip
                            label={`${filtered.length} class${filtered.length !== 1 ? 'es' : ''}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(14,165,233,0.15)', color: '#0ea5e9', fontWeight: 600 }}
                        />
                    )}
                </Box>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/Admin/addclass')}>
                    Create Class
                </Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Search bar */}
            <Paper sx={{ p: 2, mb: 2, background: 'linear-gradient(135deg, rgba(14,165,233,0.05) 0%, rgba(99,102,241,0.05) 100%)' }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search by class name or section…"
                    value={search}
                    onChange={handleSearchChange}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                        endAdornment: search ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={handleClearSearch}>
                                    <ClearIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    }}
                />
            </Paper>

            {/* Table */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : (
                <Paper>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    {['Class Name', 'Section', 'Teacher', 'Students', 'Subjects', 'Status', 'Actions'].map(h => (
                                        <TableCell key={h}><strong>{h}</strong></TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginated.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                                            {search ? `No classes match "${search}"` : 'No classes found. Click "Create Class" to get started.'}
                                        </TableCell>
                                    </TableRow>
                                ) : paginated.map(c => (
                                    <TableRow key={c._id} hover>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={600}>{c.sclassName || c.className}</Typography>
                                        </TableCell>
                                        <TableCell>{c.section || <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                                        <TableCell>{teacherName(c)}</TableCell>
                                        <TableCell>
                                            <Chip label={classStudentCount(c)} size="small"
                                                color={classStudentCount(c) > 0 ? 'primary' : 'default'} variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={classSubjectCount(c)} size="small"
                                                color={classSubjectCount(c) > 0 ? 'info' : 'default'} variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={c.status || 'active'}
                                                size="small"
                                                color={c.status === 'inactive' ? 'default' : 'success'}
                                                onClick={() => handleToggleStatus(c._id, c.status || 'active')}
                                                sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                <Tooltip title="View / Manage">
                                                    <IconButton size="small" color="primary" onClick={() => navigate(`/Admin/manage/classes/${c._id}`)}>
                                                        <VisibilityIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => openEdit(c)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton size="small" color="error"
                                                        onClick={() => handleDelete(c._id, c.sclassName || c.className)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination */}
                    <TablePagination
                        component="div"
                        count={filtered.length}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        rowsPerPageOptions={ROWS_OPTIONS}
                        labelRowsPerPage="Rows per page:"
                    />
                </Paper>
            )}

            {/* ── Edit Dialog ── */}
            <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Class</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField
                        label="Class Name" value={editForm.className} required fullWidth
                        onChange={e => setEditForm(f => ({ ...f, className: e.target.value }))}
                    />
                    <TextField
                        label="Section" value={editForm.section} fullWidth
                        onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))}
                    />
                    <FormControl fullWidth>
                        <InputLabel>Class Teacher</InputLabel>
                        <Select value={editForm.classTeacherId} label="Class Teacher"
                            onChange={e => setEditForm(f => ({ ...f, classTeacherId: e.target.value }))}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {teachers.map(t => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel>Subjects</InputLabel>
                        <Select multiple value={editForm.subjectIds}
                            input={<OutlinedInput label="Subjects" />}
                            onChange={e => setEditForm(f => ({ ...f, subjectIds: e.target.value }))}
                            renderValue={sel => sel.map(id => {
                                const s = subjects.find(s => String(s._id) === String(id));
                                return s ? subLabel(s) : id;
                            }).join(', ')}>
                            {subjects.map(s => (
                                <MenuItem key={s._id} value={String(s._id)}>
                                    <Checkbox checked={editForm.subjectIds.includes(String(s._id))} />
                                    <ListItemText primary={subLabel(s)} />
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleEditSave} disabled={saving}>
                        {saving ? <CircularProgress size={20} /> : 'Update'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Detail / Manage Dialog ── */}
            <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {detail?.sclass?.sclassName
                        ? `Manage — ${detail.sclass.sclassName}${detail.sclass.section ? ` (${detail.sclass.section})` : ''}`
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

                            {detailTab === 0 && (
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                                        <Button size="small" variant="outlined" startIcon={<AddIcon />}
                                            onClick={() => { setNewSubForm({ subName: '', subCode: '', teacherId: '' }); setAddSubOpen(true); }}>
                                            Add Subject
                                        </Button>
                                    </Box>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Subject</TableCell>
                                                <TableCell>Code</TableCell>
                                                <TableCell>Teacher</TableCell>
                                                <TableCell align="right">Remove</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {!detail.subjects?.length ? (
                                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No subjects assigned.</TableCell></TableRow>
                                            ) : detail.subjects.map(s => (
                                                <TableRow key={s._id} hover>
                                                    <TableCell><strong>{s.subName}</strong></TableCell>
                                                    <TableCell>{s.subCode || '—'}</TableCell>
                                                    <TableCell>{s.teacherId?.name || '—'}</TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Remove">
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

                            {detailTab === 1 && (
                                <Box>
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
                                        <Button variant="contained" size="small" startIcon={<PersonAddIcon />}
                                            disabled={!enrollStudent} onClick={handleEnrollStudent}>
                                            Enroll
                                        </Button>
                                    </Box>
                                    <Divider sx={{ mb: 1.5 }} />
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Roll No</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="right">Remove</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {!detail.students?.length ? (
                                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>No students enrolled.</TableCell></TableRow>
                                            ) : detail.students.map(s => (
                                                <TableRow key={s._id} hover>
                                                    <TableCell>{s.name}</TableCell>
                                                    <TableCell>{s.rollNum}</TableCell>
                                                    <TableCell>
                                                        <Chip label={s.status || 'active'} size="small"
                                                            color={s.status === 'active' ? 'success' : s.status === 'suspended' ? 'error' : 'default'} />
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
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Subjects</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {!detail.teachers?.length ? (
                                            <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>No teachers assigned.</TableCell></TableRow>
                                        ) : detail.teachers.map(t => (
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

            {/* ── Add Subject Dialog ── */}
            <Dialog open={addSubOpen} onClose={() => setAddSubOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Subject to Class</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Subject Name" required fullWidth value={newSubForm.subName}
                        onChange={e => setNewSubForm(f => ({ ...f, subName: e.target.value }))} />
                    <TextField label="Subject Code" fullWidth value={newSubForm.subCode}
                        onChange={e => setNewSubForm(f => ({ ...f, subCode: e.target.value }))} />
                    <FormControl fullWidth>
                        <InputLabel>Handling Teacher (optional)</InputLabel>
                        <Select value={newSubForm.teacherId} label="Handling Teacher (optional)"
                            onChange={e => setNewSubForm(f => ({ ...f, teacherId: e.target.value }))}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {teachers.map(t => <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}
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
