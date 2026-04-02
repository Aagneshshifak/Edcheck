import { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import {
    Box, Paper, Select, MenuItem, FormControl, InputLabel,
    Button, Alert, Typography, Table, TableBody, TableCell,
    TableHead, TableRow, CircularProgress, Tooltip,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { savePeriod } from '../../../redux/timetableRelated/timetableSlice';

const BASE_URL = process.env.REACT_APP_BASE_URL;

const BG    = '#0f172a';
const CARD  = '#111827';
const ACCENT = '#0ea5e9';
const TEXT  = '#e2e8f0';
const MUTED = 'rgba(148,163,184,0.7)';
const BREAK_BG = 'rgba(14,165,233,0.05)';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const cellSx = {
    borderColor: 'rgba(148,163,184,0.15)',
    color: TEXT,
    py: 1,
};

export default function TimetableBuilder() {
    const dispatch = useDispatch();
    const schoolId = useSelector(s => s.user.currentUser._id);

    const [selectedClass, setSelectedClass] = useState('');
    const [selectedDay,   setSelectedDay]   = useState('Mon');
    const [config,        setConfig]        = useState([]);
    const [classes,       setClasses]       = useState([]);
    const [subjects,      setSubjects]      = useState([]);
    const [teachers,      setTeachers]      = useState([]);
    const [periods,       setPeriods]       = useState({});   // periodNumber → { subjectId, teacherId }
    const [conflictError, setConflictError] = useState(null); // { conflictingClass, periodNumber }
    const [saving,        setSaving]        = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [autoGenStatus, setAutoGenStatus] = useState(null); // { type: 'success'|'error', message }
    const [autoGenerating, setAutoGenerating] = useState(false);

    // Fetch config once
    useEffect(() => {
        if (!schoolId) return;
        setLoadingConfig(true);
        axios.get(`${BASE_URL}/Timetable/config/${schoolId}`)
            .then(r => setConfig(r.data))
            .catch(() => setConfig([]))
            .finally(() => setLoadingConfig(false));
    }, [schoolId]);

    // Fetch classes once
    useEffect(() => {
        if (!schoolId) return;
        axios.get(`${BASE_URL}/SclassList/${schoolId}`)
            .then(r => setClasses(Array.isArray(r.data) ? r.data : []))
            .catch(() => setClasses([]));
    }, [schoolId]);

    // Fetch subjects when class changes
    useEffect(() => {
        if (!selectedClass) { setSubjects([]); return; }
        axios.get(`${BASE_URL}/ClassSubjects/${selectedClass}`)
            .then(r => setSubjects(Array.isArray(r.data) ? r.data : []))
            .catch(() => setSubjects([]));
    }, [selectedClass]);

    // Fetch teachers when class changes (filter by subject in selector)
    useEffect(() => {
        if (!schoolId) return;
        axios.get(`${BASE_URL}/Teachers/${schoolId}`)
            .then(r => setTeachers(Array.isArray(r.data) ? r.data : []))
            .catch(() => setTeachers([]));
    }, [schoolId]);

    // Reset period selections when class or day changes
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
            // Reset teacher if subject changes
            if (field === 'subjectId') {
                updated[periodNumber].teacherId = '';
            }
            return updated;
        });
        setConflictError(null);
    };

    const handleAutoGenerate = async () => {
        setAutoGenerating(true);
        setAutoGenStatus(null);
        try {
            const res = await axios.post(`${BASE_URL}/Timetable/auto-generate/${schoolId}`);
            const { message, classesFound, subjectsFound, created, skipped, errors } = res.data;
            const detail = `Classes: ${classesFound ?? '?'}, Subjects: ${subjectsFound ?? '?'}, Created: ${created}, Skipped: ${skipped}`;
            const errNote = errors?.length ? ` | Warnings: ${errors.slice(0, 3).join('; ')}` : '';
            setAutoGenStatus({ type: created > 0 ? 'success' : 'warning', message: `${message} (${detail}${errNote})` });
            if (selectedClass && selectedDay) setPeriods({});
        } catch (err) {
            setAutoGenStatus({
                type: 'error',
                message: err.response?.data?.message || 'Auto-generation failed.',
            });
        } finally {
            setAutoGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!selectedClass || !selectedDay) return;
        setSaving(true);
        setConflictError(null);

        // Build full periods array from config + selections
        const periodsArray = config.map(slot => {
            if (slot.type !== 'lecture') {
                return { periodNumber: slot.periodNumber, startTime: slot.startTime, endTime: slot.endTime, type: slot.type };
            }
            const sel = periods[slot.periodNumber] || {};
            return {
                periodNumber: slot.periodNumber,
                startTime:    slot.startTime,
                endTime:      slot.endTime,
                type:         slot.type,
                subjectId:    sel.subjectId  || null,
                teacherId:    sel.teacherId  || null,
            };
        });

        try {
            const result = await dispatch(savePeriod({
                classId:  selectedClass,
                day:      selectedDay,
                periods:  periodsArray,
                schoolId,
            }));

            if (savePeriod.rejected.match(result)) {
                const payload = result.payload || {};
                if (payload.status === 409 || payload.conflictingClass) {
                    setConflictError({
                        conflictingClass: payload.conflictingClass || 'another class',
                        periodNumber:     payload.periodNumber     || '?',
                    });
                }
            }
        } finally {
            setSaving(false);
        }
    };

    const selectSx = {
        color: TEXT,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
        '& .MuiSvgIcon-root': { color: MUTED },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT },
    };

    const labelSx = { color: MUTED };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: BG, p: 3 }}>
            <Typography variant="h5" sx={{ color: TEXT, mb: 3, fontWeight: 700 }}>
                Timetable Builder
            </Typography>

            {/* Auto-generate banner */}
            {autoGenStatus && (
                <Alert
                    severity={autoGenStatus.type}
                    sx={{ mb: 2 }}
                    onClose={() => setAutoGenStatus(null)}
                >
                    {autoGenStatus.message}
                </Alert>
            )}

            {/* Selectors */}
            <Paper sx={{ bgcolor: CARD, p: 2, mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel sx={labelSx}>Class</InputLabel>
                    <Select value={selectedClass} label="Class" onChange={e => setSelectedClass(e.target.value)} sx={selectSx}>
                        {classes.map(c => (
                            <MenuItem key={c._id} value={c._id}>{c.sclassName}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel sx={labelSx}>Day</InputLabel>
                    <Select value={selectedDay} label="Day" onChange={e => setSelectedDay(e.target.value)} sx={selectSx}>
                        {DAYS.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                    </Select>
                </FormControl>

                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving || !selectedClass}
                    sx={{ ml: 'auto', bgcolor: ACCENT, '&:hover': { bgcolor: '#0284c7' }, color: '#fff' }}
                >
                    {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Save'}
                </Button>

                <Tooltip title="Auto-generate timetables for ALL classes using their assigned subjects">
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={autoGenerating ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : <AutoFixHighIcon />}
                            onClick={handleAutoGenerate}
                            disabled={autoGenerating}
                            sx={{
                                borderColor: ACCENT,
                                color: ACCENT,
                                '&:hover': { bgcolor: 'rgba(14,165,233,0.08)', borderColor: ACCENT },
                            }}
                        >
                            {autoGenerating ? 'Generating…' : 'Auto-Generate All'}
                        </Button>
                    </span>
                </Tooltip>
            </Paper>

            {/* Conflict error banner */}
            {conflictError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setConflictError(null)}>
                    Conflict: Period {conflictError.periodNumber} is already assigned to{' '}
                    <strong>{conflictError.conflictingClass}</strong> on {selectedDay}.
                </Alert>
            )}

            {/* Period grid */}
            {loadingConfig ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress sx={{ color: ACCENT }} />
                </Box>
            ) : (
                <Paper sx={{ bgcolor: CARD, overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(14,165,233,0.1)' }}>
                                {['#', 'Time', 'Type', 'Subject', 'Teacher'].map(h => (
                                    <TableCell key={h} sx={{ ...cellSx, fontWeight: 700, color: ACCENT }}>{h}</TableCell>
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
                                        sx={{ bgcolor: isBreak ? BREAK_BG : 'transparent' }}
                                    >
                                        <TableCell sx={cellSx}>
                                            {isBreak ? '—' : slot.periodNumber}
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, color: MUTED, whiteSpace: 'nowrap' }}>
                                            {slot.startTime} – {slot.endTime}
                                        </TableCell>
                                        <TableCell sx={cellSx}>
                                            {slot.type === 'interval' && (
                                                <Typography variant="caption" sx={{ color: ACCENT }}>Interval</Typography>
                                            )}
                                            {slot.type === 'lunch' && (
                                                <Typography variant="caption" sx={{ color: ACCENT }}>Lunch Break</Typography>
                                            )}
                                            {slot.type === 'lecture' && (
                                                <Typography variant="caption" sx={{ color: MUTED }}>Lecture</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, minWidth: 180 }}>
                                            {isBreak ? null : (
                                                <FormControl size="small" fullWidth disabled={!selectedClass}>
                                                    <Select
                                                        displayEmpty
                                                        value={sel.subjectId || ''}
                                                        onChange={e => handlePeriodChange(slot.periodNumber, 'subjectId', e.target.value)}
                                                        sx={selectSx}
                                                        renderValue={v => {
                                                            if (!v) return <span style={{ color: MUTED }}>Subject</span>;
                                                            const sub = subjects.find(s => s._id === v);
                                                            return sub ? sub.subName : v;
                                                        }}
                                                    >
                                                        <MenuItem value=""><em>None</em></MenuItem>
                                                        {subjects.map(s => (
                                                            <MenuItem key={s._id} value={s._id}>{s.subName}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ ...cellSx, minWidth: 180 }}>
                                            {isBreak ? null : (
                                                <FormControl size="small" fullWidth disabled={!sel.subjectId}>
                                                    <Select
                                                        displayEmpty
                                                        value={sel.teacherId || ''}
                                                        onChange={e => handlePeriodChange(slot.periodNumber, 'teacherId', e.target.value)}
                                                        sx={selectSx}
                                                        renderValue={v => {
                                                            if (!v) return <span style={{ color: MUTED }}>Teacher</span>;
                                                            const t = teachers.find(t => t._id === v);
                                                            return t ? t.name : v;
                                                        }}
                                                    >
                                                        <MenuItem value=""><em>None</em></MenuItem>
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
                </Paper>
            )}
        </Box>
    );
}
