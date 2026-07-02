/**
 * LearningTrendAnalyzer
 *
 * Stage 3 of the adaptive learning pipeline.
 * Performs time-series analysis on mastery score history to identify
 * learning patterns.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Algorithm Overview
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. Linear Regression (OLS)
 *    Fit a line M(t) = β₀ + β₁·t to the mastery score history.
 *    t is measured in days from the first observation.
 *    β₁ is the slope (mastery change per day).
 *    R² measures goodness of fit.
 *
 * 2. Exponential Moving Average (EMA)
 *    ema(t) = α · score(t) + (1 − α) · ema(t−1)
 *    α = EMA_ALPHA = 0.3 (gives more weight to recent observations)
 *    Smoothed signal removes noise from single-session outliers.
 *
 * 3. Trend classification rules (deterministic, in priority order):
 *    insufficient_data  n < MIN_DATA_POINTS (3)
 *    accelerating       β₁ > ACCEL_THRESHOLD AND velocity is increasing
 *    improving          β₁ > SLOPE_THRESHOLD AND R² > R2_THRESHOLD
 *    forgetting         score was > PEAK_THRESHOLD and dropped by > FORGET_DROP
 *    declining          β₁ < -SLOPE_THRESHOLD AND R² > R2_THRESHOLD
 *    volatile           std_dev(scores) > VOLATILITY_THRESHOLD
 *    stable             |β₁| ≤ SLOPE_THRESHOLD
 *
 * 4. Pattern detection (independent of trend type):
 *    weak_area          latest mastery < WEAK_THRESHOLD (0.40)
 *    rapid_improvement  slope > RAPID_IMPROVE_SLOPE (0.05/day)
 *    plateau            |β₁| < PLATEAU_SLOPE AND R² > 0.5
 *    forgetting_curve   forgettingFactor > 0.6 in mastery record
 *    consistent_error   accuracy stayed below 0.35 across all attempts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design note: pure functions, no DB access. All outputs are fully serializable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const EMA_ALPHA           = 0.3;
const MIN_DATA_POINTS     = 3;
const SLOPE_THRESHOLD     = 0.003;   // mastery units per day
const ACCEL_THRESHOLD     = 0.006;
const RAPID_IMPROVE_SLOPE = 0.05;
const R2_THRESHOLD        = 0.25;    // minimum fit quality to trust slope
const VOLATILITY_THRESHOLD = 0.15;  // std-dev of mastery scores
const WEAK_THRESHOLD      = 0.40;
const PEAK_THRESHOLD      = 0.60;
const FORGET_DROP         = 0.15;   // drop from peak that signals forgetting
const PLATEAU_SLOPE       = 0.001;
const LOW_ACCURACY_MARK   = 0.35;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Utility: OLS linear regression on (x, y) pairs ───────────────────────────
/**
 * Ordinary Least Squares regression.
 * @param {number[]} xs — independent variable (days from first point)
 * @param {number[]} ys — dependent variable (mastery scores)
 * @returns {{ slope: number, intercept: number, rSquared: number }}
 */
function olsRegression(xs, ys) {
    const n = xs.length;
    if (n < 2) return { slope: 0, intercept: ys[0] || 0, rSquared: 0 };

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let ssXX = 0, ssXY = 0, ssYY = 0;
    for (let i = 0; i < n; i++) {
        ssXX += (xs[i] - meanX) ** 2;
        ssXY += (xs[i] - meanX) * (ys[i] - meanY);
        ssYY += (ys[i] - meanY) ** 2;
    }

    const slope     = ssXX === 0 ? 0 : ssXY / ssXX;
    const intercept = meanY - slope * meanX;
    const rSquared  = ssYY === 0 ? 1 : Math.min(1, Math.max(0, (ssXY ** 2) / (ssXX * ssYY)));

    return {
        slope:     parseFloat(slope.toFixed(6)),
        intercept: parseFloat(intercept.toFixed(6)),
        rSquared:  parseFloat(rSquared.toFixed(4)),
    };
}

// ── Utility: EMA ─────────────────────────────────────────────────────────────
/**
 * Compute EMA for a series of values.
 * @param {number[]} values — chronological series
 * @param {number}   alpha  — smoothing factor (0 < α < 1)
 * @returns {number} latest EMA value
 */
