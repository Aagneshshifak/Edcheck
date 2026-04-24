import { useState } from 'react';
import {
    Box, Typography, Select, MenuItem, FormControl, InputLabel,
    Button, CircularProgress, Alert, Card, CardContent,
} from '@mui/material';
import axiosInstance from '../../utils/axiosInstance';

const severityColor = {
    high: '#f44336',
    medium: '#ff9800',
    low: '#4caf50',
};

const WeakTopicsPanel = ({ teachSubjects = [], classId = '' }) => {
    const [subjectId, setSubjectId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const handleSubmit = async () => {
        if (!subjectId || !classId) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const { data } = await axiosInstance.post('/AI/weak-topics', { subjectId, classId });
            setResult(data);
        } catch (err) {
            if (err.response?.status === 404) {
                setError('No test results yet — run a test first to detect weak topics');
            } else {
                setError(err.response?.data?.message || 'Failed to detect weak topics');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Weak Topics Detection</Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select value={subjectId} label="Subject" onChange={e => setSubjectId(e.target.value)}>
                        {teachSubjects.map(s => (
                            <MenuItem key={s._id} value={s._id}>
                                {s.subjectName || s.subName}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading || !subjectId || !classId}
                >
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Detect Weak Topics'}
                </Button>
            </Box>

            {!classId && (
                <Alert severity="warning" sx={{ mb: 2 }}>No class assigned to your account.</Alert>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {result && result.weakTopics?.length === 0 && (
                <Alert severity="info">No weak topics detected — the class is performing well!</Alert>
            )}

            {result && result.weakTopics?.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {result.weakTopics.map((wt, i) => {
                        const clarification = result.clarificationSuggestions?.find(c => c.topic === wt.topic);
                        const color = severityColor[wt.severity] || '#9e9e9e';
                        return (
                            <Card
                                key={i}
                                variant="outlined"
                                sx={{ borderLeft: `4px solid ${color}` }}
                            >
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {wt.topic}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color, fontWeight: 700 }}>
                                            {wt.severity?.toUpperCase()} — {wt.scorePercent}%
                                        </Typography>
                                    </Box>
                                    {clarification && (
                                        <Typography variant="body2" color="text.secondary">
                                            {clarification.suggestion}
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};

export default WeakTopicsPanel;
