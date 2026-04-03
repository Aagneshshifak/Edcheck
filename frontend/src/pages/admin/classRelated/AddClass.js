import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosInstance';
import {
    Box, Button, Chip, CircularProgress, Container, Divider,
    FormControl, FormHelperText, InputLabel, MenuItem, OutlinedInput,
    Paper, Select, TextField, Typography, Alert, Checkbox, ListItemText,
    Stack,
} from '@mui/material';
import ClassIcon      from '@mui/icons-material/Class';
import ArrowBackIcon  from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';


// ── Validation ────────────────────────────────────────────────────────────────

const validate = (form, teachers, subjects) => {
    const errs = {};
    if (!form.className.trim())
        errs.className = 'Class name is required';

    if (form.classTeacherId) {
        const exists = teachers.some(t => t._id === form.classTeacherId);
        if (!exists) errs.classTeacherId = 'Selected teacher no longer exists';
    }

    for (const id of form.subjectIds) {
        if (!subjects.some(s => s._id === id)) {
            errs.subjectIds = 'One or more selected subjects no longer exist';
            break;
        }
    }
    return errs;
};

// ── Component ─────────────────────────────────────────────────────────────────

const AddClass = () => {
    const navigate  = useNavigate();
    const schoolId  = useSelector(s => s.user.currentUser._id);

    const [teachers,  setTeachers]  = useState([]);
    const [subjects,  setSubjects]  = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [fetchError,  setFetchError]  = useState('');

    const [form, setForm] = useState({
        className:      '',
        section:        '',
        classTeacherId: '',
        subjectIds:     [],
    });
    const [fieldErrors, setFieldErrors] = useState({});
    const [saving,   setSaving]   = useState(false);
    const [apiError, setApiError] = useState('');
    const [success,  setSuccess]  = useState(false);

    // Load teachers + subjects
    useEffect(() => {
        setLoadingData(true);
        Promise.all([
            axiosInstance.get(`/Teachers/${schoolId}`),
            axiosInstance.get(`/Admin/subjects/detail/${schoolId}`),
        ]).then(([t, s]) => {
            setTeachers((Array.isArray(t.data) ? t.data : []).map(t => ({ ...t, _id: String(t._id) })));
            setSubjects(Array.isArray(s.data) ? s.data : []);
        }).catch(() => setFetchError('Failed to load teachers and subjects'))
          .finally(() => setLoadingData(false));
    }, [schoolId]);

    const set = (field) => (e) => {
        setForm(f => ({ ...f, [field]: e.target.value }));
        setFieldErrors(fe => ({ ...fe, [field]: undefined }));
        setApiError('');
    };

    const handleSubjectChange = (e) => {
        const val = typeof e.target.value === 'string'
            ? e.target.value.split(',')
            : e.target.value;
        setForm(f => ({ ...f, subjectIds: val }));
        setFieldErrors(fe => ({ ...fe, subjectIds: undefined }));
        setApiError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate(form, teachers, subjects);
        if (Object.keys(errs).length) { setFieldErrors(errs); return; }

        setSaving(true); setApiError('');
        try {
            const { data } = await axiosInstance.post(`/api/class/create`, {
                className:      form.className.trim(),
                section:        form.section.trim(),
                schoolId,
                classTeacherId: form.classTeacherId || undefined,
                subjectIds:     form.subjectIds,
            });
            setSuccess(true);
            // Navigate to class management after short delay
            setTimeout(() => navigate('/Admin/manage/classes'), 1200);
        } catch (err) {
            setApiError(err.response?.data?.message || 'Failed to create class');
        } finally { setSaving(false); }
    };

    const subjectLabel = (s) => s?.subName || s?.subjectName || String(s);

    if (loadingData) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ mt: 5, mb: 8 }}>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/Admin/manage/classes')}
                sx={{ mb: 2 }}
            >
                Back to Classes
            </Button>

            <Paper elevation={3} sx={{
                p: { xs: 3, sm: 5 },
                borderRadius: 3,
                background: 'linear-gradient(135deg, #111827 0%, #1e293b 100%)',
                border: '1px solid rgba(14,165,233,0.2)',
            }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
                    <Box sx={{
                        p: 1.2, borderRadius: 2,
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                        display: 'flex', alignItems: 'center',
                    }}>
                        <ClassIcon sx={{ color: '#fff', fontSize: 26 }} />
                    </Box>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>Create New Class</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Fill in the details below to set up a new class
                        </Typography>
                    </Box>
                </Stack>

                <Divider sx={{ mb: 3 }} />

                {fetchError && <Alert severity="warning" sx={{ mb: 2 }}>{fetchError}</Alert>}
                {apiError   && <Alert severity="error"   sx={{ mb: 2 }}>{apiError}</Alert>}
                {success    && (
                    <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                        Class created successfully! Redirecting…
                    </Alert>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <Stack spacing={3}>

                        {/* Class Name */}
                        <TextField
                            label="Class Name"
                            placeholder="e.g. Grade 10, Class A, Year 3"
                            value={form.className}
                            onChange={set('className')}
                            required
                            fullWidth
                            error={!!fieldErrors.className}
                            helperText={fieldErrors.className || 'Must be unique within this school and section'}
                            inputProps={{ maxLength: 80 }}
                        />

                        {/* Section */}
                        <TextField
                            label="Section"
                            placeholder="e.g. A, B, Morning, Science"
                            value={form.section}
                            onChange={set('section')}
                            fullWidth
                            helperText="Optional — used to distinguish classes with the same name"
                            inputProps={{ maxLength: 40 }}
                        />

                        {/* Class Teacher */}
                        <FormControl fullWidth error={!!fieldErrors.classTeacherId}>
                            <InputLabel>Class Teacher</InputLabel>
                            <Select
                                value={form.classTeacherId}
                                label="Class Teacher"
                                onChange={set('classTeacherId')}
                            >
                                <MenuItem value=""><em>None (assign later)</em></MenuItem>
                                {teachers.length === 0 ? (
                                    <MenuItem disabled>No teachers found — add teachers first</MenuItem>
                                ) : teachers.map(t => (
                                    <MenuItem key={t._id} value={t._id}>
                                        <Box>
                                            <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{t.email}</Typography>
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                            {fieldErrors.classTeacherId && (
                                <FormHelperText>{fieldErrors.classTeacherId}</FormHelperText>
                            )}
                            {!fieldErrors.classTeacherId && (
                                <FormHelperText>Select the homeroom / class teacher</FormHelperText>
                            )}
                        </FormControl>

                        {/* Subjects multi-select */}
                        <FormControl fullWidth error={!!fieldErrors.subjectIds}>
                            <InputLabel>Assign Subjects</InputLabel>
                            <Select
                                multiple
                                value={form.subjectIds}
                                onChange={handleSubjectChange}
                                input={<OutlinedInput label="Assign Subjects" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map(id => {
                                            const s = subjects.find(s => String(s._id) === String(id));
                                            return (
                                                <Chip
                                                    key={id}
                                                    label={s ? subjectLabel(s) : id}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            );
                                        })}
                                    </Box>
                                )}
                            >
                                {subjects.length === 0 ? (
                                    <MenuItem disabled>No subjects found — add subjects first</MenuItem>
                                ) : subjects.map(s => (
                                    <MenuItem key={s._id} value={String(s._id)}>
                                        <Checkbox checked={form.subjectIds.includes(String(s._id))} />
                                        <ListItemText
                                            primary={subjectLabel(s)}
                                            secondary={
                                                [s.subCode, s.classId?.sclassName ? `Currently: ${s.classId.sclassName}` : 'Unassigned']
                                                    .filter(Boolean).join(' · ')
                                            }
                                        />
                                    </MenuItem>
                                ))}
                            </Select>
                            {fieldErrors.subjectIds && (
                                <FormHelperText>{fieldErrors.subjectIds}</FormHelperText>
                            )}
                            {!fieldErrors.subjectIds && (
                                <FormHelperText>
                                    {form.subjectIds.length === 0
                                        ? 'Optional — you can assign subjects later'
                                        : `${form.subjectIds.length} subject${form.subjectIds.length > 1 ? 's' : ''} selected`}
                                </FormHelperText>
                            )}
                        </FormControl>

                        <Divider />

                        {/* Submit */}
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            fullWidth
                            disabled={saving || success}
                            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <ClassIcon />}
                        >
                            {saving ? 'Creating…' : 'Create Class'}
                        </Button>

                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate('/Admin/manage/classes')}
                            disabled={saving}
                        >
                            Cancel
                        </Button>

                    </Stack>
                </form>
            </Paper>
        </Container>
    );
};

export default AddClass;
