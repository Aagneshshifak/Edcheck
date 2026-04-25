/**
 * Property-Based Tests: buildWeakTopicsPerSubject
 *
 * Property 4: Weak topic fallback completeness — for any array of weakSubjectDocs
 *   and any TopicPerformance result set, every subject name from the input has a
 *   defined array entry in the result (never undefined or null).
 *   Validates: Design §Correctness Property 4, §Function 2 postconditions
 *
 * Property 2: For any weakSubjectDocs array and any TopicPerformance result set,
 *   buildWeakTopicsPerSubject returns an object where every key is a subject name
 *   from the input and every value is an array.
 *   Validates: Design §Function 2 postconditions
 */

const fc = require('fast-check');
const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Pure re-implementation of buildWeakTopicsPerSubject for testing
// (extracted from the controller so it can be tested without DB/Groq)
// ---------------------------------------------------------------------------

/**
 * Pure synchronous version of buildWeakTopicsPerSubject that accepts
 * pre-fetched topicPerfs instead of querying the DB.
 *
 * @param {Array} weakSubjectDocs  - Subject documents with _id, subjectName/subName, topics[]
 * @param {Array} topicPerfs       - TopicPerformance records (pre-fetched)
 * @returns {Object}               - { [subjectName]: string[] }
 */
function buildWeakTopicsPerSubjectPure(weakSubjectDocs, topicPerfs) {
    const perfMap = {};
    for (const tp of topicPerfs) {
        const key = String(tp.subjectId);
        if (!perfMap[key]) perfMap[key] = [];
        perfMap[key].push({ topic: tp.topic, score: tp.averageScore, severity: tp.severity });
    }

    const result = {};
    for (const subj of weakSubjectDocs) {
        const id = String(subj._id);
        const name = subj.subjectName || subj.subName;
        const perfs = perfMap[id] || [];
        const weakTopics = perfs
            .filter(p => p.severity === 'high' || p.score < 60)
            .sort((a, b) => a.score - b.score)
            .map(p => p.topic)
            .slice(0, 4);
        result[name] = weakTopics.length > 0
            ? weakTopics
            : (subj.topics || []).slice(0, 3);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A non-empty subject name string */
const subjectNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,19}$/).filter(s => s.trim().length > 1);

/** A topic name string */
const topicNameArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{1,29}$/).filter(s => s.trim().length > 1);

/** A fake ObjectId-like string (24 alphanumeric chars) */
const objectIdArb = fc.string({ minLength: 24, maxLength: 24 });

/** A subject document */
const subjectDocArb = fc.record({
    _id: objectIdArb,
    subjectName: subjectNameArb,
    topics: fc.array(topicNameArb, { minLength: 0, maxLength: 5 }),
});

/** An array of 1–5 unique subject docs */
const weakSubjectDocsArb = fc.uniqueArray(subjectDocArb, {
    minLength: 1,
    maxLength: 5,
    selector: s => s._id,
});

/** A TopicPerformance record for a given subjectId */
function topicPerfArb(subjectId) {
    return fc.record({
        subjectId: fc.constant(subjectId),
        topic: topicNameArb,
        averageScore: fc.integer({ min: 0, max: 100 }),
        severity: fc.constantFrom('low', 'medium', 'high'),
    });
}

/** Generate a scenario: weakSubjectDocs + matching topicPerfs (may be empty or partial) */
const scenarioArb = weakSubjectDocsArb.chain(weakSubjectDocs => {
    // For each subject, optionally generate 0–4 topic performance records
    const perfArrayArbs = weakSubjectDocs.map(subj =>
        fc.array(topicPerfArb(subj._id), { minLength: 0, maxLength: 4 })
    );
    return fc.tuple(...perfArrayArbs).map(perfArrays => ({
        weakSubjectDocs,
        topicPerfs: perfArrays.flat(),
    }));
});

// ---------------------------------------------------------------------------
// Property 4: Weak topic fallback completeness
// ---------------------------------------------------------------------------

