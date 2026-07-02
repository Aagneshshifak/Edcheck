/**
 * StudentLearningProfile Schema
 *
 * The central, continuously-updated profile document for each student.
 * Aggregates outputs from all pipeline stages into a single queryable document.
 *
 * Profile dimensions:
 *   - strongestTopics / weakestTopics  — from TopicMasteryEngine
 *   - learningPace                     — from LearningTrendAnalyzer (velocity)
 *   - retentionEstimate                — from forgetting factor analysis
 *   - consistencyScore                 — variance of recent accuracies
 *   - engagementScore                  — completion rate + avg confidence
 *   - confidenceScore                  — avg self-reported confidence [0,1]
 *   - readinessScore                   — composite readiness for next-level content
 *
 * One document per student (upserted on each pipeline run).
 */

const mongoose = require('mongoose');

// ── Sub-schema: topic summary entry ──────────────────────────────────────────
const topicSummarySchema = new mongoose.Schema({
    topic:        { type: String, required: true },
    masteryScore: { type: Number },
    trendType:    { type: String },
    subjectId:    { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
}, { _id: false });

const studentLearningProfileSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'student',  required: true, unique: true },
    schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },

    // ── Topic rankings ────────────────────────────────────────────────────
    strongestTopics: { type: [topicSummarySchema], default: [] },   // top-5 by mastery
    weakestTopics:   { type: [topicSummarySchema], default: [] },   // bottom-5 by mastery

    // ── Scalar profile scores (all [0,1]) ─────────────────────────────────
    scores: {
        // Average mastery across all topics seen
        overallMastery:    { type: Number, default: 0 },

        // Pace: how fast mastery improves per day (normalized)
        learningPace:      { type: Number, default: 0 },

        // How much retained between sessions (1 − avg forgettingFactor)
        retentionEstimate: { type: Number, default: 0 },

        // Std-dev of recent accuracies inverted: high consistency → low variance
        consistencyScore:  { type: Number, default: 0 },

        // Blend of completion rate and session frequency
        engagementScore:   { type: Number, default: 0 },

        // Avg confidence across all attempts (rescaled to [0,1])
        confidenceScore:   { type: Number, default: 0 },

        // Composite readiness = 0.4·mastery + 0.3·retention + 0.3·consistency
        readinessScore:    { type: Number, default: 0 },
    },

    // ── Aggregate counters ────────────────────────────────────────────────
    totalQuizAttempts:  { type: Number, default: 0 },
    totalTopicsSeen:    { type: Number, default: 0 },
    lastActivityAt:     { type: Date },

    // ── Recommended difficulty per subject ───────────────────────────────
    // { "subjectId": "medium" }
    difficultyBySubject: {
        type: Map,
        of: String,
        default: {},
    },

    // ── Flags / alerts ────────────────────────────────────────────────────
    alerts: [{
        alertType:   { type: String, enum: ['at_risk', 'plateau', 'rapid_decline', 'ready_for_challenge'] },
        topic:       { type: String },
        triggeredAt: { type: Date, default: Date.now },
        isResolved:  { type: Boolean, default: false },
    }],

    // ── LLM study plan (latest) ───────────────────────────────────────────
    latestStudyPlan: {
        generatedAt:  { type: Date },
        studyPlanId:  { type: mongoose.Schema.Types.ObjectId, ref: 'adaptiveStudyPlan' },
        planSummary:  { type: String },  // 1–2 sentence human-readable summary
    },

    // ── Profile version (increment on each full pipeline update) ─────────
    version: { type: Number, default: 1 },

    // Machine-readable explanation of overall profile state
    explanation: { type: String, default: '' },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
studentLearningProfileSchema.index({ schoolId: 1 });
studentLearningProfileSchema.index({ 'scores.overallMastery': 1 });
studentLearningProfileSchema.index({ 'scores.readinessScore': 1 });

module.exports = mongoose.model('studentLearningProfile', studentLearningProfileSchema);
