/**
 * TestAttemptHistoryDashboard (Teacher view)
 *
 * Lets teachers:
 *   - View all attempts for a test with sortable table
 *   - Compare students side-by-side
 *   - View question discrimination statistics
 *   - Publish solutions / compute ranks
 *   - Export results
 */

import React, { useEffect, useState } from 'react';
import {
    Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
    Paper, CircularProgress, Chip, Button, Alert, Select, MenuItem,
    FormControl, InputLabel, Grid, LinearProgress, Tooltip,
    TableSortLabel, Divider,
} from '@mui/material';
import PublishIcon       from '@mui/icons-material/Publish';
import EmojiEventsIcon   from '@mui/icons-material/EmojiEvents';
import BarChartIcon      from '@mui/icons-material/BarChart';
import FileDownloadIcon  from '@mui/icons-material/FileDownload';
import { useParams }     from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchTestAttempts, publishTestSolutions, computeTestRanks,
} from '../../redux/testHistoryRelated/testHistoryHandle';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import axiosInstance from '../../utils/axiosInstance';

const GRADE_COLOR = { 'A+': '#4caf50', A: '#8bc34a', B: '#ffc107', C: '#ff9800', D: '#ff7043', F: '#f44336' };
const pct = (v) => `${Number(v).toFixed(1)}%`;
const fmt = (d) => d ? new Date(d).toLocaleString() : '—';

