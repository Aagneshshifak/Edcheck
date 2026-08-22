/**
 * TestAttemptHistory Schema
 *
 * Immutable, permanent record of every test attempt. This is the primary
 * data source for the adaptive learning system and longitudinal analytics.
 *
 * Design principles:
 *   - IMMUTABLE: never overwrite. Each submission creates a new document.
 *   - COMPREHENSIVE: all metadata captured at submission time to prevent
 *     stale references if tests/teachers/subjects are later edited.
 *   - LINKED: forward-links to adaptive pipeline outputs (mastery, profile)
 *     so the history record is the single source of truth for an attempt.
 *   - SCALABLE: indexed for every query pattern needed by student/teacher/admin.
 *
 * Grading thresholds:
 *   A+ ≥ 90%   A ≥ 80%   B ≥ 70%   C ≥ 60%   D ≥ 50%   F < 50%
 */

'use strict';

const mongoose = require('mongoose');

// ── Sub-schema: question-level response ──────────────────────────────────────
const questionResponseSchema = new mongoose.Schema({
    questionId:      { type: mongoose.Schema.Types.ObjectId },  // optional ref to question
    questionIndex:   { type: Number, required: true },          // 0-based position
    questionText:    { type: String },                          // snapshot (immutable copy)
    questionType:    { type: String, enum: ['mcq', 'true_false', 'numerical', 'short_answer', 'sentence_answer'], default: 'mcq' },
    topic:           { type: String, default: 'General' },
    subtopic:        { type: String, default: null },
    difficulty:      { type: String, enum: ['easy', 'medium', 'hard', 'challenge'], default: 'medium' },

    studentAnswer:   { type: mongoose.Schema.Types.Mixed, default: null },
    correctAnswer:   { type: mongoose.Schema.Types.Mixed },
    isCorrect:       { type: Boolean, default: false },
    isSkipped:       { type: Boolean, default: false },
    marksObtained:   { type: Number, default: 0 },
    maxMarks:        { type: Number, default: 1 },
    partialCredit:   { type: Number, min: 0, max: 1, default: null },

    // For sentence_answer questions: link to the SentenceAnswerEval document
    aiEvalId:        { type: mongoose.Schema.Types.ObjectId, ref: 'sentenceAnswerEval', default: null },
    // Whether this question requires teacher validation before DSKP update
    requiresValidation: { type: Boolean, default: false },

    responseTimeMs:  { type: Number, default: 0 },
    numberOfAttempts: { type: Number, default: 1 },   // answer changes before final submit
    confidence:      { type: Number, min: 1, max: 5, default: null },
}, { _id: false });

