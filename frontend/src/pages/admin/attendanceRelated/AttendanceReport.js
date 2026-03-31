import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Container, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, CircularProgress, Alert, Box, Button,
    TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// ─── helpers ────────────────────────────────────────────────────────────────

const pct = (n) => `${n}%`;

const rowBg = (percentage) => {
    if (percentage < 60) return '#ffebee';   // red-tinted
    if (percentage < 75) return '#fff8e1';   // amber-tinted
    return 'inherit';
};

// ─── Level 1 — School-wide view ─────────────────────────────────────────────

const SchoolView = ({ schoolId, onSelectClass }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        axios
            .get(`${process.env.REACT_APP_BASE_URL}/Admin/attendance/school/${schoolId}`)
            .then((res) => setRows(res.data))
            .catch((err) => setError(err.response?.data?.message || 'Failed to load school attendance'))
            .finally(() => setLoading(false));
    }, [schoolId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <>
            <Typography variant="h5" gutterBottom>School-wide Attendance</Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: 'grey.100' }}>
                            <TableCell><strong>Class Name</strong></TableCell>
                            <TableCell align="right"><strong>Total Records</strong></TableCell>
                            <TableCell align="right"><strong>Present Count</strong></TableCell>
                            <TableCell align="right"><strong>Attendance %</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    No attendance data found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow
                                    key={row.classId}
                                    hover
                                    sx={{ cursor: 'pointer', backgroundColor: rowBg(row.attendancePercentage) }}
                                    onClick={() => onSelectClass(row.classId, row.className)}
                                >
                                    <TableCell>{row.className}</TableCell>
                                    <TableCell align="right">{row.totalRecords}</TableCell>
                                    <TableCell align="right">{row.presentCount}</TableCell>
                                    <TableCell align="right">{pct(row.attendancePercentage)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
};

// ─── Level 2 — Class view ────────────────────────────────────────────────────

const ClassView = ({ classId, className, onBack, onSelectStudent }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        setError('');
        axios
            .get(`${process.env.REACT_APP_BASE_URL}/Admin/attendance/class/${classId}`)
            .then((res) => setRows(res.data))
            .catch((err) => setError(err.response?.data?.message || 'Failed to load class attendance'))
            .finally(() => setLoading(false));
    }, [classId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <>
            <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
                Back to School View
            </Button>
            <Typography variant="h5" gutterBottom>Class: {className}</Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: 'grey.100' }}>
                            <TableCell><strong>Student Name</strong></TableCell>
                            <TableCell align="right"><strong>Roll No.</strong></TableCell>
                            <TableCell align="right"><strong>Overall %</strong></TableCell>
                            <TableCell align="center"><strong>Details</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    No students found for this class.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => (
                                <TableRow
                                    key={row.studentId}
                                    sx={{ backgroundColor: rowBg(row.overallPercentage) }}
                                >
                                    <TableCell>{row.studentName}</TableCell>
                                    <TableCell align="right">{row.rollNum}</TableCell>
                                    <TableCell align="right">{pct(row.overallPercentage)}</TableCell>
                                    <TableCell align="center">
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => onSelectStudent(row.studentId, row.studentName)}
                                        >
                                            View Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    );
};

// ─── Level 3 — Student view ──────────────────────────────────────────────────

const StudentView = ({ studentId, studentName, onBack }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const fetchData = useCallback(() => {
        setLoading(true);
        setError('');
        const params = {};
        if (fromDate) params.from = fromDate;
        if (toDate) params.to = toDate;
        axios
            .get(`${process.env.REACT_APP_BASE_URL}/Admin/attendance/student/${studentId}`, { params })
            .then((res) => setRows(res.data))
            .catch((err) => setError(err.response?.data?.message || 'Failed to load student attendance'))
            .finally(() => setLoading(false));
    }, [studentId, fromDate, toDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <>
            <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
                Back to Class View
            </Button>
            <Typography variant="h5" gutterBottom>Student: {studentName}</Typography>

            {/* Date range filter */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                    label="From"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                />
                <TextField
                    label="To"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                />
            </Box>

            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>}
            {error && <Alert severity="error">{error}</Alert>}

            {!loading && !error && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: 'grey.100' }}>
                                <TableCell><strong>Subject</strong></TableCell>
                                <TableCell align="right"><strong>Total Classes</strong></TableCell>
                                <TableCell align="right"><strong>Attended</strong></TableCell>
                                <TableCell align="right"><strong>Absent</strong></TableCell>
                                <TableCell align="right"><strong>%</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No attendance records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((row) => (
                                    <TableRow key={row.subjectId}>
                                        <TableCell>{row.subjectName}</TableCell>
                                        <TableCell align="right">{row.totalClasses}</TableCell>
                                        <TableCell align="right">{row.attendedClasses}</TableCell>
                                        <TableCell align="right">{row.absentCount}</TableCell>
                                        <TableCell align="right">{pct(row.attendancePercentage)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </>
    );
};

// ─── Root component ──────────────────────────────────────────────────────────

const AttendanceReport = () => {
    const schoolId = useSelector((state) => state.user.currentUser._id);

    const [level, setLevel] = useState(1);
    const [selectedClass, setSelectedClass] = useState({ id: null, name: '' });
    const [selectedStudent, setSelectedStudent] = useState({ id: null, name: '' });

    const handleSelectClass = (classId, className) => {
        setSelectedClass({ id: classId, name: className });
        setLevel(2);
    };

    const handleSelectStudent = (studentId, studentName) => {
        setSelectedStudent({ id: studentId, name: studentName });
        setLevel(3);
    };

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Attendance Report</Typography>

            {level === 1 && (
                <SchoolView schoolId={schoolId} onSelectClass={handleSelectClass} />
            )}

            {level === 2 && (
                <ClassView
                    classId={selectedClass.id}
                    className={selectedClass.name}
                    onBack={() => setLevel(1)}
                    onSelectStudent={handleSelectStudent}
                />
            )}

            {level === 3 && (
                <StudentView
                    studentId={selectedStudent.id}
                    studentName={selectedStudent.name}
                    onBack={() => setLevel(2)}
                />
            )}
        </Container>
    );
};

export default AttendanceReport;
