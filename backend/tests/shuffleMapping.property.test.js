/**
 * Property-Based Test: Shuffle Index Mapping
 *
 * Property 2: Shuffled answer re-mapping is a bijection — no original index is lost or duplicated
 * Validates: Requirements 3.6
 */

const fc = require("fast-check");

/**
 * Fisher-Yates shuffle that also returns the permutation map.
 * @param {any[]} arr - Input array to shuffle
 * @returns {{ shuffled: any[], permMap: number[] }} shuffled array and permutation map
 *   where permMap[i] is the original index of the element now at position i
 */
function shuffleWithPermMap(arr) {
    const shuffled = [...arr];
    const permMap = arr.map((_, i) => i); // permMap[i] = original index

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // Swap elements
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        // Swap permutation map entries
        [permMap[i], permMap[j]] = [permMap[j], permMap[i]];
    }

    return { shuffled, permMap };
}

describe("shuffleWithPermMap - Property 2", () => {
    /**
     * **Validates: Requirements 3.6**
     *
     * Property: For any array of length N, the permMap returned by shuffleWithPermMap
     * is a bijection over [0..N-1], i.e., [...permMap].sort((a,b) => a-b) deep equals [0, 1, ..., N-1]
     */
    test("permMap is a bijection over [0..N-1]", () => {
        fc.assert(
            fc.property(
                fc.array(fc.anything(), { minLength: 1 }),
                (arr) => {
                    const N = arr.length;
                    const { permMap } = shuffleWithPermMap(arr);

                    // permMap must have the same length as the input
                    if (permMap.length !== N) return false;

                    // Sorted permMap must equal [0, 1, ..., N-1]
                    const sorted = [...permMap].sort((a, b) => a - b);
                    const expected = Array.from({ length: N }, (_, i) => i);

                    return sorted.every((val, idx) => val === expected[idx]);
                }
            )
        );
    });
});
