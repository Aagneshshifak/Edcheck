import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Box, Typography, Radio, RadioGroup, FormControlLabel,
    Button, CircularProgress, Alert, LinearProgress
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { theme } from '../../theme/studentTheme';

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
    const [questions, setQuestions] = useState([]); // shuffled order
    const [permutation, setPermutation] = useState([]); // permutation[shuffledIdx] = originalIdx
    const [answers, setAnswers] = useState([]); // answers[shuffledIdx] = selected option index or -1
    const [timeLeft, setTimeLeft] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [showFsWarning, setShowFsWarning] = useState(false);
    const [startedAt] = useState(new Date().toISOString());

    const intervalRef = useRef(null);
    const containerRef = useRef(null);
    const submittedRef = useRef(false);

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
            await axios.post(`${BASE}/SubmitAttempt`, {
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
        axios.get(`${BASE}/TestsForStudent/${currentUser._id}`)
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

            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, background: theme.card, border: theme.cardBorder, borderRadius: 2, p: 2 }}>
                <Box>
                    <Typography sx={{ color: theme.text, fontWeight: 700, fontSize: '1.1rem' }}>{test?.title}</Typography>
                    <Typography sx={{ color: theme.textMuted, fontSize: '0.78rem' }}>{questions.length} questions</Typography>
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
