import { useEffect, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import {
    Box, Typography, CircularProgress, Paper,
    Table, TableHead, TableBody, TableRow, TableCell,
    Chip, LinearProgress, Button, Tooltip,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DownloadIcon   from '@mui/icons-material/Download';


const GRADE_COLOR = {
    'A+': '#34d399', A: '#34d399', B: '#0ea5e9',
    C: '#f59e0b', D: '#f97316', F: '#ef4444', '—': '#64748b',
};

const pctColor = (v) => {
    if (v === null || v === undefined) return '#64748b';
    if (v >= 75) return '#34d399';
    if (v >= 50) return '#f59e0b';
    return '#ef4444';
};

const Cell = ({ children, sx }) => (
    <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', py: 1.5, ...sx }}>
        {children}
    </TableCell>
);

/**
 * ReportCard — reusable across Student, Parent (ChildDashboard), Teacher views.
 * Props:
 *   studentId  {string}  required
 *   compact    {boolean} optional — hides student header (for embedding)
 */
const ReportCard = ({ studentId, compact = false }) => {
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);

    useEffect(() => {
        if (!studentId) return;
        setLoading(true);
        axiosInstance.get(`/api/report/student/${studentId}`)
            .then(r => setData(r.data))
            .catch(() => setError('Failed to load report card.'))
            .finally(() => setLoading(false));
    }, [studentId]);

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: '#0ea5e9' }} />
        </Box>
    );

    if (error) return (
        <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</Typography>
        </Box>
    );

    if (!data) return null;

    return (
        <Box className="print-report-card">
            {/* ── Header ── */}
            {!compact && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <AssessmentIcon sx={{ color: '#0ea5e9', fontSize: '1.6rem' }} />
                        <Box>
                            <Typography sx={{ color: '#f1f5f9', fontWeight: 800, fontSize: '1.3rem', lineHeight: 1.2 }}>
                                Report Card
                            </Typography>
                            <Typography sx={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.8rem' }}>
                                {data.name} &nbsp;·&nbsp; {data.className} &nbsp;·&nbsp; Roll No: {data.rollNum}
                            </Typography>
                        </Box>
                    </Box>
                    <Tooltip title="Download as PDF">
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<DownloadIcon sx={{ fontSize: '1rem !important' }} />}
                            onClick={() => window.print()}
                            sx={{
                                color: '#0ea5e9', borderColor: 'rgba(14,165,233,0.35)',
                                borderRadius: 2, textTransform: 'none', fontSize: '0.78rem',
                                '&:hover': { bgcolor: 'rgba(14,165,233,0.1)', borderColor: '#0ea5e9' },
                                '@media print': { display: 'none' },
                            }}
                        >
                            Download PDF
                        </Button>
                    </Tooltip>
                </Box>
            )}

            {/* ── Overall summary ── */}
            <Paper sx={{
                bgcolor: '#1e293b', border: '1px solid rgba(14,165,233,0.15)',
                borderRadius: 3, p: 2.5, mb: 3,
                display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
            }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress
                        variant="determinate"
                        value={data.overallPercent ?? 0}
                        size={80} thickness={5}
                        sx={{ color: pctColor(data.overallPercent) }}
                    />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ color: pctColor(data.overallPercent), fontWeight: 800, fontSize: '1rem' }}>
                            {data.overallPercent ?? '—'}%
                        </Typography>
                    </Box>
                </Box>
                <Box>
                    <Typography sx={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.72rem', mb: 0.3 }}>Overall Performance</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.4rem' }}>
                            Grade
                        </Typography>
                        <Chip label={data.overallGrade} size="small" sx={{
                            bgcolor: `${GRADE_COLOR[data.overallGrade] || '#64748b'}22`,
                            color:    GRADE_COLOR[data.overallGrade] || '#64748b',
                            border:  `1px solid ${GRADE_COLOR[data.overallGrade] || '#64748b'}55`,
                            fontWeight: 800, fontSize: '0.9rem',
                        }} />
                    </Box>
                    <Typography sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.72rem', mt: 0.3 }}>
                        {data.subjects.length} subjects
                    </Typography>
                </Box>
            </Paper>

            {/* ── Subject table ── */}
            <Paper sx={{ bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#1e293b' }}>
                            {['Subject', 'Exam %', 'Test %', 'Attendance', 'Total', 'Grade'].map(h => (
                                <TableCell key={h} sx={{
                                    color: 'rgba(148,163,184,0.7)', fontWeight: 700,
                                    fontSize: '0.72rem', borderBottom: '1px solid rgba(255,255,255,0.07)', py: 1.5,
                                }}>
                                    {h}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.subjects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 5, color: 'rgba(148,163,184,0.35)', borderBottom: 'none' }}>
                                    No marks data available yet
                                </TableCell>
                            </TableRow>
                        ) : data.subjects.map(s => (
                            <TableRow key={s.subjectId} sx={{
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                            }}>
                                <Cell sx={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.85rem' }}>
                                    {s.subjectName}
                                    {s.subCode && (
                                        <Typography component="span" sx={{ color: 'rgba(148,163,184,0.45)', fontSize: '0.7rem', ml: 0.8 }}>
                                            {s.subCode}
                                        </Typography>
                                    )}
                                </Cell>
                                <Cell>
                                    <Typography sx={{ color: pctColor(s.examMarks), fontWeight: 600, fontSize: '0.83rem' }}>
                                        {s.examMarks !== null ? `${s.examMarks}%` : '—'}
                                    </Typography>
                                </Cell>
                                <Cell>
                                    <Typography sx={{ color: pctColor(s.testMarks), fontWeight: 600, fontSize: '0.83rem' }}>
                                        {s.testMarks !== null ? `${s.testMarks}%` : '—'}
                                    </Typography>
                                </Cell>
                                <Cell sx={{ minWidth: 120 }}>
                                    {s.attendancePercent !== null ? (
                                        <Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                                                <Typography sx={{ color: pctColor(s.attendancePercent), fontSize: '0.75rem', fontWeight: 600 }}>
                                                    {s.attendancePercent}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress variant="determinate" value={s.attendancePercent}
                                                sx={{ height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)',
                                                    '& .MuiLinearProgress-bar': { bgcolor: pctColor(s.attendancePercent), borderRadius: 3 } }} />
                                        </Box>
                                    ) : (
                                        <Typography sx={{ color: 'rgba(148,163,184,0.35)', fontSize: '0.75rem' }}>—</Typography>
                                    )}
                                </Cell>
                                <Cell>
                                    <Typography sx={{ color: pctColor(s.totalMarks), fontWeight: 700, fontSize: '0.9rem' }}>
                                        {s.totalMarks !== null ? `${s.totalMarks}%` : '—'}
                                    </Typography>
                                </Cell>
                                <Cell>
                                    <Chip label={s.grade} size="small" sx={{
                                        bgcolor: `${GRADE_COLOR[s.grade] || '#64748b'}18`,
                                        color:    GRADE_COLOR[s.grade] || '#64748b',
                                        border:  `1px solid ${GRADE_COLOR[s.grade] || '#64748b'}40`,
                                        fontWeight: 700, fontSize: '0.72rem',
                                    }} />
                                </Cell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Paper>

            {/* ── Grade legend ── */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                {[['A+/A', '80–100', '#34d399'], ['B', '70–79', '#0ea5e9'], ['C', '60–69', '#f59e0b'], ['D', '50–59', '#f97316'], ['F', '<50', '#ef4444']].map(([g, r, c]) => (
                    <Box key={g} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} />
                        <Typography sx={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.68rem' }}>{g}: {r}</Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

export default ReportCard;
