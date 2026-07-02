/**
 * DifficultyRecommendation Schema
 *
 * Records each recommendation produced by the AdaptiveDifficultyEngine.
 * Storing recommendations separately (not embedded in profiles) allows:
 *   - Offline ablation studies comparing engine versions
 *   - Recommendation acceptance tracking (was the suggestion followed?)
 *   - Audit trail for research reproducibility
 *
 * Decision logic (see AdaptiveDifficultyEngine for full algorithm):
 *
 *   Level thresholds:
 *     easy      mastery < 0.40
 *     medium    0.40 ≤ mastery < 0.65
 *     hard      0.65 ≤ mastery < 0.85
 *     challenge mastery ≥ 0.85
 *
 *   Modifiers applied in order:
 *     1. Trend override  — declining trend drops level by 1
 *     2. Cognitive load  — high load (>3 topics in session) drops level by 1
 *     3. Acceleration    — accelerating trend raises level by 1
 *     4. Bounds clamp    — result clamped to [easy, challenge]
 */

const mongoose = require('mongoose');

const difficultyRecommendationSchema = new mongoose.Schema({
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'student',  required: true },
    subjectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
    schoolId:    { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    topic:       { type: String, required: true },

    // ── Inputs snapshot (recorded for reproducibility) ─────────────────────
    inputMasteryScore:    { type: Number },
    inputTrendType:       { type: String },
    inputCognitiveLoad:   { type: Number },  // number of active topics in session
    inputPrevDifficulty:  { type: String, enum: ['easy', 'medium', 'hard', 'challenge', null], default: null },

    // ── Output ──────────────────────────────────────────────────────────────
    recommendedDifficulty: {
        type:     String,
        enum:     ['easy', 'medium', 'hard', 'challenge'],
        required: true,
    },
    difficultyScore: { type: Number },  // numeric mapping: easy=1, medium=2, hard=3, challenge=4

    // ── Decision trace (machine-readable) ───────────────────────────────────
    decisionTrace: [{
        step:       { type: String },  // e.g. "mastery_threshold", "trend_override"
        reasoning:  { type: String },
        adjustment: { type: Number, default: 0 }, // +1, -1, or 0
    }],

    explanation: { type: String, default: '' },

    // ── Feedback (filled in later if student/teacher rates the recommendation) ─
    wasAccepted:  { type: Boolean, default: null },
    feedback:     { type: String,  default: null },

    recommendedAt: { type: Date, default: Date.now },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
difficultyRecommendationSchema.index({ studentId: 1, topic: 1, recommendedAt: -1 });
difficultyRecommendationSchema.index({ studentId: 1, recommendedAt: -1 });

module.exports = mongoose.model('difficultyRecommendation', difficultyRecommendationSchema);
