/**
 * AdaptiveDifficultyEngine
 *
 * Stage 4 of the adaptive learning pipeline.
 * Recommends the next difficulty level for a given (student, topic) pair.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Algorithm: Multi-Stage Decision Rule with Transparent Trace
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Step 1 — Base level from mastery threshold:
 *   mastery < 0.40          → easy     (numeric = 1)
 *   0.40 ≤ mastery < 0.65   → medium   (numeric = 2)
 *   0.65 ≤ mastery < 0.85   → hard     (numeric = 3)
 *   mastery ≥ 0.85           → challenge (numeric = 4)
 *
 * Step 2 — Trend modifier (applied after base):
 *   declining / forgetting   → −1 (reduce difficulty to prevent discouragement)
 *   accelerating             → +1 (reward rapid improvement)
 *   stable, improving        → 0  (no change)
 *
 * Step 3 — Cognitive load modifier:
 *   activeTopic count > COGNITIVE_LOAD_THRESHOLD → −1
 *   (Student is overloaded; reduce difficulty for this topic)
 *
 * Step 4 — Bounds clamp:
 *   Result clamped to [1 (easy), 4 (challenge)]
 *
 * Step 5 — Previous difficulty inertia:
 *   If recommended equals previous AND consistency is low (<0.4),
 *   keep level the same (don't oscillate).
 *
 * All steps are recorded in decisionTrace for full explainability.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design note: pure function, no DB access, deterministic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const COGNITIVE_LOAD_THRESHOLD = 3;   // topics in one session beyond which load is high

const DIFFICULTY_TO_NUM = {
    easy:      1,
    medium:    2,
    hard:      3,
    challenge: 4,
};

const NUM_TO_DIFFICULTY = {
    1: 'easy',
    2: 'medium',
    3: 'hard',
    4: 'challenge',
};

const MASTERY_THRESHOLDS = [
    { min: 0.85, level: 4, label: 'challenge' },
    { min: 0.65, level: 3, label: 'hard'      },
    { min: 0.40, level: 2, label: 'medium'    },
    { min: 0.00, level: 1, label: 'easy'      },
];

// Trend → adjustment mapping
const TREND_ADJUSTMENTS = {
    declining:          -1,
    forgetting:         -1,
    accelerating:       +1,
    improving:           0,
    stable:              0,
    volatile:           -1,
    insufficient_data:   0,
};

// ── Core recommendation function ──────────────────────────────────────────────
/**
 * Recommend difficulty for the next quiz on this topic.
 *
 * @param {Object} params
 *   @param {number} params.masteryScore        — current mastery [0,1]
 *   @param {string} params.trendType           — from LearningTrendAnalyzer
 *   @param {number} [params.cognitiveLoad]     — number of active topics in session
 *   @param {string} [params.prevDifficulty]    — last recommended difficulty
 *   @param {number} [params.consistencyScore]  — from student profile [0,1]
 *
 * @returns {Object} recommendation with decisionTrace and explanation
 */
