/**
 * Unit tests for LearningTrendAnalyzer
 *
 * Run with: node --test tests/adaptiveLearning/learningTrendAnalyzer.test.js
 *
 * Tests cover:
 *   - OLS regression on clean linear data
 *   - EMA computation
 *   - Trend classification (improving, declining, stable, accelerating, forgetting, volatile)
 *   - Pattern detection (weak_area, rapid_improvement, plateau, forgetting_curve, consistent_error)
 *   - Edge cases: empty data, single point, MIN_DATA_POINTS boundary
 */

'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const {
    analyzeTrend,
    olsRegression,
    computeEMA,
    classifyTrend,
    detectPatterns,
    MIN_DATA_POINTS,
    WEAK_THRESHOLD,
} = require('../../services/adaptiveLearning/learningTrendAnalyzer');

// ── Helpers ───────────────────────────────────────────────────────────────────
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeDataPoints(scores, startDate = new Date('2025-01-01')) {
    return scores.map((masteryScore, i) => ({
        masteryScore,
        recordedAt: new Date(startDate.getTime() + i * MS_PER_DAY),
    }));
}

// ── OLS Regression ────────────────────────────────────────────────────────────
describe('olsRegression', () => {
    test('perfect positive linear data', () => {
        const xs = [0, 1, 2, 3, 4];
        const ys = [0, 0.2, 0.4, 0.6, 0.8];
        const { slope, rSquared } = olsRegression(xs, ys);
        assert.ok(Math.abs(slope - 0.2) < 0.001, `slope should ≈ 0.2, got ${slope}`);
        assert.ok(rSquared > 0.99);
    });

    test('flat data → slope ≈ 0', () => {
        const xs = [0, 1, 2, 3];
        const ys = [0.5, 0.5, 0.5, 0.5];
        const { slope } = olsRegression(xs, ys);
        assert.ok(Math.abs(slope) < 0.001);
    });

    test('single point → slope = 0', () => {
        const { slope, rSquared } = olsRegression([0], [0.5]);
        assert.equal(slope, 0);
        assert.equal(rSquared, 0);
    });

    test('negative slope', () => {
        const xs = [0, 1, 2, 3];
        const ys = [0.8, 0.6, 0.4, 0.2];
        const { slope } = olsRegression(xs, ys);
        assert.ok(slope < 0);
    });
});

// ── EMA ───────────────────────────────────────────────────────────────────────
describe('computeEMA', () => {
    test('single value → itself', () => {
        assert.equal(computeEMA([0.7]), 0.7);
    });

    test('EMA is closer to recent values', () => {
        // Series going 0.3 → 0.8; EMA should be closer to 0.8
        const ema = computeEMA([0.3, 0.3, 0.3, 0.8]);
        assert.ok(ema > 0.4, `Expected > 0.4, got ${ema}`);
    });

    test('empty array → 0', () => {
        assert.equal(computeEMA([]), 0);
    });
});

// ── Trend classification ──────────────────────────────────────────────────────
describe('classifyTrend', () => {
    test('insufficient_data for n < MIN_DATA_POINTS', () => {
        const { trendType } = classifyTrend({ n: 2, slope: 0.01, rSquared: 0.9, scores: [0.3, 0.4], emaScore: 0.4 });
        assert.equal(trendType, 'insufficient_data');
    });

    test('improving trend', () => {
        const { trendType } = classifyTrend({ n: 5, slope: 0.005, rSquared: 0.9, scores: [0.2, 0.35, 0.4, 0.5, 0.55], emaScore: 0.5 });
        assert.equal(trendType, 'improving');
    });

    test('declining trend', () => {
        // Data that clearly declines without a high peak (avoids forgetting classification)
        const { trendType } = classifyTrend({ n: 5, slope: -0.005, rSquared: 0.9, scores: [0.4, 0.38, 0.35, 0.32, 0.28], emaScore: 0.3 });
        assert.equal(trendType, 'declining');
    });

    test('stable trend', () => {
        const { trendType } = classifyTrend({ n: 5, slope: 0.0005, rSquared: 0.1, scores: [0.5, 0.51, 0.5, 0.49, 0.5], emaScore: 0.5 });
        assert.equal(trendType, 'stable');
    });

    test('forgetting trend (was high, dropped)', () => {
        const { trendType } = classifyTrend({
            n: 5,
            slope: -0.003,
            rSquared: 0.3,
            scores: [0.8, 0.75, 0.7, 0.65, 0.6],
            emaScore: 0.65,
        });
        assert.equal(trendType, 'forgetting');
    });
});

