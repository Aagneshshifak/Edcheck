import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Chip,
    Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BarChartIcon from '@mui/icons-material/BarChart';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

const TestList = () => {
    const { currentUser } = useSelector((state) => state.user);

    // teachSclass may be null — fall back to teachClasses[0]
    const rawClass = currentUser?.teachSclass || currentUser?.teachClasses?.[0];
    const classId  = rawClass?._id || (typeof rawClass === 'string' ? rawClass : '') || '';

    const navigate = useNavigate();

    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
    const [noClass, setNoClass] = useState(false);

    const fetchTests = async () => {
        setLoading(true);
        try {
            // Build list of all class IDs this teacher is assigned to
            const allClassIds = [
                currentUser?.teachSclass?._id,
                ...(currentUser?.teachClasses || []).map(c => c._id || c),
            ].filter(id => id && String(id).length === 24) // valid ObjectId only
             .filter((v, i, a) => a.findIndex(x => String(x) === String(v)) === i); // dedupe

            if (allClassIds.length === 0) {
                setNoClass(true);
                setLoading(false);
                return;
            }

            // Subject IDs this teacher is assigned to
            const teachSubjectIds = [
                ...(currentUser?.teachSubjects || []).map(s => String(s._id || s)),
                currentUser?.teachSubject ? String(currentUser.teachSubject._id || currentUser.teachSubject) : null,
            ].filter(Boolean);

            // Fetch all tests for all classes
            const results = await Promise.all(
                allClassIds.map(cid =>
                    axiosInstance.get(`/TestsByClass/${cid}`).then(r => r.data).catch(() => [])
                )
            );

            // Flatten and deduplicate
            const seen = new Set();
            let all = results.flat().filter(t => {
                if (seen.has(t._id)) return false;
                seen.add(t._id);
                return true;
            });

            // Filter by subject only if teacher has subjects AND tests have subjects assigned
            if (teachSubjectIds.length > 0) {
                const subjectSet = new Set(teachSubjectIds);
                all = all.filter(t => {
                    if (!t.subject) return true; // no subject → visible to all
                    const sid = String(t.subject._id || t.subject);
                    return subjectSet.has(sid);
                });
            }

            setTests(all);
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to load tests', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = async (id) => {
        try {
            await axiosInstance.delete(`/Test/${id}`);
            setSnackbar({ open: true, message: 'Test deleted', severity: 'success' });
            fetchTests();
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to delete test', severity: 'error' });
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>Tests</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/Teacher/tests/create')}>
                    Create Test
                </Button>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
            ) : tests.length === 0 ? (
                <Box>
                    <Typography color="text.secondary" sx={{ mb: 1 }}>No tests found for your class.</Typography>
                    {noClass && (
                        <Alert severity="warning">No class is assigned to your account. Ask your admin to assign you to a class.</Alert>
                    )}
                </Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Title</strong></TableCell>
                                <TableCell><strong>Subject</strong></TableCell>
                                <TableCell><strong>Duration</strong></TableCell>
                                <TableCell><strong>Questions</strong></TableCell>
                                <TableCell><strong>Status</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tests.map((test) => {
                                const qCount = test.questions?.length ?? 0;
                                const needsQuestions = qCount === 0;
                                return (
                                    <TableRow key={test._id} hover>
                                        <TableCell>{test.title}</TableCell>
                                        <TableCell>{test.subject?.subName || test.subject?.subjectName || '—'}</TableCell>
                                        <TableCell>{test.durationMinutes} min</TableCell>
                                        <TableCell>
                                            {needsQuestions
                                                ? <Chip label="No questions" size="small" color="warning" />
                                                : qCount}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={test.isActive ? 'Active' : 'Inactive'}
                                                size="small"
                                                color={test.isActive ? 'success' : 'default'}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title={needsQuestions ? 'Add Questions' : 'Edit Questions'}>
                                                <IconButton
                                                    color={needsQuestions ? 'warning' : 'primary'}
                                                    onClick={() => navigate(`/Teacher/tests/${test._id}/questions`)}
                                                >
                                                    {needsQuestions ? <AddIcon /> : <EditIcon />}
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="View Results">
                                                <IconButton color="primary" onClick={() => navigate(`/Teacher/tests/${test._id}/results`)}>
                                                    <BarChartIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton color="error" onClick={() => handleDelete(test._id)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Snackbar open={snackbar.open} autoHideDuration={4000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={() => setSnackbar(s => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default TestList;
