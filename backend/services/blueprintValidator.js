/**
 * Blueprint Validator
 *
 * Validates assessment blueprints before question generation.
 * Ensures balanced topic coverage, valid difficulty distribution,
 * and achievable time allocation.
 *
 * Validation checks:
 *   1. Every selected subject has coverage
 *   2. Important topics have coverage
 *   3. Question count matches total
 *   4. Difficulty distribution is valid
 *   5. No topic exceeds allowed proportion
 *   6. Assessment is achievable within time limit
 *
 * If validation fails, identifies the invalid portion so only that
 * part needs regeneration.
 */

'use strict';

const { logger } = require('../utils/serverLogger');

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_TOPIC_PROPORTION       = 0.40;  // no single topic > 40% of questions
const MIN_QUESTIONS_PER_SUBJECT  = 1;
const AVG_MINUTES_PER_QUESTION   = 2;     // rough estimate for time validation
const VALID_DIFFICULTIES         = ['easy', 'medium', 'hard', 'challenge'];
const VALID_QUESTION_TYPES       = ['mcq', 'true_false', 'numerical', 'short_answer'];

/**
 * Validate an assessment blueprint.
 *
 * @param {Object} blueprint — parsed blueprint from LLM or manual construction
 * @param {Object} constraints — { totalQuestions, durationMinutes, requiredSubjects }
 * @returns {{ valid: boolean, errors: string[], warnings: string[], fixable: Object[] }}
 */
function validateBlueprint(blueprint, constraints = {}) {
    const errors   = [];
    const warnings = [];
    const fixable  = [];

    const {
        totalQuestions: expectedTotal,
        durationMinutes,
        requiredSubjects = [],
    } = constraints;

    const subjects = blueprint.subject_distribution || [];

    // ── 1. Check total question count ─────────────────────────────────────
    const actualTotal = subjects.reduce((sum, s) => sum + (s.question_count || 0), 0);
    if (expectedTotal && actualTotal !== expectedTotal) {
        errors.push(`Question count mismatch: expected ${expectedTotal}, got ${actualTotal}`);
        fixable.push({ type: 'question_count', expected: expectedTotal, actual: actualTotal });
    }

    // ── 2. Check every required subject has coverage ─────────────────────
    const coveredSubjects = new Set(subjects.map(s => s.subject?.toLowerCase()));
    for (const required of requiredSubjects) {
        if (!coveredSubjects.has(required.toLowerCase())) {
            errors.push(`Required subject "${required}" has no coverage`);
            fixable.push({ type: 'missing_subject', subject: required });
        }
    }

    // ── 3. Check each subject has at least minimum questions ─────────────
    for (const subj of subjects) {
        if ((subj.question_count || 0) < MIN_QUESTIONS_PER_SUBJECT) {
            warnings.push(`Subject "${subj.subject}" has fewer than ${MIN_QUESTIONS_PER_SUBJECT} questions`);
        }

        // ── 4. Check topic-level details ─────────────────────────────────
        const topics = subj.topics || [];
        const topicQuestionSum = topics.reduce((sum, t) => sum + (t.question_count || 0), 0);

        if (topicQuestionSum !== (subj.question_count || 0)) {
            warnings.push(`Subject "${subj.subject}": topic questions (${topicQuestionSum}) don't sum to subject total (${subj.question_count})`);
        }

        for (const topic of topics) {
            // Check topic proportion
            if (expectedTotal && topic.question_count > expectedTotal * MAX_TOPIC_PROPORTION) {
                warnings.push(`Topic "${topic.topic}" exceeds ${MAX_TOPIC_PROPORTION * 100}% of total (${topic.question_count}/${expectedTotal})`);
            }

            // Check difficulty distribution validity
            const diffDist = topic.difficulty_distribution || {};
            for (const diff of Object.keys(diffDist)) {
                if (!VALID_DIFFICULTIES.includes(diff)) {
                    errors.push(`Topic "${topic.topic}" has invalid difficulty: "${diff}"`);
                }
            }

            // Check question type distribution validity
            const typeDist = topic.question_type_distribution || {};
            for (const qType of Object.keys(typeDist)) {
                if (!VALID_QUESTION_TYPES.includes(qType)) {
                    errors.push(`Topic "${topic.topic}" has invalid question type: "${qType}"`);
                }
            }

            // Check difficulty counts match topic question count
            const diffTotal = Object.values(diffDist).reduce((a, b) => a + (b || 0), 0);
            if (diffTotal > 0 && diffTotal !== (topic.question_count || 0)) {
                warnings.push(`Topic "${topic.topic}": difficulty counts (${diffTotal}) don't match question count (${topic.question_count})`);
            }
        }
    }

    // ── 5. Check time feasibility ────────────────────────────────────────
    if (durationMinutes && actualTotal > 0) {
        const estimatedMinutes = actualTotal * AVG_MINUTES_PER_QUESTION;
        if (estimatedMinutes > durationMinutes * 1.2) {
            warnings.push(`Assessment may exceed time limit: ~${estimatedMinutes} min estimated for ${actualTotal} questions vs ${durationMinutes} min allowed`);
        }
    }

    // ── 6. Check for duplicate topics within a subject ───────────────────
    for (const subj of subjects) {
        const topicNames = (subj.topics || []).map(t => t.topic?.toLowerCase());
        const seen = new Set();
        for (const name of topicNames) {
            if (name && seen.has(name)) {
                errors.push(`Subject "${subj.subject}" has duplicate topic: "${name}"`);
            }
            seen.add(name);
        }
    }

    const valid = errors.length === 0;

    if (!valid) {
        logger.warn('BlueprintValidator: validation failed', {
            errorCount: errors.length,
            warningCount: warnings.length,
        });
    }

    return { valid, errors, warnings, fixable };
}

