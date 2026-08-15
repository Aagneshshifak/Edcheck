const assert = require('assert');
const { getJaccardSimilarity } = require('../../services/assessmentGenerator');

describe('Assessment Generator Service Helpers', () => {
    describe('getJaccardSimilarity', () => {
        it('should return 1 for identical strings', () => {
            const sim = getJaccardSimilarity('Hello world test', 'hello world test');
            assert.strictEqual(sim, 1);
        });

        it('should return 0 for completely different strings', () => {
            const sim = getJaccardSimilarity('Apple banana orange', 'cat dog bird');
            assert.strictEqual(sim, 0);
        });

        it('should return correct ratio for partial overlap', () => {
            // s1 = {hello, world}, s2 = {hello, there}
            // intersection = {hello} (size 1)
            // union = {hello, world, there} (size 3)
            // ratio = 1/3 = 0.333...
            const sim = getJaccardSimilarity('hello world', 'hello there');
            assert.ok(Math.abs(sim - 0.333) < 0.01);
        });
    });
});