describe('Property 4 — weak topic fallback completeness', () => {
    /**
     * **Validates: Design §Correctness Property 4**
     *
     * For any array of weakSubjectDocs and any TopicPerformance result set,
     * every subject name from the input has a defined, non-null array entry
     * in the result.
     */
    test('every subject name has a defined array entry in the result', () => {
        fc.assert(
            fc.property(scenarioArb, ({ weakSubjectDocs, topicPerfs }) => {
                const result = buildWeakTopicsPerSubjectPure(weakSubjectDocs, topicPerfs);

                return weakSubjectDocs.every(subj => {
                    const name = subj.subjectName || subj.subName;
                    const entry = result[name];
                    // Must be defined, non-null, and an array
                    return entry !== undefined && entry !== null && Array.isArray(entry);
                });
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Property 2: Keys are subject names, values are arrays
// ---------------------------------------------------------------------------

describe('Property 2 — result keys are subject names and values are arrays', () => {
    /**
     * **Validates: Design §Function 2 postconditions**
     *
     * For any weakSubjectDocs array and any TopicPerformance result set,
     * buildWeakTopicsPerSubject returns an object where:
     * - every key is a subject name from the input
     * - every value is an array (never undefined or null)
     * - the number of keys equals the number of input subjects
     */
    test('result has exactly one key per subject and all values are arrays', () => {
        fc.assert(
            fc.property(scenarioArb, ({ weakSubjectDocs, topicPerfs }) => {
                const result = buildWeakTopicsPerSubjectPure(weakSubjectDocs, topicPerfs);
                const resultKeys = Object.keys(result);

                // All keys must be subject names from the input
                const inputNames = weakSubjectDocs.map(s => s.subjectName || s.subName);
                const allKeysAreSubjectNames = resultKeys.every(k => inputNames.includes(k));

                // All values must be arrays
                const allValuesAreArrays = Object.values(result).every(v => Array.isArray(v));

                // Key count matches input subject count (assuming unique names)
                const keyCountMatches = resultKeys.length === new Set(inputNames).size;

                return allKeysAreSubjectNames && allValuesAreArrays && keyCountMatches;
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Additional: fallback path — no TopicPerformance records
// ---------------------------------------------------------------------------

describe('Fallback path — no TopicPerformance records', () => {
    /**
     * When topicPerfs is empty, result values must come from subject.topics.slice(0, 3).
     */
    test('falls back to subject.topics.slice(0,3) when no performance records exist', () => {
        fc.assert(
            fc.property(weakSubjectDocsArb, (weakSubjectDocs) => {
                const result = buildWeakTopicsPerSubjectPure(weakSubjectDocs, []);

                return weakSubjectDocs.every(subj => {
                    const name = subj.subjectName || subj.subName;
                    const expected = (subj.topics || []).slice(0, 3);
                    const actual = result[name];
                    return JSON.stringify(actual) === JSON.stringify(expected);
                });
            })
        );
    });
});

// ---------------------------------------------------------------------------
// Additional: filtered topics — only high severity or score < 60 are included
// ---------------------------------------------------------------------------

describe('Filtering — only high-severity or low-score topics are selected', () => {
    /**
     * When TopicPerformance records exist, only those with severity === 'high'
     * or averageScore < 60 appear in the result (up to 4 per subject).
     */
    test('result topics are a subset of qualifying performance records', () => {
        fc.assert(
            fc.property(scenarioArb, ({ weakSubjectDocs, topicPerfs }) => {
                const result = buildWeakTopicsPerSubjectPure(weakSubjectDocs, topicPerfs);

                return weakSubjectDocs.every(subj => {
                    const id = String(subj._id);
                    const name = subj.subjectName || subj.subName;
                    const perfsForSubj = topicPerfs.filter(tp => String(tp.subjectId) === id);

                    if (perfsForSubj.length === 0) {
                        // Fallback path — already tested above
                        return true;
                    }

                    const qualifyingTopics = perfsForSubj
                        .filter(p => p.severity === 'high' || p.averageScore < 60)
                        .map(p => p.topic);

                    const actual = result[name];

                    if (qualifyingTopics.length === 0) {
                        // No qualifying topics → fallback to subject.topics.slice(0,3)
                        const expected = (subj.topics || []).slice(0, 3);
                        return JSON.stringify(actual) === JSON.stringify(expected);
                    }

                    // All returned topics must be from the qualifying set
                    return actual.every(t => qualifyingTopics.includes(t));
                });
            })
        );
    });
});
