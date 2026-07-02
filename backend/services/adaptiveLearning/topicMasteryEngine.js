/**
 * TopicMasteryEngine
 *
 * Stage 2 of the adaptive learning pipeline.
 * Computes a normalized mastery score ∈ [0,1] for each topic using a
 * Weighted Multi-Factor model.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Mastery Formula
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   M(topic) = w₁·f_accuracy
 *             + w₂·f_consistency
 *             + w₃·f_recency
 *             + w₄·(1 − f_forgetting)
 *             + w₅·f_difficulty
 *             + w₆·f_velocity
 *
 * Factor definitions:
 *
 *   f_accuracy      = correctCount / totalAnswered   (long-run accuracy)
 *
 *   f_consistency   = 1 − σ(recentAccuracies)        where σ = std deviation
 *                     High consistency → low variance in recent attempts
 *                     Uses at most WINDOW_SIZE = 5 recent attempts
 *
 *   f_recency       = exp(−λ · daysSinceLastAttempt)
 *                     Exponential decay. λ = ln(2)/HALF_LIFE_DAYS
 *                     At HALF_LIFE_DAYS days with no attempt → f_recency = 0.5
 *
 *   f_forgetting    = 1 − f_recency  (inverse of recency; high = forgot more)
 *                     Stored separately so the model is explainable.
 *
 *   f_difficulty    = weighted avg of DIFFICULTY_WEIGHT values for attempted Qs
 *                     Answering harder questions correctly earns more mastery.
 *
 *   f_velocity      = clamp(slopeLast3 / MAX_SLOPE, 0, 1)
 *                     Slope of the last-3-attempt accuracy trend line.
 *                     MAX_SLOPE = 0.5 accuracy units/attempt → f_velocity = 1
 *
 * Weights (must sum to 1.0):
 *   w₁ = 0.30  (accuracy is the primary signal)
 *   w₂ = 0.20  (consistency matters for stable mastery)
 *   w₃ = 0.15  (recency rewards fresh knowledge)
 *   w₄ = 0.15  (forgetting penalty)
 *   w₅ = 0.10  (difficulty-adjusted performance)
 *   w₆ = 0.10  (recent improvement velocity)
 *
 * Mastery level thresholds:
 *   [0.00, 0.20) → novice
 *   [0.20, 0.40) → beginner
 *   [0.40, 0.65) → developing
 *   [0.65, 0.85) → proficient
 *   [0.85, 1.00] → expert
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design note: stateless pure functions — DB writes are handled by the caller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { DIFFICULTY_WEIGHT } = require('./evaluationEngine');

// ── Constants ─────────────────────────────────────────────────────────────────
const WEIGHTS = {
    accuracy:    0.30,
    consistency: 0.20,
    recency:     0.15,
    forgetting:  0.15,
    difficulty:  0.10,
    velocity:    0.10,
};

// Sanity check: weights must sum to 1
const WEIGHT_SUM = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1.0) > 1e-6) {
    throw new Error(`TopicMasteryEngine: WEIGHTS must sum to 1.0 (got ${WEIGHT_SUM})`);
}

const WINDOW_SIZE    = 5;      // attempts used for consistency calculation
const HALF_LIFE_DAYS = 14;     // days → f_recency = 0.5 without practice
const LAMBDA         = Math.LN2 / HALF_LIFE_DAYS;
const MAX_SLOPE      = 0.5;    // max accuracy change per attempt (normalizer)

const MASTERY_LEVELS = [
    { threshold: 0.85, label: 'expert' },
    { threshold: 0.65, label: 'proficient' },
    { threshold: 0.40, label: 'developing' },
    { threshold: 0.20, label: 'beginner' },
    { threshold: 0.00, label: 'novice' },
];

// ── Utility: standard deviation ───────────────────────────────────────────────
function stdDev(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

// ── Utility: clamp to [0,1] ───────────────────────────────────────────────────
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ── Factor: accuracy ──────────────────────────────────────────────────────────
/**
 * f_accuracy = correctCount / max(totalAnswered, 1)
 * @param {number} totalCorrect
 * @param {number} totalAnswered
 * @returns {number} [0,1]
 */
function factorAccuracy(totalCorrect, totalAnswered) {
    if (totalAnswered <= 0) return 0;
    return clamp01(totalCorrect / totalAnswered);
}

// ── Factor: consistency ───────────────────────────────────────────────────────
/**
 * f_consistency = 1 − σ(recentAccuracies)
 * A student who always scores 0.8 has σ=0 → f_consistency=1
 * A student oscillating 0–1 has σ≈0.5 → f_consistency≈0.5
 *
 * @param {number[]} recentAccuracies — up to WINDOW_SIZE recent accuracy values
 * @returns {number} [0,1]
 */
