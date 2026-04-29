const Test        = require("../models/testSchema");
const TestAttempt = require("../models/testAttemptSchema");
const { invalidateByTestId } = require('../services/ai-cache-service');

// ── Score Calculator ─────────────────────────────────────────────────────────

/**
 * Calculate score from questions and submitted answers.
 * @param {Array} questions - array of question objects with correctAnswer and marks
 * @param {Array} answers   - array of submitted answer indices
 * @returns {number} total score
 */
const calculateScore = (questions, answers) => {
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
        if (answers[i] === questions[i].correctAnswer) {
            score += questions[i].marks;
        }
    }
    return score;
};

// ── Attempt Controllers ──────────────────────────────────────────────────────

// Submit a test attempt (student)
const submitAttempt = async (req, res) => {
    try {
        const { studentId, testId, answers, submissionType, startedAt } = req.body;

        // Check for duplicate attempt
        const existing = await TestAttempt.findOne({ studentId, testId });
        if (existing) {
            return res.status(409).json({ message: "Attempt already submitted for this test." });
        }

        // Fetch test to get questions and compute totalMarks
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ message: "Test not found." });
        }

        const totalMarks = test.questions.reduce((sum, q) => sum + q.marks, 0);
        const score      = calculateScore(test.questions, answers);

        const attempt = new TestAttempt({
            studentId,
            testId,
            answers,
            score,
            totalMarks,
            submittedAt: new Date(),
            submissionType,
            startedAt,
        });

        const saved = await attempt.save();

        // Invalidate AI cache entries linked to this test (non-blocking)
        invalidateByTestId(String(testId)).catch(() => {});

        res.send(saved);
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
        const attempt = await TestAttempt.findById(req.params.id);
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
