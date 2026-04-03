import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Container, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, CircularProgress, Alert, Box, Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const TestDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        axiosInstance.get(`${process.env.REACT_APP_BASE_URL}/AttemptsByTest/${id}`)
            .then(res => setAttempts(res.data))
            .catch(err => setError(err.response?.data?.message || 'Failed to load attempts'))
            .finally(() => setLoading(false));
    }, [id]);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/Admin/tests')}
                    variant="outlined"
                    size="small"
                >
                    Back
                </Button>
                <Typography variant="h5">Test Attempts</Typography>
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
                                <TableCell><strong>Student Name</strong></TableCell>
                                <TableCell align="center"><strong>Score</strong></TableCell>
                                <TableCell align="center"><strong>Total Marks</strong></TableCell>
                                <TableCell align="center"><strong>Percentage</strong></TableCell>
                                <TableCell><strong>Submitted At</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {attempts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No attempts yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                attempts.map(a => {
                                    const pct = a.totalMarks > 0
                                        ? Math.round((a.score / a.totalMarks) * 100)
                                        : 0;
                                    return (
                                        <TableRow key={a._id} hover>
                                            <TableCell>{a.studentId?.name || '—'}</TableCell>
                                            <TableCell align="center">{a.score}</TableCell>
                                            <TableCell align="center">{a.totalMarks}</TableCell>
                                            <TableCell align="center">{pct}%</TableCell>
                                            <TableCell>
                                                {a.submittedAt
                                                    ? new Date(a.submittedAt).toLocaleString()
                                                    : '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
};

export default TestDetail;