// ── Grade distribution bar ────────────────────────────────────────────────────
const GradeDist = ({ records }) => {
    const counts = { 'A+': 0, A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const r of records) counts[r.grade] = (counts[r.grade] || 0) + 1;
    const data = Object.entries(counts).map(([g, c]) => ({ grade: g, count: c }));
    return (
        <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="grade" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} allowDecimals={false} />
                <ReTooltip contentStyle={{ background: '#222', border: '1px solid #333', fontSize: 12 }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {data.map(d => <Cell key={d.grade} fill={GRADE_COLOR[d.grade] || '#666'} />)}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

// ── Question discrimination table ─────────────────────────────────────────────
const QuestionStats = ({ stats }) => {
    if (!stats || stats.length === 0) return null;
    return (
        <Box sx={{ mt: 3 }}>
            <Typography fontWeight={700} sx={{ mb: 1.5 }}>Question Analysis</Typography>
            <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {['Q#','Correct','Wrong','Skipped','Difficulty %','Discrimination'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>{h}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {stats.map(s => (
                            <TableRow key={s.idx} hover>
                                <TableCell sx={{ fontSize: '0.8rem' }}>Q{s.idx + 1}</TableCell>
                                <TableCell sx={{ fontSize: '0.8rem', color: '#4caf50' }}>{s.correct}</TableCell>
                                <TableCell sx={{ fontSize: '0.8rem', color: '#f44336' }}>{s.wrong}</TableCell>
                                <TableCell sx={{ fontSize: '0.8rem', color: '#9e9e9e' }}>{s.skipped}</TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LinearProgress variant="determinate" value={s.difficulty}
                                            sx={{ width: 60, height: 5, borderRadius: 2,
                                                  '& .MuiLinearProgress-bar': { bgcolor: s.difficulty > 70 ? '#f44336' : s.difficulty > 40 ? '#ffc107' : '#4caf50' } }} />
                                        <Typography variant="caption">{s.difficulty.toFixed(0)}%</Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '0.8rem' }}>{(s.discrimination * 100).toFixed(0)}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        </Box>
    );
};

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(records) {
    const headers = ['Student','Roll','Score','Max','Percentage','Grade','Correct','Wrong','Skipped','Time(s)','Rank'];
    const rows = records.map(r => [
        r.studentId?.name || '', r.studentId?.rollNum || '',
        r.finalScore, r.maxScore, r.percentage, r.grade,
        r.correctAnswers, r.wrongAnswers, r.skippedQuestions,
        r.timeTakenSeconds, r.rank || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'test_results.csv'; a.click();
    URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────
const TestAttemptHistoryDashboard = () => {
    const { testId } = useParams();
    const dispatch   = useDispatch();
    const { testResults, questionStats, loading, error } = useSelector(s => s.testHistory);

    const [sort,     setSort]    = useState('highest');
    const [notice,   setNotice]  = useState('');
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        if (testId) dispatch(fetchTestAttempts(testId, { sort }));
    }, [testId, sort, dispatch]);

    const handlePublishSolutions = async () => {
        await dispatch(publishTestSolutions(testId));
        setNotice('Solutions published — students can now see correct answers.');
        dispatch(fetchTestAttempts(testId, { sort }));
    };

    const handleComputeRanks = async () => {
        await dispatch(computeTestRanks(testId));
        setNotice('Ranks computed and saved.');
        dispatch(fetchTestAttempts(testId, { sort }));
    };

    // Summary stats
    const avg  = testResults.length > 0
        ? (testResults.reduce((s, r) => s + r.percentage, 0) / testResults.length).toFixed(1) : 0;
    const highest = testResults.length > 0 ? Math.max(...testResults.map(r => r.percentage)).toFixed(1) : 0;
    const lowest  = testResults.length > 0 ? Math.min(...testResults.map(r => r.percentage)).toFixed(1) : 0;

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Test Results</Typography>
                    <Typography variant="body2" color="text.secondary">{testResults.length} attempts</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" startIcon={<BarChartIcon />}
                        onClick={() => setShowStats(v => !v)} sx={{ textTransform: 'none' }}>
                        {showStats ? 'Hide' : 'Show'} Analysis
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<EmojiEventsIcon />}
                        onClick={handleComputeRanks} sx={{ textTransform: 'none' }}>
                        Compute Ranks
                    </Button>
                    <Button size="small" variant="outlined" color="success" startIcon={<PublishIcon />}
                        onClick={handlePublishSolutions} sx={{ textTransform: 'none' }}>
                        Publish Solutions
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />}
                        onClick={() => exportCSV(testResults)} sx={{ textTransform: 'none' }}>
                        Export CSV
                    </Button>
                </Box>
            </Box>

            {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
            {error  && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}

            {/* Summary */}
            {testResults.length > 0 && (
                <Grid container spacing={2} sx={{ mb: 2.5 }}>
                    {[
                        { label: 'Average',  value: `${avg}%` },
                        { label: 'Highest',  value: `${highest}%` },
                        { label: 'Lowest',   value: `${lowest}%` },
                        { label: 'Attempts', value: testResults.length },
                    ].map(s => (
                        <Grid item xs={6} sm={3} key={s.label}>
                            <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                                <Typography fontWeight={700} fontSize="1.3rem">{s.value}</Typography>
                                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Analysis */}
            {showStats && testResults.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2.5, mb: 2.5 }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>Grade Distribution</Typography>
                    <GradeDist records={testResults} />
                    <QuestionStats stats={questionStats} />
                </Paper>
            )}

            {/* Sort */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Sort By</InputLabel>
                    <Select value={sort} label="Sort By" onChange={e => setSort(e.target.value)}>
                        <MenuItem value="highest">Highest Score</MenuItem>
                        <MenuItem value="lowest">Lowest Score</MenuItem>
                        <MenuItem value="latest">Latest</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>
            ) : testResults.length === 0 ? (
                <Typography color="text.secondary">No attempts yet.</Typography>
            ) : (
                <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {['#','Student','Roll','Score','%','Grade','Correct','Wrong','Skipped','Time','Rank','Status'].map(h => (
                                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {testResults.map((r, i) => (
                                <TableRow key={r._id} hover>
                                    <TableCell sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{i + 1}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.studentId?.name || '—'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem' }}>{r.studentId?.rollNum || '—'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{r.finalScore}/{r.maxScore}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{pct(r.percentage)}</TableCell>
                                    <TableCell>
                                        <Chip label={r.grade} size="small"
                                            sx={{ bgcolor: GRADE_COLOR[r.grade] || '#666', color: '#fff', fontWeight: 700, fontSize: '0.7rem' }} />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', color: '#4caf50' }}>{r.correctAnswers}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', color: '#f44336' }}>{r.wrongAnswers}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', color: '#9e9e9e' }}>{r.skippedQuestions}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem' }}>
                                        {r.timeTakenSeconds >= 60 ? `${Math.floor(r.timeTakenSeconds / 60)}m` : `${r.timeTakenSeconds}s`}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem' }}>
                                        {r.rank ? <Chip icon={<EmojiEventsIcon sx={{ fontSize: '0.75rem !important', color: '#ffc107 !important' }} />}
                                            label={`#${r.rank}`} size="small"
                                            sx={{ bgcolor: 'rgba(255,193,7,0.12)', color: '#ffc107', fontSize: '0.7rem' }} /> : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={r.status} size="small"
                                            color={r.status === 'completed' ? 'success' : 'warning'}
                                            variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            )}
        </Box>
    );
};

export default TestAttemptHistoryDashboard;
