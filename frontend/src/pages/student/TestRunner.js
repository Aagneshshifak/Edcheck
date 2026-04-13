import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Box, Typography, Radio, RadioGroup, FormControlLabel,
    Button, CircularProgress, Alert, LinearProgress, Chip,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axiosInstance from '../../utils/axiosInstance';
import { theme } from '../../theme/studentTheme';
import VideocamIcon      from '@mui/icons-material/Videocam';
import VideocamOffIcon   from '@mui/icons-material/VideocamOff';
import WarningAmberIcon  from '@mui/icons-material/WarningAmber';

// Fisher-Yates shuffle — returns a permutation array [0..n-1] shuffled
function buildPermutation(n) {
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    return perm;
}

const TestRunner = () => {
    const { testId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useSelector(s => s.user);
    const BASE = process.env.REACT_APP_BASE_URL;

    const [test, setTest] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [permutation, setPermutation] = useState([]);
    const [answers, setAnswers] = useState([]);
    const [timeLeft, setTimeLeft] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [showFsWarning, setShowFsWarning] = useState(false);
    const [startedAt] = useState(new Date().toISOString());

    const intervalRef    = useRef(null);
    const containerRef   = useRef(null);
    const submittedRef   = useRef(false);

    // ── Proctoring state ──────────────────────────────────────────────────────
    const videoRef          = useRef(null);
    const streamRef         = useRef(null);
    const [camReady,    setCamReady]    = useState(false);   // camera granted + streaming
    const [camBlocked,  setCamBlocked]  = useState(false);   // user denied camera
    const [tabWarnings, setTabWarnings] = useState(0);       // tab-switch count
    const [tabAlert,    setTabAlert]    = useState(false);   // show warning banner
    const MAX_TAB_WARNINGS = 3;

    // handleSubmit defined with useCallback so it can be referenced in timer effect
    const handleSubmit = useCallback(async (type) => {
        if (submittedRef.current) return;
        submittedRef.current = true;
        clearInterval(intervalRef.current);

        // Re-map answers from shuffled order back to original question order
        const remapped = new Array(permutation.length).fill(-1);
        permutation.forEach((originalIdx, shuffledIdx) => {
            remapped[originalIdx] = answers[shuffledIdx] !== undefined ? answers[shuffledIdx] : -1;
        });

        setSubmitting(true);
        try {
            await axiosInstance.post(`/SubmitAttempt`, {
                studentId: currentUser._id,
                testId,
                answers: remapped,
                submissionType: type,
                startedAt,
            });
            navigate(`/Student/test/${testId}/result`);
        } catch (err) {
            setError(err.response?.data?.message || 'Submission failed. Please try again.');
            submittedRef.current = false;
            setSubmitting(false);
        }
    }, [answers, permutation, BASE, currentUser._id, testId, startedAt, navigate]);

    // Fetch test on mount
    useEffect(() => {
        axiosInstance.get(`/TestsForStudent/${currentUser._id}`)
            .then(res => {
                const found = (res.data || []).find(t => t._id === testId);
                if (!found) { setError('Test not found or not available.'); setLoading(false); return; }
                setTest(found);
                const qs = found.questions || [];
                if (found.shuffleQuestions && qs.length > 0) {
                    const perm = buildPermutation(qs.length);
                    setPermutation(perm);
                    setQuestions(perm.map(i => qs[i]));
                } else {
                    const identity = qs.map((_, i) => i);
                    setPermutation(identity);
                    setQuestions(qs);
                }
                setAnswers(new Array(qs.length).fill(-1));
                setTimeLeft((found.durationMinutes || 1) * 60);
                setLoading(false);
            })
            .catch(() => { setError('Failed to load test.'); setLoading(false); });
    }, [BASE, currentUser._id, testId]);

    // Fullscreen on mount + fullscreenchange listener
    useEffect(() => {
        document.documentElement.requestFullscreen().catch(() => {});
        const onFsChange = () => {
            if (!document.fullscreenElement) {
                setShowFsWarning(true);
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                setShowFsWarning(false);
            }
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // beforeunload warning
    useEffect(() => {
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

    // ── Webcam: request on mount, stop on unmount ─────────────────────────────
    useEffect(() => {
        let active = true;
        navigator.mediaDevices?.getUserMedia({ video: true, audio: false })
            .then(stream => {
                if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => {});
                }
                setCamReady(true);
            })
            .catch(() => {
                if (active) setCamBlocked(true);
            });
        return () => {
            active = false;
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // ── Tab-switch detection via Page Visibility API ───────────────────────────
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.hidden && !submittedRef.current) {
                setTabWarnings(prev => {
                    const next = prev + 1;
                    setTabAlert(true);
                    if (next >= MAX_TAB_WARNINGS) {
                        handleSubmit('auto');
                    }
                    return next;
                });
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, [handleSubmit]);

    // Disable copy/cut/paste/contextmenu on container
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const prevent = (e) => e.preventDefault();
        ['copy', 'cut', 'paste', 'contextmenu'].forEach(ev => el.addEventListener(ev, prevent));
        return () => ['copy', 'cut', 'paste', 'contextmenu'].forEach(ev => el.removeEventListener(ev, prevent));
    }, [loading]);

    // Timer countdown
    useEffect(() => {
        if (loading || timeLeft <= 0) return;
        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    handleSubmit('auto');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(intervalRef.current);
    }, [loading, handleSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const totalSecs = test ? (test.durationMinutes || 1) * 60 : 1;
    const progress = ((totalSecs - timeLeft) / totalSecs) * 100;

    if (loading) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: theme.accent }} />
        </Box>
    );

    // ── Camera blocked gate ───────────────────────────────────────────────────
    if (camBlocked) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
            <VideocamOffIcon sx={{ color: '#ff5252', fontSize: '3.5rem' }} />
            <Typography sx={{ color: '#ff5252', fontWeight: 700, fontSize: '1.2rem' }}>Camera Access Required</Typography>
            <Typography sx={{ color: theme.textMuted, textAlign: 'center', maxWidth: 400, fontSize: '0.9rem' }}>
                This test requires webcam access for proctoring. Please allow camera access in your browser and reload the page.
            </Typography>
            <Button onClick={() => window.location.reload()}
                sx={{ background: 'linear-gradient(135deg,#0050c8,#1e90ff)', color: '#fff', borderRadius: 2, px: 4, textTransform: 'none', fontWeight: 600 }}>
                Reload &amp; Allow Camera
            </Button>
        </Box>
    );

    if (error && !test) return (
        <Box sx={{ minHeight: '100vh', background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Alert severity="error">{error}</Alert>
        </Box>
    );

    return (
        <Box ref={containerRef} sx={{ minHeight: '100vh', background: theme.bg, p: 3, userSelect: 'none' }}>
            {/* Fullscreen warning overlay */}
            {showFsWarning && (
                <Box sx={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(5,13,24,0.97)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3
                }}>
                    <Typography sx={{ color: '#ff5252', fontSize: '1.4rem', fontWeight: 700 }}>
                        ⚠ Fullscreen Required
                    </Typography>
                    <Typography sx={{ color: theme.textMuted, textAlign: 'center', maxWidth: 400 }}>
                        You exited fullscreen mode. Please return to fullscreen to continue your test.
                    </Typography>
                    <Button
                        onClick={() => { document.documentElement.requestFullscreen().catch(() => {}); }}
                        sx={{ background: 'linear-gradient(135deg,#0050c8,#1e90ff)', color: '#fff', borderRadius: 2, px: 4, textTransform: 'none', fontWeight: 600 }}
                    >
                        Return to Fullscreen
                    </Button>
                </Box>
            )}

            {/* ── Webcam PiP — fixed bottom-right ── */}
            <Box sx={{
                position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
                width: 160, borderRadius: 2, overflow: 'hidden',
                border: `2px solid ${camReady ? 'rgba(0,230,118,0.6)' : 'rgba(255,82,82,0.5)'}`,
                boxShadow: `0 4px 20px ${camReady ? 'rgba(0,230,118,0.2)' : 'rgba(255,82,82,0.2)'}`,
                bgcolor: '#ffffff',
            }}>
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, bgcolor: 'rgba(0,0,0,0.6)' }}>
                    {camReady
                        ? <VideocamIcon sx={{ color: '#00e676', fontSize: '0.9rem' }} />
                        : <VideocamOffIcon sx={{ color: '#ff5252', fontSize: '0.9rem' }} />}
                    <Typography sx={{ color: camReady ? '#00e676' : '#ff5252', fontSize: '0.65rem', fontWeight: 700 }}>
                        {camReady ? 'Proctored' : 'No Camera'}
                    </Typography>
                </Box>
            </Box>

            {/* ── Tab-switch warning banner ── */}
            {tabAlert && (
                <Alert
                    severity="warning"
                    icon={<WarningAmberIcon />}
                    onClose={() => setTabAlert(false)}
                    sx={{ mb: 2, bgcolor: 'rgba(255,171,64,0.12)', border: '1px solid rgba(255,171,64,0.4)', color: '#ffab40' }}
                >
                    Tab switching detected — Warning {tabWarnings}/{MAX_TAB_WARNINGS}.
                    {tabWarnings >= MAX_TAB_WARNINGS - 1 && ' Next violation will auto-submit your test.'}
                </Alert>
            )}

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, background: theme.card, border: theme.cardBorder, borderRadius: 2, p: 2 }}>
                <Box>
                    <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '1.1rem' }}>{test?.title}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Typography sx={{ color: theme.textMuted, fontSize: '0.78rem' }}>{questions.length} questions</Typography>
                        <Chip
                            size="small"
                            icon={camReady ? <VideocamIcon sx={{ fontSize: '0.75rem !important' }} /> : <VideocamOffIcon sx={{ fontSize: '0.75rem !important' }} />}
                            label={camReady ? 'Proctored' : 'No Camera'}
                            sx={{
                                height: 20, fontSize: '0.65rem',
                                bgcolor: camReady ? 'rgba(0,230,118,0.12)' : 'rgba(255,82,82,0.12)',
                                color:   camReady ? '#00e676' : '#ff5252',
                                border:  `1px solid ${camReady ? 'rgba(0,230,118,0.3)' : 'rgba(255,82,82,0.3)'}`,
                            }}
                        />
                        {tabWarnings > 0 && (
                            <Chip size="small" label={`${tabWarnings} tab switch${tabWarnings > 1 ? 'es' : ''}`}
                                sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,171,64,0.12)', color: '#ffab40', border: '1px solid rgba(255,171,64,0.3)' }} />
                        )}
                    </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ color: timeLeft < 60 ? '#ff5252' : theme.accent, fontWeight: 700, fontSize: '1.5rem', fontFamily: 'monospace' }}>
                        {formatTime(timeLeft)}
                    </Typography>
                    <Typography sx={{ color: theme.textMuted, fontSize: '0.7rem' }}>remaining</Typography>
                </Box>
            </Box>

            {/* Timer progress bar */}
            <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ mb: 3, height: 4, borderRadius: 2, bgcolor: 'rgba(30,144,255,0.15)', '& .MuiLinearProgress-bar': { bgcolor: timeLeft < 60 ? '#ff5252' : theme.accent } }}
            />

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {/* Questions */}
            {questions.map((q, idx) => (
                <Box key={idx} sx={{ background: theme.card, border: theme.cardBorder, borderRadius: 2, p: 2.5, mb: 2 }}>
                    <Typography sx={{ color: theme.text, fontWeight: 600, mb: 1.5, userSelect: 'none' }}>
                        {idx + 1}. {q.questionText}
                        <Typography component="span" sx={{ color: theme.accent, fontSize: '0.75rem', ml: 1 }}>({q.marks} mark{q.marks !== 1 ? 's' : ''})</Typography>
                    </Typography>
                    <RadioGroup
                        value={answers[idx] !== undefined && answers[idx] !== -1 ? String(answers[idx]) : ''}
                        onChange={(e) => {
                            const updated = [...answers];
                            updated[idx] = Number(e.target.value);
                            setAnswers(updated);
                        }}
                    >
                        {(q.options || []).map((opt, oIdx) => (
                            <FormControlLabel
                                key={oIdx}
                                value={String(oIdx)}
                                control={<Radio sx={{ color: theme.textMuted, '&.Mui-checked': { color: theme.accent } }} />}
                                label={<Typography sx={{ color: theme.text, fontSize: '0.9rem', userSelect: 'none' }}>{opt}</Typography>}
                                sx={{ mb: 0.5 }}
                            />
                        ))}
                    </RadioGroup>
                </Box>
            ))}

            {/* Submit button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                    onClick={() => handleSubmit('manual')}
                    disabled={submitting}
                    sx={{ background: 'linear-gradient(135deg,#0050c8,#1e90ff)', color: '#fff', borderRadius: 2, px: 5, py: 1.2, textTransform: 'none', fontWeight: 600, fontSize: '0.95rem' }}
                >
                    {submitting ? 'Submitting...' : 'Submit Test'}
                </Button>
            </Box>
        </Box>
    );
};

export default TestRunner;
