/**
 * SentenceEvalController
 *
 * REST API for teacher validation of AI-evaluated sentence_answer questions.
 *
 * RBAC: All routes require auth middleware and teacher role check.
 *       Teachers can only access evals for their own subjects/tests.
 *
 * Flow:
 *   Teacher reviews pending eval
 *         ↓
 *   Accept AI score / Modify / Reject
 *         ↓
 *   finalScore is set
 *         ↓
 *   finalizeWithTeacherValidation() → DSKP updated
 *         ↓
 *   If all evals done → assessmentCompletionStatus = FULLY_VALIDATED
 */

'use strict';

const SentenceAnswerEval                 = require('../models/sentenceAnswerEvalSchema');
const TestAttemptHistory                 = require('../models/testAttemptHistorySchema');
const { finalizeWithTeacherValidation }  = require('../services/adaptiveLearning/adaptivePipeline');
const { logger }                         = require('../utils/serverLogger');

// ── GET /api/teacher/sentence-evals/pending ───────────────────────────────────
/**
 * Get all pending sentence evals for tests created by this teacher.
 * Supports optional ?subjectId= and ?classId= filters.
 */
const getPendingEvals = async (req, res) => {
    try {
        const teacherId = req.user?._id || req.user?.id;
        const { subjectId, limit = 50, skip = 0 } = req.query;

        const filter = {
            validationStatus: 'PENDING_TEACHER_REVIEW',
        };
        if (subjectId) filter.subjectId = subjectId;

        // Teachers can only see evals for their subjects
        if (subjectId) {
            filter.subjectId = subjectId;
        }

        const evals = await SentenceAnswerEval.find(filter)
            .populate('studentId',   'name rollNum')
            .populate('subjectId',   'subjectName subName')
            .populate('testId',      'title classId')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(Number(skip))
            .lean();

        const total = await SentenceAnswerEval.countDocuments(filter);

        res.json({ evals, total, pending: total });
    } catch (err) {
        logger.error('SentenceEvalController: getPendingEvals failed', { error: err.message });
        res.status(500).json({ message: err.message });
    }
};

// ── GET /api/teacher/sentence-evals/:evalId ───────────────────────────────────
/**
 * Get full detail of a single sentence eval including AI breakdown.
 */