function computeEMA(values, alpha = EMA_ALPHA) {
    if (values.length === 0) return 0;
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
        ema = alpha * values[i] + (1 - alpha) * ema;
    }
    return parseFloat(ema.toFixed(4));
}

// ── Utility: std dev ──────────────────────────────────────────────────────────
function stdDev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

// ── Core: trend classification ────────────────────────────────────────────────
/**
 * Classify the learning trend from regression statistics and raw scores.
 *
 * @param {Object} params
 * @returns {{ trendType: string, explanation: string }}
 */
function classifyTrend({ n, slope, rSquared, scores, emaScore, forgettingFactor = 0 }) {

    if (n < MIN_DATA_POINTS) {
        return {
            trendType:   'insufficient_data',
            explanation: `Only ${n} data point(s) available; need ≥ ${MIN_DATA_POINTS} to classify trend.`,
        };
    }

    const sigma  = stdDev(scores);
    const latest = scores[scores.length - 1];
    const peak   = Math.max(...scores);

    // Priority 1: Accelerating
    if (slope > ACCEL_THRESHOLD && rSquared > R2_THRESHOLD) {
        return {
            trendType:   'accelerating',
            explanation: `Slope ${slope.toFixed(5)}/day exceeds acceleration threshold (${ACCEL_THRESHOLD}). R²=${rSquared.toFixed(2)}.`,
        };
    }

    // Priority 2: Improving
    if (slope > SLOPE_THRESHOLD && rSquared > R2_THRESHOLD) {
        return {
            trendType:   'improving',
            explanation: `Positive slope ${slope.toFixed(5)}/day (threshold ${SLOPE_THRESHOLD}). R²=${rSquared.toFixed(2)}.`,
        };
    }

    // Priority 3: Forgetting (was above peak, then dropped)
    if (peak >= PEAK_THRESHOLD && (peak - latest) >= FORGET_DROP) {
        return {
            trendType:   'forgetting',
            explanation: `Peak mastery was ${(peak * 100).toFixed(1)}%; current ${(latest * 100).toFixed(1)}%. Drop of ${((peak - latest) * 100).toFixed(1)}% ≥ ${FORGET_DROP * 100}% threshold.`,
        };
    }

    // Priority 4: Declining
    if (slope < -SLOPE_THRESHOLD && rSquared > R2_THRESHOLD) {
        return {
            trendType:   'declining',
            explanation: `Negative slope ${slope.toFixed(5)}/day below threshold (−${SLOPE_THRESHOLD}). R²=${rSquared.toFixed(2)}.`,
        };
    }

    // Priority 5: Volatile
    if (sigma > VOLATILITY_THRESHOLD) {
        return {
            trendType:   'volatile',
            explanation: `High variance (σ=${sigma.toFixed(3)}) exceeds volatility threshold (${VOLATILITY_THRESHOLD}).`,
        };
    }

    // Priority 6: Stable (default)
    return {
        trendType:   'stable',
        explanation: `Slope=${slope.toFixed(5)}/day (< threshold), σ=${sigma.toFixed(3)}. Mastery is stable.`,
    };
}

// ── Core: pattern detection ───────────────────────────────────────────────────
/**
 * Detect specific learning patterns (independent of trend type).
 * Multiple patterns can coexist.
 *
 * @param {Object} params
 * @returns {Array<{ patternType, confidence, explanation }>}
 */