// ── Pattern detection ─────────────────────────────────────────────────────────
describe('detectPatterns', () => {
    test('weak_area detected for low mastery', () => {
        const patterns = detectPatterns({
            scores: [0.3, 0.28, 0.25],
            slope: -0.002,
            masteryRecord: { factors: { forgettingFactor: 0 } },
            recentAccuracies: [],
        });
        const types = patterns.map(p => p.patternType);
        assert.ok(types.includes('weak_area'), `Expected weak_area, got ${JSON.stringify(types)}`);
    });

    test('rapid_improvement detected for high slope', () => {
        const patterns = detectPatterns({
            scores: [0.2, 0.4, 0.7],
            slope: 0.1,
            masteryRecord: {},
            recentAccuracies: [],
        });
        const types = patterns.map(p => p.patternType);
        assert.ok(types.includes('rapid_improvement'), `Expected rapid_improvement, got ${JSON.stringify(types)}`);
    });

    test('forgetting_curve detected for high forgetting factor', () => {
        const patterns = detectPatterns({
            scores: [0.7, 0.65, 0.6],
            slope: -0.001,
            masteryRecord: { factors: { forgettingFactor: 0.8 } },
            recentAccuracies: [],
        });
        const types = patterns.map(p => p.patternType);
        assert.ok(types.includes('forgetting_curve'), `Expected forgetting_curve, got ${JSON.stringify(types)}`);
    });

    test('consistent_error detected for all low accuracies', () => {
        const patterns = detectPatterns({
            scores: [0.3, 0.31, 0.28],
            slope: 0,
            masteryRecord: {},
            recentAccuracies: [0.2, 0.25, 0.18],
        });
        const types = patterns.map(p => p.patternType);
        assert.ok(types.includes('consistent_error'), `Expected consistent_error, got ${JSON.stringify(types)}`);
    });
});

// ── Full analyzeTrend ─────────────────────────────────────────────────────────
describe('analyzeTrend', () => {
    test('returns insufficient_data for empty dataPoints', () => {
        const result = analyzeTrend({ dataPoints: [], masteryRecord: {} });
        assert.equal(result.trendType, 'insufficient_data');
    });

    test('returns insufficient_data for too few points', () => {
        const result = analyzeTrend({
            dataPoints: makeDataPoints([0.4, 0.5]),
            masteryRecord: {},
        });
        assert.equal(result.trendType, 'insufficient_data');
    });

    test('detects improving trend on rising data', () => {
        const points = makeDataPoints([0.2, 0.3, 0.4, 0.5, 0.6]);
        const result = analyzeTrend({ dataPoints: points, masteryRecord: {} });
        assert.ok(
            ['improving', 'accelerating'].includes(result.trendType),
            `Expected improving/accelerating, got ${result.trendType}`
        );
        assert.ok(result.regressionSlope > 0);
    });

    test('detects declining trend on falling data', () => {
        const points = makeDataPoints([0.8, 0.7, 0.6, 0.5, 0.4]);
        const result = analyzeTrend({ dataPoints: points, masteryRecord: {} });
        assert.ok(
            ['declining', 'forgetting'].includes(result.trendType),
            `Expected declining/forgetting, got ${result.trendType}`
        );
    });

    test('result has all required fields', () => {
        const result = analyzeTrend({
            dataPoints:      makeDataPoints([0.3, 0.4, 0.5]),
            masteryRecord:   {},
            recentAccuracies: [0.3, 0.4],
        });

        const requiredFields = [
            'trendType', 'regressionSlope', 'regressionIntercept',
            'rSquared', 'emaScore', 'velocityPerDay', 'dataPointCount',
            'patterns', 'explanation',
        ];
        for (const f of requiredFields) {
            assert.ok(f in result, `Missing field: ${f}`);
        }
    });

    test('patterns is always an array', () => {
        const result = analyzeTrend({
            dataPoints: makeDataPoints([0.5, 0.5, 0.5]),
            masteryRecord: {},
        });
        assert.ok(Array.isArray(result.patterns));
    });
});
