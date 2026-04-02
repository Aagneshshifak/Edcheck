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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BarChartIcon from '@mui/icons-material/BarChart';
import AddIcon from '@mui/icons-material/Add';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const TestList = () => {
    const { currentUser } = useSelector((state) => state.user);
    const classId = currentUser?.teachSclass?._id
        || currentUser?.teachClasses?.[0]?._id
        || currentUser?.teachClasses?.[0]
        || '';
    const schoolId = currentUser?.school?._id || currentUser?.schoolId || '';
    const navigate = useNavigate();

    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    const fetchTests = async () => {
        setLoading(true);
        try {
            const res = await axios.get(
                `${process.env.REACT_APP_BASE_URL}/TestsByClass/${classId}?school=${schoolId}`
            );
            setTests(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to load tests', severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (classId) fetchTests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classId]);

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${process.env.REACT_APP_BASE_URL}/Test/${id}`);
            setSnackbar({ open: true, message: 'Test deleted', severity: 'success' });
            fetchTests();
        } catch (err) {
            setSnackbar({ open: true, message: 'Failed to delete test', severity: 'error' });
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>
                    Tests
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/Teacher/tests/create')}
                >
                    Create Test
                </Button>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : tests.length === 0 ? (
                <Typography color="text.secondary">No tests found. Create one to get started.</Typography>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Title</strong></TableCell>
                                <TableCell><strong>Subject</strong></TableCell>
                                <TableCell><strong>Duration (min)</strong></TableCell>
                                <TableCell><strong>Questions</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tests.map((test) => (
                                <TableRow key={test._id} hover>
                                    <TableCell>{test.title}</TableCell>
                                    <TableCell>
                                        {test.subject?.subName || test.subject || '—'}
                                    </TableCell>
                                    <TableCell>{test.durationMinutes}</TableCell>
                                    <TableCell>{test.questions?.length ?? 0}</TableCell>
                                    <TableCell align="center">
                                        <IconButton
                                            color="primary"
                                            onClick={() => navigate(`/Teacher/tests/${test._id}/results`)}
                                            title="View Results"
                                        >
                                            <BarChartIcon />
                                        </IconButton>
                                        <IconButton
                                            color="error"
                                            onClick={() => handleDelete(test._id)}
                                            title="Delete"
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default TestList;
