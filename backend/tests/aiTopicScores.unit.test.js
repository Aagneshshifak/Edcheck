/**
 * Unit Tests: computeTopicScores
 *
 * Covers:
 * - All correct answers → 100%
 * - All wrong answers → 0%
 * - Mixed answers → correct percentage
 * - Unmatched questions → grouped under "General"
 * - Empty attempts → 0%
 */

// Mock groq config so the service module can be imported without a real GROQ_API_KEY
jest.mock('../config/groq', () => ({
    groq: { chat: { completions: { create: jest.fn() } } },
    GROQ_MODELS: { FAST: 'llama3-8b-8192', BALANCED: 'mixtral-8x7b-32768', POWERFUL: 'llama3-70b-8192' },
}));

const { computeTopicScores } = require('../services/ai-teaching-service');

// Helper to build a minimal test document
function makeTest(id, questions) {
    return { _id: id, questions };
}

// Helper to build a minimal attempt document
function makeAttempt(testId, answers) {
    return { testId, answers };
}

describe('computeTopicScores', () => {
    const subjectTopics = ['Photosynthesis', 'Cell Division'];

    describe('all correct answers → 100%', () => {
        test('single topic, all answers correct', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'What is Photosynthesis?', correctAnswer: 1 },
                    { questionText: 'Describe Photosynthesis process', correctAnswer: 2 },
                ]),
            ];
            const attempts = [
                makeAttempt('t1', [1, 2]),
            ];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['Photosynthesis'].scorePercent).toBe(100);
            expect(result['Photosynthesis'].correctCount).toBe(2);
            expect(result['Photosynthesis'].totalAttempts).toBe(2);
        });
    });

    describe('all wrong answers → 0%', () => {
        test('single topic, all answers wrong', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'What is Photosynthesis?', correctAnswer: 1 },
                    { questionText: 'Describe Photosynthesis process', correctAnswer: 2 },
                ]),
            ];
            const attempts = [
                makeAttempt('t1', [0, 0]),
            ];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['Photosynthesis'].scorePercent).toBe(0);
            expect(result['Photosynthesis'].correctCount).toBe(0);
            expect(result['Photosynthesis'].totalAttempts).toBe(2);
        });
    });

    describe('mixed answers → correct percentage', () => {
        test('2 correct out of 4 → 50%', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'Photosynthesis question 1', correctAnswer: 0 },
                    { questionText: 'Photosynthesis question 2', correctAnswer: 1 },
                    { questionText: 'Photosynthesis question 3', correctAnswer: 2 },
                    { questionText: 'Photosynthesis question 4', correctAnswer: 3 },
                ]),
            ];
            const attempts = [
                makeAttempt('t1', [0, 0, 2, 0]), // correct: q1, q3 → 2/4 = 50%
            ];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['Photosynthesis'].scorePercent).toBe(50);
            expect(result['Photosynthesis'].correctCount).toBe(2);
            expect(result['Photosynthesis'].totalAttempts).toBe(4);
        });

        test('multiple students, multiple topics', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'Photosynthesis basics', correctAnswer: 1 },
                    { questionText: 'Cell Division stages', correctAnswer: 2 },
                ]),
            ];
            const attempts = [
                makeAttempt('t1', [1, 0]), // student 1: photo correct, cell wrong
                makeAttempt('t1', [0, 2]), // student 2: photo wrong, cell correct
            ];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['Photosynthesis'].scorePercent).toBe(50);
            expect(result['Cell Division'].scorePercent).toBe(50);
        });
    });

    describe('unmatched questions → "General"', () => {
        test('question with no topic keyword goes to General', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'What is the capital of France?', correctAnswer: 0 },
                ]),
            ];
            const attempts = [
                makeAttempt('t1', [0]),
            ];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['General']).toBeDefined();
            expect(result['General'].totalQuestions).toBe(1);
            expect(result['General'].scorePercent).toBe(100);
        });

        test('mix of matched and unmatched questions', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'Photosynthesis in plants', correctAnswer: 1 },
                    { questionText: 'What is gravity?', correctAnswer: 0 },
                ]),
            ];
            const attempts = [
                makeAttempt('t1', [1, 0]),
            ];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['Photosynthesis'].totalQuestions).toBe(1);
            expect(result['General'].totalQuestions).toBe(1);
        });
    });

    describe('empty attempts → 0%', () => {
        test('no attempts at all → scorePercent is 0 for all topics', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'Photosynthesis question', correctAnswer: 1 },
                    { questionText: 'Cell Division question', correctAnswer: 0 },
                ]),
            ];
            const attempts = [];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['Photosynthesis'].scorePercent).toBe(0);
            expect(result['Photosynthesis'].totalAttempts).toBe(0);
            expect(result['Cell Division'].scorePercent).toBe(0);
            expect(result['Cell Division'].totalAttempts).toBe(0);
        });

        test('empty tests and attempts → empty map', () => {
            const result = computeTopicScores([], [], subjectTopics);
            expect(result).toEqual({});
        });
    });

    describe('totalQuestions count', () => {
        test('totalQuestions reflects matched question count across all tests', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'Photosynthesis q1', correctAnswer: 0 },
                    { questionText: 'Photosynthesis q2', correctAnswer: 1 },
                ]),
                makeTest('t2', [
                    { questionText: 'Photosynthesis q3', correctAnswer: 2 },
                ]),
            ];

            const result = computeTopicScores(tests, [], subjectTopics);

            expect(result['Photosynthesis'].totalQuestions).toBe(3);
        });
    });

    describe('edge cases', () => {
        test('empty subjectTopics → all questions go to General', () => {
            const tests = [
                makeTest('t1', [
                    { questionText: 'Any question here', correctAnswer: 0 },
                ]),
            ];
            const attempts = [makeAttempt('t1', [0])];

            const result = computeTopicScores(tests, attempts, []);

            expect(result['General']).toBeDefined();
            expect(result['General'].totalQuestions).toBe(1);
        });

        test('attempt references unknown testId → skipped gracefully', () => {
            const tests = [makeTest('t1', [{ questionText: 'Photosynthesis q', correctAnswer: 1 }])];
            const attempts = [makeAttempt('unknown-id', [1])];

            const result = computeTopicScores(tests, attempts, subjectTopics);

            expect(result['Photosynthesis'].totalAttempts).toBe(0);
        });
    });
});
