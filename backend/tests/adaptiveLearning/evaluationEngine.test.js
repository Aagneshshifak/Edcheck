/**
 * Unit tests for EvaluationEngine
 *
 * Run with: node --test tests/adaptiveLearning/evaluationEngine.test.js
 * Or via any test runner (Jest, Mocha, etc.)
 *
 * Tests cover:
 *   - MCQ correct/incorrect evaluation
 *   - True/False evaluation
 *   - Numerical evaluation with tolerance
 *   - Short answer Jaccard similarity grading
 *   - Skip detection
 *   - Aggregate metrics computation
 *   - Edge cases: empty arrays, null answers
 */

'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');

const {
    evaluateQuestion,
    computeAggregateMetrics,
    evaluateAttempt,
    jaccardSimilarity,
    NUMERICAL_TOLERANCE,
    SHORT_ANSWER_THRESHOLD,
} = require('../../services/adaptiveLearning/evaluationEngine');

// ── Shared question fixtures ──────────────────────────────────────────────────
const mcqQuestion = {
    questionText:  'What is 2 + 2?',
    questionType:  'mcq',
    topic:         'Arithmetic',
    difficulty:    'easy',
    marks:         1,
    correctAnswer: 2,
};

const tfQuestion = {
    questionText:  'The Earth is flat.',
    questionType:  'true_false',
    topic:         'Science',
    difficulty:    'easy',
    marks:         1,
    correctAnswer: 1, // 0=True, 1=False
};

const numericalQuestion = {
    questionText:  'What is π to 3 decimal places?',
    questionType:  'numerical',
    topic:         'Mathematics',
    difficulty:    'medium',
    marks:         2,
    correctAnswer: '3.14159',
};

const shortAnswerQuestion = {
    questionText:  'What is photosynthesis?',
    questionType:  'short_answer',
    topic:         'Biology',
    difficulty:    'hard',
    marks:         3,
    correctAnswer: 'process plants use sunlight water to produce food glucose',
};

// ── Jaccard similarity tests ──────────────────────────────────────────────────
describe('jaccardSimilarity', () => {
    test('identical strings → 1.0', () => {
        assert.equal(jaccardSimilarity('hello world', 'hello world'), 1);
    });

    test('completely different → 0.0', () => {
        assert.equal(jaccardSimilarity('alpha beta', 'gamma delta'), 0);
    });

    test('partial overlap', () => {
        const sim = jaccardSimilarity('plants use sunlight', 'sunlight helps plants grow');
        assert.ok(sim > 0 && sim < 1, `Expected partial overlap, got ${sim}`);
    });

    test('empty vs non-empty → 0', () => {
        assert.equal(jaccardSimilarity('', 'hello'), 0);
    });

    test('both empty → 1', () => {
        assert.equal(jaccardSimilarity('', ''), 1);
    });

    test('case insensitive', () => {
        const sim1 = jaccardSimilarity('Photosynthesis Process', 'photosynthesis process');
        assert.equal(sim1, 1);
    });
});

// ── MCQ evaluation ────────────────────────────────────────────────────────────
describe('evaluateQuestion — MCQ', () => {
    test('correct MCQ answer', () => {
        const result = evaluateQuestion(mcqQuestion, { studentAnswer: 2 }, 0);
        assert.equal(result.isCorrect, true);
        assert.equal(result.isSkipped, false);
        assert.equal(result.partialCredit, null);
        assert.ok(result.evaluationNotes.includes('Correct'));
    });

    test('incorrect MCQ answer', () => {
        const result = evaluateQuestion(mcqQuestion, { studentAnswer: 0 }, 0);
        assert.equal(result.isCorrect, false);
        assert.equal(result.isSkipped, false);
        assert.ok(result.evaluationNotes.includes('Incorrect'));
    });

    test('skipped MCQ (null answer)', () => {
        const result = evaluateQuestion(mcqQuestion, { studentAnswer: null }, 0);
        assert.equal(result.isSkipped, true);
        assert.equal(result.isCorrect, false);
    });

    test('skipped MCQ (undefined submission)', () => {
        const result = evaluateQuestion(mcqQuestion, {}, 0);
        assert.equal(result.isSkipped, true);
    });
});

// ── True/False evaluation ─────────────────────────────────────────────────────
describe('evaluateQuestion — True/False', () => {
    test('correct TF answer', () => {
        const result = evaluateQuestion(tfQuestion, { studentAnswer: 1 }, 0);
        assert.equal(result.isCorrect, true);
    });

    test('incorrect TF answer', () => {
        const result = evaluateQuestion(tfQuestion, { studentAnswer: 0 }, 0);
        assert.equal(result.isCorrect, false);
    });
});

// ── Numerical evaluation ──────────────────────────────────────────────────────
describe('evaluateQuestion — Numerical', () => {
    test('exact match', () => {
        const result = evaluateQuestion(numericalQuestion, { studentAnswer: '3.14159' }, 0);
        assert.equal(result.isCorrect, true);
    });

    test('within tolerance', () => {
        const result = evaluateQuestion(numericalQuestion, { studentAnswer: 3.14159 + NUMERICAL_TOLERANCE / 2 }, 0);
        assert.equal(result.isCorrect, true);
    });

    test('outside tolerance', () => {
        const result = evaluateQuestion(numericalQuestion, { studentAnswer: '3.2' }, 0);
        assert.equal(result.isCorrect, false);
    });

    test('non-numeric answer', () => {
        const result = evaluateQuestion(numericalQuestion, { studentAnswer: 'abc' }, 0);
        assert.equal(result.isCorrect, false);
        assert.ok(result.evaluationNotes.includes('Non-numeric'));
    });
});

