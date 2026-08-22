const Test                              = require("../models/testSchema");
const TestAttempt                       = require("../models/testAttemptSchema");
const Notification                      = require("../models/notificationSchema");
const { invalidateByTestId }            = require('../services/ai-cache-service');
const { evaluateAllSentenceAnswers }    = require('../services/sentenceAnswerEvaluator');
const { logger }                        = require('../utils/serverLogger');

// ── Score Calculator ──────────────────────────────────────────────────────────

/**
 * Deterministic score calculator.
 * Handles MCQ, true_false, numerical.
 * Skips short_answer, file_upload, and sentence_answer (needs AI/teacher eval).
 *
 * @param {Array} questions
 * @param {Array} answers
 * @returns {number} total auto-graded score
 */
const calculateScore = (questions, answers) => {
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
        const qt = questions[i].questionType;
        // Skip all subjective types
        if (['short_answer', 'file_upload', 'sentence_answer'].includes(qt)) continue;
        // Auto-grade objective types
        if (answers[i] === questions[i].correctAnswer) {
            score += questions[i].marks;
        }
    }
    return score;
};

// ── Attempt Controllers ───────────────────────────────────────────────────────

// Submit a test attempt (student)
const submitAttempt = async (req, res) => {
    try {
        const { studentId, testId, answers, submissions, submissionType, startedAt, proctoring } = req.body;

        // Check for duplicate attempt
        const existing = await TestAttempt.findOne({ studentId, testId });
        if (existing) {
            return res.status(409).json({ message: "Attempt already submitted for this test." });
        }

        // Fetch test to get questions and compute totalMarks
        const test = await Test.findById(testId).populate('subject');
        if (!test) {
            return res.status(404).json({ message: "Test not found." });
        }

        const totalMarks = test.questions.reduce((sum, q) => sum + q.marks, 0);

        // Use submissions array if provided (preferred), fall back to answers
        const submissionArray = Array.isArray(submissions) ? submissions : (Array.isArray(answers) ? answers.map(a => ({ studentAnswer: a })) : []);
        const answersForScore = submissionArray.map(s => (s && typeof s === 'object' ? s.studentAnswer : s));

        const score = calculateScore(test.questions, answersForScore);

        const attempt = new TestAttempt({
            studentId,
            testId,
            answers: answersForScore,
            score,
            totalMarks,
            submittedAt: new Date(),
            submissionType,
            startedAt,
            proctoring,
        });

        const saved = await attempt.save();

        // Invalidate AI cache entries linked to this test (non-blocking)
        invalidateByTestId(String(testId)).catch(() => {});

        // Respond immediately to the student
        res.send(saved);

        // ── Post-submission: trigger sentence_answer evaluation (async) ───────
        const hasSentenceQuestions = test.questions.some(q => q.questionType === 'sentence_answer');
        if (hasSentenceQuestions) {
            // We need an attemptHistoryId — for now use the TestAttempt._id
            // The testAttemptHistoryService will create the full history record
            setImmediate(async () => {
                try {
                    await evaluateAllSentenceAnswers({
                        attemptHistoryId: saved._id,
                        studentId:        String(studentId),
                        testId:           String(testId),
                        subjectId:        test.subject?._id ? String(test.subject._id) : null,
                        schoolId:         test.school ? String(test.school) : null,
                        questions:        test.questions,
                        submissions:      submissionArray,
                    });

                    // Notify teacher about pending sentence review
                    if (test.createdBy) {
                        await Notification.create({
                            userId:        test.createdBy,
                            recipientType: 'teacher',
                            title:         'Descriptive Answer Pending Review',
                            message:       `A student has submitted descriptive answers that require your validation for test: "${test.title}".`,
                            type:          'report',
                            readStatus:    false,
                        });
                    }
                } catch (err) {
                    logger.error('submitAttempt: sentence evaluation failed', { error: err.message, testId, studentId });
                }
            });
        }

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// Get all attempts for a test (teacher view)
const getAttemptsByTest = async (req, res) => {
    try {
        const attempts = await TestAttempt.find({ testId: req.params.testId })
            .populate("studentId", "name rollNum");
        res.send(attempts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get all attempts for a student
const getAttemptsByStudent = async (req, res) => {
    try {
        const attempts = await TestAttempt.find({ studentId: req.params.studentId })
            .populate("testId", "title");
        res.send(attempts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get a single attempt by ID (full detail)
const getAttemptById = async (req, res) => {
    try {
        const attempt = await TestAttempt.findById(req.params.id)
            .populate('studentId', 'name rollNum')
            .populate('testId');
        if (!attempt) {
            return res.status(404).json({ message: "Attempt not found." });
        }
        res.send(attempt);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    calculateScore,
    submitAttempt,
    getAttemptsByTest,
    getAttemptsByStudent,
    getAttemptById,
};
