import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Paper, Typography, Button, TextField, Table, TableBody,
    TableCell, TableHead, TableRow, Chip, CircularProgress, Alert,
} from '@mui/material';
import { markTeacherAttendance } from '../../../redux/timetableRelated/timetableSlice';


const BG     = '#ffffff';
const CARD   = '#000000';
const TEXT   = '#ffffff';
const MUTED  = 'rgba(255,255,255,0.6)';
const ACCENT = '#1976d2';

const cellSx = { borderColor: 'rgba(255,255,255,0.06)', color: '#111111', py: 1.5 };

const today = () => new Date().toISOString().split('T')[0];

export default function TeacherAttendanceManager() {
    const dispatch = useDispatch();
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [teachers,    setTeachers]    = useState([]);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState(null);
    const [date,        setDate]        = useState(today());
    const [attendance,  setAttendance]  = useState({});   // { [teacherId]: 'present' | 'absent' }
    const [saving,      setSaving]      = useState({});   // { [teacherId]: bool }
    const [saveError,   setSaveError]   = useState(null);

    useEffect(() => {
        if (!schoolId) return;
        setLoading(true);
        setError(null);
        axiosInstance.get(`/Teachers/${schoolId}`)
            .then(r => setTeachers(Array.isArray(r.data) ? r.data : []))
            .catch(() => setError('Failed to load teachers.'))
            .finally(() => setLoading(false));
    }, [schoolId]);

    const handleToggle = async (teacherId, currentStatus) => {
        const newStatus = currentStatus === 'absent' ? 'present' : 'absent';

        setSaving(prev => ({ ...prev, [teacherId]: true }));
        setSaveError(null);

        try {
            await dispatch(markTeacherAttendance({ teacherId, date, schoolId, status: newStatus }));
            setAttendance(prev => ({ ...prev, [teacherId]: newStatus }));
        } catch {
            setSaveError('Failed to update attendance. Please try again.');
        } finally {
            setSaving(prev => ({ ...prev, [teacherId]: false }));
        }
    };

    const getStatus = (teacherId) => attendance[teacherId] || 'present';

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: BG, p: 3 }}>
            <Typography variant="h5" sx={{ color: '#111111', mb: 3, fontWeight: 700 }}>
                Teacher Attendance
            </Typography>

            {/* Date picker */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ color: '#111111', fontSize: 14, fontWeight: 600 }}>Date</Typography>
                <TextField
                    type="date"
                    size="small"
                    value={date}
                    onChange={e => { setDate(e.target.value); setAttendance({}); }}
                    inputProps={{ style: { color: '#111111' } }}
                    sx={{
                        '& .MuiOutlinedInput-root': { color: '#111111' },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.3)' },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#111111' },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                        '& input[type="date"]::-webkit-calendar-picker-indicator': { filter: 'none', cursor: 'pointer' },
                    }}
                />
            </Paper>

            {saveError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
                    {saveError}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress sx={{ color: ACCENT }} />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <Paper sx={{ overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {['Teacher', 'Subject(s)', 'Status', 'Substitute'].map(h => (
                                    <TableCell key={h} sx={{ background: '#111111', color: '#ffffff', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: 'none' }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {teachers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} sx={{ textAlign: 'center', color: '#ffffff', py: 4 }}>
                                        No teachers found.
                                    </TableCell>
                                </TableRow>
                            ) : teachers.map(teacher => {
                                const status = getStatus(teacher._id);
                                const isAbsent = status === 'absent';
                                const isSaving = !!saving[teacher._id];
                                const subjects = Array.isArray(teacher.teachSubjects)
                                    ? teacher.teachSubjects.map(s => s.subName || s).filter(Boolean).join(', ')
                                    : '—';

                                return (
                                    <TableRow key={teacher._id} hover sx={{ '& .MuiTableCell-root': { color: '#111111', borderBottom: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#ffffff' } }}>
                                        <TableCell>
                                            <Typography sx={{ color: '#111111', fontWeight: 600, fontSize: '0.9rem' }}>{teacher.name}</Typography>
                                            <Typography sx={{ color: '#111111', fontSize: 12 }}>{teacher.email}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ color: '#111111', fontSize: 13 }}>
                                            {subjects || '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                disabled={isSaving}
                                                onClick={() => handleToggle(teacher._id, status)}
                                                sx={{
                                                    minWidth: 90,
                                                    borderColor: isAbsent ? '#ef4444' : '#16a34a',
                                                    color:       isAbsent ? '#ef4444' : '#16a34a',
                                                    '&:hover': {
                                                        borderColor: isAbsent ? '#dc2626' : '#15803d',
                                                        bgcolor:     isAbsent ? 'rgba(239,68,68,0.06)' : 'rgba(22,163,74,0.06)',
                                                    },
                                                }}
                                            >
                                                {isSaving ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : isAbsent ? 'Absent' : 'Present'}
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            {isAbsent ? (
                                                <Chip label="Substitutes allocated" size="small"
                                                    sx={{ bgcolor: '#111111', color: '#ffffff', fontSize: 11, height: 22 }} />
                                            ) : (
                                                <Typography sx={{ color: '#111111', fontSize: 12 }}>—</Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Paper>
            )}
        </Box>
    );
}
