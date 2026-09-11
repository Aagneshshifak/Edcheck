/**
 * StudentReportsDashboard
 *
 * Teacher-facing post-assessment analytics dashboard.
 * Shows a table of student reports with filters, and a detailed report view
 * with full Subject -> Chapter -> Subtopic -> Concept hierarchy.
 *
 * Routes:
 *   /Teacher/student-reports
 *   /Teacher/student-reports/:studentId/:reportId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Box, Typography, Paper, Chip, CircularProgress, Alert, Grid,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Tooltip, Divider, Card, CardContent, LinearProgress,
    Accordion, AccordionSummary, AccordionDetails, Button, Stack,
} from '@mui/material';
import ArrowBackIcon       from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore';
import RefreshIcon         from '@mui/icons-material/Refresh';
import WarningAmberIcon    from '@mui/icons-material/WarningAmber';
import TrendingDownIcon    from '@mui/icons-material/TrendingDown';
import TrendingUpIcon      from '@mui/icons-material/TrendingUp';
import TrendingFlatIcon    from '@mui/icons-material/TrendingFlat';
import CheckCircleIcon     from '@mui/icons-material/CheckCircle';
import PsychologyIcon      from '@mui/icons-material/Psychology';
import AutoAwesomeIcon     from '@mui/icons-material/AutoAwesome';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';

// ── Styles ─────────────────────────────────────────────────────────────────────
const GLASS = {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
};

const SEVERITY_COLOR = {
    CRITICAL:   '#ef4444',
    WEAK:       '#f97316',
    DEVELOPING: '#eab308',
    STRONG:     '#22c55e',
};

const TREND_ICON = {
    declining:         <TrendingDownIcon sx={{ color: '#ef4444', fontSize: 16 }} />,
    forgetting:        <TrendingDownIcon sx={{ color: '#ef4444', fontSize: 16 }} />,
    volatile:          <TrendingFlatIcon sx={{ color: '#eab308', fontSize: 16 }} />,
    stable:            <TrendingFlatIcon sx={{ color: '#94a3b8', fontSize: 16 }} />,
    improving:         <TrendingUpIcon  sx={{ color: '#22c55e', fontSize: 16 }} />,
    accelerating:      <TrendingUpIcon  sx={{ color: '#22c55e', fontSize: 16 }} />,
    insufficient_data: <TrendingFlatIcon sx={{ color: '#64748b', fontSize: 16 }} />,
};

const pct = (v) => `${((v || 0) * 100).toFixed(1)}%`;

function MasteryBar({ value, severity }) {
    const color = SEVERITY_COLOR[severity] || '#94a3b8';
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
            <LinearProgress
                variant="determinate"
                value={(value || 0) * 100}
                sx={{
                    flex: 1, height: 6, borderRadius: 4,
                    bgcolor: 'rgba(255,255,255,0.08)',
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
                }}
            />
            <Typography variant="caption" sx={{ color, minWidth: 40, fontWeight: 600 }}>
                {pct(value)}
            </Typography>
        </Box>
    );
}

function SeverityChip({ severity }) {
    const color = SEVERITY_COLOR[severity] || '#94a3b8';
    return (
        <Chip
            size="small"
            label={severity || 'N/A'}
            sx={{
                bgcolor: `${color}20`,
                color,
                border: `1px solid ${color}40`,
                fontWeight: 700,
                fontSize: '0.7rem',
            }}
        />
    );
}

// ── Hierarchical weak area tree ────────────────────────────────────────────────
function WeakAreaTree({ weakAreas }) {
    if (!weakAreas?.length) {
        return (
            <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
                <CheckCircleIcon sx={{ fontSize: 32, color: '#22c55e', mb: 1 }} />
                <Typography variant="body2">No critical weak areas detected.</Typography>
            </Box>
        );
    }

    return (
        <Stack spacing={1.5}>
            {weakAreas.map((wa, idx) => (
                <Paper key={idx} sx={{ ...GLASS, p: 2, borderLeft: `3px solid ${SEVERITY_COLOR[wa.severity] || '#94a3b8'}` }}>
                    {/* Breadcrumb */}
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                        {wa.domain && (
                            <>
                                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>{wa.domain}</Typography>
                                <SubdirectoryArrowRightIcon sx={{ fontSize: 12, color: '#475569' }} />
                            </>
                        )}
                        {wa.chapter && (
                            <>
                                <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{wa.chapter}</Typography>
                                {wa.subtopic && <SubdirectoryArrowRightIcon sx={{ fontSize: 12, color: '#475569' }} />}
                            </>
                        )}
                        {wa.subtopic && (
                            <>
                                <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>{wa.subtopic}</Typography>
                                {wa.concept && <SubdirectoryArrowRightIcon sx={{ fontSize: 12, color: '#475569' }} />}
                            </>
                        )}
                        {wa.concept && (
                            <Typography variant="caption" sx={{ color: '#a5b4fc', fontWeight: 700, fontStyle: 'italic' }}>
                                {wa.concept}
                            </Typography>
                        )}
                        {!wa.chapter && !wa.subtopic && !wa.concept && (
                            <Typography variant="caption" sx={{ color: '#e2e8f0', fontWeight: 600 }}>{wa.topicKey}</Typography>
                        )}
                    </Box>

                    {/* Metrics row */}
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={5}>
                            <Typography variant="caption" sx={{ color: '#64748b', mb: 0.5, display: 'block' }}>Mastery</Typography>
                            <MasteryBar value={wa.mastery} severity={wa.severity} />
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Accuracy</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#f1f5f9' }}>{pct(wa.accuracy)}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Trend</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {TREND_ICON[wa.trend] || TREND_ICON.insufficient_data}
                                <Typography variant="caption" sx={{ color: '#94a3b8', textTransform: 'capitalize' }}>
                                    {wa.trend?.replace(/_/g, ' ')}
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={6} sm={1.5}>
                            <SeverityChip severity={wa.severity} />
                        </Grid>
                        <Grid item xs={6} sm={1.5}>
                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Priority</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: wa.priorityScore > 0.7 ? '#ef4444' : wa.priorityScore > 0.45 ? '#f97316' : '#eab308' }}>
                                {(wa.priorityScore * 100).toFixed(0)}
                            </Typography>
                        </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {wa.questionCount} question{wa.questionCount !== 1 ? 's' : ''} · {wa.correctCount}/{wa.attemptedCount} correct
                            {wa.repeatedErrors > 0 && ` · ${wa.repeatedErrors} repeated error${wa.repeatedErrors !== 1 ? 's' : ''}`}
                        </Typography>
                        {wa.confidenceMismatch && (
                            <Chip size="small" label={wa.confidenceMismatch.replace(/_/g, ' ')}
                                sx={{ bgcolor: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', fontSize: '0.65rem' }} />
                        )}
                    </Box>
                </Paper>
            ))}
        </Stack>
    );
}

