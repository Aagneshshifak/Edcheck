/**
 * Property-Based Tests: computeTopicScores
 *
 * Property 1: Score bounds — scorePercent always in [0, 100]
 *   Validates: Requirements 2.4
 *
 * Property 2: Monotonicity — adding a correct answer never decreases scorePercent
 *   Validates: Requirements 7.7
 *
 * Property 3: Idempotency — calling computeTopicScores twice on same data returns identical map
 *   Validates: Requirements 7.6
 *
 * Property 4: totalQuestions count invariant — totalQuestions equals matched question count
 *   Validates: Requirements 7.8
 */

// Mock groq config so the service module can be imported without a real GROQ_API_KEY
jest.mock('../config/groq', () => ({
    groq: { chat: { completions: { create: jest.fn() } } },
    GROQ_MODELS: { FAST: 'llama3-8b-8192', BALANCED: 'mixtral-8x7b-32768', POWERFUL: 'llama3-70b-8192' },
}));

const fc = require('fast-check');
const { computeTopicScores } = require('../services/ai-teaching-service');

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A non-empty alphanumeric topic string */
const topicArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,19}$/).filter(s => s.trim().length > 1);

/** An array of 1–5 distinct topic strings */
const subjectTopicsArb = fc.uniqueArray(topicArb, { minLength: 1, maxLength: 5 });

/**
 * Build a question whose text contains a keyword from one of the provided topics,
 * so we get deterministic topic assignment.
 */
function questionArb(topics) {
    return fc.record({
        questionText: fc.oneof(
            // matched question: embed the first word of a random topic
            fc.constantFrom(...topics).map(t => `${t.split(' ')[0]} related question`),
            // unmatched question: text that won't contain any topic word
            fc.constant('What is the capital of France?')
        ),
        correctAnswer: fc.integer({ min: 0, max: 3 }),
    });
}

/** A test document with 1–5 questions */
function testDocArb(topics) {
    return fc.record({
        _id: fc.uuid(),
        questions: fc.array(questionArb(topics), { minLength: 1, maxLength: 5 }),
    });
}

/** An attempt whose answers array length matches the test's question count */
function attemptArb(test) {
    return fc.record({
        testId: fc.constant(test._id),
        answers: fc.array(fc.integer({ min: 0, max: 3 }), {
            minLength: test.questions.length,
            maxLength: test.questions.length,
        }),
    });
}

/**
 * Generates { tests, attempts, subjectTopics } where every attempt references
 * a valid test in the tests array.
 */
const scenarioArb = subjectTopicsArb.chain(topics =>
    fc.array(testDocArb(topics), { minLength: 1, maxLength: 4 }).chain(tests =>
        fc.array(
            fc.oneof(...tests.map(t => attemptArb(t))),
            { minLength: 0, maxLength: 8 }
        ).map(attempts => ({ tests, attempts, subjectTopics: topics }))
    )
);

// ---------------------------------------------------------------------------
// Property 1: Score bounds
// ---------------------------------------------------------------------------

describe('Property 1 — score bounds', () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * For any valid tests/attempts/topics, every scorePercent in the returned
     * TopicScoreMap must be in the closed interval [0, 100].
     */
    test('scorePercent is always in [0, 100]', () => {
        fc.assert(
            fc.property(scenarioArb, ({ tests, attempts, subjectTopics }) => {
                const result = computeTopicScores(tests, attempts, subjectTopics);
                return Object.values(result).every(
                    entry => entry.scorePercent >= 0 && entry.scorePercent <= 100
                );
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Property 2: Monotonicity
// ---------------------------------------------------------------------------

describe('Property 2 — monotonicity', () => {
    /**
     * **Validates: Requirements 7.7**
     *
     * Adding one more attempt where every answer is correct must not decrease
     * the scorePercent for any topic.
     */
    test('adding a fully-correct attempt never decreases scorePercent', () => {
        fc.assert(
            fc.property(scenarioArb, ({ tests, attempts, subjectTopics }) => {
                const before = computeTopicScores(tests, attempts, subjectTopics);

                // Pick the first test and build an all-correct attempt for it
                const targetTest = tests[0];
                const allCorrectAnswers = targetTest.questions.map(q => q.correctAnswer);
                const extraAttempt = { testId: targetTest._id, answers: allCorrectAnswers };

                const after = computeTopicScores(
                    tests,
                    [...attempts, extraAttempt],
                    subjectTopics
                );

                // Every topic that existed before must not have decreased
                return Object.keys(before).every(topic => {
                    const scoreBefore = before[topic].scorePercent;
                    const scoreAfter = (after[topic] || { scorePercent: 0 }).scorePercent;
                    // Allow a tiny floating-point tolerance
                    return scoreAfter >= scoreBefore - 1e-9;
                });
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Property 3: Idempotency
// ---------------------------------------------------------------------------

describe('Property 3 — idempotency', () => {
    /**
     * **Validates: Requirements 7.6**
     *
     * Calling computeTopicScores twice with identical inputs must return
     * structurally identical TopicScoreMaps.
     */
    test('two calls with the same data return identical maps', () => {
        fc.assert(
            fc.property(scenarioArb, ({ tests, attempts, subjectTopics }) => {
                const first = computeTopicScores(tests, attempts, subjectTopics);
                const second = computeTopicScores(tests, attempts, subjectTopics);
                return JSON.stringify(first) === JSON.stringify(second);
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Property 4: totalQuestions count invariant
// ---------------------------------------------------------------------------

describe('Property 4 — totalQuestions count invariant', () => {
    /**
     * **Validates: Requirements 7.8**
     *
     * For each topic in the result, totalQuestions must equal the number of
     * questions across all tests whose text was matched to that topic.
     */
    test('totalQuestions equals the count of questions matched to that topic', () => {
        fc.assert(
            fc.property(scenarioArb, ({ tests, attempts, subjectTopics }) => {
                const result = computeTopicScores(tests, attempts, subjectTopics);

                // Replicate the keyword-matching logic to compute expected counts
                function assignTopic(questionText, topics) {
                    if (!questionText || !topics || topics.length === 0) return 'General';
                    const lower = questionText.toLowerCase();
                    for (const topic of topics) {
                        if (!topic) continue;
                        const words = topic.toLowerCase().split(/\s+/).filter(Boolean);
                        for (const word of words) {
                            if (lower.includes(word)) return topic;
                        }
                    }
                    return 'General';
                }

                const expectedCounts = {};
                for (const test of tests) {
                    for (const q of test.questions || []) {
                        const topic = assignTopic(q.questionText, subjectTopics);
                        expectedCounts[topic] = (expectedCounts[topic] || 0) + 1;
                    }
                }

                return Object.keys(result).every(
                    topic => result[topic].totalQuestions === (expectedCounts[topic] || 0)
                );
            })
        );
    });
});
