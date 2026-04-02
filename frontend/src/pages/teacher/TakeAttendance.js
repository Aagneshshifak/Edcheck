import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Box, Button, Paper, Table, TableHead,
    TableBody, TableRow, TableCell, TableContainer, TextField,
    FormControl, InputLabel, Select, MenuItem, LinearProgress,
    Chip, Alert, CircularProgress,
} from '@mui/material';
import CheckCircleIcon  from '@mui/icons-material/CheckCircle';
import CancelIcon       from '@mui/icons-material/Cancel';
import EventNoteIcon    from '@mui/icons-material/EventNote';

const BASE = process.env.REACT_APP_BASE_URL;

const TakeAttendance = () => {
    const { currentUser } = useSelector(s => s.user);

    const [classes, setClasses]   = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [students, setStudents]     = useState([]);
    const [marks, setMarks]           = useState({});
    const [classId, setClassId]       = useState('');
    const [subjectId, setSubjectId]   = useState('');
    const [date, setDate]             = useState(new Date().toISOString().slice(0, 10));
    const [loading, setLoading]       = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError]           = useState('');
    const [success, setSuccess]       = useState('');

    // Fetch populated teacher to get class/subject names
    useEffect(() => {
        if (!currentUser._id) return;
        axios.get(`${BASE}/Teacher/${currentUser._id}`)
            .then(({ data }) => {
                const cls = data.teachClasses?.length  ? data.teachClasses  : data.teachSclass  ? [data.teachSclass]  : [];
                const sub = data.teachSubjects?.length ? data.teachSubjects : data.teachSubject ? [data.teachSubject] : [];
                setClasses(cls.filter(Boolean));
                setSubjects(sub.filter(Boolean));
                if (cls[0]) setClassId(cls[0]._id || cls[0]);
                if (sub[0]) setSubjectId(sub[0]._id || sub[0]);
            })
            .catch(() => {
                // fallback to raw IDs
                const cls = currentUser.teachClasses  || (currentUser.teachSclass  ? [currentUser.teachSclass]  : []);
                const sub = currentUser.teachSubjects || (currentUser.teachSubject ? [currentUser.teachSubject] : []);
                setClasses(cls);
                setSubjects(sub);
                if (cls[0]) setClassId(cls[0]._id || cls[0]);
                if (sub[0]) setSubjectId(sub[0]._id || sub[0]);
            });
    }, [currentUser._id]);

    // Fetch students when class changes
    useEffect(() => {
        if (!classId) return;
        setLoading(true);
        setStudents([]);
        setMarks({});
        axios.get(`${BASE}/Sclass/Students/${classId}`)
            .then(({ data }) => {
                // Backend returns { message: "No students found" } when empty
                const list = Array.isArray(data) ? data : [];
                setStudents(list);
                const init = {};
                list.forEach(s => { init[s._id] = 'Present'; });
                setMarks(init);
            })
            .catch(() => {
                setStudents([]);
                setMarks({});
                setError('Failed to load students');
            })
            .finally(() => setLoading(false));
    }, [classId]);

    const toggle = (id) =>
        setMarks(prev => ({ ...prev, [id]: prev[id] === 'Present' ? 'Absent' : 'Present' }));

    const markAll = (status) => {
        const next = {};
        students.forEach(s => { next[s._id] = status; });
        setMarks(next);
    };

    const handleSubmit = async () => {
        if (!subjectId) return setError('Please select a subject');
        if (!date)      return setError('Please select a date');
        setSubmitting(true); setError(''); setSuccess('');
        try {
            await Promise.all(
                students.map(s =>
                    axios.put(`${BASE}/StudentAttendance/${s._id}`, {
                        subName: subjectId,
                        status:  marks[s._id] || 'Absent',
                        date,
                    })
                )
            );
            setSuccess(`Attendance submitted for ${students.length} students`);
        } catch {
            setError('Failed to submit attendance');
        } finally { setSubmitting(false); }
    };

    const presentCount = Object.values(marks).filter(v => v === 'Present').length;
    const total        = students.length;
    const pct          = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <EventNoteIcon />
                <Typography variant="h5">Take Attendance</Typography>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Controls */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Class</InputLabel>
                    <Select value={classId} label="Class" onChange={e => setClassId(e.target.value)}>
                        {classes.map(c => (
                            <MenuItem key={c._id || c} value={c._id || c}>
                                {c.sclassName || c.className || c}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select value={subjectId} label="Subject" onChange={e => setSubjectId(e.target.value)}>
                        {subjects.map(s => (
                            <MenuItem key={s._id || s} value={s._id || s}>
                                {s.subName || s.subjectName || s}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField
                    label="Date" type="date" size="small" value={date}
                    InputLabelProps={{ shrink: true }}
                    onChange={e => setDate(e.target.value)}
                />

                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" color="success" onClick={() => markAll('Present')}>
                        All Present
                    </Button>
                    <Button size="small" variant="outlined" color="error" onClick={() => markAll('Absent')}>
                        All Absent
                    </Button>
                </Box>
            </Paper>

            {/* Attendance summary bar */}
            {total > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">
                            Present: <strong>{presentCount}</strong> / {total}
                        </Typography>
                        <Typography variant="body2" color={pct >= 75 ? 'success.main' : 'error.main'}>
                            <strong>{pct}%</strong>
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate" value={pct}
                        sx={{
                            height: 8, borderRadius: 4,
                            '& .MuiLinearProgress-bar': {
                                bgcolor: pct >= 75 ? '#4caf50' : pct >= 50 ? '#ff9800' : '#f44336',
                            },
                        }}
                    />
                </Paper>
            )}

            {/* Student list */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell><strong>#</strong></TableCell>
                                <TableCell><strong>Student Name</strong></TableCell>
                                <TableCell><strong>Roll No</strong></TableCell>
                                <TableCell align="center"><strong>Status</strong></TableCell>
                                <TableCell align="center"><strong>Mark</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        {classId ? 'No students in this class' : 'Select a class to load students'}
                                    </TableCell>
                                </TableRow>
                            ) : students.map((s, i) => {
                                const isPresent = marks[s._id] === 'Present';
                                return (
                                    <TableRow key={s._id} hover
                                        sx={{ bgcolor: isPresent ? 'rgba(76,175,80,0.05)' : 'rgba(244,67,54,0.05)' }}>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell>{s.name}</TableCell>
                                        <TableCell>{s.rollNum}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={marks[s._id] || 'Present'}
                                                size="small"
                                                color={isPresent ? 'success' : 'error'}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                                                <Button
                                                    size="small" variant={isPresent ? 'contained' : 'outlined'}
                                                    color="success" startIcon={<CheckCircleIcon />}
                                                    onClick={() => setMarks(p => ({ ...p, [s._id]: 'Present' }))}
                                                    sx={{ minWidth: 90 }}
                                                >
                                                    Present
                                                </Button>
                                                <Button
                                                    size="small" variant={!isPresent ? 'contained' : 'outlined'}
                                                    color="error" startIcon={<CancelIcon />}
                                                    onClick={() => setMarks(p => ({ ...p, [s._id]: 'Absent' }))}
                                                    sx={{ minWidth: 90 }}
                                                >
                                                    Absent
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {students.length > 0 && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained" size="large"
                        onClick={handleSubmit} disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <EventNoteIcon />}
                    >
                        {submitting ? 'Submitting…' : 'Submit Attendance'}
                    </Button>
                </Box>
            )}
        </Container>
    );
};

export default TakeAttendance;
