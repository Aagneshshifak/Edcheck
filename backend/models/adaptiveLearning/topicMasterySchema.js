/**
 * TopicMastery Schema
 *
 * Persists the normalized mastery score [0,1] for every (student, topic) pair,
 * along with all intermediate factor scores so that the computation is
 * fully explainable and auditable.
 *
 * Mastery model (Weighted Multi-Factor):
 *
 *   M(t) = w1·accuracy(t)
 *         + w2·consistency(t)
 *         + w3·recency(t)
 *         + w4·(1 − forgettingFactor(t))
 *         + w5·difficultyWeight(t)
 *         + w6·learningVelocity(t)
 *
 *   All factor values ∈ [0,1].  Weights sum to 1.
 *
 * Each document represents one topic for one student.
 * The record is upserted after every quiz attempt involving that topic.
 *
 * See: TopicMasteryEngine for computation logic.
 */

const mongoose = require('mongoose');

// ── Sub-schema: one mastery snapshot ─────────────────────────────────────────
const masterySnapshotSchema = new mongoose.Schema({
    masteryScore:    { type: Number, required: true },  // [0,1]
    computedAt:      { type: Date,   default: Date.now },

    // Factor scores (all [0,1])
    accuracy:         { type: Number },
    consistency:      { type: Number },
    recency:          { type: Number },
    forgettingFactor: { type: Number }, // higher = more forgetting
    difficultyWeight: { type: Number },
    learningVelocity: { type: Number },

    // The attempt that triggered this update
    triggerAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'quizAttemptDetail' },
}, { _id: false });

// ── Main schema ───────────────────────────────────────────────────────────────
const topicMasterySchema = new mongoose.Schema({
    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'student',  required: true },
    subjectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
    schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },

    topic:      { type: String, required: true },

    // ── Current mastery state ─────────────────────────────────────────────
    masteryScore:  { type: Number, default: 0, min: 0, max: 1 },
    masteryLevel:  {
        type: String,
        enum: ['novice', 'beginner', 'developing', 'proficient', 'expert'],
        default: 'novice',
    },

    // ── Raw counters (used in factor computations) ─────────────────────────
    totalAttempts:    { type: Number, default: 0 },
    totalCorrect:     { type: Number, default: 0 },
    totalQuestions:   { type: Number, default: 0 },

    // Rolling window: last 5 attempt accuracy values for consistency calc
    recentAccuracies: { type: [Number], default: [] },

    // Timestamps
    firstSeenAt:  { type: Date },
    lastSeenAt:   { type: Date },
    lastCorrectAt: { type: Date },

    // ── Factor scores (latest computation) ───────────────────────────────
    factors: {
        accuracy:         { type: Number, default: 0 },
        consistency:      { type: Number, default: 0 },
        recency:          { type: Number, default: 0 },
        forgettingFactor: { type: Number, default: 0 },
        difficultyWeight: { type: Number, default: 0 },
        learningVelocity: { type: Number, default: 0 },
    },

    // ── History: last 20 snapshots (for trend analysis) ──────────────────
    history: {
        type:    [masterySnapshotSchema],
        default: [],
        validate: {
            validator: (arr) => arr.length <= 20,
            message: 'history capped at 20 entries',
        },
    },

    // Explainability: why the current mastery score is what it is
    explanation: { type: String, default: '' },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
topicMasterySchema.index({ studentId: 1, topic: 1 }, { unique: true });
topicMasterySchema.index({ studentId: 1, masteryScore: 1 });
topicMasterySchema.index({ studentId: 1, subjectId: 1 });
topicMasterySchema.index({ schoolId: 1 });

module.exports = mongoose.model('topicMastery', topicMasterySchema);