function factorConsistency(recentAccuracies) {
    if (recentAccuracies.length < 2) return 0.5; // insufficient data → neutral
    const window = recentAccuracies.slice(-WINDOW_SIZE);
    const sigma  = stdDev(window);
    return clamp01(1 - sigma);
}

// ── Factor: recency ───────────────────────────────────────────────────────────
/**
 * f_recency = exp(−λ · daysSinceLastAttempt)
 * Models temporal knowledge decay.
 *
 * @param {Date|null} lastSeenAt — date of most recent attempt on this topic
 * @param {Date}      now        — current datetime (injectable for testing)
 * @returns {number} [0,1]
 */
function factorRecency(lastSeenAt, now = new Date()) {
    if (!lastSeenAt) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    const days     = (now.getTime() - new Date(lastSeenAt).getTime()) / msPerDay;
    if (days < 0) return 1;  // future date edge case
    return clamp01(Math.exp(-LAMBDA * days));
}

// ── Factor: forgetting ────────────────────────────────────────────────────────
/**
 * f_forgetting = 1 − f_recency
 * High value means the student has not practised this topic recently.
 *
 * @param {number} recencyFactor — output of factorRecency()
 * @returns {number} [0,1]
 */
function factorForgetting(recencyFactor) {
    return clamp01(1 - recencyFactor);
}

// ── Factor: difficulty weight ─────────────────────────────────────────────────
/**
 * f_difficulty = weighted average of difficulty scores for all answered questions.
 * Answers to harder questions contribute more positively to mastery when correct.
 * This implementation uses avg difficulty of ALL attempted questions (correct + incorrect)
 * to represent the level at which the student has been tested.
 *
 * @param {string[]} difficultyLevels — difficulty of each answered question
 * @returns {number} [0,1]
 */
function factorDifficulty(difficultyLevels) {
    if (difficultyLevels.length === 0) return DIFFICULTY_WEIGHT.medium; // baseline
    const sum = difficultyLevels.reduce((acc, d) => acc + (DIFFICULTY_WEIGHT[d] || DIFFICULTY_WEIGHT.medium), 0);
    return clamp01(sum / difficultyLevels.length);
}

// ── Factor: learning velocity ─────────────────────────────────────────────────
/**
 * f_velocity = clamp(slope_of_last_3_accuracies / MAX_SLOPE, 0, 1)
 *
 * Uses the slope of a simple linear fit through the last 3 accuracy values.
 * If fewer than 3 points exist, returns 0.5 (neutral).
 * Negative slope → velocity = 0 (penalised by forgetting instead).
 *
 * Simple 3-point slope = (last − first) / (n − 1)
 *
 * @param {number[]} recentAccuracies — chronological list of recent accuracies
 * @returns {number} [0,1]
 */
function factorVelocity(recentAccuracies) {
    if (recentAccuracies.length < 3) return 0.5;
    const last3 = recentAccuracies.slice(-3);
    const slope = (last3[2] - last3[0]) / 2;  // rise over 2 steps
    if (slope <= 0) return 0;  // no improvement → 0 velocity
    return clamp01(slope / MAX_SLOPE);
}

// ── Mastery level label ───────────────────────────────────────────────────────
/**
 * Map a numeric mastery score to a human-readable level.
 * @param {number} score — [0,1]
 * @returns {string}
 */
function masteryLevel(score) {
    for (const { threshold, label } of MASTERY_LEVELS) {
        if (score >= threshold) return label;
    }
    return 'novice';
}

// ── Main: compute mastery for one topic ───────────────────────────────────────
/**
 * Compute mastery score for a single (student, topic) pair.
 *
 * @param {Object} currentRecord   — current TopicMastery DB doc (or null for new topic)
 *   @param {number}   currentRecord.totalCorrect
 *   @param {number}   currentRecord.totalQuestions
 *   @param {number[]} currentRecord.recentAccuracies
 *   @param {Date}     currentRecord.lastSeenAt
 *   @param {Date}     currentRecord.firstSeenAt
 *
 * @param {Object} latestAttemptTopicData  — from metrics.topicBreakdown[topic]
 *   @param {number} latestAttemptTopicData.correct
 *   @param {number} latestAttemptTopicData.total
 *   @param {string[]} latestAttemptTopicData.difficultyLevels  (optional)
 *
 * @param {Object} [opts]
 *   @param {Date} [opts.now]  — injectable current time (for testing)
 *
 * @returns {Object} mastery result with all factor scores, explanation
 */