// ── Difficulty breakdown ──────────────────────────────────────────────────────
function DifficultyPanel({ data }) {
    if (!data?.length) return null;
    const colors = { easy: '#22c55e', medium: '#3b82f6', hard: '#f97316', challenge: '#ef4444' };
    return (
        <Grid container spacing={2}>
            {data.map(d => (
                <Grid item xs={6} sm={3} key={d.level}>
                    <Paper sx={{ ...GLASS, p: 2, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'capitalize', fontWeight: 600 }}>{d.level}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: colors[d.level] || '#94a3b8', my: 0.5 }}>
                            {pct(d.accuracy)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {d.correctCount}/{d.questionCount} correct
                        </Typography>
                    </Paper>
                </Grid>
            ))}
        </Grid>
    );
}

// ── Confidence mismatch panel ─────────────────────────────────────────────────
function ConfidenceMismatchPanel({ data }) {
    if (!data?.length) return (
        <Typography variant="body2" sx={{ color: '#64748b' }}>No confidence mismatches detected.</Typography>
    );
    return (
        <Stack spacing={1}>
            {data.map((cm, idx) => (
                <Paper key={idx} sx={{
                    ...GLASS, p: 2,
                    borderLeft: `3px solid ${cm.type === 'OVERCONFIDENCE_RISK' ? '#f97316' : '#3b82f6'}`,
                }}>
                    <Chip size="small"
                        label={cm.type === 'OVERCONFIDENCE_RISK' ? 'Overconfidence Risk' : 'Underconfidence'}
                        sx={{
                            bgcolor: cm.type === 'OVERCONFIDENCE_RISK' ? 'rgba(249,115,22,0.15)' : 'rgba(59,130,246,0.15)',
                            color: cm.type === 'OVERCONFIDENCE_RISK' ? '#f97316' : '#3b82f6',
                            fontWeight: 700, mb: 1, fontSize: '0.7rem',
                        }}
                    />
                    <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 0.5 }}>
                        {[cm.chapter, cm.subtopic, cm.concept].filter(Boolean).join(' → ')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                        Confidence: {pct(cm.confidence)} · Mastery: {pct(cm.mastery)}
                    </Typography>
                    {cm.explanation && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.5, fontStyle: 'italic' }}>
                            {cm.explanation}
                        </Typography>
                    )}
                </Paper>
            ))}
        </Stack>
    );
}

