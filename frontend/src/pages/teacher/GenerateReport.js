import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, Button, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Chip,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ArrowBackIcon  from '@mui/icons-material/ArrowBack';
import ReportCard from '../../components/ReportCard';


const GenerateReport = () => {
    const { currentUser } = useSelector(s => s.user);

    const [classes,    setClasses]    = useState([]);
    const [students,   setStudents]   = useState([]);
    const [classId,    setClassId]    = useState('');
    const [selected,   setSelected]   = useState(null); // { _id, name, rollNum }
    const [loading,    setLoading]    = useState(false);

    // Load teacher's classes
    useEffect(() => {
        if (!currentUser?._id) return;
        axiosInstance.get(`/Teacher/${currentUser._id}`)
            .then(({ data }) => {
                const cls = data.teachClasses?.length ? data.teachClasses : data.teachSclass ? [data.teachSclass] : [];
                setClasses(cls.filter(Boolean));
                if (cls[0]) setClassId(cls[0]._id || cls[0]);
            })
            .catch(() => {});
    }, [currentUser?._id]);

    // Load students when class changes
    useEffect(() => {
        if (!classId) return;
        setLoading(true);
        setStudents([]);
        setSelected(null);
        axiosInstance.get(`/Sclass/Students/${classId}`)
            .then(({ data }) => {
                const list = Array.isArray(data) ? data : [];
                list.sort((a, b) => (a.rollNum || 0) - (b.rollNum || 0));
                setStudents(list);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [classId]);

    if (!selected) return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <AssessmentIcon />
                <Typography variant="h5" fontWeight={800}>Generate Report</Typography>
            </Box>

            <Paper sx={{ borderRadius: 3, p: 2, mb: 3 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Class</InputLabel>
                    <Select value={classId} label="Class" onChange={e => setClassId(e.target.value)}>
                        {classes.map(c => (
                            <MenuItem key={c._id || c} value={c._id || c}>
                                {c.className || c.sclassName || c}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {['Roll', 'Student Name', 'Action'].map(h => (
                                    <TableCell key={h}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} align="center" sx={{ py: 5 }}>
                                        {classId ? 'No students in this class' : 'Select a class'}
                                    </TableCell>
                                </TableRow>
                            ) : students.map(s => (
                                <TableRow key={s._id}>
                                    <TableCell sx={{ width: 60 }}>{s.rollNum}</TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{s.name}</TableCell>
                                    <TableCell>
                                        <Button size="small" variant="outlined"
                                            onClick={() => setSelected(s)}
                                            sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem' }}>
                                            View Report
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}
        </Box>
    );

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => setSelected(null)}
                sx={{ textTransform: 'none', mb: 3 }}>
                Back to Students
            </Button>
            <ReportCard studentId={selected._id} />
        </Box>
    );
};

export default GenerateReport;
