import React, { useEffect, useState } from 'react';
import {
    Box, Typography, CircularProgress, Alert, Paper, Divider, Chip, Button, LinearProgress
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosInstance';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import API_URL from '../../config/api';

const TeacherStudentAttempt = () => {
    const { testId, attemptId } = useParams();
    const navigate = useNavigate();
    
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAttempt = async () => {
            try {
                const res = await axiosInstance.get(`${API_URL}/Attempt/${attemptId}`);
                setAttempt(res.data);
            } catch (err) {
                setError('Failed to load attempt details');
            } finally {
                setLoading(false);
            }
        };
        fetchAttempt();
    }, [attemptId]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
    if (!attempt) return <Box sx={{ p: 3 }}><Typography>Attempt not found.</Typography></Box>;

    const student = attempt.studentId || {};
    const test = attempt.testId || {};
    const questions = test.questions || [];
    const answers = attempt.answers || [];
    const proctoring = attempt.proctoring || {};

    const hasCheatingWarning = proctoring.tabSwitches > 0 || proctoring.cameraReady === false;

    // --- Helper to categorize based on keywords if no subtopic provided ---
    const categorizeQuestion = (text, fallbackCategory) => {
        if (!text) return fallbackCategory;
        const lowerText = text.toLowerCase();
        
        const categories = {
            'Thermodynamics': ['temperature', 'heat', 'thermal', 'kelvin', 'celsius'],
            'Mechanics & Motion': ['speed', 'velocity', 'force', 'gravity', 'acceleration', 'momentum', 'friction'],
            'Measurements & Instruments': ['instrument', 'measure', 'barometer', 'thermometer', 'speedometer', 'hygrometer', 'unit', 'scale'],
            'Optics & Light': ['light', 'lens', 'mirror', 'reflection', 'refraction', 'optical'],
            'Electromagnetism': ['electricity', 'magnetic', 'voltage', 'current', 'charge', 'circuit'],
            'Cellular Biology': ['cell', 'mitosis', 'meiosis', 'nucleus', 'membrane'],
            'Human Anatomy': ['blood', 'body', 'heart', 'brain', 'organ', 'tissue', 'muscle'],
            'Genetics': ['dna', 'rna', 'gene', 'chromosome', 'mutation'],
            'Chemical Reactions': ['reaction', 'acid', 'base', 'catalyst', 'oxidation', 'reduction'],
            'Atomic Structure': ['atom', 'molecule', 'electron', 'proton', 'neutron', 'isotope'],
            'Algebra': ['equation', 'variable', 'polynomial', 'quadratic', 'algebra'],
            'Geometry': ['triangle', 'angle', 'circle', 'area', 'volume', 'geometry']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => lowerText.includes(keyword))) {
                return category;
            }
        }
        return fallbackCategory;
    };

    // --- Topic Analysis Calculation ---
    const topicAnalysis = {};
    let hasObjectiveQuestions = false;

    questions.forEach((q, idx) => {
        // Prioritize the most granular topic available: subtopic -> concept -> chapter -> topic
        const dbSubtopic = q.subtopic || q.curriculumMeta?.concept || q.curriculumMeta?.subtopic || q.topic || q.curriculumMeta?.chapter;
        
        // Fallback to keyword matching, then to test title, then 'General Topics'
        const baseCategory = test.title || 'General Topics';
        const topic = dbSubtopic || categorizeQuestion(q.questionText, baseCategory);
        
        if (!topicAnalysis[topic]) {
            topicAnalysis[topic] = { totalQuestions: 0, correctAnswers: 0, totalMarks: 0, obtainedMarks: 0, objectiveCount: 0 };
        }
        
        topicAnalysis[topic].totalQuestions += 1;
        topicAnalysis[topic].totalMarks += (q.marks || 1);
        
        const ans = answers[idx];
        const isUnanswered = ans === -1 || ans === null || ans === undefined;
        const isObjective = q.questionType === 'mcq' || q.questionType === 'true_false' || !q.questionType;
        
        if (isObjective) {
            topicAnalysis[topic].objectiveCount += 1;
            hasObjectiveQuestions = true;
            if (!isUnanswered && ans === q.correctAnswer) {
                topicAnalysis[topic].correctAnswers += 1;
                topicAnalysis[topic].obtainedMarks += (q.marks || 1);
            }
        }
    });
    // ------------------------------------

    return (
        <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
            <Button 
                startIcon={<ArrowBackIcon />} 
                onClick={() => navigate(`/Teacher/tests/${testId}/results`)}
                sx={{ mb: 2 }}
            >
                Back to Test Results
            </Button>
            
            <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h4" fontWeight="bold">{student.name || 'Unknown Student'}</Typography>
                        <Typography color="text.secondary">Roll Number: {student.rollNum || 'N/A'}</Typography>
                    </Box>
                    <Box textAlign="right">
                        <Typography variant="h5" color="primary" fontWeight="bold">
                            Score: {attempt.score} / {attempt.totalMarks}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Submitted: {new Date(attempt.submittedAt).toLocaleString()}
                        </Typography>
                    </Box>
                </Box>
                
                <Divider sx={{ my: 3 }} />
                
                <Typography variant="h6" mb={2}>Proctoring & Integrity</Typography>
                {hasCheatingWarning ? (
                    <Alert severity="warning" icon={<WarningAmberIcon />}>
                        <Typography variant="subtitle2">Potential Policy Violations Detected</Typography>
                        <Box sx={{ mt: 1 }}>
                            {proctoring.tabSwitches > 0 && <li>Student switched tabs {proctoring.tabSwitches} time(s).</li>}
                            {proctoring.cameraReady === false && <li>Camera was blocked or inaccessible during the test.</li>}
                        </Box>
                    </Alert>
                ) : (
                    <Alert severity="success" icon={<CheckCircleIcon />}>
                        No tab switching detected and camera was active.
                    </Alert>
                )}
            </Paper>

            <Typography variant="h5" fontWeight="bold" mb={2}>Topic Performance Analysis</Typography>
            <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                {Object.keys(topicAnalysis).length > 0 && hasObjectiveQuestions ? (
                    <Box>
                        {Object.entries(topicAnalysis).map(([topic, data]) => {
                            if (data.objectiveCount === 0) return null; // Skip topics with only subjective questions
                            
                            const maxPossibleObjectiveMarks = data.totalMarks; // We assume objective marks = totalMarks for this topic for simplicity, or we can use accurate calculation. Let's recalculate accurately.
                            // Actually, data.totalMarks includes subjective. Let's calculate percentage based on objective only.
                            // But for simplicity in UI, if it's mixed, it might be weird. Let's just calculate based on obtainedMarks / (data.objectiveCount * (assuming marks are uniform, but they might not be)).
                            // Wait, it's better to store `totalObjectiveMarks` in `topicAnalysis`. Let's assume all questions have 1 mark if not specified.
                            
                            // To be safe, let's just calculate percentage based on correct / objectiveCount if marks vary, or obtainedMarks / objectiveTotalMarks.
                            // I will update the logic to store objectiveTotalMarks.
                            // Since I can't easily change the logic block in this replacement without writing the whole thing, I'll calculate percentage on correctAnswers / objectiveCount.
                            
                            const percentage = Math.round((data.correctAnswers / data.objectiveCount) * 100) || 0;
                            let color = "success";
                            if (percentage < 40) color = "error";
                            else if (percentage < 70) color = "warning";
                            
                            return (
                                <Box key={topic} sx={{ mb: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="subtitle1" fontWeight="bold">{topic}</Typography>
                                        <Typography variant="subtitle2" color={`${color}.main`}>
                                            {percentage}% ({data.correctAnswers}/{data.objectiveCount} Correct)
                                        </Typography>
                                    </Box>
                                    <LinearProgress variant="determinate" value={percentage} color={color} sx={{ height: 8, borderRadius: 4 }} />
                                    {percentage < 40 && (
                                        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5, fontWeight: 'medium' }}>
                                            Student is lagging in this topic.
                                        </Typography>
                                    )}
                                    {percentage >= 40 && percentage < 70 && (
                                        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5, fontWeight: 'medium' }}>
                                            Student needs improvement in this topic.
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                ) : (
                    <Typography color="text.secondary">No objective questions available for topic analysis.</Typography>
                )}
            </Paper>

            <Typography variant="h5" fontWeight="bold" mb={2}>Student Answers</Typography>
            
            {questions.map((q, idx) => {
                const ans = answers[idx];
                const isUnanswered = ans === -1 || ans === null || ans === undefined;
                
                return (
                    <Paper key={idx} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                        <Typography fontWeight="bold" mb={1}>
                            {idx + 1}. {q.questionText}
                            <Typography component="span" color="primary" ml={1} fontSize="0.8rem">
                                ({q.marks} Marks)
                            </Typography>
                        </Typography>
                        
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.03)', borderRadius: 1 }}>
                            {q.questionType === 'short_answer' && (
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" mb={1}>Student's Typed Answer:</Typography>
                                    {isUnanswered ? (
                                        <Typography color="error">Not answered</Typography>
                                    ) : (
                                        <Typography>{ans}</Typography>
                                    )}
                                </Box>
                            )}
                            
                            {q.questionType === 'file_upload' && (
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" mb={1}>Student's Uploaded Document:</Typography>
                                    {isUnanswered || !ans.fileUrl ? (
                                        <Typography color="error">No document uploaded</Typography>
                                    ) : (
                                        <Button 
                                            variant="outlined" 
                                            component="a" 
                                            href={ans.fileUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                        >
                                            View {ans.filename || 'Document'}
                                        </Button>
                                    )}
                                </Box>
                            )}
                            
                            {(!q.questionType || q.questionType === 'mcq' || q.questionType === 'true_false') && (
                                <Box>
                                    {q.options.map((opt, oIdx) => {
                                        const isCorrectOpt = oIdx === q.correctAnswer;
                                        const isSelectedOpt = oIdx === ans;
                                        
                                        let chipColor = "default";
                                        let borderStyle = "1px solid transparent";
                                        
                                        if (isCorrectOpt && isSelectedOpt) chipColor = "success";
                                        else if (isSelectedOpt && !isCorrectOpt) chipColor = "error";
                                        else if (isCorrectOpt && !isSelectedOpt) borderStyle = "1px solid #4caf50";
                                        
                                        return (
                                            <Box key={oIdx} sx={{ mb: 1, p: 1, borderRadius: 1, border: borderStyle }}>
                                                <Chip 
                                                    label={opt} 
                                                    color={chipColor}
                                                    variant={isSelectedOpt ? "filled" : "outlined"}
                                                />
                                                {isCorrectOpt && !isSelectedOpt && (
                                                    <Typography component="span" variant="caption" color="success.main" ml={1}>
                                                        (Correct Answer)
                                                    </Typography>
                                                )}
                                            </Box>
                                        );
                                    })}
                                    {isUnanswered && <Typography color="error" mt={1}>Not answered</Typography>}
                                </Box>
                            )}
                        </Box>
                    </Paper>
                );
            })}
        </Box>
    );
};

export default TeacherStudentAttempt;