// ── AI Summary panel ──────────────────────────────────────────────────────────
function AISummaryPanel({ aiAnalysis, generationStatus }) {
    if (generationStatus === 'PROCESSING') {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" sx={{ color: '#64748b' }}>AI analysis is being generated…</Typography>
            </Box>
        );
    }
    if (!aiAnalysis?.summary && !aiAnalysis?.overall_performance?.summary) {
        return <Typography variant="body2" sx={{ color: '#64748b' }}>AI summary not available.</Typography>;
    }
    const summary = aiAnalysis.summary || aiAnalysis.overall_performance?.summary;
    const recs     = aiAnalysis.teacherRecommendations || aiAnalysis.recommended_teacher_actions || [];

    return (
        <Stack spacing={2}>
            <Paper sx={{ ...GLASS, p: 2, borderLeft: '3px solid #a855f7' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AutoAwesomeIcon sx={{ color: '#a855f7', fontSize: 18 }} />
                    <Typography variant="caption" sx={{ color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Summary</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#cbd5e1', lineHeight: 1.7 }}>{summary}</Typography>
            </Paper>
            {recs.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1, display: 'block' }}>
                        Teacher Recommendations
                    </Typography>
                    <Stack spacing={1}>
                        {recs.map((r, idx) => {
                            const action = r.action || r.action_text || '';
                            const priority = r.priority || r.priority_level || 'MEDIUM';
                            const color = priority === 'CRITICAL' ? '#ef4444' : priority === 'HIGH' ? '#f97316' : '#3b82f6';
                            return (
                                <Paper key={idx} sx={{ ...GLASS, p: 2, borderLeft: `3px solid ${color}` }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                        <Chip size="small" label={priority}
                                            sx={{ bgcolor: `${color}20`, color, fontWeight: 700, fontSize: '0.65rem' }} />
                                        {(r.topic || r.target_topic) && (
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>{r.topic || r.target_topic}</Typography>
                                        )}
                                    </Box>
                                    <Typography variant="body2" sx={{ color: '#e2e8f0', lineHeight: 1.6 }}>{action}</Typography>
                                    {r.reason && <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, fontStyle: 'italic' }}>{r.reason}</Typography>}
                                </Paper>
                            );
                        })}
                    </Stack>
                </Box>
            )}
        </Stack>
    );
}

