/**
 * StaffStudentReport Schema
 *
 * Stores structured post-assessment reports generated for teachers/staff.
 * Each report is tied to a specific student, staff member, assessment, and timestamp.
 * Historical reports are preserved — never overwritten.
 *
 * Report structure:
 *   - analyticsSnapshot: deterministic data from the pipeline (FACTS)
 *   - aiAnalysis: LLM-generated analysis and recommendations (AI)
 *   - These are explicitly separated so the teacher knows what is data vs recommendation.
 */

const mongoose = require('mongoose');

const staffStudentReportSchema = new mongoose.Schema({
    // ── Core references ──────────────────────────────────────────────────
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'student',
        required: true,
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teacher',
        required: true,
    },
    assessmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'test',
        required: true,
    },
    attemptDetailId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'quizAttemptDetail',
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'subject',
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
    },

    // ── Assessment info ──────────────────────────────────────────────────
    assessmentTitle: { type: String },
    assessmentDate:  { type: Date },

    // ── FACTS: Analytics snapshot (from deterministic pipeline) ───────────
    analyticsSnapshot: {
        scorePercentage:  { type: Number },
        totalCorrect:     { type: Number },
        totalQuestions:   { type: Number },
        completionRate:   { type: Number },
        overallMastery:   { type: Number },
        readinessScore:   { type: Number },
        consistencyScore: { type: Number },
        confidenceScore:  { type: Number },
        retentionEstimate: { type: Number },
        learningPace:     { type: String },

        topicBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
        difficultyBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },

        weakTopics:   { type: [{ topic: String, masteryScore: Number, trendType: String }], default: [] },
        strongTopics: { type: [{ topic: String, masteryScore: Number }], default: [] },

        alerts: { type: [{ alertType: String, topic: String }], default: [] },
    },

    // ── AI: Generated analysis and recommendations ───────────────────────
    aiAnalysis: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // ── LLM metadata ─────────────────────────────────────────────────────
    llmMeta: {
        provider:         { type: String, default: 'groq' },
        model:            { type: String },
        latencyMs:        { type: Number },
        promptTokens:     { type: Number },
        completionTokens: { type: Number },
    },

    // ── Status ───────────────────────────────────────────────────────────
    generatedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['generated', 'reviewed', 'action_taken'],
        default: 'generated',
    },
    staffNotes: { type: String, default: '' },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
staffStudentReportSchema.index({ studentId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ staffId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ assessmentId: 1 });
staffStudentReportSchema.index({ schoolId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ studentId: 1, staffId: 1 });
staffStudentReportSchema.index({ studentId: 1, subjectId: 1, generatedAt: -1 });

module.exports = mongoose.model('staffStudentReport', staffStudentReportSchema);
