import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import {
    Box, Paper, Typography, Button, TextField, Table, TableBody,
    TableCell, TableHead, TableRow, Chip, CircularProgress, Alert,
} from '@mui/material';
import { markTeacherAttendance } from '../../../redux/timetableRelated/timetableSlice';

const BASE_URL = process.env.REACT_APP_BASE_URL;

const BG     = '#0f172a';
const CARD   = '#111827';
const ACCENT = '#0ea5e9';
const TEXT   = '#e2e8f0';
const MUTED  = 'rgba(148,163,184,0.7)';

const cellSx = { borderColor: 'rgba(148,163,184,0.15)', color: TEXT, py: 1.5 };

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
        axios.get(`${BASE_URL}/Teachers/${schoolId}`)
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
            <Typography variant="h5" sx={{ color: TEXT, mb: 3, fontWeight: 700 }}>
                Teacher Attendance
            </Typography>

            {/* Date picker */}
            <Paper sx={{ bgcolor: CARD, p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography sx={{ color: MUTED, fontSize: 14 }}>Date</Typography>
                <TextField
                    type="date"
                    size="small"
                    value={date}
                    onChange={e => {
                        setDate(e.target.value);
                        setAttendance({});
                    }}
                    inputProps={{ style: { color: TEXT } }}
                    sx={{
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                        '& input[type="date"]::-webkit-calendar-picker-indicator': { filter: 'invert(1)' },
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
                <Paper sx={{ bgcolor: CARD, overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(14,165,233,0.1)' }}>
                                {['Teacher', 'Subject(s)', 'Status', 'Substitute'].map(h => (
                                    <TableCell key={h} sx={{ ...cellSx, fontWeight: 700, color: ACCENT }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {teachers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} sx={{ ...cellSx, textAlign: 'center', color: MUTED }}>
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
                                    <TableRow key={teacher._id} sx={{ '&:hover': { bgcolor: 'rgba(14,165,233,0.04)' } }}>
                                        <TableCell sx={cellSx}>
                                            <Typography sx={{ color: TEXT, fontWeight: 500 }}>{teacher.name}</Typography>
                                            <Typography sx={{ color: MUTED, fontSize: 12 }}>{teacher.email}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, color: MUTED, fontSize: 13 }}>
                                            {subjects || '—'}
                                        </TableCell>
                                        <TableCell sx={cellSx}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                disabled={isSaving}
                                                onClick={() => handleToggle(teacher._id, status)}
                                                sx={{
                                                    minWidth: 90,
                                                    borderColor: isAbsent ? '#ef4444' : '#22c55e',
                                                    color:       isAbsent ? '#ef4444' : '#22c55e',
                                                    '&:hover': {
                                                        borderColor: isAbsent ? '#dc2626' : '#16a34a',
                                                        bgcolor:     isAbsent ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                                                    },
                                                }}
                                            >
                                                {isSaving
                                                    ? <CircularProgress size={16} sx={{ color: 'inherit' }} />
                                                    : isAbsent ? 'Absent' : 'Present'
                                                }
                                            </Button>
                                        </TableCell>
                                        <TableCell sx={cellSx}>
                                            {isAbsent ? (
                                                <Chip
                                                    label="Substitutes allocated"
                                                    size="small"
                                                    sx={{
                                                        bgcolor: 'rgba(14,165,233,0.15)',
                                                        color: ACCENT,
                                                        fontSize: 11,
                                                        height: 22,
                                                    }}
                                                />
                                            ) : (
                                                <Typography sx={{ color: MUTED, fontSize: 12 }}>—</Typography>
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
