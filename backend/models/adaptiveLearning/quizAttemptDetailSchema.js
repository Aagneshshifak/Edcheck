/**
 * QuizAttemptDetail Schema
 *
 * Stores the granular, question-level telemetry for every quiz attempt.
 * This is the raw input consumed by the Rule-Based Evaluation Engine.
 *
 * Design rationale:
 *   - Separated from the existing testAttemptSchema (which only tracks aggregate
 *     score) to avoid schema migration on existing data.
 *   - Links back to testAttempt via attemptId for backward compatibility.
 *   - Each question record is self-contained: topic, type, response, timing.
 *
 * Fields per question:
 *   questionIndex   — position in the quiz (0-based)
 *   questionType    — "mcq" | "true_false" | "numerical" | "short_answer"
 *   topic           — subject-level topic tag (used by mastery engine)
 *   difficulty      — "easy" | "medium" | "hard" | "challenge" (0.25–1.0)
 *   maxMarks        — marks allocated to this question
 *   studentAnswer   — raw answer (index for MCQ, value for numerical/text)
 *   correctAnswer   — ground-truth answer
 *   isCorrect       — boolean; set by evaluation engine
 *   isSkipped       — true if student did not answer
 *   responseTimeMs  — time from question display to answer submission (ms)
 *   confidence      — optional 1–5 self-reported confidence
 *   attemptCount    — how many times student changed answer before final submit
 *   partialCredit   — [0,1] for short-answer; null for MCQ/TF
 *   evaluationNotes — machine-readable explanation from the engine
 */

const mongoose = require('mongoose');

const questionDetailSchema = new mongoose.Schema({
    questionIndex:  { type: Number,  required: true },
    questionType:   { type: String,  enum: ['mcq', 'true_false', 'numerical', 'short_answer'], default: 'mcq' },
    topic:          { type: String,  required: true },
    difficulty:     { type: String,  enum: ['easy', 'medium', 'hard', 'challenge'], default: 'medium' },
    maxMarks:       { type: Number,  required: true },

    studentAnswer:  { type: mongoose.Schema.Types.Mixed, default: null },
    correctAnswer:  { type: mongoose.Schema.Types.Mixed, required: true },

    isCorrect:      { type: Boolean, default: false },
    isSkipped:      { type: Boolean, default: false },
    partialCredit:  { type: Number,  min: 0, max: 1, default: null },

    responseTimeMs: { type: Number, default: 0 },      // 0 = skipped / no timing
    confidence:     { type: Number, min: 1, max: 5, default: null },
    attemptCount:   { type: Number, default: 1 },      // answer changes before submit

    evaluationNotes: { type: String, default: '' },    // e.g. "Correct MCQ answer"
}, { _id: false });

const quizAttemptDetailSchema = new mongoose.Schema({
    // ── Links ────────────────────────────────────────────────────────────────
    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'student',      required: true },
    testId:     { type: mongoose.Schema.Types.ObjectId, ref: 'test',         required: true },
    attemptId:  { type: mongoose.Schema.Types.ObjectId, ref: 'testAttempt',  required: true, unique: true },

    // ── Attempt metadata ─────────────────────────────────────────────────────
    subjectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
    schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    attemptedAt: { type: Date, default: Date.now },
    totalDurationMs: { type: Number, default: 0 },   // total wall-clock time for quiz

    // ── Question-level records (produced by EvaluationEngine) ────────────────
    questionDetails: [questionDetailSchema],

    // ── Aggregate performance metrics (computed once, stored for fast lookup) ─
    metrics: {
        totalQuestions:    { type: Number, default: 0 },
        answeredQuestions: { type: Number, default: 0 },
        skippedQuestions:  { type: Number, default: 0 },
        correctCount:      { type: Number, default: 0 },
        incorrectCount:    { type: Number, default: 0 },
        rawScore:          { type: Number, default: 0 },
        maxScore:          { type: Number, default: 0 },
        accuracyRate:      { type: Number, default: 0 },   // [0,1]
        avgResponseTimeMs: { type: Number, default: 0 },
        avgConfidence:     { type: Number, default: null }, // null if none provided
        completionRate:    { type: Number, default: 0 },   // [0,1] answered / total

        // Per-topic breakdown: { "Algebra": { correct:3, total:5, avgTime:4200 } }
        topicBreakdown: {
            type: Map,
            of: new mongoose.Schema({
                correct:   { type: Number, default: 0 },
                total:     { type: Number, default: 0 },
                skipped:   { type: Number, default: 0 },
                totalTime: { type: Number, default: 0 }, // ms
            }, { _id: false }),
            default: {},
        },
    },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
quizAttemptDetailSchema.index({ studentId: 1, attemptedAt: -1 });
quizAttemptDetailSchema.index({ testId: 1 });
quizAttemptDetailSchema.index({ studentId: 1, testId: 1 });
quizAttemptDetailSchema.index({ subjectId: 1 });

module.exports = mongoose.model('quizAttemptDetail', quizAttemptDetailSchema);
