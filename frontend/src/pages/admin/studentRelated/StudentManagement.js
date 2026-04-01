import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Paper, Button, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, IconButton,
    Chip, MenuItem, Select, FormControl, InputLabel, CircularProgress,
    Alert, Tooltip, Grid, Divider,
} from '@mui/material';
import AddIcon        from '@mui/icons-material/Add';
import DeleteIcon     from '@mui/icons-material/Delete';
import EditIcon       from '@mui/icons-material/Edit';
import BarChartIcon   from '@mui/icons-material/BarChart';
import PeopleIcon     from '@mui/icons-material/People';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';

const BASE = process.env.REACT_APP_BASE_URL;
const LIMIT = 20;

const STATUS_OPTIONS = ['active', 'inactive', 'suspended'];
const STATUS_COLORS  = { active: 'success', inactive: 'default', suspended: 'error' };

const EMPTY_FORM = {
    name: '', rollNum: '', password: '', classId: '',
    parentName: '', parentPhone: '', status: 'active',
};

const StudentManagement = () => {
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [students, setStudents] = useState([]);
    const [classes, setClasses]   = useState([]);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState('');
    const [success, setSuccess]   = useState('');

    // Cursor pagination state
    const [total, setTotal]           = useState(0);
    const [hasMore, setHasMore]       = useState(false);
    const [nextCursor, setNextCursor] = useState(null);
    // Stack of cursors for "previous" navigation: index 0 = first page (null cursor)
    const cursorStack = useRef([null]);
    const [pageIndex, setPageIndex]   = useState(0);

    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId]     = useState(null);
    const [form, setForm]         = useState(EMPTY_FORM);
    const [saving, setSaving]     = useState(false);

    const [perfOpen, setPerfOpen]       = useState(false);
    const [perfData, setPerfData]       = useState(null);
    const [perfLoading, setPerfLoading] = useState(false);

    const [filterClass, setFilterClass]   = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Fetch a page using a specific cursor
    const fetchPage = useCallback(async (cursor) => {
        setLoading(true); setError('');
        try {
            const params = { limit: LIMIT };
            if (cursor)       params.cursor  = cursor;
            if (filterClass)  params.classId = filterClass;
            if (filterStatus) params.status  = filterStatus;

            const { data } = await axios.get(`${BASE}/Students/${schoolId}`, { params });
            setStudents(data.students || []);
            setTotal(data.total ?? 0);
            setHasMore(data.hasMore ?? false);
            setNextCursor(data.nextCursor ?? null);
        } catch {
            setError('Failed to load students');
        } finally { setLoading(false); }
    }, [schoolId, filterClass, filterStatus]);

    // Fetch classes once
    useEffect(() => {
        axios.get(`${BASE}/SclassList/${schoolId}`)
            .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
            .catch(() => {});
    }, [schoolId]);

    // Reset to first page when filters change
    useEffect(() => {
        cursorStack.current = [null];
        setPageIndex(0);
        fetchPage(null);
    }, [fetchPage]); // fetchPage already depends on filters

    const goNext = () => {
        if (!hasMore || !nextCursor) return;
        const newIndex = pageIndex + 1;
        // Push next cursor onto stack if not already there
        if (cursorStack.current.length <= newIndex) {
            cursorStack.current.push(nextCursor);
        }
        setPageIndex(newIndex);
        fetchPage(nextCursor);
    };

    const goPrev = () => {
        if (pageIndex === 0) return;
        const newIndex = pageIndex - 1;
        setPageIndex(newIndex);
        fetchPage(cursorStack.current[newIndex]);
    };

    const refresh = () => {
        cursorStack.current = [null];
        setPageIndex(0);
        fetchPage(null);
    };

    const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true); };
    const openEdit = (s) => {
        setEditId(s._id);
        setForm({
            name:        s.name,
            rollNum:     s.rollNum,
            password:    '',
            classId:     String(s.sclassName?._id || s.classId || ''),
            parentName:  s.parentName  || '',
            parentPhone: s.parentPhone || '',
            status:      s.status      || 'active',
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.rollNum || !form.classId)
            return setError('Name, roll number and class are required');
        setSaving(true); setError('');
        try {
            if (editId) {
                await axios.put(`${BASE}/Admin/student/${editId}`, form);
                setSuccess('Student updated');
            } else {
                await axios.post(`${BASE}/Admin/student/add`, { ...form, schoolId });
                setSuccess('Student added');
            }
            setFormOpen(false);
            refresh();
        } catch (e) {
            setError(e.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove student "${name}"?`)) return;
        try {
            await axios.delete(`${BASE}/Admin/student/${id}`);
            setSuccess('Student removed');
            refresh();
        } catch (e) { setError(e.response?.data?.message || 'Delete failed'); }
    };

    const openPerf = async (id) => {
        setPerfOpen(true); setPerfLoading(true); setPerfData(null);
        try {
            const { data } = await axios.get(`${BASE}/Admin/student/${id}/performance`);
            setPerfData(data);
        } catch { setPerfData(null); }
        finally { setPerfLoading(false); }
    };

    const from = pageIndex * LIMIT + 1;
    const to   = pageIndex * LIMIT + students.length;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">
                    <PeopleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />Student Management
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>Add Student</Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Filter by Class</InputLabel>
                    <Select value={filterClass} label="Filter by Class" onChange={e => setFilterClass(e.target.value)}>
                        <MenuItem value=""><em>All Classes</em></MenuItem>
                        {classes.map(c => <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Filter by Status</InputLabel>
                    <Select value={filterStatus} label="Filter by Status" onChange={e => setFilterStatus(e.target.value)}>
                        <MenuItem value=""><em>All Statuses</em></MenuItem>
                        {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </Select>
                </FormControl>
                <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
                    {total > 0 ? `${from}–${to} of ${total}` : '0 students'}
                </Typography>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : (
                <Paper>
                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'grey.100' }}>
                                <TableRow>
                                    {['Name', 'Roll No', 'Class', 'Parent', 'Phone', 'Status', 'Actions'].map(h => (
                                        <TableCell key={h}><strong>{h}</strong></TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {students.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">No students found</TableCell>
                                    </TableRow>
                                ) : students.map(s => (
                                    <TableRow key={s._id} hover>
                                        <TableCell>{s.name}</TableCell>
                                        <TableCell>{s.rollNum}</TableCell>
                                        <TableCell>{s.sclassName?.sclassName || '—'}</TableCell>
                                        <TableCell>{s.parentName  || '—'}</TableCell>
                                        <TableCell>{s.parentPhone || '—'}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={s.status || 'active'} size="small"
                                                color={STATUS_COLORS[s.status || 'active']}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Performance">
                                                <IconButton size="small" onClick={() => openPerf(s._id)}><BarChartIcon /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit">
                                                <IconButton size="small" onClick={() => openEdit(s)}><EditIcon /></IconButton>
                                            </Tooltip>
                                            <Tooltip title="Remove">
                                                <IconButton size="small" color="error" onClick={() => handleDelete(s._id, s.name)}><DeleteIcon /></IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Cursor pagination controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 2, py: 1, gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Page {pageIndex + 1}
                        </Typography>
                        <IconButton size="small" onClick={goPrev} disabled={pageIndex === 0}>
                            <NavigateBeforeIcon />
                        </IconButton>
                        <IconButton size="small" onClick={goNext} disabled={!hasMore}>
                            <NavigateNextIcon />
                        </IconButton>
                    </Box>
                </Paper>
            )}

            {/* Add / Edit Dialog */}
            <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editId ? 'Edit Student' : 'Add Student'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField label="Full Name" value={form.name} required fullWidth
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    <TextField label="Roll Number" type="number" value={form.rollNum} required fullWidth
                        onChange={e => setForm(f => ({ ...f, rollNum: e.target.value }))} />
                    {!editId && (
                        <TextField label="Password (default: roll number)" type="password" value={form.password} fullWidth
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    )}
                    <FormControl fullWidth required>
                        <InputLabel>Class</InputLabel>
                        <Select value={form.classId} label="Class"
                            onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}>
                            {classes.map(c => <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Divider>Parent Info</Divider>
                    <TextField label="Parent Name" value={form.parentName} fullWidth
                        onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} />
                    <TextField label="Parent Phone" value={form.parentPhone} fullWidth
                        onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))} />
                    {editId && (
                        <FormControl fullWidth>
                            <InputLabel>Status</InputLabel>
                            <Select value={form.status} label="Status"
                                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                                {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                            </Select>
                        </FormControl>
                    )}
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
                <DialogTitle>Student Performance — {perfData?.student?.name}</DialogTitle>
                <DialogContent>
                    {perfLoading ? <CircularProgress /> : perfData ? (
                        <Box>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                Class: {perfData.student?.classId?.sclassName || '—'} &nbsp;|&nbsp; Roll: {perfData.student?.rollNum}
                            </Typography>
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                {[
                                    { label: 'Avg Test Score', value: perfData.stats?.avgTestScore ? `${perfData.stats.avgTestScore}%` : '—' },
                                    { label: 'Attendance',     value: perfData.stats?.attendancePercentage ? `${perfData.stats.attendancePercentage}%` : '—' },
                                    { label: 'Total Attempts', value: perfData.stats?.totalAttempts ?? '—' },
                                ].map(({ label, value }) => (
                                    <Grid item xs={4} key={label}>
                                        <Paper sx={{ p: 2, textAlign: 'center' }}>
                                            <Typography variant="h5" color="primary">{value}</Typography>
                                            <Typography variant="caption">{label}</Typography>
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                            <Divider sx={{ mb: 1 }}>Exam Results</Divider>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Subject</TableCell><TableCell>Marks</TableCell><TableCell>Max</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {perfData.student?.examResult?.map((r, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{r.subjectId?.subName || '—'}</TableCell>
                                            <TableCell>{r.marks}</TableCell>
                                            <TableCell>{r.maxMarks}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    ) : <Typography>No data available</Typography>}
                </DialogContent>
                <DialogActions><Button onClick={() => setPerfOpen(false)}>Close</Button></DialogActions>
            </Dialog>
        </Container>
    );
};

export default StudentManagement;
