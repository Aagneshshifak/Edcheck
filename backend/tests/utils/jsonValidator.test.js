const assert = require('assert');
const {
    parseRawJSON,
    validateAndRepair,
    validateLLMOutput
} = require('../../utils/jsonValidator');

describe('JSON Validator', () => {
    describe('parseRawJSON', () => {
        it('should parse valid JSON', () => {
            const result = parseRawJSON('{"key": "value"}');
            assert.deepStrictEqual(result, { key: 'value' });
        });

        it('should strip markdown code fences', () => {
            const raw = '```json\n{"key": "value"}\n```';
            const result = parseRawJSON(raw);
            assert.deepStrictEqual(result, { key: 'value' });
        });

        it('should extract JSON if wrapped in other text', () => {
            const raw = 'Here is the response:\n```\n{"key": "value"}\n```\nHope this helps!';
            const result = parseRawJSON(raw);
            assert.deepStrictEqual(result, { key: 'value' });
        });

        it('should throw SyntaxError on invalid JSON', () => {
            assert.throws(() => parseRawJSON('{key: value}'), SyntaxError);
        });
    });

    describe('validateAndRepair', () => {
        const testSchema = [
            { field: 'required_str', type: 'string', required: true, default: 'none' },
            { field: 'optional_num', type: 'number', required: false, default: 0 },
            { field: 'arr_val', type: 'array', required: true, default: [] }
        ];

        it('should pass valid data', () => {
            const parsed = { required_str: 'test', optional_num: 5, arr_val: [1, 2] };
            const { valid, repaired, errors } = validateAndRepair(parsed, testSchema);
            assert.strictEqual(valid, true);
            assert.strictEqual(errors.length, 0);
            assert.deepStrictEqual(repaired, parsed);
        });

        it('should coerce types if possible', () => {
            const parsed = { required_str: 123, optional_num: '42', arr_val: [] };
            const { valid, repaired, errors } = validateAndRepair(parsed, testSchema);
            assert.strictEqual(valid, true);
            assert.strictEqual(repaired.required_str, '123');
            assert.strictEqual(repaired.optional_num, 42);
            assert.strictEqual(errors.length, 1); // 1 coercion warning for string
        });

        it('should repair missing optional fields', () => {
            const parsed = { required_str: 'test', arr_val: [] }; // missing optional_num
            const { valid, repaired, errors } = validateAndRepair(parsed, testSchema);
            assert.strictEqual(valid, true);
            assert.strictEqual(repaired.optional_num, 0);
        });

        it('should mark invalid if required field is missing', () => {
            const parsed = { optional_num: 5, arr_val: [] }; // missing required_str
            const { valid, repaired, errors } = validateAndRepair(parsed, testSchema);
            assert.strictEqual(valid, false);
            assert.strictEqual(repaired.required_str, 'none'); // still repairs it
            assert.strictEqual(errors.some(e => e.includes('Missing required field')), true);
        });
    });

    describe('validateLLMOutput', () => {
        it('should validate and return success for correct study plan', () => {
            const raw = JSON.stringify({
                summary: "Good job",
                totalWeeks: 2,
                immediate_priorities: [],
                revisionOrder: []
            });
            const result = validateLLMOutput(raw, 'study_plan');
            assert.strictEqual(result.success, true);
            assert.strictEqual(result.needsRetry, false);
            assert.deepStrictEqual(result.data.summary, "Good job");
        });

        it('should indicate needsRetry for completely malformed JSON', () => {
            const result = validateLLMOutput('not json', 'study_plan');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.needsRetry, true);
        });

        it('should indicate needsRetry if required fields are missing', () => {
            const raw = JSON.stringify({
                totalWeeks: 2
                // missing summary, immediate_priorities, revisionOrder
            });
            const result = validateLLMOutput(raw, 'study_plan');
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.needsRetry, true); // repairable but invalid -> needs retry
            assert.strictEqual(result.data.summary, ""); // was repaired locally though
        });
    });
});