// ── Sub-schema: topic-wise performance ───────────────────────────────────────
const topicPerformanceSchema = new mongoose.Schema({
    topic:           { type: String, required: true },
    totalQuestions:  { type: Number, default: 0 },
    correctAnswers:  { type: Number, default: 0 },
    wrongAnswers:    { type: Number, default: 0 },
    skipped:         { type: Number, default: 0 },
    marksObtained:   { type: Number, default: 0 },
    maxMarks:        { type: Number, default: 0 },
    accuracy:        { type: Number, default: 0 },       // [0,1]
    avgResponseMs:   { type: Number, default: 0 },

    // Mastery snapshots from the adaptive pipeline
    masteryBefore:   { type: Number, default: null },    // mastery score before this attempt
    masteryAfter:    { type: Number, default: null },     // mastery score after pipeline runs
    masteryDelta:    { type: Number, default: null },     // after − before
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────
const testAttemptHistorySchema = new mongoose.Schema({

    // ── Identity ──────────────────────────────────────────────────────────
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'student',  required: true },
    testId:      { type: mongoose.Schema.Types.ObjectId, ref: 'test',     required: true },
    attemptId:   { type: mongoose.Schema.Types.ObjectId, ref: 'testAttempt' }, // links to legacy attempt

    // ── Snapshot context (captured at submission; never changes) ──────────
    subjectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
    classId:     { type: mongoose.Schema.Types.ObjectId, ref: 'sclass' },
    teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'teacher' },
    schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    testTitle:   { type: String, default: '' },   // snapshot of test.title
    subjectName: { type: String, default: '' },   // snapshot
    teacherName: { type: String, default: '' },   // snapshot
    className:   { type: String, default: '' },   // snapshot

    // ── Timing ────────────────────────────────────────────────────────────
    startedAt:       { type: Date },
    submittedAt:     { type: Date, default: Date.now },
    timeTakenSeconds: { type: Number, default: 0 },    // wall-clock seconds

    // ── Aggregate results ─────────────────────────────────────────────────
    totalQuestions:     { type: Number, default: 0 },
    attemptedQuestions: { type: Number, default: 0 },
    correctAnswers:     { type: Number, default: 0 },
    wrongAnswers:       { type: Number, default: 0 },
    skippedQuestions:   { type: Number, default: 0 },
    finalScore:         { type: Number, default: 0 },
    maxScore:           { type: Number, default: 0 },
    percentage:         { type: Number, default: 0 },   // [0,100]
    grade: {
        type: String,
        enum: ['A+', 'A', 'B', 'C', 'D', 'F'],
        default: 'F',
    },

    // ── Test metadata ──────────────────────────────────────────────────────
    difficultyLevel: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'challenge', 'mixed'],
        default: 'mixed',
    },
    submissionType: {
        type: String,
        enum: ['manual', 'auto'],
        default: 'manual',
    },
    status: {
        type: String,
        enum: ['completed', 'abandoned', 'expired'],
        default: 'completed',
    },

    // ── Performance metrics ────────────────────────────────────────────────
    accuracyRate:       { type: Number, default: 0 },   // [0,1]
    completionRate:     { type: Number, default: 0 },   // [0,1] attempted / total
    avgResponseTimeMs:  { type: Number, default: 0 },
    avgConfidence:      { type: Number, default: null },

    // ── Learning metrics (filled by adaptive pipeline) ────────────────────
    learningVelocity:   { type: Number, default: null },  // mastery units/day
    improvementScore:   { type: Number, default: null },  // delta from last attempt on same test
    overallMasteryBefore: { type: Number, default: null },
    overallMasteryAfter:  { type: Number, default: null },

    // ── Detailed breakdowns ────────────────────────────────────────────────
    topicPerformance:  { type: [topicPerformanceSchema], default: [] },
    questionResponses: { type: [questionResponseSchema],  default: [] },

    // ── AI feedback (set after adaptive pipeline runs) ────────────────────
    aiFeedback: {
        summary:          { type: String, default: null },
        strengths:        { type: [String], default: [] },
        weaknesses:       { type: [String], default: [] },
        recommendations:  { type: [String], default: [] },
        generatedAt:      { type: Date },
    },

    // ── Solutions visibility ───────────────────────────────────────────────
    solutionsPublished: { type: Boolean, default: false },   // teacher flag
    solutionsPublishedAt: { type: Date },

    // ── Rank (filled asynchronously after all students submit) ────────────
    rank:         { type: Number, default: null },   // rank in class for this test
    totalRanked:  { type: Number, default: null },

    // ── Link to adaptive pipeline outputs ─────────────────────────────────
    adaptiveDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'quizAttemptDetail' },
    profileVersion:   { type: Number, default: null },  // StudentLearningProfile.version after update

    // ── Assessment completion state ────────────────────────────────────────
    // COMPLETED           = all objective questions graded, no sentence answers
    // AI_REVIEW_PENDING   = sentence answers submitted, AI evaluation in progress
    // TEACHER_REVIEW_PENDING = AI eval complete, awaiting teacher validation
    // FULLY_VALIDATED     = all sentence answers teacher-validated, DSKP fully updated
    assessmentCompletionStatus: {
        type:    String,
        enum:    ['COMPLETED', 'AI_REVIEW_PENDING', 'TEACHER_REVIEW_PENDING', 'FULLY_VALIDATED'],
        default: 'COMPLETED',
    },

    // Links to SentenceAnswerEval documents for this attempt (one per sentence question)
    sentenceEvalIds:      { type: [mongoose.Schema.Types.ObjectId], ref: 'sentenceAnswerEval', default: [] },
    // Count of sentence evals still awaiting teacher validation
    pendingSentenceEvals: { type: Number, default: 0 },

}, {
    timestamps: true,
    // Prevent accidental updates — use findOneAndUpdate with $set only
});

// ── Indexes (designed for all query patterns) ─────────────────────────────────
// Student history list (most common query)
testAttemptHistorySchema.index({ studentId: 1, submittedAt: -1 });
// Student + subject filter
testAttemptHistorySchema.index({ studentId: 1, subjectId: 1, submittedAt: -1 });
// Student + teacher filter
testAttemptHistorySchema.index({ studentId: 1, teacherId: 1, submittedAt: -1 });
// Student + score sort
testAttemptHistorySchema.index({ studentId: 1, percentage: -1 });
// Teacher view: all attempts for a specific test
testAttemptHistorySchema.index({ testId: 1, submittedAt: -1 });
// Class-wide analytics
testAttemptHistorySchema.index({ classId: 1, testId: 1 });
testAttemptHistorySchema.index({ classId: 1, submittedAt: -1 });
// School-wide analytics
testAttemptHistorySchema.index({ schoolId: 1, submittedAt: -1 });
// Adaptive pipeline link
testAttemptHistorySchema.index({ attemptId: 1 }, { unique: true, sparse: true });
// One-per-attempt guard for duplicate prevention
testAttemptHistorySchema.index({ studentId: 1, testId: 1, submittedAt: 1 });

module.exports = mongoose.model('testAttemptHistory', testAttemptHistorySchema);