function computeTopicMastery(currentRecord, latestAttemptTopicData, opts = {}) {
    const now = opts.now || new Date();

    // ── Merge new attempt data into running totals ────────────────────────
    const prevCorrect   = (currentRecord?.totalCorrect   || 0);
    const prevQuestions = (currentRecord?.totalQuestions || 0);

    const newCorrect   = latestAttemptTopicData.correct || 0;
    const newTotal     = latestAttemptTopicData.total   || 0;
    const newAnswered  = newTotal - (latestAttemptTopicData.skipped || 0);

    const totalCorrect   = prevCorrect   + newCorrect;
    const totalQuestions = prevQuestions + newTotal;
    const totalAnswered  = totalQuestions - ((currentRecord?.totalSkipped || 0) + (latestAttemptTopicData.skipped || 0));

    // ── Update rolling accuracy window ────────────────────────────────────
    const prevAccuracies = Array.isArray(currentRecord?.recentAccuracies)
        ? currentRecord.recentAccuracies.slice(-WINDOW_SIZE)
        : [];

    const attemptAccuracy = newAnswered > 0
        ? clamp01(newCorrect / newAnswered)
        : 0;

    const recentAccuracies = [...prevAccuracies, attemptAccuracy].slice(-WINDOW_SIZE);

    // ── Difficulty levels of newly attempted questions ────────────────────
    const difficultyLevels = latestAttemptTopicData.difficultyLevels || [];

    // ── Compute all factors ───────────────────────────────────────────────
    const f_accuracy    = factorAccuracy(totalCorrect, Math.max(totalAnswered, newAnswered));
    const f_consistency = factorConsistency(recentAccuracies);
    const f_recency     = factorRecency(now, now);                 // just attempted → 1.0
    const f_forgetting  = factorForgetting(f_recency);
    const f_difficulty  = factorDifficulty(difficultyLevels);
    const f_velocity    = factorVelocity(recentAccuracies);

    // ── Weighted sum ──────────────────────────────────────────────────────
    const masteryScore = parseFloat((
        WEIGHTS.accuracy    * f_accuracy    +
        WEIGHTS.consistency * f_consistency +
        WEIGHTS.recency     * f_recency     +
        WEIGHTS.forgetting  * (1 - f_forgetting) +   // (1 − forgetting) = benefit from recency
        WEIGHTS.difficulty  * f_difficulty  +
        WEIGHTS.velocity    * f_velocity
    ).toFixed(4));

    const level = masteryLevel(masteryScore);

    // ── Explainability ────────────────────────────────────────────────────
    const explanation = buildExplanation({
        masteryScore, level,
        f_accuracy, f_consistency, f_recency, f_forgetting, f_difficulty, f_velocity,
        totalCorrect, totalAnswered: Math.max(totalAnswered, newAnswered),
    });

    return {
        masteryScore,
        masteryLevel: level,
        totalCorrect,
        totalQuestions,
        recentAccuracies,
        lastSeenAt: now,
        firstSeenAt: currentRecord?.firstSeenAt || now,
        factors: {
            accuracy:         parseFloat(f_accuracy.toFixed(4)),
            consistency:      parseFloat(f_consistency.toFixed(4)),
            recency:          parseFloat(f_recency.toFixed(4)),
            forgettingFactor: parseFloat(f_forgetting.toFixed(4)),
            difficultyWeight: parseFloat(f_difficulty.toFixed(4)),
            learningVelocity: parseFloat(f_velocity.toFixed(4)),
        },
        explanation,
    };
}

// ── Explainability builder ────────────────────────────────────────────────────
function buildExplanation({ masteryScore, level, f_accuracy, f_consistency, f_recency,
    f_forgetting, f_difficulty, f_velocity, totalCorrect, totalAnswered }) {
    const pct = (v) => (v * 100).toFixed(1) + '%';

    const parts = [
        `Mastery: ${pct(masteryScore)} (${level}).`,
        `Accuracy=${pct(f_accuracy)} over ${totalAnswered} answered (w=0.30).`,
        `Consistency=${pct(f_consistency)} (σ of recent accuracies, w=0.20).`,
        `Recency=${pct(f_recency)} (${HALF_LIFE_DAYS}-day half-life, w=0.15).`,
        `Forgetting=${pct(f_forgetting)} (1−recency, w=0.15).`,
        `Difficulty=${pct(f_difficulty)} (avg difficulty weight, w=0.10).`,
        `Velocity=${pct(f_velocity)} (accuracy slope last 3 attempts, w=0.10).`,
    ];

    return parts.join(' ');
}

/**
 * Compute mastery from scratch when there is no prior record
 * (convenience wrapper for first-time topics).
 *
 * @param {Object} attemptTopicData — from metrics.topicBreakdown[topic]
 * @param {Object} [opts]
 * @returns {Object} mastery result
 */
function computeInitialMastery(attemptTopicData, opts = {}) {
    return computeTopicMastery(null, attemptTopicData, opts);
}

module.exports = {
    computeTopicMastery,
    computeInitialMastery,
    factorAccuracy,
    factorConsistency,
    factorRecency,
    factorForgetting,
    factorDifficulty,
    factorVelocity,
    masteryLevel,
    WEIGHTS,
    HALF_LIFE_DAYS,
    LAMBDA,
    WINDOW_SIZE,
};
