import { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Select, MenuItem, FormControl, InputLabel,
    Button, Alert, Typography, Table, TableBody, TableCell,
    TableHead, TableRow, CircularProgress, Tooltip,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { savePeriod } from '../../../redux/timetableRelated/timetableSlice';

// ── Design tokens ─────────────────────────────────────────────────────────────
const GLASS       = 'rgba(255,255,255,0.06)';
const GLASS_HOVER = 'rgba(255,255,255,0.10)';
const BORDER      = 'rgba(255,255,255,0.12)';
const ACCENT      = '#3b82f6';
const TEXT        = '#f1f5f9';
const MUTED       = 'rgba(255,255,255,0.45)';
const BREAK_BG    = 'rgba(255,255,255,0.03)';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Shared glass card style
const glassSx = {
    background: GLASS,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${BORDER}`,
    borderRadius: 2,
};

// Select styling — dark background, white text
const selectSx = {
    color: TEXT,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 1,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
    '& .MuiSvgIcon-root': { color: MUTED },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
    '& .MuiSelect-select': { color: TEXT },
};

const labelSx = { color: MUTED, '&.Mui-focused': { color: ACCENT } };

const cellSx = {
    borderColor: BORDER,
    color: TEXT,
    py: 1,
};

export default function TimetableBuilder() {
    const dispatch = useDispatch();
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [selectedClass,  setSelectedClass]  = useState('');
    const [selectedDay,    setSelectedDay]    = useState('Mon');
    const [config,         setConfig]         = useState([]);
    const [classes,        setClasses]        = useState([]);
    const [subjects,       setSubjects]       = useState([]);
    const [teachers,       setTeachers]       = useState([]);
    const [periods,        setPeriods]        = useState({});
    const [conflictError,  setConflictError]  = useState(null);
    const [saving,         setSaving]         = useState(false);
    const [loadingConfig,  setLoadingConfig]  = useState(false);
    const [autoGenStatus,  setAutoGenStatus]  = useState(null);
    const [autoGenerating, setAutoGenerating] = useState(false);

    useEffect(() => {
        if (!schoolId) return;
        setLoadingConfig(true);
        axiosInstance.get(`/Timetable/config/${schoolId}`)
            .then(r => setConfig(r.data))
            .catch(() => setConfig([]))
            .finally(() => setLoadingConfig(false));
    }, [schoolId]);

    useEffect(() => {
        if (!schoolId) return;
        axiosInstance.get(`/SclassList/${schoolId}`)
            .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
            .catch(() => setClasses([]));
    }, [schoolId]);

    useEffect(() => {
        if (!selectedClass) { setSubjects([]); return; }
        axiosInstance.get(`/ClassSubjects/${selectedClass}`)
            .then(r => setSubjects(Array.isArray(r.data) ? r.data : []))
            .catch(() => setSubjects([]));
    }, [selectedClass]);

    useEffect(() => {
        if (!schoolId) return;
        axiosInstance.get(`/Teachers/${schoolId}`)
            .then(r => setTeachers(Array.isArray(r.data) ? r.data : []))
            .catch(() => setTeachers([]));
    }, [schoolId]);

    useEffect(() => {
        setPeriods({});
        setConflictError(null);
    }, [selectedClass, selectedDay]);

    const teachersForSubject = useCallback((subjectId) => {
        if (!subjectId) return [];
        return teachers.filter(t =>
            Array.isArray(t.teachSubjects) &&
            t.teachSubjects.some(s =>
                (s._id || s) === subjectId || String(s._id || s) === String(subjectId)
            )
        );
    }, [teachers]);

    const handlePeriodChange = (periodNumber, field, value) => {
        setPeriods(prev => {
            const updated = { ...prev, [periodNumber]: { ...(prev[periodNumber] || {}), [field]: value } };
            if (field === 'subjectId') updated[periodNumber].teacherId = '';
            return updated;
        });
        setConflictError(null);
    };

    const handleAutoGenerate = async () => {
        setAutoGenerating(true);
        setAutoGenStatus(null);
        try {
            const res = await axiosInstance.post(`/Timetable/auto-generate/${schoolId}`);
            const { message, classesFound, subjectsFound, created, skipped, errors } = res.data;
            const detail = `Classes: ${classesFound ?? '?'}, Subjects: ${subjectsFound ?? '?'}, Created: ${created}, Skipped: ${skipped}`;
            const errNote = errors?.length ? ` | Warnings: ${errors.slice(0, 3).join('; ')}` : '';
            setAutoGenStatus({ type: created > 0 ? 'success' : 'warning', message: `${message} (${detail}${errNote})` });
            if (selectedClass && selectedDay) setPeriods({});
        } catch (err) {
            setAutoGenStatus({ type: 'error', message: err.response?.data?.message || 'Auto-generation failed.' });
        } finally {
            setAutoGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!selectedClass || !selectedDay) return;
        setSaving(true);
        setConflictError(null);
        const periodsArray = config.map(slot => {
            if (slot.type !== 'lecture') {
                return { periodNumber: slot.periodNumber, startTime: slot.startTime, endTime: slot.endTime, type: slot.type };
            }
            const sel = periods[slot.periodNumber] || {};
            return { periodNumber: slot.periodNumber, startTime: slot.startTime, endTime: slot.endTime, type: slot.type, subjectId: sel.subjectId || null, teacherId: sel.teacherId || null };
        });
        try {
            const result = await dispatch(savePeriod({ classId: selectedClass, day: selectedDay, periods: periodsArray, schoolId }));
            if (savePeriod.rejected.match(result)) {
                const payload = result.payload || {};
                if (payload.status === 409 || payload.conflictingClass) {
                    setConflictError({ conflictingClass: payload.conflictingClass || 'another class', periodNumber: payload.periodNumber || '?' });
                }
            }
        } finally {
            setSaving(false);
        }
    };

    // MenuItem paper dropdown styling
    const menuProps = {
        PaperProps: {
            sx: {
                bgcolor: '#1e293b',
                border: `1px solid ${BORDER}`,
                '& .MuiMenuItem-root': { color: TEXT, '&:hover': { bgcolor: GLASS_HOVER }, '&.Mui-selected': { bgcolor: 'rgba(59,130,246,0.2)' } },
            },
        },
    };

    return (
        <Box sx={{ minHeight: '100vh', p: 3 }}>
            <Typography variant="h5" sx={{ color: TEXT, mb: 3, fontWeight: 700 }}>
                Timetable Builder
            </Typography>

            {autoGenStatus && (
                <Alert severity={autoGenStatus.type} sx={{ mb: 2, bgcolor: 'rgba(0,0,0,0.4)', color: TEXT, border: `1px solid ${BORDER}` }} onClose={() => setAutoGenStatus(null)}>
                    {autoGenStatus.message}
                </Alert>
            )}

            {/* Selectors bar */}
            <Box sx={{ ...glassSx, p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel sx={labelSx}>Class</InputLabel>
                    <Select value={selectedClass} label="Class" onChange={e => setSelectedClass(e.target.value)} sx={selectSx} MenuProps={menuProps}>
                        {classes.map(c => (
                            <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={labelSx}>Day</InputLabel>
                    <Select value={selectedDay} label="Day" onChange={e => setSelectedDay(e.target.value)} sx={selectSx} MenuProps={menuProps}>
                        {DAYS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </Select>
                </FormControl>

                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || !selectedClass}
                    sx={{ ml: 'auto', bgcolor: ACCENT, '&:hover': { bgcolor: '#2563eb' }, textTransform: 'none', fontWeight: 600 }}
                >
                    {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save'}
                </Button>

                <Tooltip title="Auto-generate timetables for ALL classes using their assigned subjects">
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={autoGenerating ? <CircularProgress size={16} sx={{ color: TEXT }} /> : <AutoFixHighIcon />}
                            onClick={handleAutoGenerate}
                            disabled={autoGenerating}
                            sx={{ borderColor: BORDER, color: TEXT, textTransform: 'none', fontWeight: 600, '&:hover': { borderColor: TEXT, bgcolor: GLASS_HOVER } }}
                        >
                            {autoGenerating ? 'Generating…' : 'Auto-Generate All'}
                        </Button>
                    </span>
                </Tooltip>
            </Box>

            {conflictError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setConflictError(null)}>
                    Conflict: Period {conflictError.periodNumber} is already assigned to <strong>{conflictError.conflictingClass}</strong> on {selectedDay}.
                </Alert>
            )}

            {/* Period grid */}
            {loadingConfig ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress sx={{ color: ACCENT }} />
                </Box>
            ) : (
                <Box sx={{ ...glassSx, overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(59,130,246,0.15)' }}>
                                {['#', 'Time', 'Type', 'Subject', 'Teacher'].map(h => (
                                    <TableCell key={h} sx={{ ...cellSx, fontWeight: 700, color: TEXT, borderBottom: `1px solid ${BORDER}`, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {config.map((slot, idx) => {
                                const isBreak = slot.type === 'interval' || slot.type === 'lunch';
                                const sel = periods[slot.periodNumber] || {};
                                const availableTeachers = teachersForSubject(sel.subjectId);

                                return (
                                    <TableRow
                                        key={idx}
                                        sx={{
                                            bgcolor: isBreak ? BREAK_BG : 'transparent',
                                            '&:hover': { bgcolor: isBreak ? BREAK_BG : GLASS_HOVER },
                                        }}
                                    >
                                        <TableCell sx={{ ...cellSx, color: isBreak ? MUTED : TEXT, fontWeight: 600, width: 40 }}>
                                            {isBreak ? '—' : slot.periodNumber}
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, color: MUTED, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                                            {slot.startTime} – {slot.endTime}
                                        </TableCell>
                                        <TableCell sx={cellSx}>
                                            {slot.type === 'interval' && <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>Interval</Typography>}
                                            {slot.type === 'lunch'    && <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>Lunch Break</Typography>}
                                            {slot.type === 'lecture'  && <Typography variant="caption" sx={{ color: MUTED }}>Lecture</Typography>}
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, minWidth: 180 }}>
                                            {!isBreak && (
                                                <FormControl size="small" fullWidth disabled={!selectedClass}>
                                                    <Select
                                                        displayEmpty
                                                        value={sel.subjectId || ''}
                                                        onChange={e => handlePeriodChange(slot.periodNumber, 'subjectId', e.target.value)}
                                                        sx={selectSx}
                                                        MenuProps={menuProps}
                                                        renderValue={v => {
                                                            if (!v) return <span style={{ color: MUTED }}>Subject</span>;
                                                            const sub = subjects.find(s => s._id === v);
                                                            return <span style={{ color: TEXT }}>{sub ? sub.subName : v}</span>;
                                                        }}
                                                    >
                                                        <MenuItem value=""><em style={{ color: MUTED }}>None</em></MenuItem>
                                                        {subjects.map(s => (
                                                            <MenuItem key={s._id} value={s._id}>{s.subName}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, minWidth: 180 }}>
                                            {!isBreak && (
                                                <FormControl size="small" fullWidth disabled={!sel.subjectId}>
                                                    <Select
                                                        displayEmpty
                                                        value={sel.teacherId || ''}
                                                        onChange={e => handlePeriodChange(slot.periodNumber, 'teacherId', e.target.value)}
                                                        sx={selectSx}
                                                        MenuProps={menuProps}
                                                        renderValue={v => {
                                                            if (!v) return <span style={{ color: MUTED }}>Teacher</span>;
                                                            const t = teachers.find(t => t._id === v);
                                                            return <span style={{ color: TEXT }}>{t ? t.name : v}</span>;
                                                        }}
                                                    >
                                                        <MenuItem value=""><em style={{ color: MUTED }}>None</em></MenuItem>
                                                        {availableTeachers.map(t => (
                                                            <MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
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
