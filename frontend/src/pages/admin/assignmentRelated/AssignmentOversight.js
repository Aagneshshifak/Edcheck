import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Chip, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Box, IconButton, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const AssignmentOversight = () => {
    const navigate = useNavigate();
    const schoolId = useSelector(state => state.user.currentUser._id);

    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('');

    const fetchAssignments = () => {
        setLoading(true);
        setError('');
        axios.get(`${process.env.REACT_APP_BASE_URL}/Admin/assignments/${schoolId}`)
            .then(res => setAssignments(res.data))
            .catch(err => setError(err.response?.data?.message || 'Failed to load assignments'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchAssignments(); }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this assignment and all its submissions?')) return;
        try {
            await axios.delete(`${process.env.REACT_APP_BASE_URL}/Assignment/${id}`);
            setAssignments(prev => prev.filter(a => a._id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
    };

    // Derive unique class and subject options from fetched data
    const classOptions = [...new Map(
        assignments.map(a => [a.sclassName?._id, a.sclassName])
    ).values()].filter(Boolean);

    const subjectOptions = [...new Map(
        assignments.map(a => [a.subject?._id, a.subject])
    ).values()].filter(Boolean);

    const filtered = assignments.filter(a => {
        if (classFilter && a.sclassName?._id !== classFilter) return false;
        if (subjectFilter && a.subject?._id !== subjectFilter) return false;
        return true;
    });

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Assignment Oversight</Typography>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Class</InputLabel>
                    <Select value={classFilter} label="Class" onChange={e => setClassFilter(e.target.value)}>
                        <MenuItem value="">All Classes</MenuItem>
                        {classOptions.map(c => (
                            <MenuItem key={c._id} value={c._id}>
                                {c.sclassName || c.className}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select value={subjectFilter} label="Subject" onChange={e => setSubjectFilter(e.target.value)}>
                        <MenuItem value="">All Subjects</MenuItem>
                        {subjectOptions.map(s => (
                            <MenuItem key={s._id} value={s._id}>
                                {s.subName || s.subjectName}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress />
                </Box>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!loading && !error && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                <TableCell><strong>Title</strong></TableCell>
                                <TableCell><strong>Class</strong></TableCell>
                                <TableCell><strong>Subject</strong></TableCell>
                                <TableCell><strong>Due Date</strong></TableCell>
                                <TableCell align="center"><strong>Submissions</strong></TableCell>
                                <TableCell align="center"><strong>Status</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No assignments found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map(a => (
                                    <TableRow
                                        key={a._id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/Admin/assignments/${a._id}`)}
                                    >
                                        <TableCell>{a.title}</TableCell>
                                        <TableCell>{a.sclassName?.sclassName || a.sclassName?.className || '—'}</TableCell>
                                        <TableCell>{a.subject?.subName || a.subject?.subjectName || '—'}</TableCell>
                                        <TableCell>{new Date(a.dueDate).toLocaleDateString()}</TableCell>
                                        <TableCell align="center">{a.submissionCount ?? 0}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={a.status}
                                                size="small"
                                                sx={{
                                                    backgroundColor: a.status === 'Active' ? '#e8f5e9' : '#f5f5f5',
                                                    color: a.status === 'Active' ? '#2e7d32' : '#757575',
                                                    fontWeight: 600,
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Delete assignment">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={e => handleDelete(e, a._id)}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default AssignmentOversight;