function detectPatterns({ scores, slope, masteryRecord, recentAccuracies = [] }) {
    const patterns = [];
    const latest   = scores[scores.length - 1];

    // Weak area
    if (latest < WEAK_THRESHOLD) {
        patterns.push({
            patternType:  'weak_area',
            confidence:   parseFloat((1 - latest / WEAK_THRESHOLD).toFixed(3)),
            explanation:  `Current mastery ${(latest * 100).toFixed(1)}% < ${WEAK_THRESHOLD * 100}% weak-area threshold.`,
        });
    }

    // Rapid improvement
    if (slope > RAPID_IMPROVE_SLOPE) {
        patterns.push({
            patternType:  'rapid_improvement',
            confidence:   Math.min(1, parseFloat((slope / (RAPID_IMPROVE_SLOPE * 2)).toFixed(3))),
            explanation:  `Slope ${(slope * 1000).toFixed(1)} mastery-units/1000-days exceeds rapid-improvement threshold.`,
        });
    }

    // Plateau
    if (Math.abs(slope) < PLATEAU_SLOPE && scores.length >= MIN_DATA_POINTS) {
        patterns.push({
            patternType:  'plateau',
            confidence:   parseFloat((1 - Math.abs(slope) / SLOPE_THRESHOLD).toFixed(3)),
            explanation:  `|Slope|=${Math.abs(slope).toFixed(6)}/day below plateau threshold (${PLATEAU_SLOPE}). Progress has stalled.`,
        });
    }

    // Forgetting curve (forgetting factor from mastery record)
    const ff = masteryRecord?.factors?.forgettingFactor;
    if (ff !== undefined && ff > 0.6) {
        patterns.push({
            patternType:  'forgetting_curve',
            confidence:   parseFloat(Math.min(1, ff).toFixed(3)),
            explanation:  `Forgetting factor=${ff.toFixed(2)} (> 0.60). Student has not recently practised this topic.`,
        });
    }

    // Consistent error
    const allLow = recentAccuracies.length >= 3 && recentAccuracies.every(a => a < LOW_ACCURACY_MARK);
    if (allLow) {
        patterns.push({
            patternType:  'consistent_error',
            confidence:   parseFloat((1 - (recentAccuracies.reduce((a, b) => a + b, 0) / recentAccuracies.length) / LOW_ACCURACY_MARK).toFixed(3)),
            explanation:  `All ${recentAccuracies.length} recent attempt accuracies below ${LOW_ACCURACY_MARK * 100}% — consistent error pattern.`,
        });
    }

    return patterns;
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Analyse the learning trend for one (student, topic) pair.
 *
 * @param {Object} params
 *   @param {Array<{ masteryScore, recordedAt }>} params.dataPoints  — sorted chronologically
 *   @param {Object}  params.masteryRecord    — current TopicMastery doc (for factors)
 *   @param {number[]} params.recentAccuracies — from TopicMastery.recentAccuracies
 *
 * @returns {Object} trend analysis result (ready to upsert into LearningTrend)
 */
function analyzeTrend({ dataPoints, masteryRecord = {}, recentAccuracies = [] }) {
    if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
        return {
            trendType:           'insufficient_data',
            regressionSlope:     0,
            regressionIntercept: 0,
            rSquared:            0,
            emaScore:            0,
            velocityPerDay:      0,
            dataPointCount:      0,
            patterns:            [],
            explanation:         'No data points provided.',
        };
    }

    const n = dataPoints.length;

    // Sort by date ascending (safety guard)
    const sorted = [...dataPoints].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    const t0     = new Date(sorted[0].recordedAt).getTime();
    const xs     = sorted.map(p => (new Date(p.recordedAt).getTime() - t0) / MS_PER_DAY);
    const scores = sorted.map(p => p.masteryScore);

    const { slope, intercept, rSquared } = olsRegression(xs, scores);
    const emaScore = computeEMA(scores);

    const { trendType, explanation: trendExplanation } = classifyTrend({
        n, slope, rSquared, scores, emaScore,
        forgettingFactor: masteryRecord?.factors?.forgettingFactor,
    });

    const patterns = detectPatterns({ scores, slope, masteryRecord, recentAccuracies });

    const explanation = [
        trendExplanation,
        patterns.length > 0
            ? `Patterns: ${patterns.map(p => p.patternType).join(', ')}.`
            : 'No special patterns detected.',
    ].join(' ');

    return {
        trendType,
        regressionSlope:     slope,
        regressionIntercept: intercept,
        rSquared,
        emaScore,
        emaSmoothingFactor:  EMA_ALPHA,
        velocityPerDay:      slope,  // alias for readability in profile
        dataPointCount:      n,
        patterns:            patterns.map(p => ({ ...p, detectedAt: new Date() })),
        explanation,
    };
}

module.exports = {
    analyzeTrend,
    olsRegression,
    computeEMA,
    classifyTrend,
    detectPatterns,
    EMA_ALPHA,
    MIN_DATA_POINTS,
    SLOPE_THRESHOLD,
    WEAK_THRESHOLD,
};
