/**
 * Unit tests for AdaptiveDifficultyEngine
 *
 * Run with: node --test tests/adaptiveLearning/adaptiveDifficultyEngine.test.js
 *
 * Tests cover:
 *   - Mastery threshold mapping
 *   - Trend modifier application
 *   - Cognitive load modifier
 *   - Inertia guard (low consistency, ±1 change)
 *   - Bounds clamping
 *   - Decision trace structure
 *   - Batch recommendations
 */

'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const {
    recommendDifficulty,
    recommendBatch,
    DIFFICULTY_TO_NUM,
    COGNITIVE_LOAD_THRESHOLD,
} = require('../../services/adaptiveLearning/adaptiveDifficultyEngine');

// ── Mastery threshold mapping ─────────────────────────────────────────────────
describe('mastery threshold → base level', () => {
    const cases = [
        { mastery: 0.10, expected: 'easy' },
        { mastery: 0.39, expected: 'easy' },
        { mastery: 0.40, expected: 'medium' },
        { mastery: 0.64, expected: 'medium' },
        { mastery: 0.65, expected: 'hard' },
        { mastery: 0.84, expected: 'hard' },
        { mastery: 0.85, expected: 'challenge' },
        { mastery: 1.00, expected: 'challenge' },
    ];

    for (const { mastery, expected } of cases) {
        test(`mastery=${mastery} → ${expected}`, () => {
            const rec = recommendDifficulty({ masteryScore: mastery, trendType: 'stable' });
            assert.equal(rec.recommendedDifficulty, expected, rec.explanation);
        });
    }
});

// ── Trend modifier ────────────────────────────────────────────────────────────
describe('trend modifier', () => {
    test('declining trend reduces difficulty', () => {
        const rec = recommendDifficulty({ masteryScore: 0.70, trendType: 'declining' });
        assert.ok(
            DIFFICULTY_TO_NUM[rec.recommendedDifficulty] <= DIFFICULTY_TO_NUM['hard'],
            `Expected ≤ hard, got ${rec.recommendedDifficulty}`
        );
    });

    test('forgetting trend reduces difficulty', () => {
        const rec = recommendDifficulty({ masteryScore: 0.70, trendType: 'forgetting' });
        assert.ok(DIFFICULTY_TO_NUM[rec.recommendedDifficulty] < DIFFICULTY_TO_NUM['hard']);
    });

    test('accelerating trend increases difficulty', () => {
        const base  = recommendDifficulty({ masteryScore: 0.50, trendType: 'stable' });
        const accel = recommendDifficulty({ masteryScore: 0.50, trendType: 'accelerating' });
        assert.ok(
            DIFFICULTY_TO_NUM[accel.recommendedDifficulty] >= DIFFICULTY_TO_NUM[base.recommendedDifficulty]
        );
    });
});

// ── Cognitive load ────────────────────────────────────────────────────────────
describe('cognitive load modifier', () => {
    test(`load > ${COGNITIVE_LOAD_THRESHOLD} reduces difficulty`, () => {
        const low  = recommendDifficulty({ masteryScore: 0.70, trendType: 'stable', cognitiveLoad: 1 });
        const high = recommendDifficulty({ masteryScore: 0.70, trendType: 'stable', cognitiveLoad: COGNITIVE_LOAD_THRESHOLD + 1 });
        assert.ok(
            DIFFICULTY_TO_NUM[high.recommendedDifficulty] <= DIFFICULTY_TO_NUM[low.recommendedDifficulty],
            `high load should be ≤ low load. got high=${high.recommendedDifficulty}, low=${low.recommendedDifficulty}`
        );
    });

    test(`load ≤ ${COGNITIVE_LOAD_THRESHOLD} → no load penalty`, () => {
        const rec = recommendDifficulty({ masteryScore: 0.70, trendType: 'stable', cognitiveLoad: COGNITIVE_LOAD_THRESHOLD });
        const trace = rec.decisionTrace.find(t => t.step === 'cognitive_load');
        assert.equal(trace.adjustment, 0);
    });
});

// ── Bounds clamping ───────────────────────────────────────────────────────────
describe('bounds clamping', () => {
    test('cannot go below easy', () => {
        // low mastery + declining + high load all push down
        const rec = recommendDifficulty({
            masteryScore:  0.05,
            trendType:     'declining',
            cognitiveLoad: 10,
        });
        assert.equal(rec.recommendedDifficulty, 'easy');
    });

    test('cannot go above challenge', () => {
        const rec = recommendDifficulty({
            masteryScore: 1.0,
            trendType:    'accelerating',
        });
        assert.equal(rec.recommendedDifficulty, 'challenge');
    });
});

// ── Decision trace structure ──────────────────────────────────────────────────
describe('decisionTrace structure', () => {
    test('trace has required steps', () => {
        const rec = recommendDifficulty({ masteryScore: 0.5, trendType: 'stable' });
        const steps = rec.decisionTrace.map(t => t.step);
        assert.ok(steps.includes('mastery_threshold'));
        assert.ok(steps.includes('trend_override'));
        assert.ok(steps.includes('cognitive_load'));
    });

    test('trace steps have reasoning field', () => {
        const rec = recommendDifficulty({ masteryScore: 0.5, trendType: 'declining' });
        for (const step of rec.decisionTrace) {
            assert.ok(typeof step.reasoning === 'string' && step.reasoning.length > 0);
        }
    });
});

// ── Inertia guard ─────────────────────────────────────────────────────────────
describe('inertia guard (low consistency)', () => {
    test('low consistency prevents ±1 oscillation', () => {
        // mastery=0.41 → medium, but prev=easy with consistency<0.4
        const rec = recommendDifficulty({
            masteryScore:    0.41,
            trendType:       'stable',
            prevDifficulty:  'easy',
            consistencyScore: 0.3,
        });
        // Should stay at easy due to inertia
        assert.equal(rec.recommendedDifficulty, 'easy', rec.explanation);
    });

    test('high consistency allows level change', () => {
        const rec = recommendDifficulty({
            masteryScore:    0.70,  // → hard
            trendType:       'stable',
            prevDifficulty:  'medium',
            consistencyScore: 0.8,  // no inertia
        });
        assert.equal(rec.recommendedDifficulty, 'hard');
    });
});

// ── Batch recommendations ─────────────────────────────────────────────────────
describe('recommendBatch', () => {
    test('returns recommendation for each topic', () => {
        const inputs = [
            { topic: 'Algebra',  masteryScore: 0.3,  trendType: 'stable' },
            { topic: 'Geometry', masteryScore: 0.7,  trendType: 'improving' },
            { topic: 'Calculus', masteryScore: 0.9,  trendType: 'stable' },
        ];
        const results = recommendBatch(inputs);
        assert.equal(results.length, 3);
        for (const r of results) {
            assert.ok(r.topic);
            assert.ok(r.recommendedDifficulty);
        }
    });

    test('returns [] for empty input', () => {
        assert.deepEqual(recommendBatch([]), []);
    });

    test('cognitive load = input array length', () => {
        const inputs = Array.from({ length: 5 }, (_, i) => ({
            topic: `Topic${i}`,
            masteryScore: 0.5,
            trendType: 'stable',
        }));
        const results = recommendBatch(inputs);
        for (const r of results) {
            assert.equal(r.inputCognitiveLoad, 5);
        }
    });
});
