import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getSubjectList } from '../../redux/sclassRelated/sclassHandle';
import { getUserDetails } from '../../redux/userRelated/userHandle';
import axiosInstance from '../../utils/axiosInstance';
import {
    Box, Typography, Paper, Grid, Chip, CircularProgress,
    LinearProgress, Divider,
} from '@mui/material';
import MenuBookIcon    from '@mui/icons-material/MenuBook';
import AssignmentIcon  from '@mui/icons-material/Assignment';
import QuizIcon        from '@mui/icons-material/Quiz';
import GradeIcon       from '@mui/icons-material/Grade';

// ── colour for a percentage ───────────────────────────────────────────────────
const pctColor = (v) => v >= 75 ? 'success' : v >= 50 ? 'warning' : 'error';
const pctHex   = (v) => v >= 75 ? '#16a34a' : v >= 50 ? '#d97706' : '#dc2626';

// ── single subject card ───────────────────────────────────────────────────────
const SubjectCard = ({ subject, marks, assignmentCount, testCount, avgScore }) => {
    const hasMarks = marks !== null && marks !== undefined;

    return (
        <Paper variant="outlined" sx={{
            p: 3, borderRadius: 3,
            transition: 'box-shadow 0.2s',
            '&:hover': { boxShadow: 6 },
        }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                        width: 40, height: 40, borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <MenuBookIcon fontSize="small" />
                    </Box>
                    <Box>
                        <Typography fontWeight={700} fontSize="0.95rem">{subject.subName}</Typography>
                        <Typography variant="caption" color="text.secondary">{subject.subCode}</Typography>
                    </Box>
                </Box>
                {hasMarks && (
                    <Chip
                        label={`${marks} marks`}
                        color={pctColor(marks)}
                        size="small"
                        icon={<GradeIcon sx={{ fontSize: '0.8rem !important' }} />}
                        sx={{ fontWeight: 700 }}
                    />
                )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Stats row */}
            <Box sx={{ display: 'flex', gap: 2, mb: hasMarks ? 2 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <AssignmentIcon fontSize="small" color="action" />
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Assignments</Typography>
                        <Typography fontWeight={700} fontSize="1rem">{assignmentCount}</Typography>
                    </Box>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <QuizIcon fontSize="small" color="action" />
                    <Box>
                        <Typography variant="caption" color="text.secondary" display="block">Tests</Typography>
                        <Typography fontWeight={700} fontSize="1rem">{testCount}</Typography>
                    </Box>
                </Box>
                {avgScore !== null && (
                    <>
                        <Divider orientation="vertical" flexItem />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <GradeIcon fontSize="small" color="action" />
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">Avg Score</Typography>
                                <Typography fontWeight={700} fontSize="1rem" sx={{ color: pctHex(avgScore) }}>
                                    {avgScore}%
                                </Typography>
                            </Box>
                        </Box>
                    </>
                )}
            </Box>

            {/* Marks progress bar */}
            {hasMarks && (
                <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Exam Marks</Typography>
                        <Typography variant="caption" fontWeight={700} sx={{ color: pctHex(marks) }}>{marks}%</Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={Math.min(marks, 100)}
                        color={pctColor(marks)}
                        sx={{ height: 6, borderRadius: 3 }}
                    />
                </Box>
            )}
        </Paper>
    );
};

// ── page ──────────────────────────────────────────────────────────────────────
const StudentSubjects = () => {
    const dispatch = useDispatch();
    const { subjectsList } = useSelector((state) => state.sclass);
    const { userDetails, currentUser, loading } = useSelector((state) => state.user);

    const [assignments, setAssignments] = useState([]);
    const [tests,       setTests]       = useState([]);
    const [attempts,    setAttempts]    = useState([]);
    const [dataLoading, setDataLoading] = useState(true);

    const classId   = currentUser?.sclassName?._id || currentUser?.sclassName;
    const studentId = currentUser?._id;

    // Load subjects + user details
    useEffect(() => {
        dispatch(getUserDetails(studentId, 'Student'));
        if (classId) dispatch(getSubjectList(classId, 'ClassSubjects'));
    }, [dispatch, studentId, classId]);

    // Load assignments, tests, attempts in parallel
    useEffect(() => {
        if (!classId || !studentId) return;
        Promise.all([
            axiosInstance.get(`/AssignmentsByClass/${classId}`).catch(() => ({ data: [] })),
            axiosInstance.get(`/TestsForStudent/${studentId}`).catch(() => ({ data: [] })),
            axiosInstance.get(`/AttemptsByStudent/${studentId}`).catch(() => ({ data: [] })),
        ]).then(([asgRes, testRes, attRes]) => {
            setAssignments(Array.isArray(asgRes.data) ? asgRes.data : (asgRes.data?.assignments || []));
            setTests(Array.isArray(testRes.data) ? testRes.data : []);
            setAttempts(Array.isArray(attRes.data) ? attRes.data : []);
        }).finally(() => setDataLoading(false));
    }, [classId, studentId]);

    const subjectMarks = userDetails?.examResult || [];

    // Build per-subject stats
    const getSubjectStats = (subject) => {
        const subId   = subject._id;
        const subName = subject.subName;

        // Marks from exam result
        const markEntry = subjectMarks.find(r =>
            (r.subName?._id || r.subName) === subId ||
            r.subName?.subName === subName
        );
        const marks = markEntry?.marksObtained ?? null;

        // Assignments for this subject
        const subAssignments = assignments.filter(a =>
            (a.subject?._id || a.subject) === subId ||
            a.subject?.subName === subName
        );

        // Tests for this subject
        const subTests = tests.filter(t =>
            (t.subject?._id || t.subject) === subId ||
            t.subject?.subName === subName
        );

        // Average score from attempts on this subject's tests
        const subTestIds = new Set(subTests.map(t => t._id));
        const subAttempts = attempts.filter(a => {
            const tid = a.testId?._id || a.testId;
            return subTestIds.has(tid);
        });
        const avgScore = subAttempts.length > 0
            ? Math.round(subAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / subAttempts.length)
            : null;

        return {
            marks,
            assignmentCount: subAssignments.length,
            testCount:       subTests.length,
            avgScore,
        };
    };

    if (loading || dataLoading) return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress />
        </Box>
    );

    const subjects = subjectsList || [];

    return (
        <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 3 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <MenuBookIcon />
                    <Box>
                        <Typography variant="h5" fontWeight={700}>My Subjects</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {subjects.length} subject{subjects.length !== 1 ? 's' : ''} enrolled
                        </Typography>
                    </Box>
                </Box>
                {/* Summary chips */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip icon={<AssignmentIcon />} label={`${assignments.length} Assignments`} variant="outlined" size="small" />
                    <Chip icon={<QuizIcon />}       label={`${tests.length} Tests`}             variant="outlined" size="small" />
                </Box>
            </Box>

            {subjects.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                    <MenuBookIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                    <Typography color="text.secondary">No subjects enrolled yet.</Typography>
                </Paper>
            ) : (
                <Grid container spacing={2.5}>
                    {subjects.map((subject) => {
                        const stats = getSubjectStats(subject);
                        return (
                            <Grid item xs={12} sm={6} md={4} key={subject._id}>
                                <SubjectCard subject={subject} {...stats} />
                            </Grid>
                        );
                    })}
                </Grid>
            )}
        </Box>
    );
};

export default StudentSubjects;