// ── Short answer evaluation ───────────────────────────────────────────────────
describe('evaluateQuestion — Short Answer', () => {
    test('high-similarity answer accepted', () => {
        const result = evaluateQuestion(shortAnswerQuestion, {
            studentAnswer: 'plants use sunlight and water to produce food',
        }, 0);
        assert.ok(result.partialCredit !== null, 'partialCredit should be set');
        assert.ok(result.partialCredit > 0, 'partialCredit should be > 0');
    });

    test('very low similarity answer rejected', () => {
        const result = evaluateQuestion(shortAnswerQuestion, {
            studentAnswer: 'animals eat grass',
        }, 0);
        assert.equal(result.isCorrect, false);
        assert.ok(result.partialCredit < SHORT_ANSWER_THRESHOLD);
    });
});

// ── Response time, confidence, attempt count ──────────────────────────────────
describe('evaluateQuestion — metadata fields', () => {
    test('stores responseTimeMs', () => {
        const result = evaluateQuestion(mcqQuestion, { studentAnswer: 2, responseTimeMs: 5000 }, 0);
        assert.equal(result.responseTimeMs, 5000);
    });

    test('stores confidence (clamped)', () => {
        const result = evaluateQuestion(mcqQuestion, { studentAnswer: 2, confidence: 4 }, 0);
        assert.equal(result.confidence, 4);
    });

    test('confidence above 5 clamped to 5', () => {
        const result = evaluateQuestion(mcqQuestion, { studentAnswer: 2, confidence: 10 }, 0);
        assert.equal(result.confidence, 5);
    });

    test('stores attemptCount', () => {
        const result = evaluateQuestion(mcqQuestion, { studentAnswer: 2, attemptCount: 3 }, 0);
        assert.equal(result.attemptCount, 3);
    });
});

// ── Aggregate metrics ─────────────────────────────────────────────────────────
describe('computeAggregateMetrics', () => {
    const details = [
        { topic: 'Math', maxMarks: 1, isCorrect: true,  isSkipped: false, partialCredit: null, responseTimeMs: 5000, confidence: 4 },
        { topic: 'Math', maxMarks: 1, isCorrect: false, isSkipped: false, partialCredit: null, responseTimeMs: 3000, confidence: 3 },
        { topic: 'Bio',  maxMarks: 2, isCorrect: false, isSkipped: true,  partialCredit: null, responseTimeMs: 0,    confidence: null },
    ];

    const metrics = computeAggregateMetrics(details);

    test('totalQuestions = 3', () => assert.equal(metrics.totalQuestions, 3));
    test('answeredQuestions = 2', () => assert.equal(metrics.answeredQuestions, 2));
    test('skippedQuestions = 1', () => assert.equal(metrics.skippedQuestions, 1));
    test('correctCount = 1', () => assert.equal(metrics.correctCount, 1));
    test('incorrectCount = 1', () => assert.equal(metrics.incorrectCount, 1));
    test('rawScore = 1', () => assert.equal(metrics.rawScore, 1));
    test('maxScore = 4', () => assert.equal(metrics.maxScore, 4));
    test('accuracyRate = 0.5', () => assert.equal(metrics.accuracyRate, 0.5));
    test('avgResponseTimeMs = 4000', () => assert.equal(metrics.avgResponseTimeMs, 4000));
    test('avgConfidence = 3.5', () => assert.equal(metrics.avgConfidence, 3.5));
    test('completionRate', () => assert.ok(metrics.completionRate > 0 && metrics.completionRate < 1));

    test('topicBreakdown has Math and Bio', () => {
        assert.ok('Math' in metrics.topicBreakdown);
        assert.ok('Bio'  in metrics.topicBreakdown);
    });
});

// ── Full attempt evaluation ───────────────────────────────────────────────────
describe('evaluateAttempt', () => {
    test('evaluates a full attempt correctly', () => {
        const questions = [mcqQuestion, numericalQuestion, shortAnswerQuestion];
        const submissions = [
            { studentAnswer: 2,         responseTimeMs: 5000 },
            { studentAnswer: '3.14159', responseTimeMs: 8000 },
            { studentAnswer: null },  // skipped
        ];

        const { questionDetails, metrics } = evaluateAttempt({ questions, submissions });

        assert.equal(questionDetails.length, 3);
        assert.equal(questionDetails[0].isCorrect, true);
        assert.equal(questionDetails[1].isCorrect, true);
        assert.equal(questionDetails[2].isSkipped, true);
        assert.equal(metrics.totalQuestions, 3);
        assert.equal(metrics.skippedQuestions, 1);
    });

    test('throws on empty questions', () => {
        assert.throws(
            () => evaluateAttempt({ questions: [], submissions: [] }),
            /questions array/
        );
    });

    test('handles missing submissions gracefully', () => {
        const { questionDetails } = evaluateAttempt({
            questions:   [mcqQuestion],
            submissions: [],
        });
        assert.equal(questionDetails[0].isSkipped, true);
    });
});
