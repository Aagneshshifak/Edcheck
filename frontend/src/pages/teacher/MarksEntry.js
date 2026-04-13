import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, TextField, Button, CircularProgress,
    Alert, Chip, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import GradeIcon from '@mui/icons-material/Grade';
import SaveIcon  from '@mui/icons-material/Save';


const GRADE = (v) => {
    if (v >= 90) return { label: 'A+', color: '#34d399' };
    if (v >= 80) return { label: 'A',  color: '#34d399' };
    if (v >= 70) return { label: 'B',  color: '#0ea5e9' };
    if (v >= 60) return { label: 'C',  color: '#f59e0b' };
    if (v >= 50) return { label: 'D',  color: '#f97316' };
    return           { label: 'F',  color: '#ef4444' };
};

const MarksEntry = () => {
    const { currentUser } = useSelector(s => s.user);

    const [classes,   setClasses]   = useState([]);
    const [subjects,  setSubjects]  = useState([]);
    const [students,  setStudents]  = useState([]);
    const [classId,   setClassId]   = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [marks,     setMarks]     = useState({});   // { studentId: { marks, maxMarks } }
    const [loading,   setLoading]   = useState(false);
    const [saving,    setSaving]    = useState(false);
    const [error,     setError]     = useState('');
    const [success,   setSuccess]   = useState('');

    // Load teacher's classes + subjects
    useEffect(() => {
        if (!currentUser?._id) return;
        axiosInstance.get(`/Teacher/${currentUser._id}`)
            .then(({ data }) => {
                const cls = data.teachClasses?.length  ? data.teachClasses  : data.teachSclass  ? [data.teachSclass]  : [];
                const sub = data.teachSubjects?.length ? data.teachSubjects : data.teachSubject ? [data.teachSubject] : [];
                setClasses(cls.filter(Boolean));
                setSubjects(sub.filter(Boolean));
                if (cls[0]) setClassId(cls[0]._id || cls[0]);
                if (sub[0]) setSubjectId(sub[0]._id || sub[0]);
            })
            .catch(() => setError('Failed to load teacher data.'));
    }, [currentUser?._id]);

    // Load students when class changes
    useEffect(() => {
        if (!classId) return;
        setLoading(true);
        setStudents([]);
        setMarks({});
        axiosInstance.get(`/Sclass/Students/${classId}`)
            .then(({ data }) => {
                const list = Array.isArray(data) ? data : [];
                list.sort((a, b) => (a.rollNum || 0) - (b.rollNum || 0));
                setStudents(list);
                const init = {};
                list.forEach(s => { init[s._id] = { marks: '', maxMarks: 100 }; });
                setMarks(init);
            })
            .catch(() => setError('Failed to load students.'))
            .finally(() => setLoading(false));
    }, [classId]);

    const handleSave = async () => {
        if (!subjectId) return setError('Please select a subject.');
        setSaving(true); setError(''); setSuccess('');

        try {
            await Promise.all(
                students
                    .filter(s => marks[s._id]?.marks !== '' && marks[s._id]?.marks !== undefined)
                    .map(s =>
                        axiosInstance.put(`/UpdateExamResult/${s._id}`, {
                            subName:       subjectId,
                            marksObtained: Number(marks[s._id].marks),
                        })
                    )
            );
            setSuccess(`Marks saved for ${students.length} students.`);
        } catch {
            setError('Failed to save marks. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0b1120', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <GradeIcon sx={{ color: '#0ea5e9' }} />
                <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.4rem' }}>
                    Marks Entry
                </Typography>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* Controls */}
            <Paper sx={{ bgcolor: '#000000', border: '1px solid rgba(14,165,233,0.12)', borderRadius: 3, p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel sx={{ color: 'rgba(148,163,184,0.6)' }}>Class</InputLabel>
                    <Select value={classId} label="Class" onChange={e => setClassId(e.target.value)}
                        sx={{ color: '#f1f5f9', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(14,165,233,0.25)' } }}>
                        {classes.map(c => (
                            <MenuItem key={c._id || c} value={c._id || c}>
                                {c.className || c.sclassName || c}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel sx={{ color: 'rgba(148,163,184,0.6)' }}>Subject</InputLabel>
                    <Select value={subjectId} label="Subject" onChange={e => setSubjectId(e.target.value)}
                        sx={{ color: '#f1f5f9', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(14,165,233,0.25)' } }}>
                        {subjects.map(s => (
                            <MenuItem key={s._id || s} value={s._id || s}>
                                {s.subName || s.subjectName || s}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Paper>

            {/* Student marks table */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress sx={{ color: '#0ea5e9' }} />
                </Box>
            ) : (
                <Paper sx={{ bgcolor: '#000000', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#000000' }}>
                                {['Roll', 'Student Name', 'Marks (out of 100)', 'Grade'].map(h => (
                                    <TableCell key={h} sx={{ color: 'rgba(148,163,184,0.7)', fontWeight: 700, fontSize: '0.73rem', borderBottom: '1px solid rgba(255,255,255,0.07)', py: 1.5 }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'rgba(148,163,184,0.35)', borderBottom: 'none' }}>
                                        {classId ? 'No students in this class' : 'Select a class'}
                                    </TableCell>
                                </TableRow>
                            ) : students.map(s => {
                                const val = marks[s._id]?.marks;
                                const num = val !== '' && val !== undefined ? Number(val) : null;
                                const g   = num !== null && !isNaN(num) ? GRADE(num) : null;
                                return (
                                    <TableRow key={s._id} sx={{
                                        '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                                        '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                                    }}>
                                        <TableCell sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.8rem', width: 60 }}>{s.rollNum}</TableCell>
                                        <TableCell sx={{ color: '#f1f5f9', fontWeight: 500, fontSize: '0.85rem' }}>{s.name}</TableCell>
                                        <TableCell sx={{ width: 160 }}>
                                            <TextField
                                                size="small"
                                                type="number"
                                                inputProps={{ min: 0, max: 100, step: 1 }}
                                                value={marks[s._id]?.marks ?? ''}
                                                onChange={e => setMarks(prev => ({
                                                    ...prev,
                                                    [s._id]: { ...prev[s._id], marks: e.target.value },
                                                }))}
                                                sx={{
                                                    width: 100,
                                                    '& .MuiOutlinedInput-root': {
                                                        color: '#f1f5f9',
                                                        '& fieldset': { borderColor: 'rgba(14,165,233,0.2)' },
                                                        '&:hover fieldset': { borderColor: 'rgba(14,165,233,0.5)' },
                                                        '&.Mui-focused fieldset': { borderColor: '#0ea5e9' },
                                                    },
                                                    '& input': { py: 0.8, px: 1.2, fontSize: '0.85rem' },
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {g ? (
                                                <Chip label={g.label} size="small" sx={{
                                                    bgcolor: `${g.color}18`, color: g.color,
                                                    border: `1px solid ${g.color}40`,
                                                    fontWeight: 700, fontSize: '0.72rem',
                                                }} />
                                            ) : (
                                                <Typography sx={{ color: 'rgba(148,163,184,0.25)', fontSize: '0.75rem' }}>—</Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}

            {students.length > 0 && (
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="contained" size="large"
                        onClick={handleSave} disabled={saving}
                        startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                        sx={{
                            bgcolor: '#0ea5e9', color: '#fff', borderRadius: 2.5,
                            textTransform: 'none', fontWeight: 700, px: 4,
                            boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
                            '&:hover': { bgcolor: '#0284c7' },
                        }}>
                        {saving ? 'Saving…' : 'Save Marks'}
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default MarksEntry;