/**
 * Auto-fix a blueprint by adjusting question counts to match the expected total.
 * This is a simple proportional scaling — more sophisticated fixes can be added.
 *
 * @param {Object} blueprint — the blueprint to fix
 * @param {number} expectedTotal — target question count
 * @returns {Object} fixed blueprint
 */
function autoFixQuestionCounts(blueprint, expectedTotal) {
    const fixed = JSON.parse(JSON.stringify(blueprint)); // deep clone
    const subjects = fixed.subject_distribution || [];

    const currentTotal = subjects.reduce((sum, s) => sum + (s.question_count || 0), 0);
    if (currentTotal === 0 || currentTotal === expectedTotal) return fixed;

    const ratio = expectedTotal / currentTotal;

    let distributed = 0;
    for (let i = 0; i < subjects.length; i++) {
        const newCount = Math.max(1, Math.round((subjects[i].question_count || 0) * ratio));
        subjects[i].question_count = newCount;
        distributed += newCount;

        // Proportionally adjust topics
        const topics = subjects[i].topics || [];
        let topicDistributed = 0;
        for (let j = 0; j < topics.length; j++) {
            const topicNew = Math.max(1, Math.round((topics[j].question_count || 0) * ratio));
            topics[j].question_count = topicNew;
            topicDistributed += topicNew;
        }

        // Adjust last topic to match subject total
        if (topics.length > 0) {
            const diff = subjects[i].question_count - topicDistributed;
            topics[topics.length - 1].question_count += diff;
        }
    }

    // Adjust last subject to match expected total
    if (subjects.length > 0) {
        const diff = expectedTotal - distributed;
        subjects[subjects.length - 1].question_count += diff;
    }

    fixed.total_questions = expectedTotal;
    return fixed;
}

module.exports = {
    validateBlueprint,
    autoFixQuestionCounts,
    MAX_TOPIC_PROPORTION,
    MIN_QUESTIONS_PER_SUBJECT,
    VALID_DIFFICULTIES,
    VALID_QUESTION_TYPES,
};
