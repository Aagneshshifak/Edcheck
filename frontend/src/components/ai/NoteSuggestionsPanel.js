import { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Select, MenuItem, FormControl,
    InputLabel, Button, CircularProgress, Alert, Card, CardContent, Chip,
} from '@mui/material';
import axiosInstance from '../../utils/axiosInstance';

const NoteSuggestionsPanel = ({ teachSubjects = [] }) => {
    const [subjectId, setSubjectId] = useState('');
    const [topic, setTopic]         = useState('');
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');
    const [result, setResult]       = useState(null);
    const [cached, setCached]       = useState(null);   // last saved suggestion

    // Load cached suggestion when subject changes
    useEffect(() => {
        if (!subjectId) { setCached(null); return; }
        axiosInstance.get('/AI/note-suggestions/saved', { params: { subjectId } })
            .then(({ data }) => setCached(data.suggestions?.[0] || null))
            .catch(() => setCached(null));
    }, [subjectId]);

    const handleSubmit = async () => {
        if (!subjectId || !topic.trim()) return;
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const { data } = await axiosInstance.post('/AI/note-suggestions', { subjectId, topic: topic.trim() });
            setResult(data);
            setCached(null); // fresh result takes priority
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to get note suggestions');
        } finally {
            setLoading(false);
        }
    };

    const display = result || cached;

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Note Suggestions</Typography>

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

                <TextField
                    size="small"
                    label="Topic"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    sx={{ minWidth: 220 }}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />

                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading || !subjectId || !topic.trim()}
                >
                    {loading ? <CircularProgress size={20} color="inherit" /> : 'Get Suggestions'}
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!display && !loading && !error && subjectId && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    No saved suggestions for this subject yet. Enter a topic and click "Get Suggestions".
                </Alert>
            )}

            {cached && !result && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Showing last saved suggestions for "{cached.topic}" · {new Date(cached.lastFetched).toLocaleString()}
                </Alert>
            )}

            {display && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                Teaching Suggestions
                            </Typography>
                            {display.suggestions?.map((s, i) => (
                                <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {s}</Typography>
                            ))}
                        </CardContent>
                    </Card>

                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                Key Points
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {display.keyPoints?.map((kp, i) => (
                                    <Chip key={i} label={kp} size="small" color="primary" variant="outlined" />
                                ))}
                            </Box>
                        </CardContent>
                    </Card>

                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                Resources
                            </Typography>
                            {display.resources?.map((r, i) => (
                                <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>• {r}</Typography>
                            ))}
                        </CardContent>
                    </Card>
                </Box>
            )}
        </Box>
    );
};

export default NoteSuggestionsPanel;
