const Subject          = require('../models/subjectSchema');
const Test             = require('../models/testSchema');
const TestAttempt      = require('../models/testAttemptSchema');
const Teacher          = require('../models/teacherSchema');
const TopicPerformance = require('../models/topicPerformanceSchema');
const AIQuestionBank   = require('../models/aiQuestionBankSchema');
const AINoteSuggestion = require('../models/aiNoteSuggestionSchema');
const {
    suggestNotes,
    analyzeWeakTopics,
    generatePracticeQuestions,
} = require('../services/ai-teaching-service');
const AILog = require('../models/aiLogSchema');

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

        const start1 = Date.now();
        let result;
        try {
            result = await suggestNotes(subjectName, topic);
        } finally {
            AILog.create({
                userId: req.user.id, userRole: 'teacher', endpointName: 'generate-notes',
                model: 'llama-3.1-8b-instant', promptSummary: `Subject: ${subjectName}, Topic: ${topic}`,
                responseSummary: result ? JSON.stringify(result).slice(0, 500) : '',
                responseTimeMs: Date.now() - start1, success: !!result, fromCache: false,
            }).catch(() => {});
        }

        // Persist to AINoteSuggestion collection
        await AINoteSuggestion.findOneAndUpdate(
            { subjectId, topic: topic.trim(), createdBy: req.user.id },
            {
                $set: {
                    suggestions: result.suggestions || [],
                    keyPoints:   result.keyPoints   || [],
                    resources:   result.resources   || [],
                    lastFetched: new Date(),
                },
            },
            { upsert: true }
        );

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

        const start2 = Date.now();
        let result;
        try {
            result = await analyzeWeakTopics(tests, attempts, subjectTopics, subjectName);
        } finally {
            AILog.create({
                userId: req.user.id, userRole: 'teacher', endpointName: 'detect-weak-topics',
                model: 'llama-3.3-70b-versatile', promptSummary: `Subject: ${subjectName}, Class: ${classId}`,
                responseSummary: result ? JSON.stringify(result.weakTopics || []).slice(0, 500) : '',
                responseTimeMs: Date.now() - start2, success: !!result, fromCache: false,
            }).catch(() => {});
        }

        // Persist topic performance to MongoDB (upsert per topic)
        const now = new Date();
        const upsertOps = result.weakTopics.map((wt) => {
            const suggestion = result.clarificationSuggestions.find(c => c.topic === wt.topic)?.suggestion || '';
            // Count students who scored 0 on this topic (rough proxy for weakStudents)
            const weakStudents = attempts.filter(a => {
                const test = tests.find(t => t._id.toString() === (a.testId || '').toString());
                if (!test) return false;
                const qIdxs = (test.questions || []).reduce((acc, q, i) => {
                    if ((q.questionText || '').toLowerCase().includes((wt.topic || '').toLowerCase().split(' ')[0])) acc.push(i);
                    return acc;
                }, []);
                if (qIdxs.length === 0) return false;
                const answers = a.answers || [];
                return qIdxs.every(i => answers[i] !== test.questions[i].correctAnswer);
            }).length;

            return {
                updateOne: {
                    filter: { subjectId, classId, topic: wt.topic },
                    update: {
                        $set: {
                            averageScore: wt.scorePercent,
                            severity: wt.severity,
                            weakStudents,
                            suggestion,
                            lastAnalyzed: now,
                        },
                    },
                    upsert: true,
                },
            };
        });

        if (upsertOps.length > 0) {
            await TopicPerformance.bulkWrite(upsertOps);
        }

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
 * Validate topic + subjectName + difficulty + count, call generatePracticeQuestions,
 * persist to AIQuestionBank, return questions.
 */