// ── Deterministic interventions ───────────────────────────────────────────────
function DeterministicInterventions({ interventions }) {
    if (!interventions?.length) return null;
    return (
        <Stack spacing={1}>
            {interventions.map((iv, idx) => {
                const color = iv.priority === 'CRITICAL' ? '#ef4444' : iv.priority === 'HIGH' ? '#f97316' : '#3b82f6';
                return (
                    <Paper key={idx} sx={{ ...GLASS, p: 2, borderLeft: `3px solid ${color}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Chip size="small" label={iv.priority}
                                sx={{ bgcolor: `${color}20`, color, fontWeight: 700, fontSize: '0.65rem' }} />
                            {(iv.subtopic || iv.chapter) && (
                                <Typography variant="caption" sx={{ color: '#64748b' }}>{iv.subtopic || iv.chapter}</Typography>
                            )}
                        </Box>
                        <Typography variant="body2" sx={{ color: '#e2e8f0', lineHeight: 1.6 }}>{iv.action}</Typography>
                        {iv.reason && <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>{iv.reason}</Typography>}
                    </Paper>
                );
            })}
        </Stack>
    );
}

// ── Report Detail View ─────────────────────────────────────────────────────────
function ReportDetailView({ report, onBack }) {
    const op = report.overallPerformance || {};
    const snap = report.analyticsSnapshot || {};

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <IconButton onClick={onBack} sx={{ color: '#94a3b8', '&:hover': { color: '#f1f5f9', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                    <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f1f5f9' }}>
                        {report.assessmentTitle || 'Assessment Report'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {report.assessmentDate ? new Date(report.assessmentDate).toLocaleDateString() : ''}
                        {' · '}
                        <Chip size="small" label={report.generationStatus || 'N/A'}
                            sx={{
                                fontSize: '0.65rem', fontWeight: 700,
                                bgcolor: report.generationStatus === 'COMPLETED' ? 'rgba(34,197,94,0.15)'
                                    : report.generationStatus === 'PROCESSING' ? 'rgba(59,130,246,0.15)'
                                    : 'rgba(251,191,36,0.15)',
                                color: report.generationStatus === 'COMPLETED' ? '#22c55e'
                                    : report.generationStatus === 'PROCESSING' ? '#3b82f6'
                                    : '#fbbf24',
                            }}
                        />
                    </Typography>
                </Box>
            </Box>

            {/* Overview cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { label: 'Score', value: pct(op.score ?? snap.scorePercentage / 100), color: '#3b82f6' },
                    { label: 'Accuracy', value: pct(op.accuracy), color: '#3b82f6' },
                    { label: 'Mastery', value: pct(op.mastery ?? snap.overallMastery), color: '#a855f7' },
                    { label: 'Consistency', value: pct(op.consistency ?? snap.consistencyScore), color: '#22c55e' },
                    { label: 'Retention', value: pct(op.retention ?? snap.retentionEstimate), color: '#f97316' },
                    { label: 'Confidence', value: pct(op.confidence ?? snap.confidenceScore), color: '#eab308' },
                ].map(item => (
                    <Grid item xs={6} sm={4} md={2} key={item.label}>
                        <Paper sx={{ ...GLASS, p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>{item.label}</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: item.color, mt: 0.5 }}>{item.value}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Sections */}
            {[
                {
                    title: 'Critical Weak Areas',
                    icon: <WarningAmberIcon sx={{ color: '#ef4444', fontSize: 20 }} />,
                    content: <WeakAreaTree weakAreas={report.weakAreas} />,
                    defaultExpanded: true,
                },
                {
                    title: 'Difficulty Breakdown',
                    icon: <PsychologyIcon sx={{ color: '#3b82f6', fontSize: 20 }} />,
                    content: <DifficultyPanel data={report.difficultyAnalysis} />,
                },
                {
                    title: 'Confidence Mismatch',
                    icon: <PsychologyIcon sx={{ color: '#eab308', fontSize: 20 }} />,
                    content: <ConfidenceMismatchPanel data={report.confidenceMismatch} />,
                },
                {
                    title: 'Deterministic Interventions',
                    icon: <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} />,
                    content: <DeterministicInterventions interventions={report.recommendedInterventions} />,
                },
                {
                    title: 'AI Summary & Recommendations',
                    icon: <AutoAwesomeIcon sx={{ color: '#a855f7', fontSize: 20 }} />,
                    content: <AISummaryPanel aiAnalysis={report.aiAnalysis} generationStatus={report.generationStatus} />,
                    defaultExpanded: true,
                },
                {
                    title: 'Chapter Breakdown',
                    icon: <WarningAmberIcon sx={{ color: '#f97316', fontSize: 20 }} />,
                    content: (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        {['Chapter', 'Questions', 'Accuracy', 'Avg Mastery'].map(h => (
                                            <TableCell key={h} sx={{ color: '#64748b', borderColor: 'rgba(255,255,255,0.06)', fontSize: '0.75rem' }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(report.chapterAnalysis || []).map((ch, idx) => (
                                        <TableRow key={idx} sx={{ '& td': { borderColor: 'rgba(255,255,255,0.04)' } }}>
                                            <TableCell sx={{ color: '#e2e8f0', fontWeight: 600 }}>{ch.chapter}</TableCell>
                                            <TableCell sx={{ color: '#94a3b8' }}>{ch.questionCount}</TableCell>
                                            <TableCell sx={{ color: ch.accuracy < 0.5 ? '#ef4444' : '#22c55e' }}>{pct(ch.accuracy)}</TableCell>
                                            <TableCell>
                                                {ch.avgMastery != null && <MasteryBar value={ch.avgMastery} severity={classifySeverityInline(ch.avgMastery)} />}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ),
                },
                {
                    title: 'Learning Trend Analysis',
                    icon: <TrendingDownIcon sx={{ color: '#94a3b8', fontSize: 20 }} />,
                    content: (
                        <Stack spacing={1}>
                            {(report.trendAnalysis || []).map((t, idx) => (
                                <Paper key={idx} sx={{ ...GLASS, p: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Box>
                                            <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                                                {t.subtopic || t.chapter || t.topic}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                                                {t.dataPointCount} data points · EMA: {t.emaScore ? (t.emaScore * 100).toFixed(1) + '%' : 'N/A'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {TREND_ICON[t.trendType] || TREND_ICON.insufficient_data}
                                            <Typography variant="body2" sx={{ color: '#94a3b8', textTransform: 'capitalize' }}>
                                                {t.trendType?.replace(/_/g, ' ')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Paper>
                            ))}
                        </Stack>
                    ),
                },
                {
                    title: 'Retention Risks',
                    icon: <WarningAmberIcon sx={{ color: '#ef4444', fontSize: 20 }} />,
                    content: (
                        <Stack spacing={1}>
                            {(report.retentionRisks || []).length === 0
                                ? <Typography variant="body2" sx={{ color: '#64748b' }}>No significant retention risks detected.</Typography>
                                : (report.retentionRisks || []).map((rr, idx) => (
                                    <Paper key={idx} sx={{ ...GLASS, p: 2, borderLeft: `3px solid ${rr.risk === 'HIGH' ? '#ef4444' : '#f97316'}` }}>
                                        <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                                            {rr.subtopic || rr.chapter || rr.topic}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                            Forgetting Factor: {pct(rr.forgettingFactor)} · Retention: {pct(rr.retention)} · Risk: {rr.risk}
                                        </Typography>
                                        {rr.reason && <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontStyle: 'italic', mt: 0.5 }}>{rr.reason}</Typography>}
                                    </Paper>
                                ))
                            }
                        </Stack>
                    ),
                },
            ].map(({ title, icon, content, defaultExpanded }) => (
                <Accordion key={title} defaultExpanded={!!defaultExpanded}
                    sx={{ ...GLASS, mb: 1.5, '&:before': { display: 'none' }, '&.Mui-expanded': { my: 1.5 } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#64748b' }} />} sx={{ py: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {icon}
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#e2e8f0' }}>{title}</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>{content}</AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
}

function classifySeverityInline(mastery) {
    if (mastery < 0.40) return 'CRITICAL';
    if (mastery < 0.60) return 'WEAK';
    if (mastery < 0.75) return 'DEVELOPING';
    return 'STRONG';
}

// ── Main: Report List + Detail ────────────────────────────────────────────────
const StudentReportsDashboard = () => {
    const { studentId: paramStudentId, reportId: paramReportId } = useParams();
    const navigate = useNavigate();
    const currentUser = useSelector(s => s.user?.currentUser || s.user);

    const [reports, setReports]         = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState(null);
    const [viewMode, setViewMode]       = useState(paramStudentId && paramReportId ? 'detail' : 'list');

    const baseURL = process.env.REACT_APP_BASE_URL || '';
    const token   = currentUser?.token || localStorage.getItem('token');

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Fetch latest report for a specific student
    const loadStudentReport = useCallback(async (sid, rid) => {
        setLoading(true);
        setError(null);
        try {
            let url = rid
                ? `${baseURL}/api/adaptive/teacher-reports/report/${rid}`
                : `${baseURL}/api/adaptive/teacher-reports/student/${sid}/latest`;
            const res = await axios.get(url, { headers });
            setSelectedReport(res.data.data);
            setViewMode('detail');
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    }, [baseURL, token]);

    // Fetch recent reports list for the current teacher
    const loadRecentReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // We don't have a "list all reports" endpoint, so we use latest per student
            // This is a simplified implementation — in production this would be paginated
            setReports([]);
        } catch (err) {
            setError('Failed to load reports');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (paramStudentId && paramReportId) {
            loadStudentReport(paramStudentId, paramReportId);
        } else if (paramStudentId) {
            loadStudentReport(paramStudentId, null);
        } else {
            loadRecentReports();
        }
    }, [paramStudentId, paramReportId]);

    const handleBack = () => {
        setSelectedReport(null);
        setViewMode('list');
        navigate('/Teacher/student-reports');
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, minHeight: '100vh', background: '#0f172a' }}>
            {/* Page header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#f1f5f9', mb: 0.5 }}>
                        Student Reports
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Post-assessment analytics and teacher recommendations
                    </Typography>
                </Box>
                {viewMode === 'list' && (
                    <Tooltip title="Refresh">
                        <IconButton onClick={loadRecentReports} sx={{ color: '#64748b', '&:hover': { color: '#f1f5f9' } }}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {error}
                </Alert>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress sx={{ color: '#6366f1' }} />
                </Box>
            )}

            {!loading && viewMode === 'detail' && selectedReport && (
                <ReportDetailView report={selectedReport} onBack={handleBack} />
            )}

            {!loading && viewMode === 'list' && (
                <Box>
                    <Paper sx={{ ...GLASS, p: 3 }}>
                        <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', py: 4 }}>
                            Reports are generated automatically after each assessment.<br />
                            Navigate to a student's assessment history to view their report, or access reports via the notification bell when a new report is ready.
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            <Button
                                variant="outlined"
                                onClick={() => navigate('/Teacher/tests')}
                                sx={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8', '&:hover': { borderColor: '#6366f1', color: '#a5b4fc' } }}
                            >
                                View Tests & Assessments
                            </Button>
                        </Box>
                    </Paper>
                </Box>
            )}
        </Box>
    );
};

export default StudentReportsDashboard;
