/**
 * Property-Based Test: Score Calculation
 *
 * Property 1: Score equals sum of marks for correctly answered questions
 * Validates: Requirements 5.2
 */

const fc = require("fast-check");
const { calculateScore } = require("../controllers/test-attempt-controller");

describe("calculateScore - Property 1", () => {
    /**
     * **Validates: Requirements 5.2**
     *
     * Property: calculateScore(questions, answers) === sum of q.marks where answers[i] === q.correctAnswer
     */
    test("score equals sum of marks for correctly answered questions", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        correctAnswer: fc.integer({ min: 0, max: 5 }),
                        marks: fc.integer({ min: 1, max: 10 }),
                    })
                ).chain((questions) =>
                    fc.tuple(
                        fc.constant(questions),
                        fc.array(fc.integer({ min: 0, max: 5 }), {
                            minLength: questions.length,
                            maxLength: questions.length,
                        })
                    )
                ),
                ([questions, answers]) => {
                    const expected = questions.reduce((sum, q, i) => {
                        return answers[i] === q.correctAnswer ? sum + q.marks : sum;
                    }, 0);

                    return calculateScore(questions, answers) === expected;
                }
            )
        );
    });
});