const generateQuestions = async (req, res) => {
    try {
        const { topic, subjectName, difficulty, count, subjectId } = req.body;

        if (!topic || !subjectName || !difficulty || count == null) {
            return res.status(400).json({ message: 'topic, subjectName, difficulty, and count are required' });
        }

        const validDifficulties = ['easy', 'medium', 'hard'];
        if (!validDifficulties.includes(difficulty)) {
            return res.status(400).json({ message: 'difficulty must be easy, medium, or hard' });
        }

        const start3 = Date.now();
        let questions;
        try {
            questions = await generatePracticeQuestions(topic, subjectName, difficulty, Number(count));
        } finally {
            AILog.create({
                userId: req.user.id, userRole: 'teacher', endpointName: 'generate-questions',
                model: 'llama-3.3-70b-versatile', promptSummary: `Topic: ${topic}, Subject: ${subjectName}, Difficulty: ${difficulty}, Count: ${count}`,
                responseSummary: questions ? `${questions.length} questions generated` : '',
                responseTimeMs: Date.now() - start3, success: !!questions, fromCache: false,
            }).catch(() => {});
        }

        // Persist to AIQuestionBank if subjectId provided
        if (subjectId) {
            await AIQuestionBank.findOneAndUpdate(
                { subjectId, topic, difficultyLevel: difficulty, createdBy: req.user.id },
                {
                    $set: {
                        questions,
                        lastGenerated: new Date(),
                    },
                },
                { upsert: true, new: true }
            );
        }

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

/**
 * GET /AI/question-bank?subjectId=&topic=&difficulty=
 * Return saved AIQuestionBank entries for the requesting teacher.
 */
const getQuestionBank = async (req, res) => {
    try {
        const { subjectId, topic, difficulty } = req.query;
        const filter = { createdBy: req.user.id };
        if (subjectId)  filter.subjectId = subjectId;
        if (topic)      filter.topic = topic;
        if (difficulty) filter.difficultyLevel = difficulty;

        const banks = await AIQuestionBank.find(filter).sort({ lastGenerated: -1 }).lean();
        return res.status(200).json({ banks });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * POST /AI/question-bank/:bankId/add-to-test
 * Append questions from an AIQuestionBank entry into an existing test.
 * Body: { testId, questionIds[] }  — questionIds are _id strings from the bank's questions array.
 */
const addBankQuestionsToTest = async (req, res) => {
    try {
        const { bankId } = req.params;
        const { testId, questionIds } = req.body;

        if (!testId || !questionIds?.length) {
            return res.status(400).json({ message: 'testId and questionIds are required' });
        }

        const bank = await AIQuestionBank.findById(bankId);
        if (!bank) return res.status(404).json({ message: 'Question bank not found' });

        // Only the teacher who generated the bank can use it
        if (bank.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const selected = bank.questions.filter(q => questionIds.includes(q._id.toString()));
        if (!selected.length) return res.status(400).json({ message: 'No matching questions found' });

        // Map to test question format (add default marks = 1)
        const toAdd = selected.map(q => ({
            questionText:  q.questionText,
            options:       q.options,
            correctAnswer: q.correctAnswer,
            marks:         1,
        }));

        const test = await Test.findByIdAndUpdate(
            testId,
            { $push: { questions: { $each: toAdd } } },
            { new: true }
        );
        if (!test) return res.status(404).json({ message: 'Test not found' });

        return res.status(200).json({ message: `${toAdd.length} question(s) added to test`, test });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * GET /AI/topic-performance?subjectId=&classId=
 * Return stored TopicPerformance records for a subject+class.
 * Falls back to empty array if none exist yet (teacher hasn't run analysis).
 */
const getTopicPerformance = async (req, res) => {
    try {
        const { subjectId, classId } = req.query;

        if (!subjectId || !classId) {
            return res.status(400).json({ message: 'subjectId and classId are required' });
        }

        const records = await TopicPerformance.find({ subjectId, classId })
            .sort({ averageScore: 1 })  // weakest first
            .lean();

        return res.status(200).json({ topicPerformance: records });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * GET /AI/note-suggestions/saved?subjectId=&topic=
 * Return cached AINoteSuggestion for the requesting teacher.
 */
const getSavedNoteSuggestions = async (req, res) => {
    try {
        const { subjectId, topic } = req.query;
        const filter = { createdBy: req.user.id };
        if (subjectId) filter.subjectId = subjectId;
        if (topic)     filter.topic = topic;

        const suggestions = await AINoteSuggestion.find(filter)
            .sort({ lastFetched: -1 })
            .lean();
        return res.status(200).json({ suggestions });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getNoteSuggestions, getSavedNoteSuggestions, detectWeakTopics, generateQuestions, getTopicPerformance, getQuestionBank, addBankQuestionsToTest };
