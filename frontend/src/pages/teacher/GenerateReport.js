import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Box, Typography, Paper, Table, TableHead, TableBody,
    TableRow, TableCell, Button, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Chip,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ArrowBackIcon  from '@mui/icons-material/ArrowBack';
import ReportCard from '../../components/ReportCard';

const BASE = process.env.REACT_APP_BASE_URL;

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
        axios.get(`${BASE}/Teacher/${currentUser._id}`)
            .then(({ data }) => {
                const cls = data.teachClasses?.length ? data.teachClasses : data.teachSclass ? [data.teachSclass] : [];
                setClasses(cls.filter(Boolean));
                if (cls[0]) setClassId(cls[0]._id || cls[0]);
            })
            .catch(() => {});
    }, [currentUser?._id, BASE]);

    // Load students when class changes
    useEffect(() => {
        if (!classId) return;
        setLoading(true);
        setStudents([]);
        setSelected(null);
        axios.get(`${BASE}/Sclass/Students/${classId}`)
            .then(({ data }) => {
                const list = Array.isArray(data) ? data : [];
                list.sort((a, b) => (a.rollNum || 0) - (b.rollNum || 0));
                setStudents(list);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [classId, BASE]);

    // ── Student list view ─────────────────────────────────────────────────────
    if (!selected) return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0b1120', minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <AssessmentIcon sx={{ color: '#0ea5e9' }} />
                <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.4rem' }}>
                    Generate Report
                </Typography>
            </Box>

            <Paper sx={{ bgcolor: '#1e293b', border: '1px solid rgba(14,165,233,0.12)', borderRadius: 3, p: 2, mb: 3 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
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
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress sx={{ color: '#0ea5e9' }} />
                </Box>
            ) : (
                <Paper sx={{ bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#1e293b' }}>
                                {['Roll', 'Student Name', 'Action'].map(h => (
                                    <TableCell key={h} sx={{ color: 'rgba(148,163,184,0.7)', fontWeight: 700, fontSize: '0.73rem', borderBottom: '1px solid rgba(255,255,255,0.07)', py: 1.5 }}>
                                        {h}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {students.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} align="center" sx={{ py: 5, color: 'rgba(148,163,184,0.35)', borderBottom: 'none' }}>
                                        {classId ? 'No students in this class' : 'Select a class'}
                                    </TableCell>
                                </TableRow>
                            ) : students.map(s => (
                                <TableRow key={s._id} sx={{
                                    '& td': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                                }}>
                                    <TableCell sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.8rem', width: 60 }}>{s.rollNum}</TableCell>
                                    <TableCell sx={{ color: '#f1f5f9', fontWeight: 500, fontSize: '0.85rem' }}>{s.name}</TableCell>
                                    <TableCell>
                                        <Button size="small" variant="outlined"
                                            onClick={() => setSelected(s)}
                                            sx={{ color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.35)', borderRadius: 2, textTransform: 'none', fontSize: '0.75rem',
                                                '&:hover': { bgcolor: 'rgba(14,165,233,0.1)', borderColor: '#0ea5e9' } }}>
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

    // ── Individual report card view ───────────────────────────────────────────
    return (
        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0b1120', minHeight: '100vh' }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => setSelected(null)}
                sx={{ color: 'rgba(148,163,184,0.6)', textTransform: 'none', mb: 3, '&:hover': { color: '#f1f5f9' } }}>
                Back to Students
            </Button>
            <ReportCard studentId={selected._id} />
        </Box>
    );
};

export default GenerateReport;
