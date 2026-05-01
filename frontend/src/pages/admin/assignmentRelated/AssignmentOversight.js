import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Box, IconButton, Tooltip,
    LinearProgress, Tabs, Tab,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';


const AssignmentOversight = () => {
    const navigate  = useNavigate();
    const schoolId  = useSelector(s => s.user.currentUser._id);

    const [assignments,    setAssignments]    = useState([]);
    const [classes,        setClasses]        = useState([]);   // fetched independently
    const [subjects,       setSubjects]       = useState([]);   // fetched independently
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState('');
    const [classFilter,    setClassFilter]    = useState('');
    const [subjectFilter,  setSubjectFilter]  = useState('');
    const [tab,            setTab]            = useState(0); // 0=All, 1=Active, 2=Overdue

    const fetchAssignments = () => {
        setLoading(true); setError('');
        axiosInstance.get(`/Admin/assignments/${schoolId}`)
            .then(res => setAssignments(Array.isArray(res.data) ? res.data : []))
            .catch(err => setError(err.response?.data?.message || 'Failed to load assignments'))
            .finally(() => setLoading(false));
    };

    // Fetch classes and subjects independently — don't rely on assignments being populated
    useEffect(() => {
        if (!schoolId) return;
        axiosInstance.get(`/SclassList/${schoolId}`)
            .then(res => setClasses(Array.isArray(res.data) ? res.data : []))
            .catch(() => setClasses([]));
        axiosInstance.get(`/AllSubjects/${schoolId}`)
            .then(res => setSubjects(Array.isArray(res.data) ? res.data : []))
            .catch(() => setSubjects([]));
    }, [schoolId]);

    useEffect(() => { fetchAssignments(); }, [schoolId]); // eslint-disable-line

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this assignment and all its submissions?')) return;
        try {
            await axiosInstance.delete(`/Assignment/${id}`);
            setAssignments(prev => prev.filter(a => a._id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed'); }
    };

    const classOptions   = classes;   // already distinct from /SclassList
    const subjectOptions = subjects;  // already distinct from /AllSubjects

    const filtered = assignments.filter(a => {
        if (classFilter   && a.sclassName?._id !== classFilter)   return false;
        if (subjectFilter && a.subject?._id    !== subjectFilter)  return false;
        if (tab === 1 && a.status !== 'Active')  return false;
        if (tab === 2 && !a.overdue)             return false;
        return true;
    });

    const overdueCount = assignments.filter(a => a.overdue).length;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Assignment Overview</Typography>

            {/* Summary chips */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Chip label={`${assignments.length} total`} />
                <Chip label={`${assignments.filter(a => a.status === 'Active').length} active`} color="success" />
                <Chip label={`${overdueCount} overdue`} color={overdueCount > 0 ? 'error' : 'default'} icon={overdueCount > 0 ? <WarningAmberIcon /> : undefined} />
            </Box>

            {/* Tabs */}
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab label="All" />
                <Tab label="Active" />
                <Tab label={`Overdue (${overdueCount})`} />
            </Tabs>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Class</InputLabel>
                    <Select value={classFilter} label="Class" onChange={e => setClassFilter(e.target.value)}>
                        <MenuItem value="">All Classes</MenuItem>
                        {classOptions.map(c => (
                            <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select value={subjectFilter} label="Subject" onChange={e => setSubjectFilter(e.target.value)}>
                        <MenuItem value="">All Subjects</MenuItem>
                        {subjectOptions.map(s => (
                            <MenuItem key={s._id} value={s._id}>{s.subName}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>}
            {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!loading && !error && (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                {['Title','Subject','Teacher','Class','Due Date','Submission Rate','Status',''].map(h => (
                                    <TableCell key={h}><strong>{h}</strong></TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>No assignments found.</TableCell></TableRow>
                            ) : filtered.map(a => (
                                <TableRow key={a._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/Admin/assignments/${a._id}`)}>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {a.overdue && <Tooltip title="Overdue — incomplete submissions"><WarningAmberIcon fontSize="small" color="error" /></Tooltip>}
                                            {a.title}
                                        </Box>
                                    </TableCell>
                                    <TableCell>{a.subject?.subName || a.subject?.subjectName || '—'}</TableCell>
                                    <TableCell>{a.createdBy?.name || '—'}</TableCell>
                                    <TableCell>{a.sclassName?.sclassName || a.sclassName?.className || '—'}</TableCell>
                                    <TableCell>{new Date(a.dueDate).toLocaleDateString()}</TableCell>
                                    <TableCell sx={{ minWidth: 140 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={a.submissionRate || 0}
                                                sx={{ flexGrow: 1, height: 6, borderRadius: 3,
                                                    '& .MuiLinearProgress-bar': { bgcolor: a.submissionRate >= 80 ? '#4caf50' : a.submissionRate >= 50 ? '#ff9800' : '#f44336' }
                                                }}
                                            />
                                            <Typography variant="caption">{a.submissionRate ?? 0}%</Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            {a.submissionCount}/{a.totalStudents} submitted
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={a.status} size="small"
                                            sx={{ bgcolor: a.status === 'Active' ? '#e8f5e9' : '#f5f5f5',
                                                  color: a.status === 'Active' ? '#2e7d32' : '#757575', fontWeight: 600 }} />
                                    </TableCell>
                                    <TableCell>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={e => handleDelete(e, a._id)}>
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
        </Container>
    );
};

export default AssignmentOversight;