const getEvalById = async (req, res) => {
    try {
        const evalDoc = await SentenceAnswerEval.findById(req.params.evalId)
            .populate('studentId', 'name rollNum')
            .populate('subjectId', 'subjectName subName')
            .populate('testId',    'title durationMinutes')
            .lean();

        if (!evalDoc) {
            return res.status(404).json({ message: 'Evaluation not found.' });
        }

        res.json(evalDoc);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Shared helper: apply teacher decision and trigger DSKP update ─────────────
async function applyValidation({ evalId, teacherId, status, teacherScore, teacherFeedback }) {
    const evalDoc = await SentenceAnswerEval.findById(evalId);
    if (!evalDoc) throw Object.assign(new Error('Evaluation not found'), { statusCode: 404 });

    if (evalDoc.validationStatus !== 'PENDING_TEACHER_REVIEW') {
        throw Object.assign(new Error('This evaluation has already been validated.'), { statusCode: 409 });
    }

    // Validate teacher score
    const finalScore = typeof teacherScore === 'number'
        ? Math.max(0, Math.min(evalDoc.maxMarks, teacherScore))
        : (status === 'AI_ACCEPTED' ? (evalDoc.aiScore || 0) : 0);

    await SentenceAnswerEval.findByIdAndUpdate(evalId, {
        validationStatus: status,
        teacherId,
        teacherScore:     finalScore,
        teacherFeedback:  teacherFeedback || '',
        finalScore,
        validatedAt:      new Date(),
    });

    // Trigger DSKP update asynchronously
    setImmediate(async () => {
        try {
            const updated = await SentenceAnswerEval.findById(evalId).lean();
            await finalizeWithTeacherValidation({
                attemptHistoryId: updated.attemptHistoryId,
                studentId:        String(updated.studentId),
                subjectId:        updated.subjectId ? String(updated.subjectId) : null,
                schoolId:         updated.schoolId  ? String(updated.schoolId)  : null,
                evalDoc:          updated,
            });
        } catch (err) {
            logger.error('SentenceEvalController: DSKP finalization failed', { evalId, error: err.message });
        }
    });

    return finalScore;
}

// ── PUT /api/teacher/sentence-evals/:evalId/accept ────────────────────────────
/**
 * Accept the AI score as-is.
 */
const acceptEval = async (req, res) => {
    try {
        const teacherId = req.user?._id || req.user?.id;
        const finalScore = await applyValidation({
            evalId:          req.params.evalId,
            teacherId,
            status:          'AI_ACCEPTED',
            teacherFeedback: req.body.teacherFeedback || '',
        });
        res.json({ message: 'AI evaluation accepted.', finalScore });
    } catch (err) {
        res.status(err.statusCode || 500).json({ message: err.message });
    }
};

// ── PUT /api/teacher/sentence-evals/:evalId/modify ────────────────────────────
/**
 * Override score and/or feedback.
 * teacherScore (required), teacherFeedback (optional).
 */
const modifyEval = async (req, res) => {
    try {
        const teacherId = req.user?._id || req.user?.id;
        const { teacherScore, teacherFeedback } = req.body;

        if (teacherScore === undefined || teacherScore === null) {
            return res.status(400).json({ message: 'teacherScore is required to modify an evaluation.' });
        }
        if (typeof teacherScore !== 'number' || isNaN(teacherScore)) {
            return res.status(400).json({ message: 'teacherScore must be a valid number.' });
        }

        const finalScore = await applyValidation({
            evalId:          req.params.evalId,
            teacherId,
            status:          'TEACHER_MODIFIED',
            teacherScore,
            teacherFeedback: teacherFeedback || '',
        });
        res.json({ message: 'Evaluation score updated.', finalScore });
    } catch (err) {
        res.status(err.statusCode || 500).json({ message: err.message });
    }
};

// ── PUT /api/teacher/sentence-evals/:evalId/reject ────────────────────────────
/**
 * Reject AI evaluation — teacher enters their own score.
 * teacherScore (required) and teacherFeedback (required).
 */
const rejectEval = async (req, res) => {
    try {
        const teacherId = req.user?._id || req.user?.id;
        const { teacherScore, teacherFeedback } = req.body;

        if (teacherScore === undefined || teacherScore === null) {
            return res.status(400).json({ message: 'teacherScore is required when rejecting an AI evaluation.' });
        }
        if (!teacherFeedback || !teacherFeedback.trim()) {
            return res.status(400).json({ message: 'teacherFeedback is required when rejecting an AI evaluation.' });
        }

        const finalScore = await applyValidation({
            evalId:          req.params.evalId,
            teacherId,
            status:          'TEACHER_REJECTED',
            teacherScore,
            teacherFeedback,
        });
        res.json({ message: 'AI evaluation rejected. Teacher score recorded.', finalScore });
    } catch (err) {
        res.status(err.statusCode || 500).json({ message: err.message });
    }
};

// ── GET /api/teacher/sentence-evals/summary ───────────────────────────────────
/**
 * Summary counts of pending/accepted/modified/rejected evals for a teacher.
 */
const getEvalSummary = async (req, res) => {
    try {
        const { subjectId } = req.query;
        const filter = {};
        if (subjectId) filter.subjectId = subjectId;

        const [pending, accepted, modified, rejected] = await Promise.all([
            SentenceAnswerEval.countDocuments({ ...filter, validationStatus: 'PENDING_TEACHER_REVIEW' }),
            SentenceAnswerEval.countDocuments({ ...filter, validationStatus: 'AI_ACCEPTED' }),
            SentenceAnswerEval.countDocuments({ ...filter, validationStatus: 'TEACHER_MODIFIED' }),
            SentenceAnswerEval.countDocuments({ ...filter, validationStatus: 'TEACHER_REJECTED' }),
        ]);

        res.json({ pending, accepted, modified, rejected, total: pending + accepted + modified + rejected });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getPendingEvals,
    getEvalById,
    acceptEval,
    modifyEval,
    rejectEval,
    getEvalSummary,
};
