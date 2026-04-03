import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Box, Paper, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, IconButton,
    Chip, MenuItem, Select, FormControl, InputLabel, OutlinedInput,
    CircularProgress, Alert, Tooltip, Divider, Grid, Checkbox,
} from '@mui/material';
import AddIcon         from '@mui/icons-material/Add';
import DeleteIcon      from '@mui/icons-material/Delete';
import EditIcon        from '@mui/icons-material/Edit';
import BarChartIcon    from '@mui/icons-material/BarChart';
import PersonIcon      from '@mui/icons-material/Person';
import LockResetIcon   from '@mui/icons-material/LockReset';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useToast } from '../../../context/ToastContext';


const STATUS_COLORS = { active: 'success', suspended: 'error' };

const EMPTY_FORM = { name: '', email: '', password: '', phone: '', subjectIds: [], classIds: [] };

const TeacherManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);
    const { showSuccess, showError } = useToast();

    const [teachers, setTeachers] = useState([]);
    const [classes, setClasses]   = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [success, setSuccess]   = useState('');

    // Dialog state
    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId]     = useState(null);
    const [form, setForm]         = useState(EMPTY_FORM);
    const [saving, setSaving]     = useState(false);

    // Performance dialog
    const [perfOpen, setPerfOpen]       = useState(false);
    const [perfData, setPerfData]       = useState(null);
    const [perfLoading, setPerfLoading] = useState(false);

    // Bulk selection state
    const [selected, setSelected]             = useState(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [bulkDeleting, setBulkDeleting]     = useState(false);

    // Reset password state
    const [resetPwdOpen, setResetPwdOpen] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const fetchAll = useCallback(() => {
        setLoading(true);
        Promise.all([
            axiosInstance.get(`/Teachers/${schoolId}`),
            axiosInstance.get(`/SclassList/${schoolId}`),
            axiosInstance.get(`/AllSubjects/${schoolId}`),
        ]).then(([t, c, s]) => {
            setTeachers(Array.isArray(t.data) ? t.data : []);
            setClasses(Array.isArray(c.data) ? c.data : []);
            setSubjects(Array.isArray(s.data) ? s.data : []);
        }).catch(() => setError('Failed to load data'))
          .finally(() => setLoading(false));
    }, [schoolId]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Selection helpers ──────────────────────────────────────────────────────
    const allSelected  = teachers.length > 0 && teachers.every(t => selected.has(t._id));
    const someSelected = teachers.some(t => selected.has(t._id));

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelected(prev => {
                const next = new Set(prev);
                teachers.forEach(t => next.delete(t._id));
                return next;
            });
        } else {
            setSelected(prev => {
                const next = new Set(prev);
                teachers.forEach(t => next.add(t._id));
                return next;
            });
        }
    };

    const toggleSelect = (id) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    // ── Bulk delete ────────────────────────────────────────────────────────────
    const handleBulkDelete = async () => {
        setBulkDeleting(true);
        try {
            const teacherIds = Array.from(selected);
            const { data } = await axiosInstance.delete(`/Admin/teachers/bulk`, {
                data: { teacherIds, schoolId },
            });
            showSuccess(data.message || `${data.deleted} teachers removed`);
            setBulkDeleteOpen(false);
            setSelected(new Set());
            fetchAll();
        } catch (e) {
            showError(e.response?.data?.message || 'Bulk delete failed');
        } finally { setBulkDeleting(false); }
    };

    // ── CSV export ─────────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        const selectedTeachers = teachers.filter(t => selected.has(t._id));
        const header = 'Name,Email,Subjects,Status';
        const rows = selectedTeachers.map(t => {
            const name     = `"${(t.name || '').replace(/"/g, '""')}"`;
            const email    = t.email || '';
            const subs     = (t.teachSubjects?.length ? t.teachSubjects : t.teachSubject ? [t.teachSubject] : [])
                .map(s => s.subName || s).join('; ');
            const subjects = `"${subs.replace(/"/g, '""')}"`;
            const status   = t.status || 'active';
            return `${name},${email},${subjects},${status}`;
        });
        const csv  = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `teachers_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Status toggle ──────────────────────────────────────────────────────────
    const handleStatusToggle = async (teacher) => {
        const newStatus = teacher.status === 'active' ? 'suspended' : 'active';
        try {
            const { data } = await axiosInstance.put(`/Admin/teacher/${teacher._id}/status`, { status: newStatus });
            setTeachers(prev => prev.map(t => t._id === teacher._id ? { ...t, status: data.status } : t));
            showSuccess(`Teacher ${data.status === 'active' ? 'activated' : 'suspended'}`);
        } catch (e) {
            showError(e.response?.data?.message || 'Status update failed');
        }
    };

    // ── Reset password ─────────────────────────────────────────────────────────
    const handleResetPassword = async (id) => {
        setResetLoading(true);
        try {
            const { data } = await axiosInstance.post(`/Admin/teacher/${id}/resetPassword`);
            setTempPassword(data.tempPassword);
            setResetPwdOpen(true);
        } catch (e) {
            showError(e.response?.data?.message || 'Password reset failed');
        } finally { setResetLoading(false); }
    };

    const handleCloseResetDialog = () => {
        setResetPwdOpen(false);
        setTempPassword('');
    };

    // ── Add / Edit ─────────────────────────────────────────────────────────────
    const openAdd  = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true); };
    const openEdit = (t) => {
        setEditId(t._id);
        setForm({
            name:       t.name,
            email:      t.email,
            password:   '',
            phone:      t.phone || '',
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
                await axiosInstance.put(`/Admin/teacher/${editId}`, form);
                setSuccess('Teacher updated');
            } else {
                if (!form.password) return setError('Password is required');
                await axiosInstance.post(`/Admin/teacher/add`, { ...form, schoolId });
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
            await axiosInstance.delete(`/Admin/teacher/${id}`);
            setSuccess('Teacher removed');
            fetchAll();
        } catch (e) { setError(e.response?.data?.message || 'Delete failed'); }
    };

    const openPerf = async (id) => {
        setPerfOpen(true); setPerfLoading(true); setPerfData(null);
        try {
            const { data } = await axiosInstance.get(`/Admin/teacher/${id}/performance`);
            setPerfData(data);
        } catch { setPerfData(null); }
        finally { setPerfLoading(false); }
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Teacher Management
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Teacher</Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Bulk Action Bar */}
            {selected.size > 0 && (
                <Paper sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, mb: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {selected.size} selected
                    </Typography>
                    <Button
                        size="small" variant="outlined" color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => setBulkDeleteOpen(true)}
                    >
                        Delete Selected
                    </Button>
                    <Button size="small" variant="outlined" onClick={handleExportCSV}>
                        Export CSV
                    </Button>
                    <Button size="small" onClick={() => setSelected(new Set())} sx={{ ml: 'auto' }}>
                        Clear
                    </Button>
                </Paper>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        size="small"
                                        checked={allSelected}
                                        indeterminate={someSelected && !allSelected}
                                        onChange={toggleSelectAll}
                                        disabled={teachers.length === 0}
                                    />
                                </TableCell>
                                {['Name', 'Email', 'Phone', 'Subjects', 'Classes', 'Status', 'Actions'].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {teachers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">No teachers found</TableCell>
                                </TableRow>
                            ) : teachers.map(t => (
                                <TableRow key={t._id} hover selected={selected.has(t._id)}>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            size="small"
                                            checked={selected.has(t._id)}
                                            onChange={() => toggleSelect(t._id)}
                                        />
                                    </TableCell>
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
                                        <Tooltip title={`Click to ${t.status === 'active' ? 'suspend' : 'activate'}`}>
                                            <Chip
                                                label={t.status || 'active'} size="small"
                                                color={STATUS_COLORS[t.status || 'active'] || 'default'}
                                                onClick={() => handleStatusToggle(t)}
                                                sx={{ cursor: 'pointer' }}
                                            />
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title="Performance">
                                            <IconButton size="small" onClick={() => openPerf(t._id)}><BarChartIcon /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openEdit(t)}><EditIcon /></IconButton>
                                        </Tooltip>
                                        <Tooltip title="Reset Password">
                                            <span>
                                                <IconButton size="small" onClick={() => handleResetPassword(t._id)} disabled={resetLoading}>
                                                    <LockResetIcon />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="Remove">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(t._id, t.name)}><DeleteIcon /></IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete {selected.size} Teacher{selected.size !== 1 ? 's' : ''}?</DialogTitle>
                <DialogContent>
                    <Typography>
                        This will permanently remove {selected.size} teacher{selected.size !== 1 ? 's' : ''} and all associated records. This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleBulkDelete} disabled={bulkDeleting}>
                        {bulkDeleting ? <CircularProgress size={20} /> : `Delete ${selected.size}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={resetPwdOpen} onClose={handleCloseResetDialog} maxWidth="xs" fullWidth>
                <DialogTitle>Temporary Password</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                        Share this password with the teacher. It will not be shown again after closing this dialog.
                    </Typography>
                    <Box sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        bgcolor: 'grey.100', borderRadius: 1, px: 2, py: 1.5,
                    }}>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '1.1rem', flexGrow: 1, letterSpacing: 2 }}>
                            {tempPassword}
                        </Typography>
                        <Tooltip title="Copy">
                            <IconButton size="small" onClick={() => {
                                navigator.clipboard.writeText(tempPassword);
                                showSuccess('Password copied to clipboard');
                            }}>
                                <ContentCopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button variant="contained" onClick={handleCloseResetDialog}>Close</Button>
                </DialogActions>
            </Dialog>

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
