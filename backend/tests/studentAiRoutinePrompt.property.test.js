/**
 * Property-Based Tests: buildRoutineTopicsSection (routine prompt builder)
 *
 * Property 5: Prompt non-regression
 *   - When weakTopicsPerSubject is non-empty, the constructed user prompt string
 *     always contains the "Weak Topics Per Subject" section header.
 *   - When it is empty or absent, the prompt still contains a valid fallback line
 *     and no empty/malformed section.
 *
 * **Validates: Design §Correctness Property 5, §Function 3 postconditions**
 */

const fc = require('fast-check');
const { buildRoutineTopicsSection } = require('../services/student-ai-service');

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A non-empty subject name string */
const subjectNameArb = fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,19}$/)
    .filter(s => s.trim().length > 1);

/** A topic name string */
const topicNameArb = fc
    .stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,29}$/)
    .filter(s => s.trim().length > 1);

/** A non-empty weakTopicsPerSubject map with at least one subject */
const nonEmptyWeakTopicsArb = fc
    .uniqueArray(subjectNameArb, { minLength: 1, maxLength: 5 })
    .chain(subjects =>
        fc
            .tuple(
                ...subjects.map(subj =>
                    fc.array(topicNameArb, { minLength: 0, maxLength: 4 }).map(topics => [subj, topics])
                )
            )
            .map(entries => Object.fromEntries(entries))
    );

/** An empty weakTopicsPerSubject map */
const emptyWeakTopicsArb = fc.constantFrom({}, null, undefined);

// ---------------------------------------------------------------------------
// Property 5a: Non-empty map → prompt contains the section header
// ---------------------------------------------------------------------------

describe('Property 5a — non-empty weakTopicsPerSubject produces section header', () => {
    /**
     * **Validates: Design §Correctness Property 5**
     *
     * When weakTopicsPerSubject has at least one entry, the returned string
     * must contain the exact heading "Weak Topics Per Subject".
     */
    test('prompt contains "Weak Topics Per Subject" header when map is non-empty', () => {
        fc.assert(
            fc.property(nonEmptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return section.includes('Weak Topics Per Subject');
            })
        );
    });

    /**
     * Each subject name from the input appears in the section output.
     */
    test('each subject name appears in the section output', () => {
        fc.assert(
            fc.property(nonEmptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return Object.keys(weakTopicsPerSubject).every(subj => section.includes(subj));
            })
        );
    });

    /**
     * Subjects with non-empty topic arrays have their topics listed (comma-separated).
     */
    test('subjects with topics list them comma-separated in the output', () => {
        fc.assert(
            fc.property(nonEmptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return Object.entries(weakTopicsPerSubject).every(([subj, topics]) => {
                    if (topics.length === 0) return true; // handled by next property
                    // Each topic should appear somewhere in the section
                    return topics.every(t => section.includes(t));
                });
            })
        );
    });

    /**
     * Subjects with empty topic arrays get the fallback message, not a blank entry.
     */
    test('subjects with empty topics array get the general revision fallback', () => {
        fc.assert(
            fc.property(nonEmptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return Object.entries(weakTopicsPerSubject).every(([subj, topics]) => {
                    if (topics.length > 0) return true;
                    // Must contain the per-subject fallback phrase
                    return section.includes('(no specific topics — use general revision)');
                });
            })
        );
    });

    /**
     * The section must not be empty or whitespace-only.
     */
    test('section is never empty or whitespace-only when map is non-empty', () => {
        fc.assert(
            fc.property(nonEmptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return section.trim().length > 0;
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Property 5b: Empty / absent map → graceful fallback, no malformed section
// ---------------------------------------------------------------------------

describe('Property 5b — empty or absent weakTopicsPerSubject produces graceful fallback', () => {
    /**
     * **Validates: Design §Correctness Property 5**
     *
     * When weakTopicsPerSubject is empty ({}), null, or undefined, the returned
     * string must still contain the section header and the fallback line.
     */
    test('prompt contains section header even when map is empty/absent', () => {
        fc.assert(
            fc.property(emptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return section.includes('Weak Topics Per Subject');
            })
        );
    });

    test('prompt contains fallback line when map is empty/absent', () => {
        fc.assert(
            fc.property(emptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return section.includes('None available — use subject-level revision');
            })
        );
    });

    /**
     * The fallback section must not be empty or whitespace-only.
     */
    test('fallback section is never empty or whitespace-only', () => {
        fc.assert(
            fc.property(emptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return section.trim().length > 0;
            })
        );
    });

    /**
     * The fallback section must NOT contain the per-subject fallback phrase
     * (that phrase is only for subjects with empty topic arrays, not for the
     * global empty-map case).
     */
    test('global fallback does not contain per-subject revision phrase', () => {
        fc.assert(
            fc.property(emptyWeakTopicsArb, weakTopicsPerSubject => {
                const section = buildRoutineTopicsSection(weakTopicsPerSubject);
                return !section.includes('(no specific topics — use general revision)');
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Determinism: same input always produces same output
// ---------------------------------------------------------------------------

describe('Determinism — same input always produces same output', () => {
    test('buildRoutineTopicsSection is a pure function', () => {
        fc.assert(
            fc.property(nonEmptyWeakTopicsArb, weakTopicsPerSubject => {
                const first = buildRoutineTopicsSection(weakTopicsPerSubject);
                const second = buildRoutineTopicsSection(weakTopicsPerSubject);
                return first === second;
            })
        );
    });
});
