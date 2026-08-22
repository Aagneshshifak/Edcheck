'use strict';

const AIQuestionBank = require('../models/aiQuestionBankSchema');
const { logger } = require('../utils/serverLogger');

/**
 * Computes Jaccard Similarity between two strings.
 */
function getJaccardSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = new Set(str1.toLowerCase().split(/\s+/).filter(Boolean));
    const s2 = new Set(str2.toLowerCase().split(/\s+/).filter(Boolean));
    const intersection = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Checks if a question is a duplicate within a list of existing questions.
 */
function isDuplicate(newQuestion, existingQuestions, threshold = 0.85) {
    for (const eq of existingQuestions) {
        if (getJaccardSimilarity(newQuestion.questionText, eq.questionText) > threshold) {
            return true;
        }
    }
    return false;
}

/**
 * Validates the final test structure, checking coverage against the blueprint
 * and ensuring no internal duplicates exist.
 * 
 * @param {Object} blueprint - The original generated blueprint
 * @param {Array} validatedQuestions - Array of questions that passed QuestionValidator
 * @param {Number} totalRequiredQuestions - Total questions expected in the test
 * @returns {Object} validation metadata and boolean result
 */
async function validateTestCoverageAndDuplicates(blueprint, validatedQuestions, totalRequiredQuestions) {
    const meta = {
        validQuestions: 0,
        invalidQuestions: 0,
        duplicates: 0,
        topicsCovered: 0,
        topicsRequired: 0,
        coverageComplete: false
    };

    // 1. Count valid/invalid and find internal duplicates
    const finalUniqueQuestions = [];
    for (const q of validatedQuestions) {
        if (q.validationStatus !== 'VALID') {
            meta.invalidQuestions++;
            continue;
        }

        if (isDuplicate(q, finalUniqueQuestions, 0.85)) {
            meta.duplicates++;
            q.validationStatus = 'INVALID';
            q.validationDetails = { reason: 'Duplicate of another question in this test', issues: [] };
            meta.invalidQuestions++;
        } else {
            finalUniqueQuestions.push(q);
            meta.validQuestions++;
        }
    }

    // 2. Validate Topic Coverage against Blueprint
    const requiredTopics = new Map(); // key: subject_topic, val: count
    
    if (blueprint && Array.isArray(blueprint.subject_distribution)) {
        for (const subj of blueprint.subject_distribution) {
            for (const tConfig of (subj.topics || [])) {
                if (tConfig.question_count > 0) {
                    const key = `${subj.subject}_${tConfig.topic}`.toLowerCase();
                    requiredTopics.set(key, tConfig.question_count);
                    meta.topicsRequired++;
                }
            }
        }
    }

    // Tally up what we actually have
    const actualCoverage = new Map();
    for (const q of finalUniqueQuestions) {
        // q.curriculumMeta.domain/chapter or just topic fallback
        const subjName = q.curriculumMeta?.domain || q.curriculumMeta?.subjectId || 'unknown';
        const topicName = q.curriculumMeta?.chapter || q.topic || 'unknown';
        
        const key = `${subjName}_${topicName}`.toLowerCase();
        actualCoverage.set(key, (actualCoverage.get(key) || 0) + 1);
    }

    // Verify all required topics are covered
    let coverageMet = true;
    for (const [key, requiredCount] of requiredTopics.entries()) {
        const actualCount = actualCoverage.get(key) || 0;
        if (actualCount > 0) {
            meta.topicsCovered++;
        }
        if (actualCount < requiredCount) {
            coverageMet = false;
            logger.warn(`TestCoverageValidator: Missing coverage for ${key}. Expected ${requiredCount}, got ${actualCount}`);
        }
    }

    meta.coverageComplete = coverageMet && (meta.topicsRequired > 0 || !blueprint);

    const isFullyValid = (
        meta.invalidQuestions === 0 &&
        meta.duplicates === 0 &&
        meta.validQuestions === totalRequiredQuestions &&
        meta.coverageComplete
    );

    return {
        isTestValid: isFullyValid,
        meta,
        finalQuestions: validatedQuestions // Includes the mutated duplicates marked as INVALID
    };
}

module.exports = {
    getJaccardSimilarity,
    isDuplicate,
    validateTestCoverageAndDuplicates
};
