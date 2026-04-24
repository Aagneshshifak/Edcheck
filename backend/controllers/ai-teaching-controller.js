const Subject     = require('../models/subjectSchema');
const Test        = require('../models/testSchema');
const TestAttempt = require('../models/testAttemptSchema');
const Teacher     = require('../models/teacherSchema');
const {
    suggestNotes,
    analyzeWeakTopics,
    generatePracticeQuestions,
} = require('../services/ai-teaching-service');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determine whether an error originated from the Groq SDK (network / auth).
 * The Groq SDK throws errors with a `status` property or whose message
 * contains typical HTTP-client error patterns.
 */
function isGroqApiError(err) {
    // Groq SDK errors carry a numeric status code
    if (err && typeof err.status === 'number') return true;
    // Network-level errors (ECONNREFUSED, ETIMEDOUT, etc.)
    if (err && err.code && /^E(CONN|TIMEOUT|NOTFOUND)/.test(err.code)) return true;
    return false;
}

/**
 * Verify that the authenticated teacher is assigned to the given subjectId.
 * Returns the Teacher document on success, or sends a 403 response and returns null.
 */
async function verifyTeacherOwnership(req, res, subjectId) {
    const teacher = await Teacher.findById(req.user.id).select('teachSubjects');
    if (!teacher) {
        res.status(403).json({ message: 'Access denied: subject not assigned to this teacher' });
        return null;
    }

    const assigned = teacher.teachSubjects.some(
        (id) => id.toString() === subjectId.toString()
    );

    if (!assigned) {
        res.status(403).json({ message: 'Access denied: subject not assigned to this teacher' });
        return null;
    }

    return teacher;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /AI/note-suggestions
 * Validate subjectId + topic, fetch Subject, verify ownership, call suggestNotes.
 */
const getNoteSuggestions = async (req, res) => {
    try {
        const { subjectId, topic } = req.body;

        if (!subjectId || !topic) {
            return res.status(400).json({ message: 'subjectId and topic are required' });
        }

        const ownership = await verifyTeacherOwnership(req, res, subjectId);
        if (!ownership) return; // 403 already sent

        const subject = await Subject.findById(subjectId).select('subjectName subName topics');
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        const subjectName = subject.subjectName || subject.subName || '';

        const result = await suggestNotes(subjectName, topic);
        return res.status(200).json(result);

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(500).json({ message: 'AI returned an unexpected response format' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: err.message });
    }
};

/**
 * POST /AI/weak-topics
 * Validate subjectId + classId, verify ownership, fetch Tests + TestAttempts,
 * call analyzeWeakTopics, return 200 or 404 if no attempts.
 */
const detectWeakTopics = async (req, res) => {
    try {
        const { subjectId, classId } = req.body;

        if (!subjectId || !classId) {
            return res.status(400).json({ message: 'subjectId and classId are required' });
        }

        const ownership = await verifyTeacherOwnership(req, res, subjectId);
        if (!ownership) return; // 403 already sent

        const subject = await Subject.findById(subjectId).select('subjectName subName topics');
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        // Fetch tests for this class + subject
        const tests = await Test.find({ classId, subject: subjectId });
        const testIds = tests.map((t) => t._id);

        // Fetch all attempts for those tests
        const attempts = await TestAttempt.find({ testId: { $in: testIds } });

        if (attempts.length === 0) {
            return res.status(404).json({ message: 'No test attempts found for this subject/class' });
        }

        const subjectName = subject.subjectName || subject.subName || '';
        const subjectTopics = subject.topics || [];

        const result = await analyzeWeakTopics(tests, attempts, subjectTopics, subjectName);
        return res.status(200).json(result);

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(500).json({ message: 'AI returned an unexpected response format' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: err.message });
    }
};

/**
 * POST /AI/generate-questions
 * Validate topic + subjectName + difficulty + count, call generatePracticeQuestions.
 */
const generateQuestions = async (req, res) => {
    try {
        const { topic, subjectName, difficulty, count } = req.body;

        if (!topic || !subjectName || !difficulty || count == null) {
            return res.status(400).json({ message: 'topic, subjectName, difficulty, and count are required' });
        }

        const validDifficulties = ['easy', 'medium', 'hard'];
        if (!validDifficulties.includes(difficulty)) {
            return res.status(400).json({ message: 'difficulty must be easy, medium, or hard' });
        }

        const questions = await generatePracticeQuestions(topic, subjectName, difficulty, Number(count));
        return res.status(200).json({ questions });

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(500).json({ message: 'AI returned an unexpected response format' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getNoteSuggestions, detectWeakTopics, generateQuestions };
