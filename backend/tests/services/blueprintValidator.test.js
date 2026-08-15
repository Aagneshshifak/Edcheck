const assert = require('assert');
const {
    validateBlueprint,
    autoFixQuestionCounts
} = require('../../services/blueprintValidator');

describe('Blueprint Validator', () => {
    describe('validateBlueprint', () => {
        it('should pass a valid blueprint', () => {
            const blueprint = {
                total_questions: 10,
                subject_distribution: [
                    {
                        subject: 'Math',
                        question_count: 10,
                        topics: [
                            {
                                topic: 'Algebra',
                                question_count: 4,
                                difficulty_distribution: { medium: 4 },
                                question_type_distribution: { mcq: 4 }
                            },
                            {
                                topic: 'Geometry',
                                question_count: 6,
                                difficulty_distribution: { medium: 6 },
                                question_type_distribution: { mcq: 6 }
                            }
                        ]
                    }
                ]
            };
            const result = validateBlueprint(blueprint, { totalQuestions: 10, durationMinutes: 30, requiredSubjects: ['Math'] });
            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.errors.length, 0);
            // Algebra is 40%, Geometry is 60%. Geometry exceeds 40% warning.
            assert.strictEqual(result.warnings.some(w => w.includes('exceeds 40%')), true);
        });

        it('should fail if total questions mismatch', () => {
            const blueprint = {
                total_questions: 10,
                subject_distribution: [
                    { subject: 'Math', question_count: 5 } // total is 5, but expected 10
                ]
            };
            const result = validateBlueprint(blueprint, { totalQuestions: 10 });
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.errors.some(e => e.includes('Question count mismatch')), true);
        });

        it('should fail if missing required subject', () => {
            const blueprint = {
                total_questions: 10,
                subject_distribution: [
                    { subject: 'Math', question_count: 10 }
                ]
            };
            const result = validateBlueprint(blueprint, { totalQuestions: 10, requiredSubjects: ['Science'] });
            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.errors.some(e => e.includes('Required subject "Science" has no coverage')), true);
        });

        it('should warn if time limit is exceeded', () => {
            const blueprint = {
                subject_distribution: [
                    { subject: 'Math', question_count: 50 } // 50 questions
                ]
            };
            // 50 questions * 2 min = 100 min. Expected 30 min.
            const result = validateBlueprint(blueprint, { totalQuestions: 50, durationMinutes: 30 });
            assert.strictEqual(result.valid, true); // time is a warning, not an error
            assert.strictEqual(result.warnings.some(w => w.includes('may exceed time limit')), true);
        });
    });

    describe('autoFixQuestionCounts', () => {
        it('should scale questions proportionally', () => {
            const blueprint = {
                subject_distribution: [
                    {
                        subject: 'Math',
                        question_count: 5,
                        topics: [{ topic: 'A', question_count: 5 }]
                    }
                ]
            };
            // Current total = 5. Target = 10.
            const fixed = autoFixQuestionCounts(blueprint, 10);
            assert.strictEqual(fixed.total_questions, 10);
            assert.strictEqual(fixed.subject_distribution[0].question_count, 10);
            assert.strictEqual(fixed.subject_distribution[0].topics[0].question_count, 10);
        });
    });
});
