/**
 * LearningTrend Schema
 *
 * Stores the result of time-series analysis on a student's quiz performance
 * history for a given subject/topic.
 *
 * Trend classification is done by the LearningTrendAnalyzer service using
 * linear regression on mastery score history and exponential smoothing for
 * short-term signals.
 *
 * Trend types:
 *   improving         — consistent upward slope (β > threshold)
 *   declining         — consistent downward slope (β < -threshold)
 *   stable            — low slope, low variance
 *   accelerating      — positive slope AND increasing velocity
 *   forgetting        — mastery was high, has dropped over time
 *   volatile          — high variance, no consistent direction
 *   insufficient_data — fewer than MIN_DATA_POINTS attempts
 *
 * One document per (studentId, topic) — upserted on each analysis run.
 */

const mongoose = require('mongoose');

// ── Data point used in regression ────────────────────────────────────────────
const trendPointSchema = new mongoose.Schema({
    masteryScore: { type: Number, required: true },
    recordedAt:   { type: Date,   required: true },
    attemptId:    { type: mongoose.Schema.Types.ObjectId, ref: 'quizAttemptDetail' },
}, { _id: false });

const learningTrendSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'student',  required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
    schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    topic:     { type: String, required: true },

    // ── Trend classification ──────────────────────────────────────────────
    trendType: {
        type: String,
        enum: ['improving', 'declining', 'stable', 'accelerating', 'forgetting', 'volatile', 'insufficient_data'],
        default: 'insufficient_data',
    },

    // ── Regression statistics ─────────────────────────────────────────────
    regressionSlope:     { type: Number, default: 0 },    // β₁ of least-squares line
    regressionIntercept: { type: Number, default: 0 },    // β₀
    rSquared:            { type: Number, default: 0 },    // goodness of fit [0,1]

    // ── Smoothed signal (exponential moving average) ──────────────────────
    emaScore:            { type: Number, default: 0 },    // latest EMA value
    emaSmoothingFactor:  { type: Number, default: 0.3 },  // α used in EMA

    // ── Velocity (change rate per day) ───────────────────────────────────
    velocityPerDay:      { type: Number, default: 0 },

    // ── Raw data window (last N mastery snapshots used in analysis) ────────
    dataPoints: {
        type:    [trendPointSchema],
        default: [],
    },
    dataPointCount: { type: Number, default: 0 },

    // ── Detected patterns (can have multiple) ────────────────────────────
    patterns: [{
        patternType: {
            type: String,
            enum: ['weak_area', 'rapid_improvement', 'plateau', 'forgetting_curve', 'consistent_error'],
        },
        confidence:  { type: Number, min: 0, max: 1 },
        detectedAt:  { type: Date, default: Date.now },
        explanation: { type: String },
    }],

    // ── Explainability ────────────────────────────────────────────────────
    explanation: { type: String, default: '' },

    analyzedAt:  { type: Date, default: Date.now },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
learningTrendSchema.index({ studentId: 1, topic: 1 }, { unique: true });
learningTrendSchema.index({ studentId: 1, trendType: 1 });
learningTrendSchema.index({ studentId: 1, subjectId: 1 });

module.exports = mongoose.model('learningTrend', learningTrendSchema);
