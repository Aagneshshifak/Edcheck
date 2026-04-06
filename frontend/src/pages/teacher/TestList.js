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
import EditIcon from '@mui/icons-material/Edit';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';

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
            const res = await axiosInstance.get(
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
            await axiosInstance.delete(`${process.env.REACT_APP_BASE_URL}/Test/${id}`);
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
                                <TableCell><strong>Publication Status</strong></TableCell>
                                <TableCell align="center"><strong>Actions</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tests.map((test) => {
                                const questionCount = test.questions?.length ?? 0;
                                const hasNoQuestions = questionCount === 0;
                                const isActive = test.isActive ?? false;

                                return (
                                    <TableRow key={test._id} hover>
                                        <TableCell>{test.title}</TableCell>
                                        <TableCell>
                                            {test.subject?.subName || test.subject || '—'}
                                        </TableCell>
                                        <TableCell>{test.durationMinutes}</TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {hasNoQuestions && (
                                                    <WarningIcon 
                                                        sx={{ 
                                                            color: 'warning.main', 
                                                            fontSize: 20 
                                                        }} 
                                                    />
                                                )}
                                                <Typography
                                                    sx={{
                                                        color: hasNoQuestions ? 'warning.main' : 'text.primary',
                                                        fontWeight: hasNoQuestions ? 600 : 400,
                                                    }}
                                                >
                                                    {questionCount}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {isActive ? (
                                                    <>
                                                        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                                                        <Typography sx={{ color: 'success.main' }}>Active</Typography>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CancelIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                                        <Typography sx={{ color: 'text.secondary' }}>Inactive</Typography>
                                                    </>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center">
                                            {hasNoQuestions ? (
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    size="small"
                                                    startIcon={<AddIcon />}
                                                    onClick={() => navigate(`/Teacher/tests/${test._id}/questions`)}
                                                    sx={{ mr: 1 }}
                                                >
                                                    Add Questions
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="outlined"
                                                    color="primary"
                                                    size="small"
                                                    startIcon={<EditIcon />}
                                                    onClick={() => navigate(`/Teacher/tests/${test._id}/questions`)}
                                                    sx={{ mr: 1 }}
                                                >
                                                    Edit Questions
                                                </Button>
                                            )}
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
                                );
                            })}
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
