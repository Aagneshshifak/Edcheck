import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Typography, Button, TextField, Table, TableBody,
    TableCell, TableHead, TableRow, Chip, CircularProgress, Alert,
} from '@mui/material';
import { markTeacherAttendance } from '../../../redux/timetableRelated/timetableSlice';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GLASS       = 'rgba(255,255,255,0.06)';
const GLASS_HOVER = 'rgba(255,255,255,0.10)';
const BORDER      = 'rgba(255,255,255,0.12)';
const ACCENT      = '#3b82f6';
const TEXT        = '#f1f5f9';
const MUTED       = 'rgba(255,255,255,0.45)';

const glassSx = {
    background: GLASS,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
};

const cellSx = {
    borderColor: BORDER,
    color: TEXT,
    py: 1.5,
};

const today = () => new Date().toISOString().split('T')[0];

export default function TeacherAttendanceManager() {
    const dispatch = useDispatch();
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [teachers,   setTeachers]   = useState([]);
    const [loading,    setLoading]    = useState(false);
    const [error,      setError]      = useState(null);
    const [date,       setDate]       = useState(today());
    const [attendance, setAttendance] = useState({});
    const [saving,     setSaving]     = useState({});
    const [saveError,  setSaveError]  = useState(null);

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

    // Summary counts
    const presentCount = teachers.filter(t => getStatus(t._id) === 'present').length;
    const absentCount  = teachers.filter(t => getStatus(t._id) === 'absent').length;

    return (
        <Box sx={{ minHeight: '100vh', p: 3 }}>
            <Typography variant="h5" sx={{ color: TEXT, mb: 3, fontWeight: 700 }}>
                Teacher Attendance
            </Typography>

            {/* Date + summary bar */}
            <Box sx={{ ...glassSx, p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <Typography sx={{ color: MUTED, fontSize: 14, fontWeight: 600 }}>Date</Typography>
                <TextField
                    type="date"
                    size="small"
                    value={date}
                    onChange={e => { setDate(e.target.value); setAttendance({}); }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            color: TEXT,
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: 1,
                        },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
                        '& input[type="date"]::-webkit-calendar-picker-indicator': {
                            filter: 'invert(1)',
                            cursor: 'pointer',
                        },
                    }}
                    inputProps={{ style: { color: TEXT } }}
                />

                {/* Summary chips */}
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1.5 }}>
                    <Chip
                        label={`Present: ${presentCount}`}
                        size="small"
                        sx={{ bgcolor: 'rgba(22,163,74,0.2)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.4)', fontWeight: 600 }}
                    />
                    <Chip
                        label={`Absent: ${absentCount}`}
                        size="small"
                        sx={{ bgcolor: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)', fontWeight: 600 }}
                    />
                    <Chip
                        label={`Total: ${teachers.length}`}
                        size="small"
                        sx={{ bgcolor: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.4)', fontWeight: 600 }}
                    />
                </Box>
            </Box>

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
                <Box sx={{ ...glassSx, overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(59,130,246,0.15)' }}>
                                {['Teacher', 'Subject(s)', 'Status', 'Substitute'].map(h => (
                                    <TableCell key={h} sx={{
                                        ...cellSx,
                                        fontWeight: 700,
                                        color: TEXT,
                                        borderBottom: `1px solid ${BORDER}`,
                                        fontSize: '0.75rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {teachers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} sx={{ textAlign: 'center', color: MUTED, py: 6, borderColor: BORDER }}>
                                        No teachers found.
                                    </TableCell>
                                </TableRow>
                            ) : teachers.map(teacher => {
                                const status   = getStatus(teacher._id);
                                const isAbsent = status === 'absent';
                                const isSaving = !!saving[teacher._id];
                                const subjects = Array.isArray(teacher.teachSubjects)
                                    ? teacher.teachSubjects.map(s => s.subName || s).filter(Boolean).join(', ')
                                    : '—';

                                return (
                                    <TableRow
                                        key={teacher._id}
                                        sx={{
                                            bgcolor: isAbsent ? 'rgba(239,68,68,0.04)' : 'transparent',
                                            '&:hover': { bgcolor: GLASS_HOVER },
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        <TableCell sx={cellSx}>
                                            <Typography sx={{ color: TEXT, fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>
                                                {teacher.name}
                                            </Typography>
                                            <Typography sx={{ color: MUTED, fontSize: '0.75rem', mt: 0.2 }}>
                                                {teacher.email}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, color: MUTED, fontSize: '0.82rem' }}>
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
                                                    fontWeight: 600,
                                                    textTransform: 'none',
                                                    borderColor: isAbsent ? 'rgba(239,68,68,0.6)' : 'rgba(22,163,74,0.6)',
                                                    color:       isAbsent ? '#f87171'              : '#4ade80',
                                                    bgcolor:     isAbsent ? 'rgba(239,68,68,0.1)'  : 'rgba(22,163,74,0.1)',
                                                    '&:hover': {
                                                        borderColor: isAbsent ? '#ef4444' : '#16a34a',
                                                        bgcolor:     isAbsent ? 'rgba(239,68,68,0.2)' : 'rgba(22,163,74,0.2)',
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
                                                        bgcolor: 'rgba(245,158,11,0.15)',
                                                        color: '#fbbf24',
                                                        border: '1px solid rgba(245,158,11,0.3)',
                                                        fontSize: '0.7rem',
                                                        height: 22,
                                                        fontWeight: 600,
                                                    }}
                                                />
                                            ) : (
                                                <Typography sx={{ color: MUTED, fontSize: '0.82rem' }}>—</Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Box>
            )}
        </Box>
    );
}