function recommendDifficulty({
    masteryScore,
    trendType         = 'stable',
    cognitiveLoad     = 1,
    prevDifficulty    = null,
    consistencyScore  = 0.5,
}) {
    const trace = [];

    // ── Step 1: Base from mastery ──────────────────────────────────────────
    let baseLevel = 1;
    let baseLabel = 'easy';

    for (const { min, level, label } of MASTERY_THRESHOLDS) {
        if (masteryScore >= min) {
            baseLevel = level;
            baseLabel = label;
            break;
        }
    }

    trace.push({
        step: 'mastery_threshold',
        reasoning: `Mastery=${(masteryScore * 100).toFixed(1)}% maps to base difficulty "${baseLabel}" (threshold band).`,
        adjustment: 0,
    });

    let numericLevel = baseLevel;

    // ── Step 2: Trend modifier ────────────────────────────────────────────
    const trendAdj = TREND_ADJUSTMENTS[trendType] ?? 0;

    if (trendAdj !== 0) {
        const direction = trendAdj > 0 ? 'up' : 'down';
        trace.push({
            step: 'trend_override',
            reasoning: `Trend "${trendType}" → adjustment ${trendAdj > 0 ? '+1' : '−1'} (${direction}).`,
            adjustment: trendAdj,
        });
        numericLevel += trendAdj;
    } else {
        trace.push({
            step: 'trend_override',
            reasoning: `Trend "${trendType}" → no adjustment.`,
            adjustment: 0,
        });
    }

    // ── Step 3: Cognitive load modifier ──────────────────────────────────
    if (cognitiveLoad > COGNITIVE_LOAD_THRESHOLD) {
        trace.push({
            step: 'cognitive_load',
            reasoning: `Active topics (${cognitiveLoad}) > threshold (${COGNITIVE_LOAD_THRESHOLD}). Reducing difficulty to manage load.`,
            adjustment: -1,
        });
        numericLevel -= 1;
    } else {
        trace.push({
            step: 'cognitive_load',
            reasoning: `Active topics (${cognitiveLoad}) ≤ threshold (${COGNITIVE_LOAD_THRESHOLD}). No load penalty.`,
            adjustment: 0,
        });
    }

    // ── Step 4: Clamp ─────────────────────────────────────────────────────
    const clampedLevel = Math.min(4, Math.max(1, numericLevel));
    if (clampedLevel !== numericLevel) {
        trace.push({
            step: 'bounds_clamp',
            reasoning: `Computed level ${numericLevel} clamped to [1,4] → ${clampedLevel}.`,
            adjustment: clampedLevel - numericLevel,
        });
        numericLevel = clampedLevel;
    }

    // ── Step 5: Inertia (prevent oscillation on low consistency) ─────────
    if (prevDifficulty && consistencyScore < 0.4) {
        const prevNum = DIFFICULTY_TO_NUM[prevDifficulty];
        if (prevNum !== undefined && Math.abs(prevNum - numericLevel) === 1) {
            trace.push({
                step: 'inertia_guard',
                reasoning: `Consistency (${consistencyScore.toFixed(2)}) < 0.40 and proposed change is ±1 from previous "${prevDifficulty}". Maintaining previous level.`,
                adjustment: prevNum - numericLevel,
            });
            numericLevel = prevNum;
        }
    }

    const recommendedDifficulty = NUM_TO_DIFFICULTY[numericLevel];
    const difficultyScore       = numericLevel;

    // ── Explanation ───────────────────────────────────────────────────────
    const explanation = buildExplanation({
        masteryScore, trendType, cognitiveLoad, prevDifficulty,
        recommendedDifficulty, trace,
    });

    return {
        recommendedDifficulty,
        difficultyScore,
        inputMasteryScore:   masteryScore,
        inputTrendType:      trendType,
        inputCognitiveLoad:  cognitiveLoad,
        inputPrevDifficulty: prevDifficulty,
        decisionTrace: trace,
        explanation,
    };
}

// ── Batch recommendation ──────────────────────────────────────────────────────
/**
 * Recommend difficulty for multiple topics at once.
 * Automatically calculates per-session cognitive load.
 *
 * @param {Array<Object>} topicInputs  — array of recommendDifficulty params + { topic }
 * @returns {Array<{ topic, ...recommendation }>}
 */
function recommendBatch(topicInputs) {
    if (!Array.isArray(topicInputs) || topicInputs.length === 0) return [];
    const cognitiveLoad = topicInputs.length;

    return topicInputs.map(input => ({
        topic: input.topic,
        ...recommendDifficulty({ ...input, cognitiveLoad }),
    }));
}

// ── Explainability ────────────────────────────────────────────────────────────
function buildExplanation({ masteryScore, trendType, cognitiveLoad, prevDifficulty, recommendedDifficulty, trace }) {
    const steps = trace.map(t => `[${t.step}] ${t.reasoning}`).join(' | ');
    return (
        `Recommended: "${recommendedDifficulty}". ` +
        `Inputs: mastery=${(masteryScore * 100).toFixed(1)}%, trend=${trendType}, ` +
        `cogLoad=${cognitiveLoad}, prev=${prevDifficulty || 'none'}. ` +
        `Decision trace: ${steps}`
    );
}

module.exports = {
    recommendDifficulty,
    recommendBatch,
    DIFFICULTY_TO_NUM,
    NUM_TO_DIFFICULTY,
    MASTERY_THRESHOLDS,
    TREND_ADJUSTMENTS,
    COGNITIVE_LOAD_THRESHOLD,
};
