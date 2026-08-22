/**
 * SentenceAnswerEval Schema
 *
 * Stores the AI evaluation and teacher validation for each sentence_answer
 * question in a student's test attempt.
 *
 * Lifecycle:
 *   1. Created immediately after student submits (one record per sentence question)
 *   2. AI runs sentenceAnswerEvaluator → fills ai* fields, validationStatus = PENDING_TEACHER_REVIEW
 *   3. Teacher reviews → sets validationStatus, teacherScore, teacherFeedback
 *   4. finalScore is set = teacherScore (or aiScore if AI_ACCEPTED)
 *   5. adaptivePipeline.finalizeWithTeacherValidation() is called → DSKP updated
 *
 * Design principles:
 *   - AI score is NEVER the authoritative score — only finalScore goes to DSKP.
 *   - Teacher validation is MANDATORY (no auto-accept).
 *   - All AI evaluation details are stored for teacher review and auditability.
 */

'use strict';

const mongoose = require('mongoose');

const sentenceAnswerEvalSchema = new mongoose.Schema({
    // ── Core references ────────────────────────────────────────────────────
    attemptHistoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'testAttemptHistory',
        required: true,
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'student',
        required: true,
    },
    testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'test',
        required: true,
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'subject',
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'admin',
    },

    // ── Question snapshot (immutable copy at submission time) ──────────────
    questionIndex:   { type: Number, required: true },
    questionText:    { type: String, required: true },
    topic:           { type: String, default: 'General' },
    subtopic:        { type: String, default: null },
    expectedAnswer:  { type: String, default: '' },
    keyConcepts:     { type: [String], default: [] },
    // Rubric used for AI evaluation (snapshot)
    scoringRubric: {
        conceptCoverage:    { type: Number, default: 0.40 },
        correctness:        { type: Number, default: 0.30 },
        relevance:          { type: Number, default: 0.15 },
        explanationQuality: { type: Number, default: 0.15 },
    },
    maxMarks: { type: Number, required: true },

    // ── Student Answer ─────────────────────────────────────────────────────
    studentAnswer: { type: String, default: '' },

    // ── AI Evaluation (set by sentenceAnswerEvaluator) ─────────────────────
    aiScore:               { type: Number, default: null },
    aiConceptCoverage:     { type: Number, default: null },  // [0,1]
    aiCorrectness:         { type: Number, default: null },  // [0,1]
    aiRelevance:           { type: Number, default: null },  // [0,1]
    aiExplanationQuality:  { type: Number, default: null },  // [0,1]
    coveredConcepts:       { type: [String], default: [] },
    missingConcepts:       { type: [String], default: [] },
    incorrectConcepts:     { type: [String], default: [] },
    aiFeedback:            { type: String, default: '' },
    aiConfidence: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        default: 'LOW',
    },
    aiEvaluatedAt:  { type: Date, default: null },
    aiRetryCount:   { type: Number, default: 0 },
    aiRawResponse:  { type: String, default: null },  // stored for debugging

    // ── Teacher Validation (set when teacher acts) ─────────────────────────
    validationStatus: {
        type: String,
        enum: ['PENDING_TEACHER_REVIEW', 'AI_ACCEPTED', 'TEACHER_MODIFIED', 'TEACHER_REJECTED'],
        default: 'PENDING_TEACHER_REVIEW',
    },
    teacherId:       { type: mongoose.Schema.Types.ObjectId, ref: 'teacher', default: null },
    teacherScore:    { type: Number, default: null },
    teacherFeedback: { type: String, default: '' },
    validatedAt:     { type: Date, default: null },

    // ── Final Score (authoritative — only this goes to DSKP) ───────────────
    // Set after teacher validation: = teacherScore (modified/rejected) or aiScore (accepted)
    finalScore: { type: Number, default: null },

    // ── Pipeline state ─────────────────────────────────────────────────────
    // true once DSKP has been updated with this question's finalScore
    dskpUpdated: { type: Boolean, default: false },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
// Teacher pending review query
sentenceAnswerEvalSchema.index({ validationStatus: 1, subjectId: 1 });
sentenceAnswerEvalSchema.index({ attemptHistoryId: 1 });
sentenceAnswerEvalSchema.index({ studentId: 1, testId: 1 });
// Teacher dashboard: all pending evals for a teacher's subjects
sentenceAnswerEvalSchema.index({ teacherId: 1, validationStatus: 1 });
sentenceAnswerEvalSchema.index({ schoolId: 1, validationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('sentenceAnswerEval', sentenceAnswerEvalSchema);
