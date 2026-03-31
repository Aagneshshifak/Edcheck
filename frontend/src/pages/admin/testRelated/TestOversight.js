import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Box, IconButton, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

const TestOversight = () => {
    const navigate = useNavigate();
    const schoolId = useSelector(state => state.user.currentUser._id);

    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [classFilter, setClassFilter] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        axios.get(`${process.env.REACT_APP_BASE_URL}/Admin/tests/${schoolId}`)
            .then(res => setTests(res.data))
            .catch(err => setError(err.response?.data?.message || 'Failed to load tests'))
            .finally(() => setLoading(false));
    }, [schoolId]);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this test and all its attempts?')) return;
        try {
            await axios.delete(`${process.env.REACT_APP_BASE_URL}/Test/${id}`);
            setTests(prev => prev.filter(t => t._id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed');
        }
    };

    const classOptions = [...new Map(
        tests.map(t => [t.classId?._id, t.classId])
    ).values()].filter(Boolean);

    const filtered = classFilter
        ? tests.filter(t => t.classId?._id === classFilter)
        : tests;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Test Oversight</Typography>

            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
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
                                <TableCell><strong>Date</strong></TableCell>
                                <TableCell align="center"><strong>Attempts</strong></TableCell>
                                <TableCell align="center"><strong>Avg Score</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No tests found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map(t => (
                                    <TableRow
                                        key={t._id}
                                        hover
                                        sx={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/Admin/tests/${t._id}`)}
                                    >
                                        <TableCell>{t.title}</TableCell>
                                        <TableCell>{t.classId?.sclassName || t.classId?.className || '—'}</TableCell>
                                        <TableCell>{t.subject?.subName || t.subject?.subjectName || '—'}</TableCell>
                                        <TableCell>
                                            {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                                        </TableCell>
                                        <TableCell align="center">{t.attemptCount ?? 0}</TableCell>
                                        <TableCell align="center">
                                            {t.classAvgScore != null ? `${t.classAvgScore}` : '—'}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Delete test">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={e => handleDelete(e, t._id)}
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

export default TestOversight;
