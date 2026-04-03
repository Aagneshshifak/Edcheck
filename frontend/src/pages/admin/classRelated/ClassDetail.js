import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import axiosInstance from '../../../utils/axiosInstance';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    Container, Box, Typography, Paper, Grid, Chip, Button, Divider,
    Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
    TablePagination, CircularProgress, Alert, Avatar, Tooltip, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Autocomplete,
} from '@mui/material';
import ArrowBackIcon           from '@mui/icons-material/ArrowBack';
import EditIcon                from '@mui/icons-material/Edit';
import PersonAddIcon           from '@mui/icons-material/PersonAdd';
import PeopleIcon              from '@mui/icons-material/People';
import TopicIcon               from '@mui/icons-material/Topic';
import PersonIcon              from '@mui/icons-material/Person';
import SchoolIcon              from '@mui/icons-material/School';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import VisibilityIcon          from '@mui/icons-material/Visibility';


// ── Small stat card ───────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color = '#0ea5e9' }) => (
    <Paper sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'linear-gradient(135deg, #111827 0%, #1e293b 100%)',
        border: '1px solid rgba(14,165,233,0.2)',
        borderRadius: 3,
        transition: 'all 0.2s ease',
        '&:hover': {
            borderColor: color,
            boxShadow: `0 4px 20px ${color}22`,
            transform: 'translateY(-2px)',
        },
    }}>
        <Avatar sx={{ bgcolor: `${color}22`, color, width: 48, height: 48 }}>
            {icon}
        </Avatar>
        <Box>
            <Typography variant="h4" fontWeight={700} color={color}>{value}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>{label}</Typography>
        </Box>
    </Paper>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const ClassDetail = () => {
    const { id }      = useParams();
    const navigate    = useNavigate();
    const schoolId    = useSelector(s => s.user.currentUser._id);

    const [detail,        setDetail]        = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState('');
    const [success,       setSuccess]       = useState('');

    // Student pagination
    const [students,      setStudents]      = useState([]);
    const [studentTotal,  setStudentTotal]  = useState(0);
    const [studentPage,   setStudentPage]   = useState(0);   // 0-indexed for MUI
    const [studentLimit,  setStudentLimit]  = useState(10);
    const [studentsLoading, setStudentsLoading] = useState(false);

    // Enrollment picker — lazy loaded only when dialog opens
    const [enrollOpen,    setEnrollOpen]    = useState(false);
    const [enrollTarget,  setEnrollTarget]  = useState(null);
    const [enrolling,     setEnrolling]     = useState(false);
    const [pickerStudents, setPickerStudents] = useState([]);
    const [pickerLoaded,   setPickerLoaded]  = useState(false);

    // ── Fetch class detail (no students) ─────────────────────────────────────
    const fetchDetail = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const { data } = await axiosInstance.get(`/api/class/${id}?studentPage=1&studentLimit=${studentLimit}`);
            setDetail(data);
            setStudents(data.students || []);
            setStudentTotal(data.studentTotal || 0);
        } catch {
            setError('Failed to load class details');
        } finally { setLoading(false); }
    }, [id, studentLimit]);

    // ── Fetch a page of students ──────────────────────────────────────────────
    const fetchStudentPage = useCallback(async (page) => {
        setStudentsLoading(true);
        try {
            const { data } = await axiosInstance.get(
                `/api/class/${id}?studentPage=${page + 1}&studentLimit=${studentLimit}`
            );
            setStudents(data.students || []);
            setStudentTotal(data.studentTotal || 0);
        } catch { /* non-fatal */ }
        finally { setStudentsLoading(false); }
    }, [id, studentLimit]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    // ── Lazy-load enrollment picker only when dialog opens ───────────────────
    const openEnrollDialog = useCallback(async () => {
        setEnrollTarget(null);
        setEnrollOpen(true);
        if (!pickerLoaded) {
            try {
                const { data } = await axiosInstance.get(`/Students/${schoolId}?limit=200`);
                const list = Array.isArray(data) ? data : (data.students || []);
                setPickerStudents(list);
                setPickerLoaded(true);
            } catch { /* non-fatal */ }
        }
    }, [schoolId, pickerLoaded]);

    // ── Enroll student ────────────────────────────────────────────────────────
    const handleEnroll = async () => {
        if (!enrollTarget) return;
        setEnrolling(true); setError('');
        try {
            await axiosInstance.post(`/Admin/student/${enrollTarget._id}/enroll`, { classId: id });
            setSuccess(`${enrollTarget.name} enrolled successfully`);
            setEnrollOpen(false);
            setEnrollTarget(null);
            setPickerLoaded(false); // invalidate picker cache
            await fetchStudentPage(studentPage);
        } catch (e) {
            setError(e.response?.data?.message || 'Failed to enroll student');
        } finally { setEnrolling(false); }
    };

    // ── Remove student ────────────────────────────────────────────────────────
    const handleRemoveStudent = async (studentId, studentName) => {
        if (!window.confirm(`Remove ${studentName} from this class?`)) return;
        try {
            await axiosInstance.delete(`/Admin/student/${studentId}/enroll`);
            setSuccess(`${studentName} removed from class`);
            setPickerLoaded(false); // invalidate picker cache
            // If last student on page, go back one
            const newPage = students.length === 1 && studentPage > 0 ? studentPage - 1 : studentPage;
            setStudentPage(newPage);
            await fetchStudentPage(newPage);
        } catch { setError('Failed to remove student'); }
    };

    // Students not yet in this class (from lazy-loaded picker)
    const unenrolled = pickerStudents.filter(s =>
        String(s.classId || s.sclassName || '') !== String(id)
    );

    // ── Loading / error states ────────────────────────────────────────────────
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error && !detail) {
        return (
            <Container maxWidth="md" sx={{ mt: 6 }}>
                <Alert severity="error">{error}</Alert>
                <Button startIcon={<ArrowBackIcon />} sx={{ mt: 2 }} onClick={() => navigate('/Admin/manage/classes')}>
                    Back to Classes
                </Button>
            </Container>
        );
    }

    const cls      = detail?.class;
    const subjects = detail?.class?.subjects  || [];
    const teachers = detail?.teachers         || [];

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>

            {/* ── Top bar ── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/Admin/manage/classes')}>
                    Back to Classes
                </Button>
                <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => navigate('/Admin/manage/classes')}
                >
                    Edit Class
                </Button>
            </Box>

            {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

            {/* ── Class header card ── */}
            <Paper sx={{
                p: 3, mb: 3,
                borderLeft: '4px solid #0ea5e9',
                background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(0,78,146,0.12) 100%)',
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                            <SchoolIcon color="primary" />
                            <Typography variant="h4" fontWeight={700}>{cls?.className || cls?.sclassName}</Typography>
                            {cls?.section && (
                                <Chip label={`Section ${cls.section}`} size="small" color="primary" variant="outlined" />
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <PersonIcon fontSize="small" color="action" />
                            <Typography variant="body2" color="text.secondary">
                                Class Teacher:&nbsp;
                                <strong>{cls?.classTeacher?.name || 'Not assigned'}</strong>
                                {cls?.classTeacher?.email && (
                                    <Typography component="span" variant="caption" color="text.disabled">
                                        &nbsp;· {cls.classTeacher.email}
                                    </Typography>
                                )}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip
                        label={cls?.status || 'active'}
                        color={cls?.status === 'inactive' ? 'default' : 'success'}
                        sx={{ textTransform: 'capitalize', fontWeight: 600 }}
                    />
                </Box>
            </Paper>

            {/* ── Stat cards ── */}
            <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={4}>
                    <StatCard icon={<PeopleIcon />}  label="Total Students" value={studentTotal} color="#0ea5e9" />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard icon={<TopicIcon />}   label="Subjects"       value={subjects.length} color="#8b5cf6" />
                </Grid>
                <Grid item xs={12} sm={4}>
                    <StatCard icon={<PersonIcon />}  label="Teachers"       value={teachers.length} color="#22c55e" />
                </Grid>
            </Grid>

            <Grid container spacing={3}>

                {/* ── Subjects ── */}
                <Grid item xs={12} md={5}>
                    <Paper sx={{ p: 0, height: '100%' }}>
                        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <TopicIcon fontSize="small" color="secondary" />
                            <Typography variant="subtitle1" fontWeight={700}>Subjects</Typography>
                            <Chip label={subjects.length} size="small" sx={{ ml: 'auto' }} />
                        </Box>
                        {subjects.length === 0 ? (
                            <Typography color="text.secondary" sx={{ p: 3 }}>No subjects assigned to this class yet.</Typography>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Subject</TableCell>
                                            <TableCell>Code</TableCell>
                                            <TableCell>Teacher</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {subjects.map(s => (
                                            <TableRow key={s._id} hover>
                                                <TableCell><strong>{s.subName || s.subjectName}</strong></TableCell>
                                                <TableCell>
                                                    {s.subCode
                                                        ? <Chip label={s.subCode} size="small" variant="outlined" />
                                                        : <Typography variant="caption" color="text.disabled">—</Typography>}
                                                </TableCell>
                                                <TableCell>
                                                    {s.teacherId?.name
                                                        ? <Chip icon={<PersonIcon />} label={s.teacherId.name} size="small" color="primary" variant="outlined" />
                                                        : <Chip label="Unassigned" size="small" color="warning" variant="outlined" />}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={7}>
                    <Paper sx={{ p: 0 }}>
                        <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <PeopleIcon fontSize="small" color="primary" />
                            <Typography variant="subtitle1" fontWeight={700}>Students</Typography>
                            <Chip label={`${studentTotal} enrolled`} size="small" color="primary" sx={{ ml: 'auto' }} />
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<PersonAddIcon />}
                                onClick={openEnrollDialog}
                                sx={{ ml: 1 }}
                            >
                                Add Student
                            </Button>
                        </Box>

                        {studentTotal === 0 ? (
                            <Box sx={{ p: 3, textAlign: 'center' }}>
                                <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                                <Typography color="text.secondary">No students enrolled yet.</Typography>
                                <Button variant="outlined" startIcon={<PersonAddIcon />} sx={{ mt: 2 }} onClick={openEnrollDialog}>
                                    Add First Student
                                </Button>
                            </Box>
                        ) : (
                            <>
                                <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>#</TableCell>
                                                <TableCell>Name</TableCell>
                                                <TableCell>Roll No</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell align="right">Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {studentsLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                                        <CircularProgress size={24} />
                                                    </TableCell>
                                                </TableRow>
                                            ) : students.map((s, i) => (
                                                <TableRow key={s._id} hover>
                                                    <TableCell sx={{ color: 'text.disabled' }}>
                                                        {studentPage * studentLimit + i + 1}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: 'rgba(14,165,233,0.2)', color: '#0ea5e9' }}>
                                                                {s.name?.[0]?.toUpperCase()}
                                                            </Avatar>
                                                            <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>{s.rollNum}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={s.status || 'active'} size="small"
                                                            color={s.status === 'active' ? 'success' : s.status === 'suspended' ? 'error' : 'default'}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="View student">
                                                            <IconButton size="small" onClick={() => navigate(`/Admin/students/student/${s._id}`)}>
                                                                <VisibilityIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Remove from class">
                                                            <IconButton size="small" color="error" onClick={() => handleRemoveStudent(s._id, s.name)}>
                                                                <RemoveCircleOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <TablePagination
                                    component="div"
                                    count={studentTotal}
                                    page={studentPage}
                                    onPageChange={(_, p) => { setStudentPage(p); fetchStudentPage(p); }}
                                    rowsPerPage={studentLimit}
                                    onRowsPerPageChange={e => {
                                        const newLimit = parseInt(e.target.value, 10);
                                        setStudentLimit(newLimit);
                                        setStudentPage(0);
                                    }}
                                    rowsPerPageOptions={[5, 10, 25, 50]}
                                    labelRowsPerPage="Per page:"
                                />
                            </>
                        )}
                    </Paper>
                </Grid>

                {/* ── Teachers ── */}
                {teachers.length > 0 && (
                    <Grid item xs={12}>
                        <Paper sx={{ p: 0 }}>
                            <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <PersonIcon fontSize="small" color="success" />
                                <Typography variant="subtitle1" fontWeight={700}>Assigned Teachers</Typography>
                                <Chip label={teachers.length} size="small" color="success" sx={{ ml: 'auto' }} />
                            </Box>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Subjects Taught</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {teachers.map(t => (
                                            <TableRow key={t._id} hover>
                                                <TableCell><strong>{t.name}</strong></TableCell>
                                                <TableCell>{t.email}</TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                        {t.teachSubjects?.length
                                                            ? t.teachSubjects.map(s => (
                                                                <Chip key={s._id} label={s.subName} size="small" variant="outlined" />
                                                            ))
                                                            : <Typography variant="caption" color="text.disabled">—</Typography>}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>
                )}

            </Grid>

            {/* ── Add Student Dialog ── */}
            <Dialog open={enrollOpen} onClose={() => setEnrollOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Student to Class</DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Search for a student not yet enrolled in this class.
                    </Typography>
                    <Autocomplete
                        options={unenrolled}
                        getOptionLabel={s => `${s.name} (Roll: ${s.rollNum})`}
                        value={enrollTarget}
                        onChange={(_, v) => setEnrollTarget(v)}
                        isOptionEqualToValue={(o, v) => o._id === v._id}
                        loading={!pickerLoaded}
                        renderInput={params => (
                            <TextField {...params} label="Search student" fullWidth autoFocus
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {!pickerLoaded && <CircularProgress size={16} />}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        noOptionsText={
                            !pickerLoaded ? 'Loading…' :
                            unenrolled.length === 0 ? 'All students are already enrolled in this class' :
                            'No matching students'
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEnrollOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        startIcon={enrolling ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
                        onClick={handleEnroll}
                        disabled={!enrollTarget || enrolling}
                    >
                        {enrolling ? 'Enrolling…' : 'Add to Class'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
};

export default ClassDetail;
