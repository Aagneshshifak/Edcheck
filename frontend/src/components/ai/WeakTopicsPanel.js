import { useState, useEffect } from 'react';
import {
    Box, Typography, Select, MenuItem, FormControl, InputLabel,
    Button, CircularProgress, Alert, Card, CardContent, Chip,
} from '@mui/material';
import axiosInstance from '../../utils/axiosInstance';

const severityColor = {
    high:   '#f44336',
    medium: '#ff9800',
    low:    '#4caf50',
};

const WeakTopicsPanel = ({ teachSubjects = [], classId = '' }) => {
    const [subjectId, setSubjectId]   = useState('');
    const [loading, setLoading]       = useState(false);
    const [loadingStored, setLoadingStored] = useState(false);
    const [error, setError]           = useState('');
    const [result, setResult]         = useState(null);
    const [stored, setStored]         = useState([]);   // persisted TopicPerformance records

    // Load stored topic performance whenever subject/class changes
    useEffect(() => {
        if (!subjectId || !classId) { setStored([]); return; }
        setLoadingStored(true);
        axiosInstance.get('/AI/topic-performance', { params: { subjectId, classId } })
            .then(({ data }) => setStored(data.topicPerformance || []))
            .catch(() => setStored([]))
            .finally(() => setLoadingStored(false));
    }, [subjectId, classId]);

    const handleSubmit = async () => {
        if (!subjectId || !classId) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const { data } = await axiosInstance.post('/AI/weak-topics', { subjectId, classId });
            setResult(data);
            // Refresh stored records after new analysis
            const { data: perf } = await axiosInstance.get('/AI/topic-performance', { params: { subjectId, classId } });
            setStored(perf.topicPerformance || []);
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

    // Prefer fresh AI result; fall back to stored records
    const weakTopics = result?.weakTopics ?? stored.map(r => ({
        topic: r.topic,
        scorePercent: r.averageScore,
        severity: r.severity,
    }));

    const clarificationMap = {};
    if (result?.clarificationSuggestions) {
        result.clarificationSuggestions.forEach(c => { clarificationMap[c.topic] = c.suggestion; });
    } else {
        stored.forEach(r => { clarificationMap[r.topic] = r.suggestion; });
    }

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
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Analyse Now'}
                </Button>
            </Box>

            {!classId && (
                <Alert severity="warning" sx={{ mb: 2 }}>No class assigned to your account.</Alert>
            )}

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {loadingStored && <CircularProgress size={20} sx={{ mb: 2 }} />}

            {!loading && !loadingStored && weakTopics.length === 0 && subjectId && (
                <Alert severity="info">No weak topics on record — click "Analyse Now" to run a fresh analysis.</Alert>
            )}

            {weakTopics.length > 0 && (
                <Box>
                    {stored.length > 0 && !result && (
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Showing last analysis · {new Date(stored[0]?.lastAnalyzed).toLocaleString()}
                        </Typography>
                    )}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {weakTopics.map((wt, i) => {
                            const color = severityColor[wt.severity] || '#9e9e9e';
                            const suggestion = clarificationMap[wt.topic];
                            const weakCount = stored.find(r => r.topic === wt.topic)?.weakStudents;
                            return (
                                <Card key={i} variant="outlined" sx={{ borderLeft: `4px solid ${color}` }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Typography variant="subtitle1" fontWeight={600}>
                                                {wt.topic}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                {weakCount != null && (
                                                    <Chip label={`${weakCount} weak students`} size="small" variant="outlined" />
                                                )}
                                                <Typography variant="body2" sx={{ color, fontWeight: 700 }}>
                                                    {wt.severity?.toUpperCase()} — {Math.round(wt.scorePercent)}%
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {suggestion && (
                                            <Typography variant="body2" color="text.secondary">
                                                💡 {suggestion}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default WeakTopicsPanel;
