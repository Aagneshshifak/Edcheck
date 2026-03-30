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
    CircularProgress,
    Chip,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const TestResults = () => {
    const { testId } = useParams();
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAttempts = async () => {
            try {
                const res = await axios.get(
                    `${process.env.REACT_APP_BASE_URL}/AttemptsByTest/${testId}`
                );
                setAttempts(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                setError('Failed to load results');
            } finally {
                setLoading(false);
            }
        };
        if (testId) fetchAttempts();
    }, [testId]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString();
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight={700} mb={3}>
                Test Results
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Typography color="error">{error}</Typography>
            ) : attempts.length === 0 ? (
                <Typography color="text.secondary">No attempts submitted yet.</Typography>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell><strong>Student Name</strong></TableCell>
                                <TableCell><strong>Roll No.</strong></TableCell>
                                <TableCell><strong>Score</strong></TableCell>
                                <TableCell><strong>Submission Type</strong></TableCell>
                                <TableCell><strong>Submitted At</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {attempts.map((attempt) => (
                                <TableRow key={attempt._id} hover>
                                    <TableCell>
                                        {attempt.studentId?.name || '—'}
                                    </TableCell>
                                    <TableCell>
                                        {attempt.studentId?.rollNum || '—'}
                                    </TableCell>
                                    <TableCell>
                                        {attempt.score} / {attempt.totalMarks}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={attempt.submissionType}
                                            color={attempt.submissionType === 'auto' ? 'warning' : 'success'}
                                            size="small"
                                        />
                                    </TableCell>
                                    <TableCell>{formatDate(attempt.submittedAt)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default TestResults;
