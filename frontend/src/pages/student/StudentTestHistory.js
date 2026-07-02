/**
 * StudentTestHistory
 *
 * Full test history page for students.
 * Features: search, filter by subject/teacher/grade/date/score, sort, pagination,
 * attempt detail drawer, topic-wise analytics, AI feedback, correct-answer review,
 * PDF export.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, TextField, MenuItem, Select, InputLabel, FormControl,
    Chip, CircularProgress, Alert, Pagination, Grid, Card, CardContent,
    CardActionArea, Drawer, Divider, Button, IconButton, Tooltip,
    LinearProgress, Tab, Tabs, Table, TableHead, TableRow, TableCell,
    TableBody, Paper, Collapse,
} from '@mui/material';
import FilterListIcon    from '@mui/icons-material/FilterList';
import DownloadIcon      from '@mui/icons-material/Download';
import CloseIcon         from '@mui/icons-material/Close';
import TrendingUpIcon    from '@mui/icons-material/TrendingUp';
import QuizIcon          from '@mui/icons-material/Quiz';
import CheckCircleIcon   from '@mui/icons-material/CheckCircle';
import CancelIcon        from '@mui/icons-material/Cancel';
import RemoveCircleIcon  from '@mui/icons-material/RemoveCircle';
import AutoAwesomeIcon   from '@mui/icons-material/AutoAwesome';
import EmojiEventsIcon   from '@mui/icons-material/EmojiEvents';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as ReTooltip, Legend, ResponsiveContainer, RadarChart,
    PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { useDispatch, useSelector } from 'react-redux';
import { fetchStudentHistory, fetchAttemptDetail, fetchStudentAnalytics, fetchExportData }
    from '../../redux/testHistoryRelated/testHistoryHandle';
import { setDetail } from '../../redux/testHistoryRelated/testHistorySlice';

// ── Helpers ───────────────────────────────────────────────────────────────────
const GRADE_COLOR = { 'A+': '#4caf50', A: '#8bc34a', B: '#ffc107', C: '#ff9800', D: '#ff7043', F: '#f44336' };
const gradeChip = (grade) => (
    <Chip label={grade} size="small"
        sx={{ bgcolor: GRADE_COLOR[grade] || '#666', color: '#fff', fontWeight: 700, fontSize: '0.75rem' }} />
);
const pct = (v) => `${Number(v).toFixed(1)}%`;
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (s) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

// ── Test Card ─────────────────────────────────────────────────────────────────
const TestCard = ({ record, onClick }) => (
    <Card variant="outlined"
        sx={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2, transition: 'border-color 0.2s',
              '&:hover': { borderColor: 'rgba(255,255,255,0.3)' } }}>
        <CardActionArea onClick={() => onClick(record)} sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Box sx={{ flex: 1, mr: 1 }}>
                    <Typography fontWeight={700} fontSize="0.95rem" noWrap>{record.testTitle || 'Untitled Test'}</Typography>
                    <Typography variant="caption" color="text.secondary">{record.subjectName} • {record.teacherName}</Typography>
                </Box>
                {gradeChip(record.grade)}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <Chip icon={<QuizIcon sx={{ fontSize: '0.9rem !important' }} />}
                    label={`${record.finalScore}/${record.maxScore}`} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem' }} />
                <Chip label={pct(record.percentage)} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem' }} />
                <Chip label={record.difficultyLevel} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem', textTransform: 'capitalize' }} />
                {record.rank && (
                    <Chip icon={<EmojiEventsIcon sx={{ fontSize: '0.9rem !important', color: '#ffc107 !important' }} />}
                        label={`#${record.rank}`} size="small"
                        sx={{ bgcolor: 'rgba(255,193,7,0.12)', fontSize: '0.75rem', color: '#ffc107' }} />
                )}
            </Box>

            <LinearProgress variant="determinate" value={Math.min(100, record.percentage)}
                sx={{ height: 4, borderRadius: 2, mb: 1.5,
                      '& .MuiLinearProgress-bar': { bgcolor: GRADE_COLOR[record.grade] || '#666' } }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">{fmt(record.submittedAt)}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {record.timeTakenSeconds ? fmtTime(record.timeTakenSeconds) : '—'}
                </Typography>
            </Box>
        </CardActionArea>
    </Card>
);

// ── AI Feedback Panel ─────────────────────────────────────────────────────────
const AIFeedbackPanel = ({ feedback }) => {
    if (!feedback?.summary) return (
        <Alert severity="info" sx={{ mt: 2 }}>
            AI feedback is being generated. Check back in a moment.
        </Alert>
    );
    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AutoAwesomeIcon sx={{ color: '#ab47bc', fontSize: '1.1rem' }} />
                <Typography fontWeight={700} fontSize="0.9rem">AI Feedback</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                {feedback.summary}
            </Typography>
            {feedback.strengths?.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="success.main" fontWeight={700}>Strengths</Typography>
                    {feedback.strengths.map((s, i) => (
                        <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1, '&:before': { content: '"• "' } }}>{s}</Typography>
                    ))}
                </Box>
            )}
            {feedback.weaknesses?.length > 0 && (
                <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="warning.main" fontWeight={700}>Areas to Improve</Typography>
                    {feedback.weaknesses.map((w, i) => (
                        <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1, '&:before': { content: '"• "' } }}>{w}</Typography>
                    ))}
                </Box>
            )}
            {feedback.recommendations?.length > 0 && (
                <Box>
                    <Typography variant="caption" color="info.main" fontWeight={700}>Recommendations</Typography>
                    {feedback.recommendations.map((r, i) => (
                        <Typography key={i} variant="body2" color="text.secondary" sx={{ pl: 1, '&:before': { content: '"• "' } }}>{r}</Typography>
                    ))}
                </Box>
            )}
        </Box>
    );
};

// ── Attempt Detail Drawer ─────────────────────────────────────────────────────
const AttemptDetailDrawer = ({ open, onClose, record, onExport }) => {
    const [tab, setTab] = useState(0);
    if (!record) return null;

    const topicData = (record.topicPerformance || []).map(tp => ({
        topic:    tp.topic.length > 12 ? tp.topic.slice(0, 12) + '…' : tp.topic,
        fullTopic: tp.topic,
        accuracy: parseFloat((tp.accuracy * 100).toFixed(1)),
        mastery:  tp.masteryAfter != null ? parseFloat((tp.masteryAfter * 100).toFixed(1)) : null,
    }));

    return (
        <Drawer anchor="right" open={open} onClose={onClose}
            PaperProps={{ sx: { width: { xs: '100vw', sm: 520 }, background: '#161616', p: 0 } }}>
            {/* Header */}
            <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography fontWeight={700}>{record.testTitle || 'Test Detail'}</Typography>
                    <Typography variant="caption" color="text.secondary">{record.subjectName} • {fmt(record.submittedAt)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Download PDF report">
                        <IconButton size="small" onClick={() => onExport(record._id)}>
                            <DownloadIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
                </Box>
            </Box>

            {/* Score hero */}
            <Box sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress variant="determinate" value={Math.min(100, record.percentage)}
                        size={80} thickness={5}
                        sx={{ color: GRADE_COLOR[record.grade] || '#666' }} />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography fontWeight={700} fontSize="1.1rem">{pct(record.percentage)}</Typography>
                    </Box>
                </Box>
                <Box>
                    <Typography fontWeight={700} fontSize="1.5rem">{record.finalScore}/{record.maxScore}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        {gradeChip(record.grade)}
                        {record.rank && <Chip icon={<EmojiEventsIcon sx={{ fontSize: '0.85rem !important', color: '#ffc107 !important' }} />}
                            label={`Rank #${record.rank}/${record.totalRanked}`} size="small"
                            sx={{ bgcolor: 'rgba(255,193,7,0.12)', color: '#ffc107', fontSize: '0.72rem' }} />}
                    </Box>
                </Box>
                <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">Time Taken</Typography>
                    <Typography fontWeight={600}>{record.timeTakenSeconds ? fmtTime(record.timeTakenSeconds) : '—'}</Typography>
                </Box>
            </Box>

            {/* Stats row */}
            <Box sx={{ px: 2.5, py: 1.5, display: 'flex', gap: 3,
                borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                    { label: 'Correct',  value: record.correctAnswers,     color: '#4caf50', icon: <CheckCircleIcon sx={{ fontSize: '0.9rem', color: '#4caf50' }} /> },
                    { label: 'Wrong',    value: record.wrongAnswers,        color: '#f44336', icon: <CancelIcon sx={{ fontSize: '0.9rem', color: '#f44336' }} /> },
                    { label: 'Skipped',  value: record.skippedQuestions,   color: '#9e9e9e', icon: <RemoveCircleIcon sx={{ fontSize: '0.9rem', color: '#9e9e9e' }} /> },
                ].map(s => (
                    <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {s.icon}
                        <Typography variant="body2" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Box>
                ))}
                {record.improvementScore != null && (
                    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: '0.9rem', color: record.improvementScore >= 0 ? '#4caf50' : '#f44336' }} />
                        <Typography variant="body2" fontWeight={700}
                            sx={{ color: record.improvementScore >= 0 ? '#4caf50' : '#f44336' }}>
                            {record.improvementScore >= 0 ? '+' : ''}{record.improvementScore}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">vs last</Typography>
                    </Box>
                )}
            </Box>

            {/* Tabs */}
            <Tabs value={tab} onChange={(_, v) => setTab(v)}
                sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', px: 1,
                      '& .MuiTab-root': { textTransform: 'none', fontSize: '0.82rem', minWidth: 80 } }}>
                <Tab label="Topics" />
                <Tab label="Questions" />
                <Tab label="AI Feedback" />
            </Tabs>

            <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
                {/* Topics tab */}
                {tab === 0 && (
                    <Box>
                        {topicData.length > 0 && (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={topicData} margin={{ top: 0, right: 0, bottom: 20, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="topic" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} angle={-30} textAnchor="end" />
                                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} domain={[0, 100]} />
                                    <ReTooltip contentStyle={{ background: '#222', border: '1px solid #333', fontSize: 12 }} />
                                    <Bar dataKey="accuracy" name="Accuracy %" fill="#42a5f5" radius={[3, 3, 0, 0]} />
                                    {topicData.some(t => t.mastery != null) && (
                                        <Bar dataKey="mastery" name="Mastery %" fill="#ab47bc" radius={[3, 3, 0, 0]} />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                        <Box sx={{ mt: 2 }}>
                            {(record.topicPerformance || []).map((tp, i) => (
                                <Box key={i} sx={{ mb: 1.5 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="body2" fontWeight={600}>{tp.topic}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {tp.correctAnswers}/{tp.totalQuestions} correct
                                        </Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={tp.accuracy * 100}
                                        sx={{ height: 5, borderRadius: 2,
                                              '& .MuiLinearProgress-bar': { bgcolor: tp.accuracy >= 0.7 ? '#4caf50' : tp.accuracy >= 0.4 ? '#ffc107' : '#f44336' } }} />
                                    {tp.masteryAfter != null && (
                                        <Typography variant="caption" color="text.secondary">
                                            Mastery: {pct(tp.masteryBefore * 100 || 0)} → {pct(tp.masteryAfter * 100)}
                                            {tp.masteryDelta != null && (
                                                <span style={{ color: tp.masteryDelta >= 0 ? '#4caf50' : '#f44336', marginLeft: 4 }}>
                                                    ({tp.masteryDelta >= 0 ? '+' : ''}{(tp.masteryDelta * 100).toFixed(1)}%)
                                                </span>
                                            )}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Questions tab */}
                {tab === 1 && (
                    <Box>
                        {record.solutionsPublished
                            ? (record.questionResponses || []).map((qr, i) => (
                                <Box key={i} sx={{ mb: 2, p: 1.5, borderRadius: 1.5,
                                    border: `1px solid ${qr.isSkipped ? 'rgba(255,255,255,0.06)' : qr.isCorrect ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
                                    background: qr.isSkipped ? 'transparent' : qr.isCorrect ? 'rgba(76,175,80,0.05)' : 'rgba(244,67,54,0.05)' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary">Q{i + 1} • {qr.topic}</Typography>
                                        {qr.isSkipped
                                            ? <Chip label="Skipped" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.06)', fontSize: '0.7rem' }} />
                                            : qr.isCorrect
                                                ? <Chip label="Correct" size="small" sx={{ bgcolor: 'rgba(76,175,80,0.15)', color: '#4caf50', fontSize: '0.7rem' }} />
                                                : <Chip label="Wrong" size="small" sx={{ bgcolor: 'rgba(244,67,54,0.15)', color: '#f44336', fontSize: '0.7rem' }} />}
                                    </Box>
                                    {qr.questionText && (
                                        <Typography variant="body2" sx={{ mb: 0.5 }}>{qr.questionText}</Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                        Your answer: <strong>{qr.studentAnswer ?? '—'}</strong> &nbsp;|&nbsp;
                                        Correct: <strong style={{ color: '#4caf50' }}>{qr.correctAnswer ?? '—'}</strong>
                                    </Typography>
                                    {qr.responseTimeMs > 0 && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                            Time: {(qr.responseTimeMs / 1000).toFixed(1)}s
                                        </Typography>
                                    )}
                                </Box>
                            ))
                            : <Alert severity="info">Correct answers will be visible after the teacher publishes solutions.</Alert>
                        }
                    </Box>
                )}

                {/* AI Feedback tab */}
                {tab === 2 && <AIFeedbackPanel feedback={record.aiFeedback} />}
            </Box>
        </Drawer>
    );
};

// ── Analytics Section ─────────────────────────────────────────────────────────
const AnalyticsSection = ({ analytics }) => {
    if (!analytics) return null;
    const {
        scoreProgression, subjectProgress, topicMasteryProgression, accuracyTrend,
        weeklyImprovement, strongTopics, weakTopics, testFrequency,
        avgVelocity, consistencyScore, totalAttempts, overallAvg,
    } = analytics;

    return (
        <Box>
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Tests Taken',     value: totalAttempts },
                    { label: 'Overall Average', value: `${overallAvg}%` },
                    { label: 'Consistency',     value: `${(consistencyScore * 100).toFixed(0)}%` },
                    { label: 'Learning Velocity', value: avgVelocity != null ? `${(avgVelocity * 100).toFixed(1)}%/day` : '—' },
                ].map(s => (
                    <Grid item xs={6} sm={3} key={s.label}>
                        <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <Typography fontWeight={700} fontSize="1.4rem">{s.value}</Typography>
                            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Score progression */}
            {scoreProgression?.length > 1 && (
                <Box sx={{ mb: 4 }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>Score Progression</Typography>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={scoreProgression.map(p => ({ ...p, date: fmt(p.date) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                            <ReTooltip contentStyle={{ background: '#222', border: '1px solid #333', fontSize: 12 }}
                                formatter={(v) => [`${v}%`, 'Score']} />
                            <Line type="monotone" dataKey="score" stroke="#42a5f5" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </Box>
            )}

            {/* Subject progress */}
            {subjectProgress?.length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>Subject-wise Performance</Typography>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={subjectProgress} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                            <YAxis type="category" dataKey="subject" width={100} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                            <ReTooltip contentStyle={{ background: '#222', border: '1px solid #333', fontSize: 12 }}
                                formatter={(v) => [`${v}%`, 'Avg Score']} />
                            <Bar dataKey="avg" fill="#ab47bc" radius={[0, 3, 3, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            )}

            {/* Weekly improvement */}
            {weeklyImprovement?.length > 1 && (
                <Box sx={{ mb: 4 }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>Weekly Progress</Typography>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={weeklyImprovement}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="period" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                            <ReTooltip contentStyle={{ background: '#222', border: '1px solid #333', fontSize: 12 }}
                                formatter={(v) => [`${v}%`, 'Average']} />
                            <Bar dataKey="avg" fill="#26a69a" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>
            )}

            {/* Topic mastery radar */}
            {topicMasteryProgression?.length >= 3 && (
                <Box sx={{ mb: 4 }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>Topic Mastery Map</Typography>
                    <ResponsiveContainer width="100%" height={240}>
                        <RadarChart data={topicMasteryProgression.slice(0, 8).map(t => ({
                            topic:   t.topic.length > 10 ? t.topic.slice(0, 10) + '…' : t.topic,
                            mastery: parseFloat(((t.mastery || 0) * 100).toFixed(1)),
                        }))}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                            <PolarAngleAxis dataKey="topic" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                            <Radar name="Mastery" dataKey="mastery" stroke="#42a5f5" fill="#42a5f5" fillOpacity={0.2} />
                            <ReTooltip contentStyle={{ background: '#222', border: '1px solid #333', fontSize: 12 }}
                                formatter={(v) => [`${v}%`, 'Mastery']} />
                        </RadarChart>
                    </ResponsiveContainer>
                </Box>
            )}

            {/* Weak / Strong topics */}
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <Typography fontWeight={700} color="success.main" sx={{ mb: 1 }}>Strong Topics</Typography>
                    {(strongTopics || []).map((t, i) => (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">{t.topic}</Typography>
                            <Typography variant="body2" color="success.main" fontWeight={600}>{t.accuracy}%</Typography>
                        </Box>
                    ))}
                    {(!strongTopics || strongTopics.length === 0) && (
                        <Typography variant="body2" color="text.secondary">Keep attempting tests to identify strong areas.</Typography>
                    )}
                </Grid>
                <Grid item xs={12} sm={6}>
                    <Typography fontWeight={700} color="warning.main" sx={{ mb: 1 }}>Needs Improvement</Typography>
                    {(weakTopics || []).map((t, i) => (
                        <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">{t.topic}</Typography>
                            <Typography variant="body2" color="warning.main" fontWeight={600}>{t.accuracy}%</Typography>
                        </Box>
                    ))}
                    {(!weakTopics || weakTopics.length === 0) && (
                        <Typography variant="body2" color="text.secondary">No weak areas detected yet.</Typography>
                    )}
                </Grid>
            </Grid>
        </Box>
    );
};

// ── PDF Export ────────────────────────────────────────────────────────────────
function printReport(exportData) {
    if (!exportData) return;
    const { record, student } = exportData;
    const w = window.open('', '_blank');
    const tp = (record.topicPerformance || [])
        .map(t => `<tr><td>${t.topic}</td><td>${t.correctAnswers}/${t.totalQuestions}</td><td>${(t.accuracy*100).toFixed(1)}%</td></tr>`)
        .join('');
    w.document.write(`
<html><head><title>Score Report</title>
<style>body{font-family:Arial,sans-serif;padding:30px;color:#111}
h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;color:#555;margin:0 0 20px}
.hero{display:flex;gap:40px;margin-bottom:20px}
.stat{background:#f5f5f5;border-radius:8px;padding:12px 20px;text-align:center}
.stat .val{font-size:24px;font-weight:700}.stat .lbl{font-size:12px;color:#777}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}th{background:#f5f5f5}
</style></head><body>
<h1>Score Report</h1>
<h2>${record.testTitle || 'Test'} — ${record.subjectName || ''}</h2>
<p>Student: <strong>${student?.name || ''}</strong> | Roll: ${student?.rollNum || ''} | Date: ${fmt(record.submittedAt)}</p>
<div class="hero">
  <div class="stat"><div class="val">${record.finalScore}/${record.maxScore}</div><div class="lbl">Score</div></div>
  <div class="stat"><div class="val">${record.percentage}%</div><div class="lbl">Percentage</div></div>
  <div class="stat"><div class="val">${record.grade}</div><div class="lbl">Grade</div></div>
  <div class="stat"><div class="val">#${record.rank || '—'}</div><div class="lbl">Rank</div></div>
</div>
<p>Correct: ${record.correctAnswers} | Wrong: ${record.wrongAnswers} | Skipped: ${record.skippedQuestions} | Time: ${fmtTime(record.timeTakenSeconds)}</p>
<table><thead><tr><th>Topic</th><th>Correct/Total</th><th>Accuracy</th></tr></thead><tbody>${tp}</tbody></table>
${record.aiFeedback?.summary ? `<h2 style="margin-top:24px">AI Feedback</h2><p>${record.aiFeedback.summary}</p>` : ''}
</body></html>`);
    w.document.close();
    w.print();
}

// ── Main Component ────────────────────────────────────────────────────────────
const StudentTestHistory = () => {
    const dispatch = useDispatch();
    const { currentUser } = useSelector(s => s.user);
    const { records, total, pages, loading, error, detail, analytics, exportData } =
        useSelector(s => s.testHistory);

    const studentId = currentUser?._id;

    const [drawerOpen,  setDrawerOpen]  = useState(false);
    const [analyticsTab, setAnalyticsTab] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [page,   setPage]   = useState(1);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ sort: 'latest', grade: '', minScore: '', maxScore: '', from: '', to: '' });

    const loadHistory = useCallback(() => {
        if (!studentId) return;
        const p = { page, sort: filters.sort };
        if (search)          p.search   = search;
        if (filters.grade)   p.grade    = filters.grade;
        if (filters.minScore) p.minScore = filters.minScore;
        if (filters.maxScore) p.maxScore = filters.maxScore;
        if (filters.from)    p.from     = filters.from;
        if (filters.to)      p.to       = filters.to;
        dispatch(fetchStudentHistory(studentId, p));
    }, [dispatch, studentId, page, search, filters]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    useEffect(() => {
        if (!analyticsTab || !studentId) return;
        dispatch(fetchStudentAnalytics(studentId));
    }, [analyticsTab, dispatch, studentId]);

    const handleCardClick = (record) => {
        dispatch(fetchAttemptDetail(record._id));
        setDrawerOpen(true);
    };

    const handleExport = useCallback((id) => {
        dispatch(fetchExportData(studentId, id));
    }, [dispatch, studentId]);

    useEffect(() => {
        if (exportData) printReport(exportData);
    }, [exportData]);

    const handleFilterChange = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', background: '#111111' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Test History</Typography>
                    <Typography variant="body2" color="text.secondary">{total} attempt{total !== 1 ? 's' : ''} recorded</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant={analyticsTab ? 'contained' : 'outlined'} size="small"
                        startIcon={<TrendingUpIcon />}
                        onClick={() => setAnalyticsTab(v => !v)}
                        sx={{ textTransform: 'none' }}>
                        Analytics
                    </Button>
                    <IconButton onClick={() => setFiltersOpen(v => !v)} size="small"
                        sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 1.5 }}>
                        <FilterListIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            {/* Search */}
            <TextField fullWidth size="small" placeholder="Search by test or subject…"
                value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                sx={{ mb: 2, '& .MuiOutlinedInput-root': { background: '#1a1a1a' } }} />

            {/* Filters */}
            <Collapse in={filtersOpen}>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2,
                    p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', background: '#1a1a1a' }}>
                    {[
                        { label: 'Sort', key: 'sort', options: ['latest','oldest','highest','lowest'] },
                        { label: 'Grade', key: 'grade', options: ['','A+','A','B','C','D','F'] },
                    ].map(f => (
                        <FormControl key={f.key} size="small" sx={{ minWidth: 120 }}>
                            <InputLabel>{f.label}</InputLabel>
                            <Select value={filters[f.key]} label={f.label}
                                onChange={e => { handleFilterChange(f.key, e.target.value); setPage(1); }}>
                                {f.options.map(o => (
                                    <MenuItem key={o} value={o}>{o || 'All'}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ))}
                    <TextField label="Min %" size="small" type="number"
                        value={filters.minScore} onChange={e => handleFilterChange('minScore', e.target.value)}
                        sx={{ width: 90 }} />
                    <TextField label="Max %" size="small" type="number"
                        value={filters.maxScore} onChange={e => handleFilterChange('maxScore', e.target.value)}
                        sx={{ width: 90 }} />
                    <TextField label="From" size="small" type="date" InputLabelProps={{ shrink: true }}
                        value={filters.from} onChange={e => handleFilterChange('from', e.target.value)}
                        sx={{ width: 150 }} />
                    <TextField label="To" size="small" type="date" InputLabelProps={{ shrink: true }}
                        value={filters.to} onChange={e => handleFilterChange('to', e.target.value)}
                        sx={{ width: 150 }} />
                    <Button size="small" variant="outlined" sx={{ textTransform: 'none' }}
                        onClick={() => { setFilters({ sort: 'latest', grade: '', minScore: '', maxScore: '', from: '', to: '' }); setPage(1); }}>
                        Reset
                    </Button>
                </Box>
            </Collapse>

            {/* Analytics panel */}
            {analyticsTab && (
                <Box sx={{ mb: 3, p: 2.5, borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.08)', background: '#1a1a1a' }}>
                    {loading && !analytics ? <CircularProgress size={28} /> : <AnalyticsSection analytics={analytics} />}
                </Box>
            )}

            {/* Error */}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* History grid */}
            {loading && records.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                    <CircularProgress />
                </Box>
            ) : records.length === 0 ? (
                <Box sx={{ textAlign: 'center', mt: 6 }}>
                    <QuizIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.15)', mb: 2 }} />
                    <Typography color="text.secondary">No test attempts found.</Typography>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {records.map(r => (
                        <Grid item xs={12} sm={6} md={4} key={r._id}>
                            <TestCard record={r} onClick={handleCardClick} />
                        </Grid>
                    ))}
                </Grid>
            )}

            {/* Pagination */}
            {pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination count={pages} page={page} onChange={(_, v) => setPage(v)}
                        sx={{ '& .MuiPaginationItem-root': { color: 'rgba(255,255,255,0.6)' } }} />
                </Box>
            )}

            {/* Detail drawer */}
            <AttemptDetailDrawer
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); dispatch(setDetail(null)); }}
                record={detail}
                onExport={handleExport}
            />
        </Box>
    );
};

export default StudentTestHistory;
