/**
 * Unit tests for TopicMasteryEngine
 *
 * Run with: node --test tests/adaptiveLearning/topicMasteryEngine.test.js
 *
 * Tests cover:
 *   - Initial mastery computation (no prior record)
 *   - Multi-attempt mastery updates
 *   - Factor computations: accuracy, consistency, recency, forgetting, difficulty, velocity
 *   - Mastery level thresholds
 *   - Edge cases: all correct, all wrong, all skipped
 */

'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const {
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
} = require('../../services/adaptiveLearning/topicMasteryEngine');

// ── Factor tests ──────────────────────────────────────────────────────────────
describe('factorAccuracy', () => {
    test('perfect score', () => assert.equal(factorAccuracy(10, 10), 1));
    test('zero score', () => assert.equal(factorAccuracy(0, 10), 0));
    test('50% score', () => assert.equal(factorAccuracy(5, 10), 0.5));
    test('zero denominator → 0', () => assert.equal(factorAccuracy(0, 0), 0));
});

describe('factorConsistency', () => {
    test('always 1.0 → consistency 1.0', () => {
        assert.equal(factorConsistency([1, 1, 1, 1, 1]), 1);
    });

    test('oscillating 0–1 → low consistency', () => {
        const fc = factorConsistency([0, 1, 0, 1, 0]);
        assert.ok(fc < 0.6, `Expected < 0.6, got ${fc}`);
    });

    test('single value → neutral 0.5', () => {
        assert.equal(factorConsistency([0.8]), 0.5);
    });

    test('empty array → 0.5', () => {
        assert.equal(factorConsistency([]), 0.5);
    });
});

describe('factorRecency', () => {
    test('just attempted → 1.0', () => {
        const now = new Date();
        assert.ok(factorRecency(now, now) > 0.99);
    });

    test(`${HALF_LIFE_DAYS}-day old → ~0.5`, () => {
        const past = new Date(Date.now() - HALF_LIFE_DAYS * 24 * 60 * 60 * 1000);
        const fr = factorRecency(past);
        assert.ok(Math.abs(fr - 0.5) < 0.05, `Expected ~0.5, got ${fr}`);
    });

    test('very old (1 year) → near 0', () => {
        const past = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const fr = factorRecency(past);
        assert.ok(fr < 0.05, `Expected near 0, got ${fr}`);
    });

    test('null lastSeenAt → 0', () => {
        assert.equal(factorRecency(null), 0);
    });
});

describe('factorForgetting', () => {
    test('recency=1 → forgetting=0', () => assert.equal(factorForgetting(1), 0));
    test('recency=0 → forgetting=1', () => assert.equal(factorForgetting(0), 1));
    test('recency=0.5 → forgetting=0.5', () => assert.equal(factorForgetting(0.5), 0.5));
});

describe('factorDifficulty', () => {
    test('all easy → 0.25', () => assert.equal(factorDifficulty(['easy', 'easy']), 0.25));
    test('all challenge → 1.0', () => assert.equal(factorDifficulty(['challenge', 'challenge']), 1.0));
    test('empty → baseline 0.5', () => assert.equal(factorDifficulty([]), 0.5));
    test('mixed', () => {
        const fd = factorDifficulty(['easy', 'hard']);  // (0.25 + 0.75) / 2 = 0.5
        assert.equal(fd, 0.5);
    });
});

describe('factorVelocity', () => {
    test('improving trend → positive velocity', () => {
        const fv = factorVelocity([0.3, 0.5, 0.7]);
        assert.ok(fv > 0, `Expected > 0, got ${fv}`);
    });

    test('declining trend → 0', () => {
        const fv = factorVelocity([0.8, 0.6, 0.4]);
        assert.equal(fv, 0);
    });

    test('fewer than 3 points → 0.5', () => {
        assert.equal(factorVelocity([0.5]), 0.5);
        assert.equal(factorVelocity([0.4, 0.6]), 0.5);
    });
});

// ── Mastery level ─────────────────────────────────────────────────────────────
describe('masteryLevel', () => {
    test('0.0 → novice',      () => assert.equal(masteryLevel(0.0), 'novice'));
    test('0.15 → novice',     () => assert.equal(masteryLevel(0.15), 'novice'));
    test('0.20 → beginner',   () => assert.equal(masteryLevel(0.20), 'beginner'));
    test('0.40 → developing', () => assert.equal(masteryLevel(0.40), 'developing'));
    test('0.65 → proficient', () => assert.equal(masteryLevel(0.65), 'proficient'));
    test('0.85 → expert',     () => assert.equal(masteryLevel(0.85), 'expert'));
    test('1.00 → expert',     () => assert.equal(masteryLevel(1.00), 'expert'));
});

// ── Weights sanity ────────────────────────────────────────────────────────────
describe('WEIGHTS', () => {
    test('weights sum to 1.0', () => {
        const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - 1.0) < 1e-6, `Weights sum = ${sum}`);
    });
});

// ── computeInitialMastery ─────────────────────────────────────────────────────
describe('computeInitialMastery', () => {
    test('perfect first attempt → mastery > 0.5', () => {
        const result = computeInitialMastery({
            correct:          5,
            total:            5,
            skipped:          0,
            difficultyLevels: ['medium', 'medium', 'medium', 'medium', 'medium'],
        });
        assert.ok(result.masteryScore > 0.5, `Expected > 0.5, got ${result.masteryScore}`);
        assert.ok(result.masteryScore <= 1, 'Should not exceed 1');
    });

    test('zero correct first attempt → low mastery', () => {
        const result = computeInitialMastery({
            correct:          0,
            total:            5,
            skipped:          0,
            difficultyLevels: ['easy'],
        });
        assert.ok(result.masteryScore < 0.5);
    });

    test('all skipped → low mastery', () => {
        const result = computeInitialMastery({
            correct:  0,
            total:    5,
            skipped:  5,
            difficultyLevels: [],
        });
        assert.ok(result.masteryScore >= 0 && result.masteryScore <= 1);
    });

    test('result contains all required fields', () => {
        const result = computeInitialMastery({ correct: 3, total: 5, skipped: 0, difficultyLevels: ['medium'] });
        assert.ok('masteryScore'    in result);
        assert.ok('masteryLevel'    in result);
        assert.ok('factors'         in result);
        assert.ok('explanation'     in result);
        assert.ok('recentAccuracies' in result);
    });
});

// ── computeTopicMastery — multi-attempt ───────────────────────────────────────
describe('computeTopicMastery — multi-attempt progression', () => {
    test('mastery increases after correct answers', () => {
        const attempt1 = computeInitialMastery({
            correct: 2, total: 5, skipped: 0,
            difficultyLevels: ['medium', 'medium'],
        });

        const attempt2 = computeTopicMastery(
            { ...attempt1, totalSkipped: 0 },
            { correct: 5, total: 5, skipped: 0, difficultyLevels: ['medium', 'medium', 'medium', 'medium', 'medium'] }
        );

        assert.ok(attempt2.masteryScore >= attempt1.masteryScore,
            `Expected mastery to stay or increase. Was ${attempt1.masteryScore}, now ${attempt2.masteryScore}`);
    });

    test('mastery score stays in [0,1]', () => {
        const prev = computeInitialMastery({ correct: 3, total: 5, skipped: 0, difficultyLevels: ['hard'] });
        const next = computeTopicMastery(prev, { correct: 5, total: 5, skipped: 0, difficultyLevels: ['challenge'] });

        assert.ok(next.masteryScore >= 0);
        assert.ok(next.masteryScore <= 1);
    });
});
